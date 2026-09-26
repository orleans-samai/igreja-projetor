import type { Alinhamento, FamiliaId, Mascara, Preenchimento } from "../../documento.ts";
import { contraste, misturar } from "../../catalogo/cores.ts";
import { dentro, type Compositor, type ItemDeTexto, type Proporcao, type Ret, type Visual } from "../compositor.ts";

/**
 * O contrato de uma variante e as ferramentas que as famílias dividem.
 *
 * Cada variante declara o que precisa (imagem, data, título curto) e em
 * quais proporções funciona. O gerador lê isso antes de tentar compor:
 * layout de foto dominante não é nem cogitado quando não há foto, e o de
 * "número grande" não entra quando a data é "todo sábado".
 */

export interface Requisitos {
  /**
   * "nenhuma": não usa imagem. "opcional": usa se houver. "qualquer": foto
   * ou ilustração. "foto": só foto do usuário. "ilustracao": só desenho.
   */
  imagem: "nenhuma" | "opcional" | "qualquer" | "foto" | "ilustracao";
  /** Pede duas imagens diferentes. */
  duasImagens?: boolean;
  /** Pede dia e mês reconhecíveis na data. */
  diaEMes?: boolean;
  /** Pede data ou horário. */
  quando?: boolean;
  /** Pede logo ou nome da organização. */
  identidade?: boolean;
  /** Título até este número de caracteres. */
  tituloMax?: number;
  /** Título com pelo menos duas palavras. */
  tituloComPalavras?: number;
  proporcoes?: Proporcao[];
}

export interface Variante {
  id: string;
  familia: FamiliaId;
  /** Descrição curta da geometria — documentação, não aparece para o usuário. */
  descricao: string;
  requisitos: Requisitos;
  /** Composição predominantemente centralizada (o lote limita a duas). */
  centralizada: boolean;
  /** Monta a arte. `false` quando o conteúdo não coube: o gerador tenta outra. */
  compor: (c: Compositor) => boolean;
}

export interface Familia {
  id: FamiliaId;
  nome: string;
  variantes: Variante[];
}

// ───────────────────────────── geometria

export function colunas(r: Ret, fracoes: number[], vao: number): Ret[] {
  const soma = fracoes.reduce((a, b) => a + b, 0);
  const util = r.w - vao * (fracoes.length - 1);
  let x = r.x;
  return fracoes.map((f) => {
    const w = (util * f) / soma;
    const ret = { x, y: r.y, w, h: r.h };
    x += w + vao;
    return ret;
  });
}

export function linhas(r: Ret, fracoes: number[], vao: number): Ret[] {
  const soma = fracoes.reduce((a, b) => a + b, 0);
  const util = r.h - vao * (fracoes.length - 1);
  let y = r.y;
  return fracoes.map((f) => {
    const h = (util * f) / soma;
    const ret = { x: r.x, y, w: r.w, h };
    y += h + vao;
    return ret;
  });
}

/** Um retângulo em fração do quadro inteiro. */
export function q(c: Compositor, x: number, y: number, w: number, h: number): Ret {
  return { x: c.amb.L * x, y: c.amb.A * y, w: c.amb.L * w, h: c.amb.A * h };
}

/** Recorta um retângulo à área segura. */
export function naArea(c: Compositor, r: Ret): Ret {
  const s = c.amb.seg;
  const x0 = Math.max(r.x, s.x);
  const y0 = Math.max(r.y, s.y);
  const x1 = Math.min(r.x + r.w, s.x + s.w);
  const y1 = Math.min(r.y + r.h, s.y + s.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// ───────────────────────────── cor

/** Fundo da paleta, liso ou em dois tons suaves, conforme o sorteio. */
export function fundoDaPaleta(c: Compositor, estilo: "liso" | "gradiente" | "radial" = "liso"): void {
  const p = c.p;
  let f: Preenchimento;
  if (estilo === "gradiente") f = { tipo: "linear", cores: [p.fundo, p.fundo2], angulo: 90 + Math.round(c.amb.r() * 40 - 20) };
  else if (estilo === "radial") f = { tipo: "radial", cores: [p.fundo2, p.fundo], centro: { x: 0.3 + c.amb.r() * 0.4, y: 0.3 }, raio: 0.9 };
  else f = { tipo: "solido", cor: p.fundo };
  c.fundo(f);
}

export function sortearFundo(c: Compositor): "liso" | "gradiente" | "radial" {
  const r = c.amb.r();
  return r < 0.55 ? "liso" : r < 0.85 ? "gradiente" : "radial";
}

/** Cor de painel que contrasta com o fundo sem brigar com o destaque. */
export function corDePainel(c: Compositor): string {
  const p = c.p;
  return contraste(p.superficie, p.fundo) > 1.3 ? p.superficie : misturar(p.fundo, p.texto, 0.12);
}

// ───────────────────────────── imagem

export function visualPrincipal(c: Compositor): Visual | null {
  return c.amb.visuais[0] ?? null;
}

export function segundoVisual(c: Compositor): Visual | null {
  const [a, b] = c.amb.visuais;
  if (b && b.id !== a?.id) return b;
  const apoio = c.amb.apoios.find((il) => il.id !== a?.id);
  return apoio ? { tipo: "ilustracao", id: apoio.id, il: apoio } : null;
}

export function fotoPrincipal(c: Compositor): Visual | null {
  return c.amb.visuais.find((v) => v.tipo === "foto") ?? null;
}

export function ilustracaoPrincipal(c: Compositor, preferirCena = false): Visual | null {
  const vs = c.amb.visuais.filter((v) => v.tipo === "ilustracao");
  if (preferirCena) {
    const cena = vs.find((v) => v.tipo === "ilustracao" && v.il.tipo === "cena");
    if (cena) return cena;
  }
  if (vs[0]) return vs[0];
  const il = c.amb.apoios[0];
  return il ? { tipo: "ilustracao", id: il.id, il } : null;
}

/**
 * Uma imagem ocupando uma região: foto cobre; ilustração vai num painel
 * da cor da paleta, contida, com respiro — ilustração solta no meio do
 * fundo parece clip-art.
 */
export function imagemNaRegiao(
  c: Compositor,
  r: Ret,
  v: Visual,
  o: { painel?: string | null; respiro?: number; alinhar?: { x: number; y: number }; mascara?: Mascara; zoom?: number } = {},
): Ret {
  if (v.tipo === "foto") return c.visual(r, v, { mascara: o.mascara, zoom: o.zoom }).ret;
  const cor = o.painel === undefined ? corDePainel(c) : o.painel;
  if (cor) {
    if (o.mascara?.tipo === "circulo") c.circulo(r, cor, { papel: "painel", nome: "Fundo da ilustração" });
    else if (o.mascara?.tipo === "caminho") c.caminho(r, o.mascara.d, cor, { papel: "painel", nome: "Fundo da ilustração" });
    else c.bloco(r, cor, { papel: "painel", nome: "Fundo da ilustração", raio: o.mascara?.tipo === "retangulo" ? o.mascara.raio : 0 });
  }
  const respiro = o.respiro ?? Math.min(r.w, r.h) * 0.12;
  const alvo = o.mascara?.tipo === "circulo" ? dentro(r, Math.min(r.w, r.h) * 0.2) : dentro(r, respiro);
  return c.visual(alvo, v, { alinhar: o.alinhar ?? { x: 0.5, y: o.mascara?.tipo === "circulo" ? 0.55 : 0.5 } }).ret;
}

// ───────────────────────────── texto

/**
 * Uma coluna de texto completa: título em cima, informação embaixo, marca
 * no pé. Monta de baixo para cima — é o conteúdo de baixo que tem tamanho
 * fixo; o título fica com o espaço que sobrar.
 */
export function coluna(
  c: Compositor,
  r: Ret,
  cfg: {
    topo: (ItemDeTexto | null)[];
    base?: (ItemDeTexto | null)[];
    marca?: boolean;
    /** Logo sem o nome da organização (o nome já está noutro lugar da arte). */
    marcaSemNome?: boolean;
    alinhamento?: Alinhamento;
    divisor?: boolean;
    verticalTopo?: "top" | "middle" | "bottom";
    fracaoDaBase?: number;
  },
): boolean {
  const u = c.amb.u;
  const al = cfg.alinhamento ?? "left";
  let limite = r.y + r.h;
  if (cfg.marca) {
    const alt = u * 7;
    const mk = c.rodapeDeMarca({ x: r.x, y: limite - alt, w: r.w, h: alt }, al, { semNome: cfg.marcaSemNome });
    if (mk && mk.h > 0) limite = mk.y - u * 3;
  }
  const base = (cfg.base ?? []).filter((i): i is ItemDeTexto => !!i);
  if (base.length) {
    const alt = (limite - r.y) * (cfg.fracaoDaBase ?? 0.5);
    const b = c.pilha({ x: r.x, y: limite - alt, w: r.w, h: alt }, base, { alinhamento: al, vertical: "bottom", espaco: u * 0.9 });
    if (!b) return false;
    limite = b.y - u * 3.5;
    if (cfg.divisor) {
      const x0 = al === "right" ? r.x + r.w - u * 12 : al === "center" ? r.x + r.w / 2 - u * 6 : r.x;
      c.linha(x0, limite, x0 + u * 12, limite, c.p.destaque, Math.max(2, u * 0.45), { nome: "Divisor" });
      limite -= u * 3;
    }
  }
  const topo = cfg.topo.filter((i): i is ItemDeTexto => !!i);
  const t = c.pilha({ x: r.x, y: r.y, w: r.w, h: limite - r.y }, topo, { alinhamento: al, vertical: cfg.verticalTopo ?? "top" });
  return !!t;
}

/** Título + sobretítulo + apoio, na ordem de leitura. */
export function blocoPrincipal(c: Compositor, o: { tituloMax?: number; tituloMin?: number; linhas?: number; apoio?: boolean; versiculo?: boolean } = {}): (ItemDeTexto | null)[] {
  return [
    c.itemSobretitulo(),
    c.itemTitulo(o.tituloMax, o.tituloMin, o.linhas ?? 4),
    ...(o.apoio === false ? [] : c.itensDeApoio({ versiculo: o.versiculo })),
  ];
}
