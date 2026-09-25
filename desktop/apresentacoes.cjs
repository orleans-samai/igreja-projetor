/**
 * Onde as apresentações importadas moram, e como o telão as alcança.
 *
 * Cada apresentação vira uma pasta com uma imagem por slide. As imagens
 * ficam em disco, nunca dentro do estado salvo do app: esse estado é
 * reescrito inteiro a cada mudança, e quarenta slides de 800 KB lá dentro
 * seriam 32 MB copiados a cada avanço de verso — engasgo na projeção.
 *
 * O telão pede `lumen://app/__apresentacao/<id>/<arquivo>`. Quem monta o
 * caminho no disco é só este arquivo, e ele aceita um formato de id e um
 * formato de nome de arquivo. Qualquer outra coisa é 404.
 */
const path = require("node:path");
const fsp = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const { lerPptx } = require("./pptx.cjs");

const PASTA = "apresentacoes";
/**
 * A rota que o telão pede. Escrita por extenso, e não derivada de PASTA:
 * tirar o "s" de "apresentacoes" dá "apresentacoe", e foi exatamente isso
 * que saiu na primeira versão — toda imagem de slide em 404 no telão.
 */
const ROTA = "__apresentacao";
const PASTA_RECEBIDOS = "recebidos";
/** Teto para um arquivo que se tenta importar. O mesmo da página do dirigente. */
const MAX_ARQUIVO = 64 * 1024 * 1024;
/** Teto para as páginas de um PDF. Culto não tem mil páginas. */
const MAX_PAGINAS = 300;
/** Teto para cada página renderizada que chega da janela. */
const MAX_PAGINA = 12 * 1024 * 1024;

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ARQUIVO = /^(slide|pagina)-\d{1,4}\.(png|jpg|gif|bmp|webp)$/;

let dataDir = "";

function init(dir) {
  dataDir = dir;
}

function base() {
  if (!dataDir) throw new Error("Apresentações sem pasta: init() não foi chamado.");
  return path.join(dataDir, PASTA);
}

/**
 * O caminho de um arquivo recebido, preso à pasta de recebidos.
 *
 * O nome vem da janela, que o recebeu da rede. Montar o caminho aqui, com
 * `basename` e conferência, é o que impede um "..\\..\\" de sair da pasta.
 */
function recebido(nome) {
  if (!dataDir) return null;
  const limpo = path.basename(String(nome || ""));
  if (!limpo || limpo !== String(nome) || limpo.includes("\0")) return null;
  const dir = path.resolve(dataDir, PASTA_RECEBIDOS);
  const alvo = path.resolve(dir, limpo);
  return alvo.startsWith(dir + path.sep) ? alvo : null;
}

function url(id, arquivo) {
  return `lumen://app/${ROTA}/${id}/${arquivo}`;
}

async function lerComTeto(caminho) {
  const st = await fsp.stat(caminho);
  if (!st.isFile()) throw new Error("Não é um arquivo.");
  if (st.size > MAX_ARQUIVO) throw new Error("Arquivo grande demais (máximo 64 MB).");
  return fsp.readFile(caminho);
}

/**
 * Importa um .pptx recebido: lê, grava uma imagem por slide, devolve os
 * slides prontos para virar baralho.
 */
async function importarPptx(nome) {
  const caminho = recebido(nome);
  if (!caminho) return { ok: false, error: "Arquivo fora da pasta de recebidos." };
  let lido;
  try {
    lido = lerPptx(await lerComTeto(caminho));
  } catch (erro) {
    return { ok: false, error: erro?.message || "Não consegui ler a apresentação." };
  }
  const id = randomUUID();
  const dir = path.join(base(), id);
  await fsp.mkdir(dir, { recursive: true });
  const slides = [];
  for (let i = 0; i < lido.slides.length; i += 1) {
    const s = lido.slides[i];
    let imagem = "";
    if (s.imagem) {
      const arquivo = `slide-${i + 1}${s.imagem.ext}`;
      await fsp.writeFile(path.join(dir, arquivo), s.imagem.bytes);
      imagem = url(id, arquivo);
    }
    slides.push({ texto: s.texto, imagem });
  }
  return {
    ok: true,
    id,
    titulo: lido.titulo || path.basename(caminho, path.extname(caminho)),
    slides,
  };
}

/** Os bytes de um PDF recebido, para a janela desenhar as páginas. */
async function lerPdf(nome) {
  const caminho = recebido(nome);
  if (!caminho || path.extname(caminho).toLowerCase() !== ".pdf") {
    return { ok: false, error: "PDF fora da pasta de recebidos." };
  }
  try {
    return { ok: true, bytes: await lerComTeto(caminho) };
  } catch (erro) {
    return { ok: false, error: erro?.message || "Não consegui ler o PDF." };
  }
}

/**
 * Grava as páginas que a janela desenhou de um PDF.
 *
 * O desenho é na janela porque é lá que o pdf.js tem canvas; a gravação é
 * aqui porque é aqui que se escreve no disco. Cada página é conferida
 * como PNG antes de virar arquivo — o que chega pela IPC é dado, não
 * confiança.
 */
async function salvarPaginas(paginas) {
  const lista = Array.isArray(paginas) ? paginas.slice(0, MAX_PAGINAS) : [];
  if (lista.length === 0) return { ok: false, error: "O PDF não tem páginas." };
  const id = randomUUID();
  const dir = path.join(base(), id);
  await fsp.mkdir(dir, { recursive: true });
  const urls = [];
  for (let i = 0; i < lista.length; i += 1) {
    const bytes = Buffer.from(lista[i] ?? []);
    const png = bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47;
    if (!png || bytes.length > MAX_PAGINA) {
      await fsp.rm(dir, { recursive: true, force: true });
      return { ok: false, error: `A página ${i + 1} não é uma imagem válida.` };
    }
    const arquivo = `pagina-${i + 1}.png`;
    await fsp.writeFile(path.join(dir, arquivo), bytes);
    urls.push(url(id, arquivo));
  }
  return { ok: true, id, urls };
}

/** O arquivo no disco para um pedido do telão, ou null. */
async function resolver(pathname) {
  const partes = String(pathname).split("/").filter(Boolean); // ["__apresentacao", id, arquivo]
  if (partes.length !== 3 || partes[0] !== ROTA) return null;
  const [, id, arquivo] = partes;
  if (!ID.test(id) || !ARQUIVO.test(arquivo)) return null;
  const dir = path.resolve(base(), id);
  const alvo = path.resolve(dir, arquivo);
  if (!alvo.startsWith(dir + path.sep)) return null;
  try {
    return (await fsp.stat(alvo)).isFile() ? alvo : null;
  } catch {
    return null;
  }
}

/** Apaga as imagens de uma apresentação que saiu da biblioteca. */
async function remover(id) {
  if (!ID.test(String(id))) return { ok: false };
  await fsp.rm(path.join(base(), id), { recursive: true, force: true });
  return { ok: true };
}

module.exports = {
  init,
  importarPptx,
  lerPdf,
  salvarPaginas,
  resolver,
  remover,
  recebido,
  MAX_PAGINAS,
};
