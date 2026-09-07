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

function save() {
  try {
    fs.writeFileSync(configFile, JSON.stringify(pastas, null, 2));
  } catch {
    /* disco cheio ou somente leitura: segue com a pasta em memória */
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

/** @param {string} kind */
async function choose(kind) {
  if (!KINDS[kind]) throw new Error("Tipo de mídia desconhecido.");
  const escolha = await dialog.showOpenDialog({
    title: `Pasta de ${kind === "video" ? "vídeos" : kind === "audio" ? "áudios" : "imagens"}`,
    defaultPath: dirFor(kind),
    properties: ["openDirectory", "createDirectory"],
  });
  if (escolha.canceled || !escolha.filePaths[0]) return { ok: false, canceled: true };
  pastas[kind] = escolha.filePaths[0];
  save();
  return { ok: true, dir: pastas[kind] };
}

/** Volta a pasta do tipo para o padrão dentro dos dados do usuário. */
async function reset(kind) {
  if (!KINDS[kind]) throw new Error("Tipo de mídia desconhecido.");
  delete pastas[kind];
  save();
  await fsp.mkdir(dirFor(kind), { recursive: true }).catch(() => {});
  return { ok: true, dir: dirFor(kind) };
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

module.exports = { init, ensure, folders, list, open, choose, reset, resolveMedia, KINDS };
