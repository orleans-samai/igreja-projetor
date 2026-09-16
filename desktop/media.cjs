/**
 * Biblioteca de mídia em pasta de verdade.
 *
 * Cada tipo tem a sua pasta — vídeo, áudio e imagem — para a igreja largar os
 * arquivos ali pelo Explorer e o Lúmen enxergar. Antes só existia importação
 * por sessão: fechava o app, perdia tudo.
 *
 * A pasta padrão fica nos dados do usuário, mas o operador pode apontar para
 * onde o material já estiver (um pendrive, uma pasta da rede). Só as pastas
 * escolhidas são servidas, e sempre com o caminho preso dentro delas.
 */
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { shell, dialog } = require("electron");

/** Extensões que o Chromium do Electron consegue exibir. */
const KINDS = {
  video: [".mp4", ".webm", ".m4v", ".ogv"],
  audio: [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"],
  image: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"],
};
const PASTA_PADRAO = { video: "video", audio: "audio", image: "imagem" };

let dataDir = "";
let configFile = "";
/** @type {Record<string, string>} */
let pastas = {};

/** @param {string} dir */
function init(dir) {
  dataDir = dir;
  configFile = path.join(dir, "media-folders.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configFile, "utf8"));
    for (const kind of Object.keys(KINDS)) {
      if (typeof raw?.[kind] === "string" && raw[kind]) pastas[kind] = raw[kind];
    }
  } catch {
    /* primeira execução */
  }
}

/** @param {string} kind */
function dirFor(kind) {
  if (!KINDS[kind]) throw new Error("Tipo de mídia desconhecido.");
  return pastas[kind] || path.join(dataDir, "midia", PASTA_PADRAO[kind]);
}

/**
 * Grava a escolha e diz se conseguiu.
 *
 * Antes engolia o erro: o operador trocava a pasta, via a lista nova, fechava
 * o app e no domingo a pasta era a antiga de novo, sem nada explicando.
 */
function save() {
  try {
    fs.writeFileSync(configFile, JSON.stringify(pastas, null, 2));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Não consegui guardar a escolha da pasta: ${error?.message || error}` };
  }
}

/**
 * A pasta serve? Existe, é pasta, dá para ler e dá para escrever.
 *
 * O teste de escrita é um arquivo de verdade, criado e apagado: no Windows,
 * perguntar a permissão de uma pasta responde "pode" para lugares onde
 * gravar falha na hora — pasta de rede sem credencial, unidade só de leitura.
 */
async function validar(dir) {
  if (typeof dir !== "string" || !dir.trim()) return { ok: false, error: "Caminho de pasta vazio." };
  let st;
  try {
    st = await fsp.stat(dir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      try {
        await fsp.mkdir(dir, { recursive: true });
        st = await fsp.stat(dir);
      } catch {
        return { ok: false, error: `A pasta ${dir} não existe e não consegui criá-la.` };
      }
    } else {
      return { ok: false, error: `Não consegui abrir ${dir}. Ela pode estar desconectada.` };
    }
  }
  if (!st.isDirectory()) return { ok: false, error: `${dir} não é uma pasta.` };
  try {
    await fsp.readdir(dir);
  } catch {
    return { ok: false, error: `Sem permissão de leitura em ${dir}.` };
  }
  const teste = path.join(dir, `.lumen-teste-${process.pid}-${Date.now()}`);
  try {
    await fsp.writeFile(teste, "");
    await fsp.rm(teste, { force: true });
  } catch {
    return { ok: false, error: `Sem permissão de gravação em ${dir}. Escolha outra pasta.` };
  }
  return { ok: true };
}

/** Quantos arquivos daquele tipo moram numa pasta — para saber se vale perguntar. */
async function contarMidias(dir, kind) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries.filter(
      (e) => e.isFile() && KINDS[kind].includes(path.extname(e.name).toLowerCase()),
    ).length;
  } catch {
    return 0;
  }
}

/** Cria as três pastas na primeira execução, para o operador já achar onde pôr. */
async function ensure() {
  for (const kind of Object.keys(KINDS)) {
    try {
      await fsp.mkdir(dirFor(kind), { recursive: true });
    } catch {
      /* pasta da rede fora do ar: listar vai avisar */
    }
  }
  return folders();
}

function folders() {
  return Object.fromEntries(Object.keys(KINDS).map((k) => [k, dirFor(k)]));
}

/**
 * Identidade estável do arquivo, para favorito e seleção sobreviverem ao
 * atualizar. O nome basta: dois arquivos com o mesmo nome na mesma pasta não
 * existem.
 */
function idFor(kind, name) {
  return `midia:${kind}:${name}`;
}

/** @param {string} kind */
async function list(kind) {
  const dir = dirFor(kind);
  const exts = KINDS[kind];
  if (!exts) return { ok: false, error: "Tipo de mídia desconhecido." };
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await fsp.mkdir(dir, { recursive: true }).catch(() => {});
      return { ok: true, dir, items: [] };
    }
    return { ok: false, error: `Não consegui ler ${dir}.`, dir };
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.includes(ext)) continue;
    let size = 0;
    let at = 0;
    try {
      const st = await fsp.stat(path.join(dir, entry.name));
      size = st.size;
      at = st.mtimeMs;
    } catch {
      continue;
    }
    items.push({
      id: idFor(kind, entry.name),
      kind,
      name: entry.name,
      title: entry.name.replace(/\.[^.]+$/, ""),
      url: `lumen://app/__midia/${kind}/${encodeURIComponent(entry.name)}`,
      size,
      at,
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  return { ok: true, dir, items };
}

/** Abre a pasta no Explorer, que é como a igreja vai pôr arquivo lá. */
async function open(kind) {
  const dir = dirFor(kind);
  await fsp.mkdir(dir, { recursive: true }).catch(() => {});
  const problema = await shell.openPath(dir);
  return problema ? { ok: false, error: problema } : { ok: true, dir };
}

/**
 * Abre o seletor de pasta e devolve o que foi escolhido — sem aplicar ainda.
 *
 * Quem aplica é `apply`, depois de a cabine perguntar o que fazer com o que
 * já estava na pasta antiga. Assim "Cancelar" naquela pergunta cancela de
 * verdade, em vez de deixar a pasta trocada pela metade.
 *
 * A janela-mãe importa: sem ela o diálogo do Windows não é modal e abre atrás
 * do telão em tela cheia, que é o motivo de "trocar a pasta não funciona".
 *
 * @param {string} kind
 * @param {import("electron").BrowserWindow | null} janela
 */
async function choose(kind, janela) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const titulo = `Pasta de ${kind === "video" ? "vídeos" : kind === "audio" ? "áudios" : "imagens"}`;
  const opcoes = {
    title: titulo,
    defaultPath: dirFor(kind),
    properties: ["openDirectory", "createDirectory"],
  };
  let escolha;
  try {
    escolha = janela && !janela.isDestroyed()
      ? await dialog.showOpenDialog(janela, opcoes)
      : await dialog.showOpenDialog(opcoes);
  } catch (error) {
    return { ok: false, error: `Não consegui abrir o seletor de pastas: ${error?.message || error}` };
  }
  if (escolha.canceled || !escolha.filePaths[0]) return { ok: false, canceled: true };

  const destino = path.resolve(escolha.filePaths[0]);
  const atual = path.resolve(dirFor(kind));
  if (destino === atual) return { ok: false, mesmaPasta: true, dir: atual };

  const teste = await validar(destino);
  if (!teste.ok) return teste;

  return { ok: true, dir: destino, anterior: atual, pendentes: await contarMidias(atual, kind) };
}

/**
 * Move um arquivo para a pasta nova.
 *
 * `rename` resolve quando é o mesmo disco; entre discos (um pendrive, uma
 * pasta de rede) ele falha com EXDEV e aí é copiar e apagar. Nunca sobrescreve
 * um arquivo que já exista lá: material de igreja não se perde em silêncio.
 */
async function moverArquivo(de, para) {
  try {
    await fsp.access(para);
    return { ok: false, erro: "já existe um arquivo com esse nome na pasta nova" };
  } catch {
    /* não existe: pode mover */
  }
  try {
    await fsp.rename(de, para);
    return { ok: true };
  } catch (error) {
    if (error?.code !== "EXDEV") return { ok: false, erro: error?.message || String(error) };
  }
  try {
    await fsp.copyFile(de, para);
    await fsp.rm(de, { force: true });
    return { ok: true };
  } catch (error) {
    await fsp.rm(para, { force: true }).catch(() => {});
    return { ok: false, erro: error?.message || String(error) };
  }
}

/**
 * Aplica a pasta escolhida, movendo o acervo antigo se for o caso.
 *
 * @param {string} kind
 * @param {string} dir
 * @param {boolean} mover
 */
async function apply(kind, dir, mover) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const destino = path.resolve(String(dir || ""));
  const teste = await validar(destino);
  if (!teste.ok) return teste;

  const anterior = path.resolve(dirFor(kind));
  let movidos = 0;
  /** @type {{ nome: string; erro: string }[]} */
  const falhas = [];

  if (mover && anterior !== destino) {
    let entries = [];
    try {
      entries = await fsp.readdir(anterior, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!KINDS[kind].includes(path.extname(entry.name).toLowerCase())) continue;
      const r = await moverArquivo(path.join(anterior, entry.name), path.join(destino, entry.name));
      if (r.ok) movidos += 1;
      else falhas.push({ nome: entry.name, erro: r.erro });
    }
  }

  // A pasta só passa a valer depois de mover: se a gravação da escolha
  // falhar, os arquivos já estão no lugar novo e a mensagem diz o que houve.
  pastas[kind] = destino;
  const gravou = save();
  return {
    ok: true,
    dir: destino,
    anterior,
    movidos,
    falhas,
    aviso: gravou.ok ? null : gravou.error,
  };
}

/** Volta a pasta do tipo para o padrão dentro dos dados do usuário. */
async function reset(kind) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const anterior = dirFor(kind);
  delete pastas[kind];
  const gravou = save();
  const padrao = dirFor(kind);
  try {
    await fsp.mkdir(padrao, { recursive: true });
  } catch (error) {
    pastas[kind] = anterior;
    save();
    return { ok: false, error: `Não consegui criar a pasta padrão: ${error?.message || error}` };
  }
  return { ok: true, dir: padrao, aviso: gravou.ok ? null : gravou.error };
}

/**
 * Traduz `lumen://app/__midia/<tipo>/<arquivo>` num caminho de disco.
 *
 * Só resolve dentro da pasta configurada para aquele tipo e só para as
 * extensões daquele tipo — o renderer não tem como pedir um arquivo qualquer
 * da máquina por este caminho.
 *
 * @param {string} pathname já decodificado, começando com /__midia/
 */
async function resolveMedia(pathname) {
  const partes = pathname.split("/").filter(Boolean); // ["__midia", kind, name]
  if (partes.length !== 3 || partes[0] !== "__midia") return null;
  const [, kind, name] = partes;
  if (!KINDS[kind]) return null;
  if (name.includes("\\") || name.includes("\0") || name === "." || name === "..") return null;
  if (!KINDS[kind].includes(path.extname(name).toLowerCase())) return null;
  const dir = path.resolve(dirFor(kind));
  const file = path.resolve(dir, name);
  if (file !== path.join(dir, name) || !file.startsWith(dir + path.sep)) return null;
  try {
    return (await fsp.stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

module.exports = { init, ensure, folders, list, open, choose, apply, reset, resolveMedia, KINDS };
