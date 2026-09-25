/**
 * Ler um PowerPoint sem PowerPoint.
 *
 * O PC da cabine pode não ter Office nenhum instalado — e o da igreja que
 * reportou isto não tem. Um .pptx é um ZIP com XML dentro, e o que um
 * culto precisa dele cabe em pouca coisa: a ordem dos slides, o texto de
 * cada um e a imagem principal. É isso que sai daqui.
 *
 * O que NÃO sai, e é bom ser dito: animação, transição, posição exata das
 * caixas, fontes do autor. Quem precisa do slide idêntico salva como PDF,
 * que o Lúmen desenha pixel a pixel.
 *
 * O arquivo vem da rede, da página do dirigente. Todo tamanho e todo
 * deslocamento é conferido antes de ser usado, e há teto para o que se
 * descompacta: um ZIP de 1 MB que se expande em 10 GB é um ataque antigo,
 * e o PC que projeta o culto não é o lugar para descobrir isso.
 */
const zlib = require("node:zlib");

/** Teto para uma entrada descompactada. Slide não tem 200 MB. */
const MAX_ENTRADA = 200 * 1024 * 1024;
/** Teto para tudo que se descompacta de um arquivo. */
const MAX_TOTAL = 512 * 1024 * 1024;
/** Um culto não tem mil slides; um arquivo que diz ter está mentindo. */
const MAX_SLIDES = 500;

class ArquivoInvalido extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ArquivoInvalido";
  }
}

// ─────────────────────────────────────────────── ZIP

/**
 * O índice de um ZIP: nome → onde está e como está guardado.
 *
 * Lê o diretório central, no fim do arquivo, em vez de varrer os
 * cabeçalhos locais do começo: é o índice que o próprio formato manda
 * confiar, e é o que resiste a um arquivo com lixo no meio.
 */
function indiceDoZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new ArquivoInvalido("Arquivo vazio ou cortado.");
  // O fim do diretório central fica nos últimos 22 bytes, mais até 64 KB
  // de comentário. Procura de trás para frente.
  let fim = -1;
  const limite = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= limite; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new ArquivoInvalido("Isto não é um arquivo do PowerPoint.");

  const total = buf.readUInt16LE(fim + 10);
  const tamanhoDir = buf.readUInt32LE(fim + 12);
  const inicioDir = buf.readUInt32LE(fim + 16);
  if (inicioDir === 0xffffffff || tamanhoDir === 0xffffffff) {
    throw new ArquivoInvalido("Arquivo grande demais para abrir aqui (ZIP64).");
  }
  if (inicioDir + tamanhoDir > buf.length) throw new ArquivoInvalido("Arquivo cortado.");

  const entradas = new Map();
  let p = inicioDir;
  for (let n = 0; n < total; n += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new ArquivoInvalido("Índice do arquivo corrompido.");
    }
    const metodo = buf.readUInt16LE(p + 10);
    const compactado = buf.readUInt32LE(p + 20);
    const cheio = buf.readUInt32LE(p + 24);
    const lenNome = buf.readUInt16LE(p + 28);
    const lenExtra = buf.readUInt16LE(p + 30);
    const lenComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (p + 46 + lenNome > buf.length) throw new ArquivoInvalido("Índice do arquivo corrompido.");
    const nome = buf.toString("utf8", p + 46, p + 46 + lenNome);
    entradas.set(nome, { metodo, compactado, cheio, local });
    p += 46 + lenNome + lenExtra + lenComentario;
  }
  return entradas;
}

/** Os bytes de uma entrada, já descompactados. */
function lerEntrada(buf, entrada, orcamento) {
  const { metodo, compactado, cheio, local } = entrada;
  if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) {
    throw new ArquivoInvalido("Entrada do arquivo corrompida.");
  }
  // O cabeçalho local tem os próprios tamanhos de nome e extra, que podem
  // diferir dos do índice central. É o local que diz onde os dados começam.
  const dados = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  if (dados + compactado > buf.length) throw new ArquivoInvalido("Entrada do arquivo cortada.");
  if (cheio > MAX_ENTRADA) throw new ArquivoInvalido("Uma parte do arquivo é grande demais.");
  if (orcamento.usado + cheio > MAX_TOTAL) throw new ArquivoInvalido("O arquivo se expande demais.");

  const bruto = buf.subarray(dados, dados + compactado);
  let saida;
  if (metodo === 0) saida = Buffer.from(bruto);
  else if (metodo === 8) {
    // maxOutputLength segura o caso em que o índice mente sobre o tamanho:
    // é o descompactador quem para, não a confiança no número declarado.
    saida = zlib.inflateRawSync(bruto, { maxOutputLength: Math.min(MAX_ENTRADA, Math.max(cheio, 1) + 1024) });
  } else throw new ArquivoInvalido("Compressão que o Lúmen não conhece.");
  orcamento.usado += saida.length;
  return saida;
}

// ─────────────────────────────────────────────── XML, o mínimo

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function desescapar(texto) {
  return String(texto).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Relacionamentos de um .rels: id → { tipo, alvo }. */
function relacionamentos(xml) {
  const mapa = new Map();
  for (const m of String(xml).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attr = (nome) => {
      const r = new RegExp(`\\b${nome}="([^"]*)"`).exec(m[1]);
      return r ? desescapar(r[1]) : "";
    };
    mapa.set(attr("Id"), { tipo: attr("Type"), alvo: attr("Target") });
  }
  return mapa;
}

/** Junta um caminho relativo de .rels ao diretório da peça que o cita. */
function resolver(diretorio, alvo) {
  if (alvo.startsWith("/")) return alvo.slice(1);
  const partes = diretorio.split("/").filter(Boolean);
  for (const pedaco of alvo.split("/")) {
    if (pedaco === "..") partes.pop();
    else if (pedaco && pedaco !== ".") partes.push(pedaco);
  }
  return partes.join("/");
}

function relsDe(caminho) {
  const i = caminho.lastIndexOf("/");
  return `${caminho.slice(0, i)}/_rels/${caminho.slice(i + 1)}.rels`;
}

function diretorioDe(caminho) {
  return caminho.slice(0, caminho.lastIndexOf("/"));
}

// ─────────────────────────────────────────────── o slide

/**
 * Placeholders que não são conteúdo: número do slide, data, rodapé. Num
 * PowerPoint de culto eles aparecem em todo slide e poluiriam o telão com
 * "12" e "25/09/2026" no meio da letra.
 */
const PLACEHOLDERS_DE_RUIDO = new Set(["sldNum", "dt", "ftr"]);

/** O texto de um slide, parágrafo a parágrafo, na ordem do XML. */
function textoDoSlide(xml) {
  const linhas = [];
  for (const forma of String(xml).matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
    const tipo = /<p:ph\b[^>]*\btype="([^"]+)"/.exec(forma[0]);
    if (tipo && PLACEHOLDERS_DE_RUIDO.has(tipo[1])) continue;
    for (const par of forma[0].matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)) {
      const pedacos = [...par[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => desescapar(t[1]));
      const linha = pedacos.join("").replace(/\s+/g, " ").trim();
      if (linha) linhas.push(linha);
    }
  }
  return linhas.join("\n");
}

/** O r:embed da imagem de fundo declarada numa peça, se houver. */
function fundoDe(xml) {
  const bg = /<p:bg\b[\s\S]*?<\/p:bg>/.exec(String(xml));
  if (!bg) return null;
  const blip = /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(bg[0]);
  return blip ? blip[1] : null;
}

/**
 * A maior figura do slide, pelo tamanho declarado.
 *
 * Num slide de culto a figura grande é o fundo — a foto do pôr do sol
 * atrás da letra — e as pequenas são logo e ícone. Ficar com a maior é
 * ficar com a que importa.
 */
function maiorFiguraDe(xml) {
  let melhor = null;
  let area = 0;
  for (const pic of String(xml).matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/g)) {
    const blip = /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(pic[0]);
    if (!blip) continue;
    const ext = /<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(pic[0]);
    const a = ext ? Number(ext[1]) * Number(ext[2]) : 1;
    if (a > area) {
      area = a;
      melhor = blip[1];
    }
  }
  return melhor;
}

const EXTENSOES_DE_IMAGEM = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"]);

function extensaoDe(caminho) {
  const i = caminho.lastIndexOf(".");
  return i >= 0 ? caminho.slice(i).toLowerCase() : "";
}

// ─────────────────────────────────────────────── a apresentação

/**
 * Os slides de um .pptx, na ordem da apresentação.
 *
 * Para cada slide: o texto e a imagem principal, que é a primeira que
 * existir nesta ordem — o fundo do próprio slide, a maior figura dele, o
 * fundo do layout, o fundo do mestre. Esta última é o caso mais comum em
 * PowerPoint de igreja: a foto está no mestre, e o slide só traz a letra.
 *
 * @returns {{ titulo: string, slides: { texto: string, imagem: { ext: string, bytes: Buffer } | null }[] }}
 */
function lerPptx(buf) {
  const indice = indiceDoZip(buf);
  const orcamento = { usado: 0 };
  const cache = new Map();
  const ler = (caminho) => {
    if (cache.has(caminho)) return cache.get(caminho);
    const e = indice.get(caminho);
    const v = e ? lerEntrada(buf, e, orcamento) : null;
    cache.set(caminho, v);
    return v;
  };
  const lerTexto = (caminho) => {
    const b = ler(caminho);
    return b ? b.toString("utf8") : null;
  };

  const apresentacao = lerTexto("ppt/presentation.xml");
  if (!apresentacao) throw new ArquivoInvalido("Isto não é um arquivo do PowerPoint (.pptx).");
  const relsDaApresentacao = relacionamentos(lerTexto("ppt/_rels/presentation.xml.rels") || "");

  // A ordem vem da lista de slides, não do nome do arquivo: slide10.xml pode
  // vir antes de slide2.xml, e o autor pode ter reordenado tudo.
  const ordem = [...apresentacao.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => relsDaApresentacao.get(m[1]))
    .filter((r) => r && /\/slide$/.test(r.tipo))
    .map((r) => resolver("ppt", r.alvo))
    .slice(0, MAX_SLIDES);

  const titulo = (() => {
    const core = lerTexto("docProps/core.xml") || "";
    const t = /<dc:title>([\s\S]*?)<\/dc:title>/.exec(core);
    return t ? desescapar(t[1]).trim() : "";
  })();

  /** A imagem apontada por um r:embed, a partir da peça que a cita. */
  const imagemDe = (peca, rid) => {
    if (!rid) return null;
    const rels = relacionamentos(lerTexto(relsDe(peca)) || "");
    const r = rels.get(rid);
    if (!r || /External/i.test(r.tipo)) return null;
    const caminho = resolver(diretorioDe(peca), r.alvo);
    const ext = extensaoDe(caminho);
    if (!EXTENSOES_DE_IMAGEM.has(ext)) return null;
    const bytes = ler(caminho);
    return bytes && bytes.length ? { ext: ext === ".jpeg" ? ".jpg" : ext, bytes } : null;
  };

  /** A peça ligada por tipo (o layout de um slide, o mestre de um layout). */
  const ligada = (peca, fimDoTipo) => {
    const rels = relacionamentos(lerTexto(relsDe(peca)) || "");
    for (const r of rels.values()) {
      if (r.tipo.endsWith(fimDoTipo)) return resolver(diretorioDe(peca), r.alvo);
    }
    return null;
  };

  const slides = [];
  for (const caminho of ordem) {
    const xml = lerTexto(caminho);
    if (!xml) continue;
    let imagem = imagemDe(caminho, fundoDe(xml)) || imagemDe(caminho, maiorFiguraDe(xml));
    if (!imagem) {
      const layout = ligada(caminho, "/slideLayout");
      const layoutXml = layout ? lerTexto(layout) : null;
      if (layoutXml) imagem = imagemDe(layout, fundoDe(layoutXml));
      if (!imagem && layout) {
        const mestre = ligada(layout, "/slideMaster");
        const mestreXml = mestre ? lerTexto(mestre) : null;
        if (mestreXml) imagem = imagemDe(mestre, fundoDe(mestreXml));
      }
    }
    slides.push({ texto: textoDoSlide(xml), imagem });
  }

  if (slides.length === 0) throw new ArquivoInvalido("A apresentação não tem slides.");
  return { titulo, slides };
}

module.exports = {
  lerPptx,
  indiceDoZip,
  textoDoSlide,
  ArquivoInvalido,
  MAX_SLIDES,
};
