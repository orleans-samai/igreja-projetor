/**
 * As fotos e logos que entram nas artes.
 *
 * Ficam em disco, numa pasta do app, e a arte guarda só o endereço
 * `lumen://app/__artes/<id>.<ext>`. Endereço de sessão (blob:, object URL)
 * morreria no fechamento do app, e a arte salva abriria sem foto; bytes
 * dentro do estado salvo engordariam o arquivo reescrito a cada mudança.
 *
 * A janela manda a imagem já reduzida (lado maior de até 2400 px). Aqui só
 * se confere o que chega: tamanho, e que o começo do arquivo é mesmo de
 * JPEG, PNG ou WebP — extensão dita pela janela não conta.
 */
const path = require("node:path");
const fsp = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

const PASTA = "artes-imagens";
const ROTA = "__artes";
const MAX_IMAGEM = 20 * 1024 * 1024;
const ARQUIVO = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;

let dataDir = "";

function init(dir) {
  dataDir = dir;
}

function base() {
  if (!dataDir) throw new Error("Imagens das artes sem pasta: init() não foi chamado.");
  return path.join(dataDir, PASTA);
}

/** O tipo pelo conteúdo, não pelo nome. */
function tipoDe(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47) return "png";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

async function salvar(dados) {
  const bytes = Buffer.from(dados ?? []);
  if (bytes.length === 0) return { ok: false, error: "A imagem veio vazia." };
  if (bytes.length > MAX_IMAGEM) return { ok: false, error: "A imagem passa de 20 MB." };
  const tipo = tipoDe(bytes);
  if (!tipo) return { ok: false, error: "O arquivo não é JPEG, PNG nem WebP." };
  const arquivo = `${randomUUID()}.${tipo}`;
  await fsp.mkdir(base(), { recursive: true });
  await fsp.writeFile(path.join(base(), arquivo), bytes);
  return { ok: true, url: `lumen://app/${ROTA}/${arquivo}` };
}

/** O arquivo no disco para um pedido, ou null. */
async function resolver(pathname) {
  const partes = String(pathname).split("/").filter(Boolean);
  if (partes.length !== 2 || partes[0] !== ROTA || !ARQUIVO.test(partes[1])) return null;
  const dir = path.resolve(base());
  const alvo = path.resolve(dir, partes[1]);
  if (!alvo.startsWith(dir + path.sep)) return null;
  try {
    return (await fsp.stat(alvo)).isFile() ? alvo : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────── exportação

let pastaDeExportacao = "";

/** Onde as artes exportadas vão parar: Imagens\Lúmen - Artes. */
function definirExportacao(dir) {
  pastaDeExportacao = dir;
}

const NOME_EXPORTADO = /^[A-Za-z0-9 _-]{1,80}\.(png|jpg)$/;

/**
 * Grava a arte exportada na pasta de artes, sem janela de "salvar como":
 * no domingo de manhã, uma arte a mais é um clique, não um passeio pelas
 * pastas do Windows. Nome repetido ganha número, nunca sobrescreve.
 */
async function exportar(nome, dados) {
  if (!pastaDeExportacao) return { ok: false, error: "Pasta de exportação não definida." };
  const limpo = path.basename(String(nome || ""));
  if (!NOME_EXPORTADO.test(limpo)) return { ok: false, error: "Nome de arquivo inválido." };
  const bytes = Buffer.from(dados ?? []);
  const tipo = tipoDe(bytes);
  if (!tipo || (tipo === "png") !== limpo.endsWith(".png")) return { ok: false, error: "O conteúdo não confere com o tipo do arquivo." };
  await fsp.mkdir(pastaDeExportacao, { recursive: true });
  const ext = path.extname(limpo);
  const raiz = limpo.slice(0, -ext.length);
  let alvo = path.join(pastaDeExportacao, limpo);
  for (let i = 2; i < 1000; i++) {
    try {
      await fsp.access(alvo);
      alvo = path.join(pastaDeExportacao, `${raiz} (${i})${ext}`);
    } catch {
      break;
    }
  }
  await fsp.writeFile(alvo, bytes);
  return { ok: true, caminho: alvo };
}

/** Só mostra no Explorer o que está dentro da pasta de artes. */
function dentroDaExportacao(caminho) {
  if (!pastaDeExportacao) return false;
  const dir = path.resolve(pastaDeExportacao);
  const alvo = path.resolve(String(caminho || ""));
  return alvo.startsWith(dir + path.sep);
}

module.exports = { init, salvar, resolver, definirExportacao, exportar, dentroDaExportacao, ROTA, PASTA };
