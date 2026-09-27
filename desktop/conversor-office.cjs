const path = require("node:path");
const fsp = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");

/**
 * PowerPoint desenhado por quem sabe desenhá-lo.
 *
 * O leitor próprio do Lúmen (pptx.cjs) tira de cada slide só o texto e a
 * imagem principal: posição das caixas, fontes, cores e formas se perdiam,
 * e a igreja via a apresentação "totalmente desconfigurada". Quem desenha
 * um .pptx igual ao PowerPoint é o PowerPoint — ou o LibreOffice, gratuito
 * e praticamente igual. Aqui se usa o que o computador tiver, nessa ordem,
 * e o que sai é um PDF: dali em diante é o caminho do PDF, que o pdf.js
 * desenha página por página, idêntico ao original. Animação e transição
 * não atravessam: viram o slide já montado.
 *
 * Os caminhos chegam aqui montados pelo processo principal
 * (apresentacoes.cjs), presos às pastas do app. O script do PowerPoint é
 * fixo e recebe os caminhos por variável de ambiente — nada do nome do
 * arquivo vira código.
 */

/** O que o PowerPoint e o LibreOffice abrem; .ppsx e .pps são o mesmo formato, salvo para abrir já em apresentação. */
const EXTENSOES = new Set([".pptx", ".ppsx", ".ppt", ".pps", ".odp"]);
/** Apresentação com fotos grandes leva tempo; culto parado esperando, não. */
const TEMPO_MAXIMO_MS = 3 * 60 * 1000;

const LOCAIS_DO_LIBREOFFICE = [
  path.join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
];

function rodar(programa, args, opcoes = {}) {
  return new Promise((resolve) => {
    execFile(programa, args, { windowsHide: true, ...opcoes }, (erro, saida) =>
      resolve({ erro, saida: String(saida || "") }),
    );
  });
}

async function arquivoExiste(caminho) {
  try {
    return (await fsp.stat(caminho)).isFile();
  } catch {
    return false;
  }
}

/** Onde está o soffice.exe, ou null: nos lugares de instalação e, depois, no registro. */
async function acharLibreOffice(locais = LOCAIS_DO_LIBREOFFICE) {
  for (const local of locais) if (await arquivoExiste(local)) return local;
  if (process.platform !== "win32") return null;
  for (const chave of [
    "HKLM\\SOFTWARE\\LibreOffice\\UNO\\InstallPath",
    "HKLM\\SOFTWARE\\WOW6432Node\\LibreOffice\\UNO\\InstallPath",
  ]) {
    const { erro, saida } = await rodar("reg", ["query", chave, "/ve"], { timeout: 5000 });
    if (erro) continue;
    const pasta = saida.match(/REG_SZ\s+(.+)/)?.[1]?.trim();
    const soffice = pasta ? path.join(pasta, "soffice.exe") : "";
    if (soffice && (await arquivoExiste(soffice))) return soffice;
  }
  return null;
}

/** Se há um PowerPoint instalado que aceita ser comandado. */
async function temPowerPoint() {
  if (process.platform !== "win32") return false;
  const { erro } = await rodar("reg", ["query", "HKCR\\PowerPoint.Application\\CLSID", "/ve"], { timeout: 5000 });
  return !erro;
}

/**
 * O PowerPoint abre a apresentação sem janela, salva como PDF e fecha. Se o
 * operador estiver com o PowerPoint aberto, o dele fica como estava: só se
 * encerra o PowerPoint que não tem mais nada aberto.
 */
const SCRIPT_DO_POWERPOINT = [
  "$ErrorActionPreference = 'Stop'",
  "$pp = New-Object -ComObject PowerPoint.Application",
  "try {",
  // Open(arquivo, só leitura, sem título, sem janela); 32 = salvar como PDF.
  "  $apres = $pp.Presentations.Open($env:LUMEN_ENTRADA, -1, 0, 0)",
  "  try { $apres.SaveAs($env:LUMEN_SAIDA, 32) } finally { $apres.Close() }",
  "} finally {",
  "  if ($pp.Presentations.Count -eq 0) { $pp.Quit() }",
  "}",
].join("\n");

async function comPowerPoint(entrada, pdf) {
  const script = Buffer.from(SCRIPT_DO_POWERPOINT, "utf16le").toString("base64");
  const { erro } = await rodar(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", script],
    { timeout: TEMPO_MAXIMO_MS, env: { ...process.env, LUMEN_ENTRADA: entrada, LUMEN_SAIDA: pdf } },
  );
  return !erro && (await arquivoExiste(pdf));
}

function comLibreOffice(soffice, entrada, pasta, perfil) {
  return rodar(
    soffice,
    [
      // Perfil próprio: com o LibreOffice do operador aberto, a conversão
      // sem perfil separado falha calada — o pedido vai para a janela dele.
      `-env:UserInstallation=${pathToFileURL(perfil).href}`,
      "--headless",
      "--invisible",
      "--norestore",
      "--nolockcheck",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      pasta,
      entrada,
    ],
    { timeout: TEMPO_MAXIMO_MS },
  );
}

const CONVERSORES = { temPowerPoint, acharLibreOffice };

/**
 * A apresentação em PDF, dentro de `pasta`.
 *
 * @returns {Promise<{ ok: true, pdf: string, com: "PowerPoint" | "LibreOffice" }
 *   | { ok: false, error: string, semConversor?: boolean }>}
 */
async function paraPdf(entrada, pasta, perfil, conversores = CONVERSORES) {
  if (!EXTENSOES.has(path.extname(entrada).toLowerCase())) {
    return { ok: false, error: "Formato de apresentação que o Lúmen não conhece." };
  }
  await fsp.mkdir(pasta, { recursive: true });
  const pdf = path.join(pasta, `${path.basename(entrada, path.extname(entrada))}.pdf`);
  if (await conversores.temPowerPoint()) {
    if (await comPowerPoint(entrada, pdf)) return { ok: true, pdf, com: "PowerPoint" };
  }
  const soffice = await conversores.acharLibreOffice();
  if (!soffice) {
    return {
      ok: false,
      semConversor: true,
      error: "Este computador não tem PowerPoint nem LibreOffice para desenhar a apresentação.",
    };
  }
  const { erro } = await comLibreOffice(soffice, entrada, pasta, perfil);
  if (await arquivoExiste(pdf)) return { ok: true, pdf, com: "LibreOffice" };
  return {
    ok: false,
    error: erro?.killed
      ? "O LibreOffice demorou demais para desenhar a apresentação."
      : "O LibreOffice não conseguiu abrir essa apresentação.",
  };
}

/** Quem vai desenhar as apresentações neste computador, para a cabine dizer. */
async function conversorDisponivel(conversores = CONVERSORES) {
  if (await conversores.temPowerPoint()) return "PowerPoint";
  return (await conversores.acharLibreOffice()) ? "LibreOffice" : null;
}

module.exports = { paraPdf, conversorDisponivel, acharLibreOffice, temPowerPoint, EXTENSOES };
