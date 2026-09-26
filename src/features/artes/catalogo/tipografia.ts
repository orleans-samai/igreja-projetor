import type { FamiliaId } from "../documento.ts";

/**
 * Fontes e conjuntos tipográficos.
 *
 * Todas as fontes são OFL 1.1, vêm em pacotes @fontsource e ficam dentro do
 * app: arte feita sem internet sai com a mesma letra que a prévia mostrou.
 * Todas cobrem o português inteiro — til, cedilha, crase, circunflexo.
 *
 * Um conjunto é uma decisão só, não quatro sorteios: título, apoio,
 * informação e destaque escolhidos para trabalhar juntos, com no máximo
 * duas famílias. Fonte sorteada por papel dá cartaz de gráfica rápida.
 */

export type ClasseDeFonte = "serifa" | "serifa-texto" | "sem-serifa" | "condensada" | "arredondada" | "manuscrita" | "mono";

export interface Fonte {
  /** Nome da família no CSS — o mesmo que o Konva usa no canvas. */
  familia: string;
  nome: string;
  classe: ClasseDeFonte;
  pesos: readonly number[];
  italico: boolean;
  pacote: string;
  licenca: "OFL-1.1";
  /**
   * Largura média de um caractere, em fração do corpo, para texto misto em
   * português; e para caixa alta. Só serve onde não há canvas (testes no
   * Node) — no app, o texto é medido com a fonte carregada.
   */
  larguraMedia: number;
  larguraMaiuscula: number;
}

export const FONTES: readonly Fonte[] = [
  { familia: "Fraunces Variable", nome: "Fraunces", classe: "serifa", pesos: [300, 400, 500, 600, 700, 800, 900], italico: false, pacote: "@fontsource-variable/fraunces", licenca: "OFL-1.1", larguraMedia: 0.55, larguraMaiuscula: 0.71 },
  { familia: "Instrument Sans Variable", nome: "Instrument Sans", classe: "sem-serifa", pesos: [400, 500, 600, 700], italico: false, pacote: "@fontsource-variable/instrument-sans", licenca: "OFL-1.1", larguraMedia: 0.52, larguraMaiuscula: 0.67 },
  { familia: "IBM Plex Mono", nome: "IBM Plex Mono", classe: "mono", pesos: [400, 500], italico: false, pacote: "@fontsource/ibm-plex-mono", licenca: "OFL-1.1", larguraMedia: 0.6, larguraMaiuscula: 0.6 },
  { familia: "Oswald Variable", nome: "Oswald", classe: "condensada", pesos: [300, 400, 500, 600, 700], italico: false, pacote: "@fontsource-variable/oswald", licenca: "OFL-1.1", larguraMedia: 0.44, larguraMaiuscula: 0.52 },
  { familia: "Anton", nome: "Anton", classe: "condensada", pesos: [400], italico: false, pacote: "@fontsource/anton", licenca: "OFL-1.1", larguraMedia: 0.46, larguraMaiuscula: 0.5 },
  { familia: "Playfair Display Variable", nome: "Playfair Display", classe: "serifa", pesos: [400, 500, 600, 700, 800, 900], italico: true, pacote: "@fontsource-variable/playfair-display", licenca: "OFL-1.1", larguraMedia: 0.55, larguraMaiuscula: 0.72 },
  { familia: "DM Serif Display", nome: "DM Serif Display", classe: "serifa", pesos: [400], italico: true, pacote: "@fontsource/dm-serif-display", licenca: "OFL-1.1", larguraMedia: 0.52, larguraMaiuscula: 0.68 },
  { familia: "Bricolage Grotesque Variable", nome: "Bricolage Grotesque", classe: "sem-serifa", pesos: [300, 400, 500, 600, 700, 800], italico: false, pacote: "@fontsource-variable/bricolage-grotesque", licenca: "OFL-1.1", larguraMedia: 0.56, larguraMaiuscula: 0.7 },
  { familia: "Fredoka Variable", nome: "Fredoka", classe: "arredondada", pesos: [400, 500, 600, 700], italico: false, pacote: "@fontsource-variable/fredoka", licenca: "OFL-1.1", larguraMedia: 0.55, larguraMaiuscula: 0.68 },
  { familia: "Caveat Variable", nome: "Caveat", classe: "manuscrita", pesos: [400, 500, 600, 700], italico: false, pacote: "@fontsource-variable/caveat", licenca: "OFL-1.1", larguraMedia: 0.42, larguraMaiuscula: 0.55 },
  { familia: "Newsreader Variable", nome: "Newsreader", classe: "serifa-texto", pesos: [400, 500, 600, 700], italico: true, pacote: "@fontsource-variable/newsreader", licenca: "OFL-1.1", larguraMedia: 0.49, larguraMaiuscula: 0.66 },
];

export function acharFonte(familia: string): Fonte | null {
  return FONTES.find((f) => f.familia === familia) ?? null;
}

export interface EstiloDeTexto {
  fonte: string;
  peso: number;
  estilo: "normal" | "italic";
  maiusculas: boolean;
  /** Espaço entre letras, em fração do corpo. */
  espacamento: number;
  entrelinha: number;
}

export interface ConjuntoTipografico {
  id: string;
  nome: string;
  titulo: EstiloDeTexto;
  /** Subtítulo, mensagem, tema. */
  apoio: EstiloDeTexto;
  /** Data, horário, local — o que tem de ler de longe e pequeno. */
  info: EstiloDeTexto;
  /** Data em destaque, chamada, número grande. */
  destaque: EstiloDeTexto;
  /** Rótulo pequeno em cima do título: organização, tema. */
  sobretitulo: EstiloDeTexto;
  /** Ambientes em que o conjunto funciona. */
  tags: string[];
  /** Famílias de composição para as quais ele está preparado. */
  familias: readonly FamiliaId[];
  /** Título de letra estreita: aguenta linhas de tamanhos diferentes. */
  escalonavel: boolean;
  /** Caracteres do título a partir dos quais ele já não serve. */
  tituloMaximo: number;
}

const e = (
  fonte: string,
  peso: number,
  extra: Partial<Omit<EstiloDeTexto, "fonte" | "peso">> = {},
): EstiloDeTexto => ({
  fonte,
  peso,
  estilo: "normal",
  maiusculas: false,
  espacamento: 0,
  entrelinha: 1.2,
  ...extra,
});

const FR = "Fraunces Variable";
const IS = "Instrument Sans Variable";
const MONO = "IBM Plex Mono";
const OS = "Oswald Variable";
const AN = "Anton";
const PF = "Playfair Display Variable";
const DM = "DM Serif Display";
const BR = "Bricolage Grotesque Variable";
const FD = "Fredoka Variable";
const CV = "Caveat Variable";
const NR = "Newsreader Variable";

const TODAS: readonly FamiliaId[] = [
  "editorial", "fotografia", "tipografica", "colagem", "geometrica", "minimalista",
  "ilustrada", "institucional", "molduras", "organica", "cartaz", "capa",
];

export const CONJUNTOS: readonly ConjuntoTipografico[] = [
  {
    id: "livro",
    nome: "Livro",
    titulo: e(NR, 600, { entrelinha: 1.08, espacamento: -0.01 }),
    apoio: e(NR, 400, { estilo: "italic", entrelinha: 1.3 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(IS, 600, { maiusculas: true, espacamento: 0.12 }),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.18 }),
    tags: ["ensino", "editorial", "sobrio", "adultos"],
    familias: ["editorial", "capa", "minimalista", "molduras", "institucional", "ilustrada", "colagem"],
    escalonavel: false,
    tituloMaximo: 90,
  },
  {
    id: "classico-editorial",
    nome: "Clássico editorial",
    titulo: e(PF, 700, { entrelinha: 1.04, espacamento: -0.01 }),
    apoio: e(NR, 400, { estilo: "italic", entrelinha: 1.3 }),
    info: e(NR, 500, { entrelinha: 1.35 }),
    destaque: e(PF, 600, { estilo: "italic" }),
    sobretitulo: e(NR, 600, { maiusculas: true, espacamento: 0.16 }),
    tags: ["editorial", "gratidao", "casais", "mulheres", "sobrio"],
    familias: ["editorial", "capa", "fotografia", "molduras", "minimalista", "organica"],
    escalonavel: false,
    tituloMaximo: 70,
  },
  {
    id: "fraunces-suave",
    nome: "Serifa suave",
    titulo: e(FR, 600, { entrelinha: 1.05, espacamento: -0.015 }),
    apoio: e(IS, 400, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(FR, 700),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.16 }),
    tags: ["gratidao", "familia", "caloroso", "natureza", "ensino"],
    familias: TODAS,
    escalonavel: false,
    tituloMaximo: 80,
  },
  {
    id: "cartaz-condensado",
    nome: "Cartaz condensado",
    titulo: e(OS, 700, { maiusculas: true, entrelinha: 0.98, espacamento: 0 }),
    apoio: e(IS, 500, { entrelinha: 1.3 }),
    info: e(OS, 500, { maiusculas: true, espacamento: 0.06, entrelinha: 1.25 }),
    destaque: e(OS, 700, { maiusculas: true }),
    sobretitulo: e(OS, 500, { maiusculas: true, espacamento: 0.2 }),
    tags: ["cartaz", "jovem", "vibrante", "institucional"],
    familias: ["cartaz", "tipografica", "geometrica", "fotografia", "colagem", "institucional"],
    escalonavel: true,
    tituloMaximo: 70,
  },
  {
    id: "cartaz-pesado",
    nome: "Cartaz pesado",
    titulo: e(AN, 400, { maiusculas: true, entrelinha: 0.96, espacamento: 0.005 }),
    apoio: e(IS, 600, { entrelinha: 1.3 }),
    info: e(IS, 600, { entrelinha: 1.35 }),
    destaque: e(AN, 400, { maiusculas: true }),
    sobretitulo: e(IS, 700, { maiusculas: true, espacamento: 0.18 }),
    tags: ["cartaz", "jovem", "vibrante", "festivo"],
    familias: ["cartaz", "tipografica", "geometrica", "colagem", "fotografia"],
    escalonavel: true,
    tituloMaximo: 48,
  },
  {
    id: "grotesca-jovem",
    nome: "Grotesca expressiva",
    titulo: e(BR, 800, { entrelinha: 0.98, espacamento: -0.02 }),
    apoio: e(BR, 500, { entrelinha: 1.3 }),
    info: e(IS, 600, { entrelinha: 1.35 }),
    destaque: e(BR, 700),
    sobretitulo: e(IS, 700, { maiusculas: true, espacamento: 0.16 }),
    tags: ["jovem", "vibrante", "festivo", "familia"],
    familias: ["tipografica", "geometrica", "colagem", "cartaz", "organica", "fotografia", "ilustrada"],
    escalonavel: false,
    tituloMaximo: 60,
  },
  {
    id: "grotesca-leve",
    nome: "Grotesca leve",
    titulo: e(BR, 500, { entrelinha: 1.02, espacamento: -0.02 }),
    apoio: e(BR, 400, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(BR, 700),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.16 }),
    tags: ["suave", "fresco", "minimalista", "mulheres"],
    familias: ["minimalista", "organica", "editorial", "molduras", "geometrica"],
    escalonavel: false,
    tituloMaximo: 80,
  },
  {
    id: "serifa-display",
    nome: "Serifa de impacto",
    titulo: e(DM, 400, { entrelinha: 1.02, espacamento: -0.005 }),
    apoio: e(IS, 400, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(DM, 400, { estilo: "italic" }),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.18 }),
    tags: ["editorial", "gratidao", "ceia", "caloroso", "casais"],
    familias: ["capa", "editorial", "fotografia", "molduras", "cartaz", "organica"],
    escalonavel: false,
    tituloMaximo: 70,
  },
  {
    id: "institucional",
    nome: "Institucional",
    titulo: e(IS, 700, { entrelinha: 1.08, espacamento: -0.015 }),
    apoio: e(IS, 400, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(IS, 700),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.14 }),
    tags: ["institucional", "sobrio", "lideranca"],
    familias: ["institucional", "editorial", "minimalista", "geometrica", "fotografia", "capa"],
    escalonavel: false,
    tituloMaximo: 100,
  },
  {
    id: "infantil",
    nome: "Arredondada",
    titulo: e(FD, 700, { entrelinha: 1.0 }),
    apoio: e(FD, 500, { entrelinha: 1.3 }),
    info: e(FD, 500, { entrelinha: 1.35 }),
    destaque: e(FD, 700),
    sobretitulo: e(FD, 600, { maiusculas: true, espacamento: 0.12 }),
    tags: ["infantil", "festivo", "familia"],
    familias: TODAS,
    escalonavel: false,
    tituloMaximo: 60,
  },
  {
    id: "manuscrito",
    nome: "Manuscrito",
    titulo: e(CV, 700, { entrelinha: 0.95 }),
    apoio: e(IS, 500, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(CV, 700),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.16 }),
    tags: ["gratidao", "caloroso", "familia", "infantil", "natureza"],
    familias: ["ilustrada", "organica", "colagem", "molduras", "minimalista", "editorial", "capa", "cartaz", "geometrica"],
    escalonavel: false,
    tituloMaximo: 40,
  },
  {
    id: "minimal-mono",
    nome: "Minimalista técnico",
    titulo: e(IS, 600, { entrelinha: 1.05, espacamento: -0.02 }),
    apoio: e(IS, 400, { entrelinha: 1.35 }),
    info: e(MONO, 400, { entrelinha: 1.45 }),
    destaque: e(MONO, 500, { maiusculas: true, espacamento: 0.04 }),
    sobretitulo: e(MONO, 500, { maiusculas: true, espacamento: 0.12 }),
    tags: ["minimalista", "jovem", "institucional", "sobrio"],
    familias: ["minimalista", "geometrica", "institucional", "tipografica", "editorial"],
    escalonavel: false,
    tituloMaximo: 80,
  },
  {
    id: "fraunces-cheia",
    nome: "Serifa cheia",
    titulo: e(FR, 900, { entrelinha: 0.98, espacamento: -0.02 }),
    apoio: e(BR, 500, { entrelinha: 1.3 }),
    info: e(BR, 600, { entrelinha: 1.35 }),
    destaque: e(FR, 800),
    sobretitulo: e(BR, 700, { maiusculas: true, espacamento: 0.14 }),
    tags: ["jovem", "festivo", "familia", "caloroso"],
    familias: ["tipografica", "cartaz", "organica", "colagem", "geometrica", "capa"],
    escalonavel: false,
    tituloMaximo: 55,
  },
  {
    id: "playfair-italico",
    nome: "Itálico elegante",
    titulo: e(PF, 600, { estilo: "italic", entrelinha: 1.04 }),
    apoio: e(IS, 400, { entrelinha: 1.35 }),
    info: e(IS, 500, { entrelinha: 1.35 }),
    destaque: e(PF, 700, { estilo: "italic" }),
    sobretitulo: e(IS, 600, { maiusculas: true, espacamento: 0.2 }),
    tags: ["casais", "mulheres", "gratidao", "suave"],
    familias: ["capa", "molduras", "minimalista", "organica", "editorial", "fotografia"],
    escalonavel: false,
    tituloMaximo: 60,
  },
];

export function acharConjunto(id: string): ConjuntoTipografico | null {
  return CONJUNTOS.find((c) => c.id === id) ?? null;
}

/** As famílias que um conjunto usa — o teste exige no máximo duas. */
export function familiasDoConjunto(c: ConjuntoTipografico): string[] {
  return [...new Set([c.titulo, c.apoio, c.info, c.destaque, c.sobretitulo].map((x) => x.fonte))];
}
