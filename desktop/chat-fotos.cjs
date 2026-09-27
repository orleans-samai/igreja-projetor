/**
 * As fotos do chat da equipe — a setlist fotografada, o aviso escrito na mão.
 *
 * Ficam em disco, numa pasta do app, e o recado guarda só o nome do arquivo.
 * Foto dentro do recado (em base64) iria inteira para cada celular a cada
 * reconexão e engordaria o histórico gravado a cada mensagem.
 *
 * Quem manda já reduz a foto (lado maior de até 1600 px). Aqui se confere o
 * que chega: tamanho, e que o começo do arquivo é mesmo de JPEG, PNG ou
 * WebP — tipo dito por quem manda não conta.
 *
 * A cabine vê a foto por `lumen://app/__chat/<arquivo>`; o celular, pelo
 * servidor do controle remoto, que confere se aquele aparelho pode ver o
 * recado em que a foto veio.
 */
const path = require("node:path");
const fsp = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

const PASTA = "chat-fotos";
const ROTA = "__chat";
const MAX_FOTO = 6 * 1024 * 1024;
const ARQUIVO = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

let dataDir = "";

/** @param {string} dir */
function init(dir) {
  dataDir = dir;
}

function base() {
  if (!dataDir) throw new Error("Fotos do chat sem pasta: init() não foi chamado.");
  return path.join(dataDir, PASTA);
}

/** O tipo pelo conteúdo, não pelo nome. @param {Buffer} bytes */
function tipoDe(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47) return "png";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Grava a foto e devolve o nome do arquivo.
 * @param {Buffer | Uint8Array | ArrayBuffer} dados
 */
async function salvar(dados) {
  const bytes = Buffer.from(/** @type {any} */ (dados ?? []));
  if (bytes.length === 0) return { ok: false, error: "A foto veio vazia." };
  if (bytes.length > MAX_FOTO) return { ok: false, error: "A foto passa de 6 MB." };
  const tipo = tipoDe(bytes);
  if (!tipo) return { ok: false, error: "O arquivo não é uma foto (JPEG, PNG ou WebP)." };
  const arquivo = `${randomUUID()}.${tipo}`;
  await fsp.mkdir(base(), { recursive: true });
  await fsp.writeFile(path.join(base(), arquivo), bytes);
  return { ok: true, arquivo };
}

/** O caminho no disco de um arquivo de foto, preso na pasta, ou null. @param {string} arquivo */
function caminho(arquivo) {
  if (!ARQUIVO.test(String(arquivo))) return null;
  const dir = path.resolve(base());
  const alvo = path.resolve(dir, arquivo);
  return alvo.startsWith(dir + path.sep) ? alvo : null;
}

/** Os bytes e o tipo, para o servidor do celular servir. @param {string} arquivo */
async function ler(arquivo) {
  const alvo = caminho(arquivo);
  if (!alvo) return null;
  try {
    const ext = /** @type {keyof typeof MIME} */ (path.extname(alvo).slice(1));
    return { bytes: await fsp.readFile(alvo), tipo: MIME[ext] };
  } catch {
    return null;
  }
}

/** `/__chat/<arquivo>` para o protocolo da cabine. @param {string} pathname */
async function resolver(pathname) {
  const partes = String(pathname).split("/").filter(Boolean);
  if (partes.length !== 2 || partes[0] !== ROTA) return null;
  const alvo = caminho(partes[1]);
  if (!alvo) return null;
  try {
    return (await fsp.stat(alvo)).isFile() ? alvo : null;
  } catch {
    return null;
  }
}

/** A cabine apagou o recado: a foto sai do disco junto. @param {string} arquivo */
async function apagar(arquivo) {
  const alvo = caminho(arquivo);
  if (alvo) await fsp.rm(alvo, { force: true }).catch(() => {});
}

module.exports = { init, salvar, ler, resolver, apagar, tipoDe, ROTA, MAX_FOTO };
