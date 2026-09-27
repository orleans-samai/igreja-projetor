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
/** O PowerPoint desenha uma apresentação de culto em segundos; dois minutos é PowerPoint travado. */
const TEMPO_DO_POWERPOINT_MS = 2 * 60 * 1000;
/** O LibreOffice demora mais na primeira vez, quando monta o perfil. Culto parado esperando, não. */
const TEMPO_DO_LIBREOFFICE_MS = 3 * 60 * 1000;
/**
 * Depois de um PowerPoint que travou, ele fica de fora por um tempo: sem
 * isso, cada apresentação seguinte esperaria os mesmos dois minutos.
 */
const DESCANSO_DO_POWERPOINT_MS = 10 * 60 * 1000;

const COM_SENHA = "A apresentação tem senha. Peça a quem mandou uma cópia sem senha.";

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
 * Um .pptx com senha não é ZIP: é um arquivo OLE com a parte
 * "EncryptedPackage" dentro. Descobrir isso antes poupa o PowerPoint e o
 * LibreOffice de tentar — e a cabine de dizer "não conseguiu abrir" quando
 * o que falta é só a senha.
 */
async function temSenha(caminho) {
  const arquivo = await fsp.open(caminho, "r");
  try {
    const cabeca = Buffer.alloc(8);
    await arquivo.read(cabeca, 0, 8, 0);
    if (!cabeca.equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) return false;
  } finally {
    await arquivo.close();
  }
  return (await fsp.readFile(caminho)).includes(Buffer.from("EncryptedPackage", "utf16le"));
}

/**
 * O PowerPoint abre a apresentação sem janela, salva como PDF e fecha. Se o
 * operador estiver com o PowerPoint aberto, o dele fica como estava: só se
 * encerra o PowerPoint que não tem mais nada aberto.
 *
 * - `Tentar`: com o operador mexendo no PowerPoint dele (digitando, com um
 *   menu aberto), o PowerPoint recusa a automação ("chamada rejeitada").
 *   Foi o que fez a conversão falhar no teste com o Office de verdade; o
 *   certo é esperar ele ficar livre e tentar de novo.
 * - `::lumen-sem-senha::`: apresentação com senha abriria uma janela
 *   pedindo a senha, e o culto ficaria esperando alguém digitar. Com uma
 *   senha qualquer no nome, o PowerPoint recusa na hora; sem senha no
 *   arquivo, o sufixo é ignorado.
 * - `DisplayAlerts = 1` (nenhum alerta): arquivo com defeito é recusado em
 *   vez de perguntar se deve ser reparado.
 */
const SCRIPT_DO_POWERPOINT = [
  "$ErrorActionPreference = 'Stop'",
  "function Tentar([scriptblock]$acao) {",
  "  $limite = (Get-Date).AddSeconds(75)",
  "  while ($true) {",
  "    try { return (& $acao) }",
  "    catch {",
  "      $e = $_.Exception",
  "      $ocupado = \"$($e.HResult) $($e.InnerException.HResult) $($e.Message)\" -match '-2147418111|-2147417846|0x80010001|0x8001010A'",
  "      if (-not $ocupado -or (Get-Date) -gt $limite) { throw }",
  "      Start-Sleep -Milliseconds 500",
  "    }",
  "  }",
  "}",
  "$pp = Tentar { New-Object -ComObject PowerPoint.Application }",
  "try { Tentar { $pp.DisplayAlerts = 1 } } catch { }",
  "$apres = $null",
  "$falhou = $false",
  "try {",
  // Open(arquivo, só leitura, sem título, sem janela); 32 = salvar como PDF.
  "  $apres = Tentar { $pp.Presentations.Open($env:LUMEN_ENTRADA + '::lumen-sem-senha::', -1, 0, 0) }",
  "  Tentar { $apres.SaveAs($env:LUMEN_SAIDA, 32) }",
  "} catch {",
  "  $falhou = $true",
  "  if ($_.Exception.Message -match 'senha|password') { 'LUMEN-SENHA' }",
  "} finally {",
  "  if ($apres) { try { Tentar { $apres.Close() } } catch { } }",
  "  try { if ((Tentar { $pp.Presentations.Count }) -eq 0) { Tentar { $pp.Quit() } } } catch { }",
  "}",
  "if ($falhou) { exit 1 }",
].join("\n");

async function comPowerPoint(entrada, pdf) {
  const script = Buffer.from(SCRIPT_DO_POWERPOINT, "utf16le").toString("base64");
  const { erro, saida } = await rodar(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", script],
    { timeout: TEMPO_DO_POWERPOINT_MS, env: { ...process.env, LUMEN_ENTRADA: entrada, LUMEN_SAIDA: pdf } },
  );
  if (await arquivoExiste(pdf)) return { ok: true };
  return { ok: false, senha: saida.includes("LUMEN-SENHA"), travou: Boolean(erro?.killed) };
}

async function comLibreOffice(soffice, entrada, pasta, perfil, pdf) {
  const { erro } = await rodar(
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
    { timeout: TEMPO_DO_LIBREOFFICE_MS },
  );
  return (await arquivoExiste(pdf)) ? { ok: true } : { ok: false, travou: Boolean(erro?.killed) };
}

/** Lembra, por um tempo, que o PowerPoint travou. */
function descanso(duracao = DESCANSO_DO_POWERPOINT_MS) {
  let ate = 0;
  return {
    ativo: () => Date.now() < ate,
    comecar: () => {
      ate = Date.now() + duracao;
    },
  };
}

const CONVERSORES = {
  temPowerPoint,
  acharLibreOffice,
  comPowerPoint,
  comLibreOffice,
  powerPointTravado: descanso(),
};

/**
 * A apresentação em PDF, dentro de `pasta`: pelo PowerPoint; se não houver
 * ou não conseguir, pelo LibreOffice.
 *
 * Cada um recebe uma cópia do arquivo, com nome simples, dentro de
 * `pasta`: um PowerPoint que falhou no meio não prende o arquivo que o
 * LibreOffice vai abrir em seguida, e a cópia não leva a marca de "baixado
 * da internet" que o Windows grava junto do original.
 *
 * @returns {Promise<{ ok: true, pdf: string, com: "PowerPoint" | "LibreOffice" }
 *   | { ok: false, error: string, semConversor?: boolean, comSenha?: boolean }>}
 */
async function paraPdf(entrada, pasta, perfil, trocas = {}) {
  const conversores = { ...CONVERSORES, ...trocas };
  const ext = path.extname(entrada).toLowerCase();
  if (!EXTENSOES.has(ext)) {
    return { ok: false, error: "Formato de apresentação que o Lúmen não conhece." };
  }
  if (await temSenha(entrada)) return { ok: false, comSenha: true, error: COM_SENHA };
  await fsp.mkdir(pasta, { recursive: true });
  const copia = path.join(pasta, `apresentacao${ext}`);
  const pdf = path.join(pasta, "apresentacao.pdf");
  await fsp.writeFile(copia, await fsp.readFile(entrada));

  let falhaDoPowerPoint = "";
  if (!conversores.powerPointTravado?.ativo() && (await conversores.temPowerPoint())) {
    const r = await conversores.comPowerPoint(copia, pdf);
    if (r.ok) return { ok: true, pdf, com: "PowerPoint" };
    if (r.senha) return { ok: false, comSenha: true, error: COM_SENHA };
    if (r.travou) conversores.powerPointTravado?.comecar();
    falhaDoPowerPoint = r.travou
      ? "O PowerPoint demorou demais para abrir essa apresentação."
      : "O PowerPoint não conseguiu abrir essa apresentação.";
  }

  const soffice = await conversores.acharLibreOffice();
  if (!soffice) {
    return falhaDoPowerPoint
      ? { ok: false, error: falhaDoPowerPoint }
      : {
          ok: false,
          semConversor: true,
          error: "Este computador não tem PowerPoint nem LibreOffice para desenhar a apresentação.",
        };
  }
  await fsp.rm(pdf, { force: true });
  const r = await conversores.comLibreOffice(soffice, copia, pasta, perfil, pdf);
  if (r.ok) return { ok: true, pdf, com: "LibreOffice" };
  if (falhaDoPowerPoint) {
    return { ok: false, error: "Nem o PowerPoint nem o LibreOffice conseguiram abrir essa apresentação." };
  }
  return {
    ok: false,
    error: r.travou
      ? "O LibreOffice demorou demais para desenhar a apresentação."
      : "O LibreOffice não conseguiu abrir essa apresentação.",
  };
}

/** Quem vai desenhar as apresentações neste computador, para a cabine dizer. */
async function conversorDisponivel(trocas = {}) {
  const conversores = { ...CONVERSORES, ...trocas };
  if (await conversores.temPowerPoint()) return "PowerPoint";
  return (await conversores.acharLibreOffice()) ? "LibreOffice" : null;
}

module.exports = {
  paraPdf,
  conversorDisponivel,
  acharLibreOffice,
  temPowerPoint,
  temSenha,
  comPowerPoint,
  comLibreOffice,
  descanso,
  EXTENSOES,
};
