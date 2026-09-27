import { corDe, corDentro, lerMapa, lerTema, TEMA_PADRAO, type ContextoDeCor, type MapaDeCores, type Rgba, type Tema } from "./cores.ts";
import { geometriaDe, type Geometria } from "./geometria.ts";
import { ArquivoInvalido, type Pacote } from "./zip.ts";
import { booleano, descer, filho, filhos, lerXml, numero, umDe, type No } from "./xml.ts";

/**
 * Um PowerPoint lido por inteiro: o que cada slide desenha, onde e como.
 *
 * É o desenho do próprio Lúmen para quando o computador não tem PowerPoint
 * nem LibreOffice. O leitor antigo tirava de cada slide só o texto e uma
 * imagem, e a igreja via a apresentação "totalmente desconfigurada". Aqui
 * sai a posição de cada caixa, a fonte, o tamanho, a cor, o fundo, as
 * formas e as imagens — com a herança que o PowerPoint faz: o título que
 * não diz a própria fonte usa a do layout, que usa a do mestre, que usa a
 * do tema. Errar essa herança é o título que sai pequeno e preto no canto.
 *
 * Tudo em EMU (1 cm = 360 000) e em pontos, como no arquivo; quem converte
 * para pixel é o desenho.
 */

export interface Caixa {
  x: number;
  y: number;
  cx: number;
  cy: number;
  /** Graus, no sentido do relógio. */
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

/** Recorte da imagem, em frações de cada lado (negativo: sobra em volta). */
export interface Recorte {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface ImagemPreenchida {
  tipo: "imagem";
  /** Caminho da imagem dentro do arquivo. */
  midia: string;
  recorte: Recorte;
  /** Ladrilho: escala (fração do tamanho natural) e deslocamento (EMU). */
  mosaico: { sx: number; sy: number; tx: number; ty: number } | null;
  opacidade: number;
  cinza: boolean;
  /** -1 a 1. */
  brilho: number;
  contraste: number;
}

export type Preenchimento =
  | { tipo: "solido"; cor: Rgba }
  | {
      tipo: "gradiente";
      paradas: { pos: number; cor: Rgba }[];
      /** Graus: 0 da esquerda para a direita, 90 de cima para baixo. */
      angulo: number;
      radial: boolean;
      /** Centro do radial, em frações da caixa. */
      centro: { x: number; y: number };
    }
  | ImagemPreenchida
  | { tipo: "padrao"; frente: Rgba; fundo: Rgba };

export interface Ponta {
  tipo: string;
  largura: string;
  comprimento: string;
}

export interface Contorno {
  cor: Rgba;
  /** EMU. */
  largura: number;
  tracejado: string;
  ponta: string;
  juncao: "round" | "bevel" | "miter";
  inicio: Ponta | null;
  fim: Ponta | null;
}

export interface Sombra {
  cor: Rgba;
  /** EMU. */
  desfoque: number;
  distancia: number;
  /** Graus. */
  direcao: number;
}

export interface Trecho {
  texto: string;
  /** Quebra de linha (`a:br`): o texto dela é vazio. */
  quebra?: boolean;
  fonte: string;
  /** Pontos. */
  tamanho: number;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  tachado: boolean;
  caixaAlta: "none" | "all" | "small";
  /** Espaço a mais entre letras, em pontos. */
  espacamento: number;
  /** Sobrescrito (+) ou subscrito (−), em fração do corpo. */
  base: number;
  /** Null: sem preenchimento — letra só de contorno. */
  cor: Preenchimento | null;
  contorno: { cor: Rgba; largura: number } | null;
  sombra: Sombra | null;
  realce: Rgba | null;
}

export type Espaco = { pct: number } | { pts: number };

export interface Paragrafo {
  alinhamento: "l" | "ctr" | "r" | "just" | "dist";
  margemEsq: number;
  margemDir: number;
  recuo: number;
  linha: Espaco;
  antes: Espaco;
  depois: Espaco;
  marcador: { texto: string; fonte: string | null; cor: Rgba | null; tamanhoPct: number } | null;
  trechos: Trecho[];
  /** O estilo do fim do parágrafo: a altura da linha vazia vem dele. */
  vazio: Trecho;
}

export interface CorpoDeTexto {
  margens: { l: number; t: number; r: number; b: number };
  ancora: "t" | "ctr" | "b";
  quebrar: boolean;
  autoajuste: { tipo: "nenhum" } | { tipo: "encolher"; escala: number; reducao: number } | { tipo: "forma" };
  vertical: "horz" | "vert" | "vert270";
  paragrafos: Paragrafo[];
}

export interface CelulaDeTabela {
  texto: CorpoDeTexto | null;
  preenchimento: Preenchimento | null;
  bordas: { l: Contorno | null; r: Contorno | null; t: Contorno | null; b: Contorno | null };
  colunas: number;
  linhas: number;
  /** Parte de uma célula mesclada: não se desenha sozinha. */
  continua: boolean;
}

export type Item =
  | { tipo: "grupo"; caixa: Caixa; filhos: Item[] }
  | {
      tipo: "forma";
      caixa: Caixa;
      geometria: Geometria;
      preenchimento: Preenchimento | null;
      contorno: Contorno | null;
      sombra: Sombra | null;
      texto: CorpoDeTexto | null;
      /** Onde o texto mora, quando não é na forma inteira (SmartArt). */
      caixaDoTexto: Caixa | null;
    }
  | {
      tipo: "imagem";
      caixa: Caixa;
      geometria: Geometria;
      imagem: ImagemPreenchida;
      contorno: Contorno | null;
      sombra: Sombra | null;
    }
  | { tipo: "tabela"; caixa: Caixa; colunas: number[]; linhas: { altura: number; celulas: CelulaDeTabela[] }[] };

export interface SlideDaCena {
  fundo: Preenchimento | null;
  itens: Item[];
}

export interface Cena {
  titulo: string;
  largura: number;
  altura: number;
  slides: SlideDaCena[];
  /** O que o desenho não sabe fazer e ficou de fora, para a cabine avisar. */
  faltas: string[];
}

// ─────────────────────────────────────────── partes do arquivo

interface Rel {
  tipo: string;
  alvo: string;
  externo: boolean;
}

interface Parte {
  caminho: string;
  raiz: No;
  rels: Map<string, Rel>;
}

const MAX_SLIDES = 500;
const IMAGENS = /\.(png|jpe?g|gif|bmp|webp)$/i;
const PREENCHIMENTOS = ["noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill"] as const;

function diretorioDe(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf("/"));
}

function resolverCaminho(diretorio: string, alvo: string): string {
  let a = alvo;
  try {
    a = decodeURIComponent(alvo);
  } catch {
    /* alvo com % solto: fica como veio */
  }
  if (a.startsWith("/")) return a.slice(1);
  const partes = diretorio.split("/").filter(Boolean);
  for (const pedaco of a.split("/")) {
    if (pedaco === "..") partes.pop();
    else if (pedaco && pedaco !== ".") partes.push(pedaco);
  }
  return partes.join("/");
}

class Leitor {
  private cache = new Map<string, Promise<Parte | null>>();
  private pacote: Pacote;
  constructor(pacote: Pacote) {
    this.pacote = pacote;
  }

  parte(caminho: string | null): Promise<Parte | null> {
    if (!caminho) return Promise.resolve(null);
    let p = this.cache.get(caminho);
    if (!p) {
      p = this.ler(caminho);
      this.cache.set(caminho, p);
    }
    return p;
  }

  private async ler(caminho: string): Promise<Parte | null> {
    const texto = await this.pacote.texto(caminho);
    if (texto === null) return null;
    const raiz = lerXml(texto);
    if (!raiz) return null;
    const i = caminho.lastIndexOf("/");
    const relsTexto = await this.pacote.texto(`${caminho.slice(0, i)}/_rels/${caminho.slice(i + 1)}.rels`);
    const rels = new Map<string, Rel>();
    for (const r of filhos(relsTexto ? lerXml(relsTexto) : null, "Relationship")) {
      rels.set(r.attrs.Id ?? "", {
        tipo: r.attrs.Type ?? "",
        alvo: r.attrs.Target ?? "",
        externo: (r.attrs.TargetMode ?? "") === "External",
      });
    }
    return { caminho, raiz, rels };
  }

  /** O caminho que um r:id aponta, a partir da parte que o cita. Externo não vale: o culto é offline. */
  alvo(parte: Parte, rid: string | undefined): string | null {
    const r = rid ? parte.rels.get(rid) : undefined;
    if (!r || r.externo) return null;
    return resolverCaminho(diretorioDe(parte.caminho), r.alvo);
  }

  /** A parte ligada por tipo: o layout de um slide, o mestre de um layout, o tema de um mestre. */
  ligada(parte: Parte | null, fimDoTipo: string): string | null {
    if (!parte) return null;
    for (const r of parte.rels.values()) {
      if (!r.externo && r.tipo.endsWith(fimDoTipo)) return resolverCaminho(diretorioDe(parte.caminho), r.alvo);
    }
    return null;
  }
}

// ─────────────────────────────────────────── contexto de um slide

interface Contexto {
  leitor: Leitor;
  cor: ContextoDeCor;
  tema: Tema;
  mestre: Parte | null;
  layout: Parte | null;
  apresentacao: No;
  numeroDoSlide: number;
  largura: number;
  altura: number;
  fundo: Preenchimento | null;
  estilosDeTabela: No | null;
  faltas: Set<string>;
}

/** Uma forma e a parte onde ela mora (é contra a parte que os r:id se resolvem). */
interface Elo {
  no: No;
  dono: Parte;
}

// ─────────────────────────────────────────── caixas

function caixaDoXfrm(xfrm: No | null | undefined): Caixa | null {
  if (!xfrm) return null;
  const off = filho(xfrm, "off");
  const ext = filho(xfrm, "ext");
  if (!off && !ext) return null;
  return {
    x: numero(off, "x", 0),
    y: numero(off, "y", 0),
    cx: Math.max(0, numero(ext, "cx", 0)),
    cy: Math.max(0, numero(ext, "cy", 0)),
    rot: numero(xfrm, "rot", 0) / 60000,
    flipH: booleano(xfrm, "flipH") ?? false,
    flipV: booleano(xfrm, "flipV") ?? false,
  };
}

/** Onde o PowerPoint põe título e corpo quando nem o layout nem o mestre dizem. */
function caixaPadrao(tipoDoPh: string | null, largura: number, altura: number): Caixa {
  const sx = largura / 12192000;
  const sy = altura / 6858000;
  const caixa = (x: number, y: number, cx: number, cy: number): Caixa => ({
    x: x * sx,
    y: y * sy,
    cx: cx * sx,
    cy: cy * sy,
    rot: 0,
    flipH: false,
    flipV: false,
  });
  if (tipoDoPh === "title" || tipoDoPh === "ctrTitle") return caixa(838200, 365125, 10515600, 1325563);
  if (tipoDoPh !== null) return caixa(838200, 1825625, 10515600, 4351338);
  // Forma de texto sem posição nenhuma (arquivo gerado à mão): o slide
  // inteiro, para o texto aparecer em vez de sumir num canto de largura zero.
  return caixa(0, 0, 12192000, 6858000);
}

// ─────────────────────────────────────────── placeholders

interface Ph {
  tipo: string;
  idx: string | null;
}

function phDe(no: No): Ph | null {
  const nv = umDe(no, ["nvSpPr", "nvPicPr", "nvGraphicFramePr", "nvCxnSpPr", "nvGrpSpPr"]);
  const ph = descer(nv, "nvPr", "ph");
  if (!ph) return null;
  return { tipo: ph.attrs.type ?? "obj", idx: ph.attrs.idx ?? null };
}

const DO_CORPO = new Set(["body", "subTitle", "obj", "pic", "tbl", "chart", "media", "clipArt", "dgm"]);

function tipoNormal(tipo: string): string {
  if (tipo === "ctrTitle") return "title";
  return DO_CORPO.has(tipo) ? "body" : tipo;
}

/** O placeholder correspondente no layout (pelo idx, depois pelo tipo) ou no mestre (pelo tipo). */
function acharPh(arvore: No | null, ph: Ph, noMestre: boolean): No | null {
  if (!arvore) return null;
  const lista = arvore.filhos.filter((f) => phDe(f));
  if (!noMestre && ph.idx !== null) {
    const porIdx = lista.find((f) => phDe(f)?.idx === ph.idx);
    if (porIdx) return porIdx;
  }
  if (!noMestre) {
    const exato = lista.find((f) => phDe(f)?.tipo === ph.tipo);
    if (exato) return exato;
  }
  return lista.find((f) => tipoNormal(phDe(f)?.tipo ?? "") === tipoNormal(ph.tipo)) ?? null;
}

function arvoreDe(parte: Parte | null): No | null {
  return descer(parte?.raiz, "cSld", "spTree");
}

// ─────────────────────────────────────────── preenchimento, contorno, sombra

function imagemDe(blipFill: No, dono: Parte, ctx: Contexto): ImagemPreenchida | null {
  const blip = filho(blipFill, "blip");
  const midia = ctx.leitor.alvo(dono, blip?.attrs.embed);
  if (!midia) return null;
  if (!IMAGENS.test(midia)) {
    ctx.faltas.add(/\.(emf|wmf)$/i.test(midia) ? "imagem em formato EMF/WMF" : "imagem em formato que o Lúmen não abre");
    return null;
  }
  const src = filho(blipFill, "srcRect");
  const tile = filho(blipFill, "tile");
  const lum = filho(blip, "lum");
  return {
    tipo: "imagem",
    midia,
    recorte: {
      l: numero(src, "l", 0) / 100000,
      t: numero(src, "t", 0) / 100000,
      r: numero(src, "r", 0) / 100000,
      b: numero(src, "b", 0) / 100000,
    },
    mosaico: tile
      ? {
          sx: numero(tile, "sx", 100000) / 100000,
          sy: numero(tile, "sy", 100000) / 100000,
          tx: numero(tile, "tx", 0),
          ty: numero(tile, "ty", 0),
        }
      : null,
    opacidade: Math.max(0, Math.min(1, numero(filho(blip, "alphaModFix"), "amt", 100000) / 100000)),
    cinza: Boolean(filho(blip, "grayscl")),
    brilho: numero(lum, "bright", 0) / 100000,
    contraste: numero(lum, "contrast", 0) / 100000,
  };
}

function preenchimentoDe(no: No | null, dono: Parte, ctx: Contexto, cor: ContextoDeCor, grupo: Preenchimento | null): Preenchimento | null {
  if (!no) return null;
  switch (no.nome) {
    case "solidFill": {
      const c = corDentro(no, cor);
      return c ? { tipo: "solido", cor: c } : null;
    }
    case "gradFill": {
      const paradas = filhos(filho(no, "gsLst"), "gs")
        .map((gs) => ({ pos: numero(gs, "pos", 0) / 100000, cor: corDentro(gs, cor) }))
        .filter((p): p is { pos: number; cor: Rgba } => p.cor !== null)
        .sort((a, b) => a.pos - b.pos);
      if (paradas.length === 0) return null;
      const caminho = filho(no, "path");
      const foco = filho(caminho, "fillToRect");
      const l = numero(foco, "l", 50000) / 100000;
      const t = numero(foco, "t", 50000) / 100000;
      const r = numero(foco, "r", 50000) / 100000;
      const b = numero(foco, "b", 50000) / 100000;
      return {
        tipo: "gradiente",
        paradas,
        angulo: numero(filho(no, "lin"), "ang", 5400000) / 60000,
        radial: Boolean(caminho),
        centro: { x: (l + (1 - r)) / 2, y: (t + (1 - b)) / 2 },
      };
    }
    case "blipFill":
      return imagemDe(no, dono, ctx);
    case "pattFill": {
      const frente = corDentro(filho(no, "fgClr"), cor) ?? { r: 0, g: 0, b: 0, a: 1 };
      const fundo = corDentro(filho(no, "bgClr"), cor) ?? { r: 255, g: 255, b: 255, a: 1 };
      return { tipo: "padrao", frente, fundo };
    }
    case "grpFill":
      return grupo;
    default:
      return null;
  }
}

function pontaDe(no: No | null): Ponta | null {
  const tipo = no?.attrs.type;
  if (!tipo || tipo === "none") return null;
  return { tipo, largura: no?.attrs.w ?? "med", comprimento: no?.attrs.len ?? "med" };
}

function contornoDe(ln: No | null, cor: ContextoDeCor): Contorno | null {
  if (!ln) return null;
  const fill = umDe(ln, PREENCHIMENTOS);
  if (!fill || fill.nome === "noFill") return null;
  const c =
    fill.nome === "solidFill"
      ? corDentro(fill, cor)
      : fill.nome === "gradFill"
        ? corDentro(filhos(filho(fill, "gsLst"), "gs")[0], cor)
        : null;
  if (!c) return null;
  return {
    cor: c,
    largura: numero(ln, "w", 9525),
    tracejado: filho(ln, "prstDash")?.attrs.val ?? "solid",
    ponta: ln.attrs.cap ?? "flat",
    juncao: filho(ln, "round") ? "round" : filho(ln, "bevel") ? "bevel" : "miter",
    inicio: pontaDe(filho(ln, "headEnd")),
    fim: pontaDe(filho(ln, "tailEnd")),
  };
}

function sombraDe(effectLst: No | null, cor: ContextoDeCor): Sombra | null {
  const s = filho(effectLst, "outerShdw");
  if (!s) return null;
  const c = corDentro(s, cor);
  if (!c) return null;
  return {
    cor: c,
    desfoque: numero(s, "blurRad", 0),
    distancia: numero(s, "dist", 0),
    direcao: numero(s, "dir", 0) / 60000,
  };
}

/** A lista de estilo do tema que um `*Ref` aponta: 1…999 nos comuns, 1001… nos de fundo. */
function doTema(lista: No[], fundos: No[], idx: number): No | null {
  if (idx >= 1001) return fundos[idx - 1001] ?? null;
  if (idx >= 1) return lista[idx - 1] ?? null;
  return null;
}

// ─────────────────────────────────────────── texto

const ESPACO_PADRAO: Espaco = { pct: 1 };

function espacoDe(no: No | null): Espaco | null {
  if (!no) return null;
  const pct = filho(no, "spcPct");
  if (pct) return { pct: numero(pct, "val", 100000) / 100000 };
  const pts = filho(no, "spcPts");
  if (pts) return { pts: numero(pts, "val", 0) / 100 };
  return null;
}

/** Os símbolos das fontes de marcador (Wingdings, Symbol) no Unicode que qualquer fonte tem. */
const SIMBOLOS: Record<string, string> = {
  "§": "▪",
  Ø: "➢",
  ü: "✔",
  q: "❑",
  v: "❖",
  n: "■",
  l: "●",
  à: "➔",
  è: "➜",
  Ü: "✓",
  o: "□",
  p: "◼",
  "·": "•",
  Þ: "⇒",
  "®": "→",
  ª: "✦",
};

function romano(n: number): string {
  const tabela: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let resto = Math.max(1, Math.min(3999, n));
  let s = "";
  for (const [v, l] of tabela) {
    while (resto >= v) {
      s += l;
      resto -= v;
    }
  }
  return s;
}

function letras(n: number): string {
  let s = "";
  let k = Math.max(1, n);
  while (k > 0) {
    k -= 1;
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  }
  return s;
}

/** "1.", "a)", "(iv)": a numeração automática do PowerPoint. */
export function numeracao(tipo: string, n: number): string {
  const m = /^(arabic|alphaLc|alphaUc|romanLc|romanUc|circleNum\w*?)(Period|ParenR|ParenBoth|Plain|Minus|DbPlain|WdBlackPlain|WdWhitePlain)?$/.exec(tipo);
  const base = m?.[1] ?? "arabic";
  const fim = m?.[2] ?? "Period";
  let v: string;
  if (base.startsWith("circleNum")) v = n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : String(n);
  else if (base === "alphaLc") v = letras(n);
  else if (base === "alphaUc") v = letras(n).toUpperCase();
  else if (base === "romanLc") v = romano(n);
  else if (base === "romanUc") v = romano(n).toUpperCase();
  else v = String(n);
  if (base.startsWith("circleNum")) return v;
  if (fim === "ParenR") return `${v})`;
  if (fim === "ParenBoth") return `(${v})`;
  if (fim === "Plain") return v;
  if (fim === "Minus") return `${v} -`;
  return `${v}.`;
}

/** Um nó que faz de `lstStyle` com a mesma cor e fonte em todos os níveis — o `fontRef` de uma forma. */
function estiloDaFonte(corNo: No | null, fonte: string | null): No | null {
  if (!corNo && !fonte) return null;
  const defRPr: No = {
    nome: "defRPr",
    attrs: {},
    texto: "",
    filhos: [
      ...(corNo ? [{ nome: "solidFill", attrs: {}, texto: "", filhos: [corNo] }] : []),
      ...(fonte ? [{ nome: "latin", attrs: { typeface: fonte }, texto: "", filhos: [] }] : []),
    ],
  };
  return {
    nome: "lstStyle",
    attrs: {},
    texto: "",
    filhos: Array.from({ length: 9 }, (_, i) => ({ nome: `lvl${i + 1}pPr`, attrs: {}, texto: "", filhos: [defRPr] })),
  };
}

function fonteDoTema(typeface: string | undefined, tema: Tema): string {
  if (!typeface) return tema.fonteCorpo;
  if (typeface.startsWith("+mj")) return tema.fonteTitulo;
  if (typeface.startsWith("+mn")) return tema.fonteCorpo;
  return typeface;
}

interface Fontes {
  /** `lstStyle` e seções de `txStyles`, do mais específico para o mais geral. */
  listas: (No | null)[];
  /** O `bodyPr` da forma e dos placeholders dela. */
  corpos: (No | null)[];
}

function trechoDe(cadeia: (No | null)[], texto: string, ctx: Contexto, dono: Parte, hiperlink: boolean): Trecho {
  const atributo = (nome: string): string | undefined => {
    for (const n of cadeia) {
      const v = n?.attrs[nome];
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const elemento = (nomes: readonly string[]): No | null => {
    for (const n of cadeia) {
      const f = umDe(n, nomes);
      if (f) return f;
    }
    return null;
  };
  const verdade = (v: string | undefined) => v === "1" || v === "true";
  const preenchimento = elemento(PREENCHIMENTOS);
  let cor: Preenchimento | null;
  let sublinhado = (atributo("u") ?? "none") !== "none";
  if (preenchimento) cor = preenchimentoDe(preenchimento, dono, ctx, ctx.cor, null);
  else if (hiperlink) {
    // Link sem cor própria: a cor de link do tema, sublinhado, como o PowerPoint.
    const c = corDe({ nome: "schemeClr", attrs: { val: "hlink" }, filhos: [], texto: "" }, ctx.cor);
    cor = c ? { tipo: "solido", cor: c } : null;
    sublinhado = true;
  } else {
    const c = corDe({ nome: "schemeClr", attrs: { val: "tx1" }, filhos: [], texto: "" }, ctx.cor);
    cor = c ? { tipo: "solido", cor: c } : null;
  }
  const ln = elemento(["ln"]);
  const contornoDoTexto = ln ? contornoDe(ln, ctx.cor) : null;
  const realce = elemento(["highlight"]);
  return {
    texto,
    fonte: fonteDoTema(elemento(["latin"])?.attrs.typeface, ctx.tema),
    tamanho: Number(atributo("sz") ?? 1800) / 100,
    negrito: verdade(atributo("b")),
    italico: verdade(atributo("i")),
    sublinhado,
    tachado: (atributo("strike") ?? "noStrike") !== "noStrike",
    caixaAlta: ((): Trecho["caixaAlta"] => {
      const c = atributo("cap");
      return c === "all" || c === "small" ? c : "none";
    })(),
    espacamento: Number(atributo("spc") ?? 0) / 100,
    base: Number(atributo("baseline") ?? 0) / 100000,
    cor,
    contorno: contornoDoTexto ? { cor: contornoDoTexto.cor, largura: contornoDoTexto.largura } : null,
    sombra: sombraDe(elemento(["effectLst"]), ctx.cor),
    realce: realce ? corDentro(realce, ctx.cor) : null,
  };
}

function corpoDe(txBody: No | null, fontes: Fontes, ctx: Contexto, dono: Parte): CorpoDeTexto | null {
  if (!txBody) return null;
  const corpo = (nome: string): string | undefined => {
    for (const b of fontes.corpos) {
      const v = b?.attrs[nome];
      if (v !== undefined) return v;
    }
    return undefined;
  };
  let autoajuste: CorpoDeTexto["autoajuste"] = { tipo: "nenhum" };
  for (const b of fontes.corpos) {
    const a = umDe(b, ["normAutofit", "spAutoFit", "noAutofit"]);
    if (!a) continue;
    if (a.nome === "normAutofit") {
      autoajuste = {
        tipo: "encolher",
        escala: numero(a, "fontScale", 100000) / 100000,
        reducao: numero(a, "lnSpcReduction", 0) / 100000,
      };
    } else if (a.nome === "spAutoFit") autoajuste = { tipo: "forma" };
    break;
  }
  const vert = corpo("vert") ?? "horz";
  const paragrafos: Paragrafo[] = [];
  // A numeração automática conta por nível, e recomeça quando um nível
  // mais raso interrompe — como a lista 1, 2, 3 do PowerPoint.
  const contadores: (number | undefined)[] = [];
  for (const p of filhos(txBody, "p")) {
    const pPr = filho(p, "pPr");
    const nivel = Math.max(0, Math.min(8, numero(pPr, "lvl", 0)));
    const niveis: (No | null)[] = [pPr, ...fontes.listas.map((l) => filho(l, `lvl${nivel + 1}pPr`) ?? filho(l, "defPPr"))];
    const pAtributo = (nome: string): string | undefined => {
      for (const n of niveis) {
        const v = n?.attrs[nome];
        if (v !== undefined) return v;
      }
      return undefined;
    };
    const pElemento = (nomes: readonly string[]): No | null => {
      for (const n of niveis) {
        const f = umDe(n, nomes);
        if (f) return f;
      }
      return null;
    };
    const defRPrs = niveis.map((n) => filho(n, "defRPr"));
    const trechos: Trecho[] = [];
    for (const r of p.filhos) {
      if (r.nome === "r" || r.nome === "fld") {
        const rPr = filho(r, "rPr");
        let t = filho(r, "t")?.texto ?? "";
        if (r.nome === "fld" && r.attrs.type === "slidenum") t = String(ctx.numeroDoSlide);
        if (!t) continue;
        trechos.push(trechoDe([rPr, ...defRPrs], t, ctx, dono, Boolean(filho(rPr, "hlinkClick"))));
      } else if (r.nome === "br") {
        trechos.push({ ...trechoDe([filho(r, "rPr"), ...defRPrs], "", ctx, dono, false), quebra: true });
      }
    }
    const vazio = trechoDe([filho(p, "endParaRPr"), ...defRPrs], "", ctx, dono, false);
    const primeiro = trechos.find((t) => !t.quebra) ?? vazio;

    let marcador: Paragrafo["marcador"] = null;
    const bu = pElemento(["buNone", "buChar", "buAutoNum", "buBlip"]);
    for (let k = nivel + 1; k < 9; k += 1) contadores[k] = undefined;
    const temTexto = trechos.some((t) => t.texto.trim());
    if (bu?.nome === "buAutoNum" && temTexto) {
      const inicio = numero(bu, "startAt", 1);
      contadores[nivel] = (contadores[nivel] ?? inicio - 1) + 1;
      marcador = { texto: numeracao(bu.attrs.type ?? "arabicPeriod", contadores[nivel] ?? 1), fonte: null, cor: null, tamanhoPct: 1 };
    } else {
      contadores[nivel] = undefined;
      if (bu?.nome === "buChar" && temTexto) {
        const fonteDoMarcador = pElemento(["buFontTx", "buFont"]);
        const nomeDaFonte = fonteDoMarcador?.nome === "buFont" ? fonteDoMarcador.attrs.typeface ?? null : null;
        const deSimbolo = nomeDaFonte !== null && /wingdings|symbol/i.test(nomeDaFonte);
        const ch = bu.attrs.char ?? "•";
        marcador = {
          texto: deSimbolo ? (SIMBOLOS[ch] ?? "•") : ch,
          fonte: deSimbolo ? null : nomeDaFonte,
          cor: ((): Rgba | null => {
            const c = pElemento(["buClrTx", "buClr"]);
            return c?.nome === "buClr" ? corDentro(c, ctx.cor) : null;
          })(),
          tamanhoPct: ((): number => {
            const s = pElemento(["buSzTx", "buSzPct", "buSzPts"]);
            if (s?.nome === "buSzPct") return numero(s, "val", 100000) / 100000;
            if (s?.nome === "buSzPts") return numero(s, "val", 0) / 100 / Math.max(1, primeiro.tamanho);
            return 1;
          })(),
        };
      }
    }
    const alinhamento = pAtributo("algn");
    paragrafos.push({
      alinhamento:
        alinhamento === "ctr" || alinhamento === "r" || alinhamento === "just" || alinhamento === "dist"
          ? alinhamento
          : alinhamento === "justLow" || alinhamento === "thaiDist"
            ? "just"
            : "l",
      margemEsq: Number(pAtributo("marL") ?? 0),
      margemDir: Number(pAtributo("marR") ?? 0),
      recuo: Number(pAtributo("indent") ?? 0),
      linha: espacoDe(pElemento(["lnSpc"])) ?? ESPACO_PADRAO,
      antes: espacoDe(pElemento(["spcBef"])) ?? { pts: 0 },
      depois: espacoDe(pElemento(["spcAft"])) ?? { pts: 0 },
      marcador,
      trechos,
      vazio,
    });
  }
  return {
    margens: {
      l: Number(corpo("lIns") ?? 91440),
      t: Number(corpo("tIns") ?? 45720),
      r: Number(corpo("rIns") ?? 91440),
      b: Number(corpo("bIns") ?? 45720),
    },
    ancora: ((): CorpoDeTexto["ancora"] => {
      const a = corpo("anchor");
      return a === "ctr" || a === "b" ? a : "t";
    })(),
    quebrar: corpo("wrap") !== "none",
    autoajuste,
    vertical: vert === "vert" || vert === "eaVert" || vert === "wordArtVert" ? "vert" : vert === "vert270" ? "vert270" : "horz",
    paragrafos,
  };
}

function temTexto(txBody: No | null): boolean {
  if (!txBody) return false;
  for (const p of filhos(txBody, "p")) {
    for (const r of p.filhos) {
      if ((r.nome === "r" || r.nome === "fld") && (filho(r, "t")?.texto ?? "").trim()) return true;
    }
  }
  return false;
}

/** A seção de `txStyles` do mestre que vale para um placeholder, ou para quem não é placeholder. */
function estiloDoMestre(ctx: Contexto, ph: Ph | null): No | null {
  const estilos = descer(ctx.mestre?.raiz, "txStyles");
  if (!ph) return filho(estilos, "otherStyle");
  const t = tipoNormal(ph.tipo);
  if (t === "title") return filho(estilos, "titleStyle");
  if (t === "body") return filho(estilos, "bodyStyle");
  return filho(estilos, "otherStyle");
}

// ─────────────────────────────────────────── as formas

function spPrDe(no: No): No | null {
  return filho(no, "spPr") ?? filho(no, "grpSpPr");
}

function primeiroEm(cadeia: Elo[], pegar: (e: Elo) => No | null): { no: No; dono: Parte } | null {
  for (const e of cadeia) {
    const n = pegar(e);
    if (n) return { no: n, dono: e.dono };
  }
  return null;
}

/** A forma, o placeholder do layout e o do mestre: a cadeia de onde tudo se herda. */
async function cadeiaDe(no: No, dono: Parte, ctx: Contexto, camada: "slide" | "layout" | "mestre"): Promise<{ cadeia: Elo[]; ph: Ph | null }> {
  const ph = phDe(no);
  const cadeia: Elo[] = [{ no, dono }];
  if (!ph || camada === "mestre") return { cadeia, ph };
  if (camada === "slide" && ctx.layout) {
    const doLayout = acharPh(arvoreDe(ctx.layout), ph, false);
    if (doLayout) cadeia.push({ no: doLayout, dono: ctx.layout });
  }
  if (ctx.mestre) {
    const doMestre = acharPh(arvoreDe(ctx.mestre), ph, true);
    if (doMestre) cadeia.push({ no: doMestre, dono: ctx.mestre });
  }
  return { cadeia, ph };
}

function estiloRef(no: No, nome: string): No | null {
  return descer(no, "style", nome);
}

async function formaDe(no: No, dono: Parte, ctx: Contexto, camada: "slide" | "layout" | "mestre", grupo: Preenchimento | null): Promise<Item | null> {
  const { cadeia, ph } = await cadeiaDe(no, dono, ctx, camada);
  const txBody = filho(no, "txBody");
  // Placeholder vazio não aparece na apresentação — o "Clique para
  // adicionar um título" é só da edição.
  if (ph && !temTexto(txBody)) return null;
  const caixa =
    caixaDoXfrm(primeiroEm(cadeia, (e) => filho(spPrDe(e.no), "xfrm"))?.no) ??
    caixaPadrao(ph ? ph.tipo : null, ctx.largura, ctx.altura);
  const geo = primeiroEm(cadeia, (e) => umDe(spPrDe(e.no), ["prstGeom", "custGeom"]));
  const geometria = geometriaDe(geo ? { nome: "spPr", attrs: {}, texto: "", filhos: [geo.no] } : null);

  // Cor do preenchimento: a da forma, a herdada do placeholder, ou a do
  // estilo do tema (fillRef) — nessa ordem.
  let preenchimento: Preenchimento | null = null;
  const fill = primeiroEm(cadeia, (e) => umDe(spPrDe(e.no), PREENCHIMENTOS));
  if (no.attrs.useBgFill === "1" || no.attrs.useBgFill === "true") preenchimento = ctx.fundo;
  else if (fill) preenchimento = preenchimentoDe(fill.no, fill.dono, ctx, ctx.cor, grupo);
  else {
    const ref = estiloRef(no, "fillRef");
    const idx = numero(ref, "idx", 0);
    const doEstilo = doTema(ctx.tema.preenchimentos, ctx.tema.fundos, idx);
    if (doEstilo) preenchimento = preenchimentoDe(doEstilo, dono, ctx, { ...ctx.cor, phClr: corDentro(ref, ctx.cor) }, grupo);
  }

  let contorno: Contorno | null = null;
  const ln = primeiroEm(cadeia, (e) => filho(spPrDe(e.no), "ln"));
  const lnRef = estiloRef(no, "lnRef");
  const corDoLnRef = corDentro(lnRef, ctx.cor);
  if (ln) {
    contorno = contornoDe(ln.no, ctx.cor);
    // `a:ln` só com largura: a cor vem do estilo.
    if (!contorno && !umDe(ln.no, PREENCHIMENTOS) && corDoLnRef) {
      contorno = { ...(contornoDe(doTema(ctx.tema.linhas, [], numero(lnRef, "idx", 0)), { ...ctx.cor, phClr: corDoLnRef }) ?? { cor: corDoLnRef, largura: 9525, tracejado: "solid", ponta: "flat", juncao: "miter", inicio: null, fim: null }), largura: numero(ln.no, "w", 9525) };
    }
  } else if (lnRef) {
    contorno = contornoDe(doTema(ctx.tema.linhas, [], numero(lnRef, "idx", 0)), { ...ctx.cor, phClr: corDoLnRef });
  }

  const efeitos = primeiroEm(cadeia, (e) => filho(spPrDe(e.no), "effectLst"));
  let sombra = efeitos ? sombraDe(efeitos.no, ctx.cor) : null;
  if (!efeitos) {
    const ref = estiloRef(no, "effectRef");
    const estilo = doTema(ctx.tema.efeitos, [], numero(ref, "idx", 0));
    sombra = sombraDe(filho(estilo, "effectLst"), { ...ctx.cor, phClr: corDentro(ref, ctx.cor) });
  }

  if (no.nome === "pic") {
    const blipFill = filho(no, "blipFill");
    const imagem = blipFill ? imagemDe(blipFill, dono, ctx) : null;
    if (!imagem) return null;
    return { tipo: "imagem", caixa, geometria, imagem, contorno, sombra };
  }

  let texto: CorpoDeTexto | null = null;
  if (txBody && temTexto(txBody)) {
    const fontRef = estiloRef(no, "fontRef");
    const corDaFonte = fontRef ? (fontRef.filhos[0] ?? null) : null;
    const fonteDaRef = fontRef?.attrs.idx === "major" ? "+mj-lt" : fontRef?.attrs.idx === "minor" ? "+mn-lt" : null;
    texto = corpoDe(
      txBody,
      {
        listas: [
          filho(txBody, "lstStyle"),
          ...cadeia.slice(1).map((e) => descer(e.no, "txBody", "lstStyle")),
          estiloDaFonte(corDaFonte, fonteDaRef),
          estiloDoMestre(ctx, ph),
          filho(ctx.apresentacao, "defaultTextStyle"),
        ],
        corpos: cadeia.map((e) => descer(e.no, "txBody", "bodyPr")),
      },
      ctx,
      dono,
    );
  }
  return {
    tipo: "forma",
    caixa,
    geometria,
    preenchimento,
    contorno,
    sombra,
    texto,
    caixaDoTexto: caixaDoXfrm(filho(no, "txXfrm")),
  };
}

// ─────────────────────────────────────────── grupos, tabelas, SmartArt

/** A caixa de um filho de grupo, levada das coordenadas do grupo para as de fora. */
function mapearCaixa(c: Caixa, g: { off: [number, number]; chOff: [number, number]; sx: number; sy: number }): Caixa {
  return {
    ...c,
    x: g.off[0] + (c.x - g.chOff[0]) * g.sx,
    y: g.off[1] + (c.y - g.chOff[1]) * g.sy,
    cx: c.cx * g.sx,
    cy: c.cy * g.sy,
  };
}

function mapearItem(item: Item, g: { off: [number, number]; chOff: [number, number]; sx: number; sy: number }): Item {
  if (item.tipo === "grupo") {
    return { ...item, caixa: mapearCaixa(item.caixa, g), filhos: item.filhos.map((f) => mapearItem(f, g)) };
  }
  if (item.tipo === "forma") {
    return { ...item, caixa: mapearCaixa(item.caixa, g), caixaDoTexto: item.caixaDoTexto ? mapearCaixa(item.caixaDoTexto, g) : null };
  }
  if (item.tipo === "tabela") {
    return {
      ...item,
      caixa: mapearCaixa(item.caixa, g),
      colunas: item.colunas.map((c) => c * g.sx),
      linhas: item.linhas.map((l) => ({ ...l, altura: l.altura * g.sy })),
    };
  }
  return { ...item, caixa: mapearCaixa(item.caixa, g) };
}

async function grupoDe(no: No, dono: Parte, ctx: Contexto, camada: "slide" | "layout" | "mestre", grupoPai: Preenchimento | null): Promise<Item | null> {
  const grpSpPr = filho(no, "grpSpPr");
  const xfrm = filho(grpSpPr, "xfrm");
  const caixa = caixaDoXfrm(xfrm);
  const fill = umDe(grpSpPr, PREENCHIMENTOS);
  const preenchimentoDoGrupo = fill ? preenchimentoDe(fill, dono, ctx, ctx.cor, grupoPai) : grupoPai;
  const filhosDoGrupo = await itensDe(no, dono, ctx, camada, preenchimentoDoGrupo);
  if (!caixa) return filhosDoGrupo.length ? { tipo: "grupo", caixa: { x: 0, y: 0, cx: 0, cy: 0, rot: 0, flipH: false, flipV: false }, filhos: filhosDoGrupo } : null;
  const chOff = filho(xfrm, "chOff");
  const chExt = filho(xfrm, "chExt");
  const chCx = numero(chExt, "cx", caixa.cx);
  const chCy = numero(chExt, "cy", caixa.cy);
  const mapa = {
    off: [caixa.x, caixa.y] as [number, number],
    chOff: [numero(chOff, "x", caixa.x), numero(chOff, "y", caixa.y)] as [number, number],
    sx: chCx > 0 ? caixa.cx / chCx : 1,
    sy: chCy > 0 ? caixa.cy / chCy : 1,
  };
  return { tipo: "grupo", caixa, filhos: filhosDoGrupo.map((f) => mapearItem(f, mapa)) };
}

/** As partes do estilo de tabela que valem para uma célula, da mais geral para a mais específica. */
function partesDoEstilo(estilo: No | null, tblPr: No | null, linha: number, coluna: number, linhas: number, colunas: number): No[] {
  if (!estilo) return [];
  const liga = (a: string) => booleano(tblPr, a) === true;
  const partes: (No | null)[] = [filho(estilo, "wholeTbl")];
  const primeiraLinha = liga("firstRow") && linha === 0;
  const ultimaLinha = liga("lastRow") && linha === linhas - 1;
  if (liga("bandRow") && !primeiraLinha && !ultimaLinha) {
    const k = linha - (liga("firstRow") ? 1 : 0);
    partes.push(filho(estilo, k % 2 === 0 ? "band1H" : "band2H"));
  }
  if (liga("bandCol")) {
    const k = coluna - (liga("firstCol") ? 1 : 0);
    partes.push(filho(estilo, k % 2 === 0 ? "band1V" : "band2V"));
  }
  if (liga("firstCol") && coluna === 0) partes.push(filho(estilo, "firstCol"));
  if (liga("lastCol") && coluna === colunas - 1) partes.push(filho(estilo, "lastCol"));
  if (ultimaLinha) partes.push(filho(estilo, "lastRow"));
  if (primeiraLinha) partes.push(filho(estilo, "firstRow"));
  return partes.filter((p): p is No => p !== null);
}

function tabelaDe(frame: No, tbl: No, dono: Parte, ctx: Contexto): Item | null {
  const caixa = caixaDoXfrm(filho(frame, "xfrm"));
  if (!caixa) return null;
  const tblPr = filho(tbl, "tblPr");
  const idDoEstilo = filho(tblPr, "tableStyleId")?.texto.trim() ?? "";
  const estilo =
    filhos(ctx.estilosDeTabela, "tblStyle").find((s) => s.attrs.styleId === idDoEstilo) ?? null;
  const colunas = filhos(filho(tbl, "tblGrid"), "gridCol").map((c) => numero(c, "w", 0));
  const trs = filhos(tbl, "tr");
  const linhas = trs.map((tr, i) => {
    const celulas = filhos(tr, "tc").map((tc, j): CelulaDeTabela => {
      const tcPr = filho(tc, "tcPr");
      const partes = partesDoEstilo(estilo, tblPr, i, j, trs.length, colunas.length);
      // A parte mais específica do estilo ganha; a própria célula ganha de todas.
      const doEstilo = (pegar: (p: No) => No | null): No | null => {
        for (let k = partes.length - 1; k >= 0; k -= 1) {
          const n = pegar(partes[k]);
          if (n) return n;
        }
        return null;
      };
      const fillProprio = umDe(tcPr, PREENCHIMENTOS);
      const fillDoEstilo = doEstilo((p) => umDe(descer(p, "tcStyle", "fill"), PREENCHIMENTOS));
      const preenchimento = fillProprio
        ? preenchimentoDe(fillProprio, dono, ctx, ctx.cor, null)
        : fillDoEstilo
          ? preenchimentoDe(fillDoEstilo, dono, ctx, ctx.cor, null)
          : null;
      const bordaDoEstilo = (lado: string, dentro: string, eBorda: boolean): Contorno | null => {
        const n = doEstilo((p) => descer(p, "tcStyle", "tcBdr", eBorda ? lado : dentro, "ln") ?? descer(p, "tcStyle", "tcBdr", lado, "ln"));
        return contornoDe(n, ctx.cor);
      };
      const borda = (proprio: string, lado: string, dentro: string, eBorda: boolean) => {
        const ln = filho(tcPr, proprio);
        return ln ? contornoDe(ln, ctx.cor) : bordaDoEstilo(lado, dentro, eBorda);
      };
      const txTcStyle = doEstilo((p) => filho(p, "tcTxStyle"));
      const corDoEstilo = txTcStyle ? txTcStyle.filhos.find((f) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(f.nome)) ?? null : null;
      const negritoDoEstilo = txTcStyle?.attrs.b === "on";
      const estiloDoTexto = estiloDaFonte(corDoEstilo, null);
      if (estiloDoTexto && negritoDoEstilo) {
        for (const nivel of estiloDoTexto.filhos) for (const d of nivel.filhos) d.attrs.b = "1";
      }
      const txBody = filho(tc, "txBody");
      return {
        texto: temTexto(txBody)
          ? corpoDe(
              txBody,
              {
                listas: [filho(txBody, "lstStyle"), estiloDoTexto, estiloDoMestre(ctx, null), filho(ctx.apresentacao, "defaultTextStyle")],
                corpos: [
                  {
                    nome: "bodyPr",
                    attrs: {
                      lIns: tcPr?.attrs.marL ?? "91440",
                      rIns: tcPr?.attrs.marR ?? "91440",
                      tIns: tcPr?.attrs.marT ?? "45720",
                      bIns: tcPr?.attrs.marB ?? "45720",
                      anchor: tcPr?.attrs.anchor ?? "t",
                    },
                    texto: "",
                    filhos: [],
                  },
                ],
              },
              ctx,
              dono,
            )
          : null,
        preenchimento,
        bordas: {
          l: borda("lnL", "left", "insideV", j === 0),
          r: borda("lnR", "right", "insideV", j === colunas.length - 1),
          t: borda("lnT", "top", "insideH", i === 0),
          b: borda("lnB", "bottom", "insideH", i === trs.length - 1),
        },
        colunas: Math.max(1, numero(tc, "gridSpan", 1)),
        linhas: Math.max(1, numero(tc, "rowSpan", 1)),
        continua: booleano(tc, "hMerge") === true || booleano(tc, "vMerge") === true,
      };
    });
    return { altura: numero(tr, "h", 0), celulas };
  });
  return { tipo: "tabela", caixa, colunas, linhas };
}

/**
 * O SmartArt pelo desenho que o PowerPoint guardou dele (`drawingN.xml`):
 * as caixas e setas já calculadas. Sem esse desenho, o SmartArt fica de fora.
 */
async function smartArtDe(frame: No, dados: No, dono: Parte, ctx: Contexto): Promise<Item | null> {
  const caixa = caixaDoXfrm(filho(frame, "xfrm"));
  const relIds = filho(dados, "relIds");
  const parteDosDados = await ctx.leitor.parte(ctx.leitor.alvo(dono, relIds?.attrs.dm));
  const relDoDesenho = parteDosDados ? procurar(parteDosDados.raiz, "dataModelExt")?.attrs.relId : undefined;
  const desenho = await ctx.leitor.parte(ctx.leitor.alvo(dono, relDoDesenho));
  const arvore = filho(desenho?.raiz, "spTree");
  if (!caixa || !desenho || !arvore) {
    ctx.faltas.add("SmartArt");
    return null;
  }
  const filhosDoDesenho = await itensDe(arvore, desenho, ctx, "mestre", null);
  const mapa = { off: [caixa.x, caixa.y] as [number, number], chOff: [0, 0] as [number, number], sx: 1, sy: 1 };
  return { tipo: "grupo", caixa: { ...caixa, rot: 0, flipH: false, flipV: false }, filhos: filhosDoDesenho.map((f) => mapearItem(f, mapa)) };
}

function procurar(no: No | null, nome: string): No | null {
  if (!no) return null;
  if (no.nome === nome) return no;
  for (const f of no.filhos) {
    const achado = procurar(f, nome);
    if (achado) return achado;
  }
  return null;
}

async function quadroDe(no: No, dono: Parte, ctx: Contexto, camada: "slide" | "layout" | "mestre"): Promise<Item | null> {
  const dados = descer(no, "graphic", "graphicData");
  if (!dados) return null;
  const tbl = filho(dados, "tbl");
  if (tbl) return tabelaDe(no, tbl, dono, ctx);
  const uri = dados.attrs.uri ?? "";
  if (uri.endsWith("/diagram")) return smartArtDe(no, dados, dono, ctx);
  if (uri.endsWith("/chart") || uri.includes("chartex")) {
    ctx.faltas.add("gráfico");
    return null;
  }
  // Objeto OLE (planilha colada, equação antiga): o PowerPoint guarda a
  // imagem dele, e é ela que se desenha.
  const pic = procurar(dados, "pic");
  if (pic) {
    const caixa = caixaDoXfrm(filho(no, "xfrm"));
    const item = await formaDe(pic, dono, ctx, camada, null);
    if (item && item.tipo === "imagem" && caixa) return { ...item, caixa };
  }
  return null;
}

/** Os itens de uma árvore de formas, na ordem em que o PowerPoint os empilha. */
async function itensDe(arvore: No, dono: Parte, ctx: Contexto, camada: "slide" | "layout" | "mestre", grupo: Preenchimento | null): Promise<Item[]> {
  const itens: Item[] = [];
  const visitar = async (no: No) => {
    if (no.nome === "AlternateContent") {
      // A versão de reserva é a que todo leitor entende; a "escolha" usa
      // recurso novo do Office.
      const alternativa = filho(no, "Fallback") ?? filho(no, "Choice");
      for (const f of alternativa?.filhos ?? []) await visitar(f);
      return;
    }
    const nv = umDe(no, ["nvSpPr", "nvPicPr", "nvGrpSpPr", "nvGraphicFramePr", "nvCxnSpPr"]);
    if (booleano(filho(nv, "cNvPr"), "hidden")) return;
    // Placeholder do mestre e do layout é molde, não desenho: só aparece
    // no slide que o usa.
    if (camada !== "slide" && phDe(no) && dono !== undefined && no.nome !== "grpSp") {
      const eDoDesenho = arvore.nome === "spTree" && dono.raiz.nome === "drawing";
      if (!eDoDesenho) return;
    }
    let item: Item | null = null;
    if (no.nome === "sp" || no.nome === "cxnSp" || no.nome === "pic") item = await formaDe(no, dono, ctx, camada, grupo);
    else if (no.nome === "grpSp") item = await grupoDe(no, dono, ctx, camada, grupo);
    else if (no.nome === "graphicFrame") item = await quadroDe(no, dono, ctx, camada);
    if (item) itens.push(item);
  };
  for (const f of arvore.filhos) await visitar(f);
  return itens;
}

// ─────────────────────────────────────────── fundo

function fundoDe(parte: Parte | null, ctx: Contexto): Preenchimento | null | undefined {
  const bg = descer(parte?.raiz, "cSld", "bg");
  if (!bg || !parte) return undefined;
  const bgPr = filho(bg, "bgPr");
  if (bgPr) return preenchimentoDe(umDe(bgPr, PREENCHIMENTOS), parte, ctx, ctx.cor, null);
  const ref = filho(bg, "bgRef");
  if (ref) {
    const estilo = doTema(ctx.tema.preenchimentos, ctx.tema.fundos, numero(ref, "idx", 0));
    return preenchimentoDe(estilo, parte, ctx, { ...ctx.cor, phClr: corDentro(ref, ctx.cor) }, null);
  }
  return undefined;
}

// ─────────────────────────────────────────── a apresentação

export async function montarCena(pacote: Pacote): Promise<Cena> {
  const leitor = new Leitor(pacote);
  const apresentacao = await leitor.parte("ppt/presentation.xml");
  if (!apresentacao || apresentacao.raiz.nome !== "presentation") {
    throw new ArquivoInvalido("Isto não é um arquivo do PowerPoint (.pptx).");
  }
  const tamanho = filho(apresentacao.raiz, "sldSz");
  const largura = numero(tamanho, "cx", 12192000) || 12192000;
  const altura = numero(tamanho, "cy", 6858000) || 6858000;

  const titulo = await (async () => {
    const core = await leitor.parte("docProps/core.xml");
    return filho(core?.raiz, "title")?.texto.trim() ?? "";
  })();

  const estilosDeTabela = (await leitor.parte(leitor.ligada(apresentacao, "/tableStyles")))?.raiz ?? null;

  const caminhos = filhos(filho(apresentacao.raiz, "sldIdLst"), "sldId")
    .map((s) => apresentacao.rels.get(s.attrs.id ?? ""))
    .filter((r): r is Rel => Boolean(r && !r.externo && /\/slide$/.test(r.tipo)))
    .map((r) => resolverCaminho("ppt", r.alvo))
    .slice(0, MAX_SLIDES);

  const partesDosSlides = (await Promise.all(caminhos.map((c) => leitor.parte(c)))).filter(
    (p): p is Parte => p !== null,
  );
  // Slide escondido não entra na apresentação do PowerPoint; se todos
  // estiverem escondidos, entram todos — melhor do que nada no telão.
  const visiveis = partesDosSlides.filter((p) => p.raiz.attrs.show !== "0" && p.raiz.attrs.show !== "false");
  const aDesenhar = visiveis.length ? visiveis : partesDosSlides;

  const faltas = new Set<string>();
  const slides: SlideDaCena[] = [];
  for (let i = 0; i < aDesenhar.length; i += 1) {
    const slide = aDesenhar[i];
    const layout = await leitor.parte(leitor.ligada(slide, "/slideLayout"));
    const mestre = await leitor.parte(leitor.ligada(layout, "/slideMaster"));
    const temaParte = await leitor.parte(leitor.ligada(mestre, "/theme"));
    const tema = temaParte ? lerTema(temaParte.raiz) : TEMA_PADRAO;
    let mapa: MapaDeCores = lerMapa(filho(mestre?.raiz, "clrMap"));
    for (const p of [layout, slide]) {
      const ovr = descer(p?.raiz, "clrMapOvr", "overrideClrMapping");
      if (ovr) mapa = lerMapa(ovr);
    }
    const ctx: Contexto = {
      leitor,
      cor: { tema, mapa },
      tema,
      mestre,
      layout,
      apresentacao: apresentacao.raiz,
      numeroDoSlide: partesDosSlides.indexOf(slide) + 1,
      largura,
      altura,
      fundo: null,
      estilosDeTabela,
      faltas,
    };
    let fundo: Preenchimento | null = null;
    for (const p of [slide, layout, mestre]) {
      const f = fundoDe(p, ctx);
      if (f !== undefined) {
        fundo = f;
        break;
      }
    }
    ctx.fundo = fundo;
    const itens: Item[] = [];
    const mostraMestre = slide.raiz.attrs.showMasterSp !== "0" && slide.raiz.attrs.showMasterSp !== "false";
    const layoutMostraMestre = layout?.raiz.attrs.showMasterSp !== "0" && layout?.raiz.attrs.showMasterSp !== "false";
    if (mostraMestre && layoutMostraMestre && mestre) {
      const arvore = arvoreDe(mestre);
      if (arvore) itens.push(...(await itensDe(arvore, mestre, ctx, "mestre", null)));
    }
    if (mostraMestre && layout) {
      const arvore = arvoreDe(layout);
      if (arvore) itens.push(...(await itensDe(arvore, layout, ctx, "layout", null)));
    }
    const arvore = arvoreDe(slide);
    if (arvore) itens.push(...(await itensDe(arvore, slide, ctx, "slide", null)));
    slides.push({ fundo, itens });
  }
  if (slides.length === 0) throw new ArquivoInvalido("A apresentação não tem slides.");
  return { titulo, largura, altura, slides, faltas: [...faltas] };
}
