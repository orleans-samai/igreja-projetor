import { css, type Rgba } from "./cores.ts";
import {
  montarCena,
  type Caixa,
  type CelulaDeTabela,
  type Contorno,
  type CorpoDeTexto,
  type ImagemPreenchida,
  type Item,
  type Preenchimento,
  type Sombra,
  type Trecho,
} from "./cena.ts";
import { areaDeTexto, soContorno, tracosDe, type Comando, type Geometria, type Traco } from "./geometria.ts";
import { diagramar, topoDoBloco, type FonteCss, type Medidor } from "./texto.ts";
import { abrirZip, type Pacote } from "./zip.ts";

/**
 * O PowerPoint desenhado pelo próprio Lúmen, slide a slide, em Full HD.
 *
 * É a terceira opção: com PowerPoint no computador, ele desenha; sem ele,
 * o LibreOffice; sem nenhum dos dois, este desenho. Cada slide vira uma
 * imagem PNG do tamanho do telão, como as páginas do PDF — e dali o
 * caminho é o mesmo.
 *
 * Fonte que o autor usou e não existe neste Windows é trocada por uma
 * parecida (serifada por serifada, condensada por condensada), e a cabine
 * diz quais foram trocadas: é a diferença que a igreja vai notar.
 */

export interface DesenhoDoPptx {
  titulo: string;
  paginas: Uint8Array[];
  fontesTrocadas: string[];
  faltas: string[];
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─────────────────────────────────────────── fontes

/** Uma fonte parecida com a que falta, entre as que todo Windows 10/11 tem. */
export function fonteParecida(familia: string): string {
  const f = familia.toLowerCase();
  if (/script|hand|brush|pacifico|lobster|dancing|allura|vibes|satisfy|caveat|kalam|comic|signature/.test(f)) return "Segoe Script";
  if (/condensed|narrow|compressed|bebas|oswald|anton|impact|league gothic|teko|fjalla|agency/.test(f)) return "Bahnschrift Condensed";
  if (/mono|courier|consolas|code/.test(f)) return "Consolas";
  if (!/sans/.test(f) && /serif|times|georgia|garamond|cambria|palatino|book|baskerville|playfair|merriweather|lora|minion|caslon|bodoni|didot|constantia|century|cormorant|libre|crimson|fraunces/.test(f)) {
    return "Georgia";
  }
  if (/light|thin/.test(f)) return "Segoe UI Light";
  return "Segoe UI";
}

function limpar(familia: string): string {
  return familia.replace(/["\\;{}<>]/g, "").trim() || "Segoe UI";
}

function pilha(familia: string): string {
  const f = limpar(familia);
  return `"${f}", "${fonteParecida(f)}", sans-serif`;
}

function fonteCss(f: FonteCss): string {
  return `${f.italico ? "italic " : ""}${f.negrito ? "bold " : ""}${Math.max(1, f.tamanhoPx).toFixed(2)}px ${pilha(f.familia)}`;
}

/**
 * Se a fonte existe neste computador. O canvas não conta; a pista é a
 * largura: com a fonte ausente, o texto mede igual à genérica em que ele cai.
 */
function fonteExiste(ctx: CanvasRenderingContext2D, familia: string): boolean {
  const amostra = "mmmmmmmmmmlliWWQ@#ãõçÁ";
  for (const generica of ["monospace", "serif", "sans-serif"]) {
    ctx.font = `72px ${generica}`;
    const base = ctx.measureText(amostra).width;
    ctx.font = `72px "${limpar(familia)}", ${generica}`;
    if (Math.abs(ctx.measureText(amostra).width - base) > 0.01) return true;
  }
  return false;
}

function medidorDo(ctx: CanvasRenderingContext2D): Medidor {
  const larguras = new Map<string, number>();
  const metricas = new Map<string, { ascendente: number; descendente: number }>();
  const comEspaco = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  return {
    largura(texto, fonte, espacamentoPx) {
      const f = fonteCss(fonte);
      const chave = `${f}|${espacamentoPx}|${texto}`;
      let l = larguras.get(chave);
      if (l === undefined) {
        ctx.font = f;
        comEspaco.letterSpacing = `${espacamentoPx}px`;
        l = ctx.measureText(texto).width;
        comEspaco.letterSpacing = "0px";
        larguras.set(chave, l);
      }
      return l;
    },
    metricas(fonte) {
      const f = fonteCss(fonte);
      let m = metricas.get(f);
      if (!m) {
        ctx.font = f;
        const t = ctx.measureText("ÁHgjy");
        m = {
          ascendente: t.fontBoundingBoxAscent || fonte.tamanhoPx * 0.92,
          descendente: t.fontBoundingBoxDescent || fonte.tamanhoPx * 0.28,
        };
        metricas.set(f, m);
      }
      return m;
    },
  };
}

// ─────────────────────────────────────────── imagens

const TIPO_DA_IMAGEM: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

class Imagens {
  private cache = new Map<string, Promise<ImageBitmap | null>>();
  private pacote: Pacote;
  constructor(pacote: Pacote) {
    this.pacote = pacote;
  }

  pegar(caminho: string): Promise<ImageBitmap | null> {
    let p = this.cache.get(caminho);
    if (!p) {
      p = (async () => {
        const bytes = await this.pacote.bytes(caminho);
        if (!bytes?.length) return null;
        const ext = caminho.slice(caminho.lastIndexOf(".") + 1).toLowerCase();
        try {
          return await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: TIPO_DA_IMAGEM[ext] ?? "" }));
        } catch {
          return null;
        }
      })();
      this.cache.set(caminho, p);
    }
    return p;
  }

  async fechar() {
    for (const p of this.cache.values()) (await p)?.close();
    this.cache.clear();
  }
}

// ─────────────────────────────────────────── caminhos e tinta

function caminhoDe(comandos: Comando[]): Path2D {
  const c = new Path2D();
  for (const k of comandos) {
    if (k.op === "M") c.moveTo(k.x, k.y);
    else if (k.op === "L") c.lineTo(k.x, k.y);
    else if (k.op === "C") c.bezierCurveTo(k.x1, k.y1, k.x2, k.y2, k.x, k.y);
    else if (k.op === "Q") c.quadraticCurveTo(k.x1, k.y1, k.x, k.y);
    else if (k.op === "A") c.ellipse(k.cx, k.cy, Math.max(0, k.rx), Math.max(0, k.ry), 0, k.inicio, k.fim, k.antiHorario);
    else c.closePath();
  }
  return c;
}

function retangulo(a: Area): Path2D {
  const c = new Path2D();
  c.rect(a.x, a.y, a.w, a.h);
  return c;
}

function aplicarSombra(ctx: CanvasRenderingContext2D, s: Sombra | null, k: number) {
  if (!s) {
    ctx.shadowColor = "transparent";
    return;
  }
  const dist = s.distancia * k;
  ctx.shadowColor = css(s.cor);
  ctx.shadowBlur = s.desfoque * k;
  ctx.shadowOffsetX = dist * Math.cos((s.direcao * Math.PI) / 180);
  ctx.shadowOffsetY = dist * Math.sin((s.direcao * Math.PI) / 180);
}

function tintaDoGradiente(ctx: CanvasRenderingContext2D, p: Extract<Preenchimento, { tipo: "gradiente" }>, a: Area): CanvasGradient {
  let g: CanvasGradient;
  if (p.radial) {
    const cx = a.x + p.centro.x * a.w;
    const cy = a.y + p.centro.y * a.h;
    const r = Math.max(
      Math.hypot(cx - a.x, cy - a.y),
      Math.hypot(a.x + a.w - cx, cy - a.y),
      Math.hypot(cx - a.x, a.y + a.h - cy),
      Math.hypot(a.x + a.w - cx, a.y + a.h - cy),
    );
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
  } else {
    const ang = (p.angulo * Math.PI) / 180;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const meio = (Math.abs(a.w * dx) + Math.abs(a.h * dy)) / 2;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    g = ctx.createLinearGradient(cx - dx * meio, cy - dy * meio, cx + dx * meio, cy + dy * meio);
  }
  for (const parada of p.paradas) g.addColorStop(Math.max(0, Math.min(1, parada.pos)), css(parada.cor));
  return g;
}

async function desenharImagem(ctx: CanvasRenderingContext2D, img: ImagemPreenchida, a: Area, recorteDaForma: Path2D | null, imagens: Imagens, k: number) {
  const bitmap = await imagens.pegar(img.midia);
  if (!bitmap) return;
  ctx.save();
  if (recorteDaForma) ctx.clip(recorteDaForma);
  ctx.globalAlpha *= img.opacidade;
  const filtros: string[] = [];
  if (img.cinza) filtros.push("grayscale(1)");
  if (img.brilho) filtros.push(`brightness(${1 + img.brilho})`);
  if (img.contraste) filtros.push(`contrast(${1 + img.contraste})`);
  if (filtros.length) ctx.filter = filtros.join(" ");
  if (img.mosaico) {
    const padrao = ctx.createPattern(bitmap, "repeat");
    if (padrao) {
      // Ladrilho no tamanho natural da imagem (96 dpi = 9525 EMU por pixel).
      const escala = 9525 * k;
      padrao.setTransform(
        new DOMMatrix()
          .translate(a.x + img.mosaico.tx * k, a.y + img.mosaico.ty * k)
          .scale(escala * img.mosaico.sx, escala * img.mosaico.sy),
      );
      ctx.fillStyle = padrao;
      ctx.fillRect(a.x, a.y, a.w, a.h);
    }
  } else {
    // O recorte diz que pedaço da imagem estica até a caixa; recorte
    // negativo é sobra — a imagem fica menor que a caixa.
    const { l, t, r, b } = img.recorte;
    const larguraVisivel = Math.max(1e-6, 1 - l - r);
    const alturaVisivel = Math.max(1e-6, 1 - t - b);
    const w = a.w / larguraVisivel;
    const h = a.h / alturaVisivel;
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    ctx.drawImage(bitmap, a.x - l * w, a.y - t * h, w, h);
  }
  ctx.restore();
}

async function pintar(ctx: CanvasRenderingContext2D, p: Preenchimento, caminho: Path2D, a: Area, parImpar: boolean, imagens: Imagens, k: number) {
  const regra: CanvasFillRule = parImpar ? "evenodd" : "nonzero";
  if (p.tipo === "solido") {
    ctx.fillStyle = css(p.cor);
    ctx.fill(caminho, regra);
  } else if (p.tipo === "gradiente") {
    ctx.fillStyle = tintaDoGradiente(ctx, p, a);
    ctx.fill(caminho, regra);
  } else if (p.tipo === "padrao") {
    ctx.fillStyle = css(p.fundo);
    ctx.fill(caminho, regra);
    ctx.fillStyle = css({ ...p.frente, a: p.frente.a * 0.5 });
    ctx.fill(caminho, regra);
  } else {
    await desenharImagem(ctx, p, a, caminho, imagens, k);
  }
}

const TRACEJADOS: Record<string, number[]> = {
  dot: [1, 1],
  sysDot: [1, 1],
  dash: [4, 3],
  sysDash: [3, 1],
  lgDash: [8, 3],
  dashDot: [4, 3, 1, 3],
  sysDashDot: [3, 1, 1, 1],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDashDotDot: [3, 1, 1, 1, 1, 1],
};

function prepararContorno(ctx: CanvasRenderingContext2D, c: Contorno, k: number) {
  const largura = Math.max(1, c.largura * k);
  ctx.lineWidth = largura;
  ctx.strokeStyle = css(c.cor);
  ctx.lineCap = c.ponta === "rnd" ? "round" : c.ponta === "sq" ? "square" : "butt";
  ctx.lineJoin = c.juncao;
  ctx.setLineDash((TRACEJADOS[c.tracejado] ?? []).map((v) => v * largura));
}

/** A ponta de seta de uma linha, desenhada no fim dela, na direção do último trecho. */
function desenharPonta(ctx: CanvasRenderingContext2D, ponta: Contorno["fim"], de: [number, number], ate: [number, number], c: Contorno, k: number) {
  if (!ponta) return;
  const largura = Math.max(1, c.largura * k);
  const tamanho = { sm: 2, med: 3, lg: 5 } as Record<string, number>;
  const comprimento = largura * (tamanho[ponta.comprimento] ?? 3);
  const abertura = largura * (tamanho[ponta.largura] ?? 3);
  const ang = Math.atan2(ate[1] - de[1], ate[0] - de[0]);
  ctx.save();
  ctx.translate(ate[0], ate[1]);
  ctx.rotate(ang);
  ctx.setLineDash([]);
  ctx.fillStyle = css(c.cor);
  ctx.beginPath();
  if (ponta.tipo === "oval") ctx.ellipse(0, 0, comprimento / 2, abertura / 2, 0, 0, Math.PI * 2);
  else if (ponta.tipo === "diamond") {
    ctx.moveTo(comprimento / 2, 0);
    ctx.lineTo(0, abertura / 2);
    ctx.lineTo(-comprimento / 2, 0);
    ctx.lineTo(0, -abertura / 2);
  } else if (ponta.tipo === "arrow") {
    ctx.strokeStyle = css(c.cor);
    ctx.lineWidth = largura;
    ctx.moveTo(-comprimento, -abertura / 2);
    ctx.lineTo(0, 0);
    ctx.lineTo(-comprimento, abertura / 2);
    ctx.stroke();
    ctx.restore();
    return;
  } else {
    // triangle, stealth
    ctx.moveTo(0, 0);
    ctx.lineTo(-comprimento, -abertura / 2);
    if (ponta.tipo === "stealth") ctx.lineTo(-comprimento * 0.6, 0);
    ctx.lineTo(-comprimento, abertura / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function pontasDoTraco(comandos: Comando[]): { inicio: [[number, number], [number, number]] | null; fim: [[number, number], [number, number]] | null } {
  const pontos: [number, number][] = [];
  for (const c of comandos) {
    if (c.op === "M" || c.op === "L") pontos.push([c.x, c.y]);
    else if (c.op === "C") pontos.push([c.x2, c.y2], [c.x, c.y]);
    else if (c.op === "Q") pontos.push([c.x1, c.y1], [c.x, c.y]);
  }
  if (pontos.length < 2) return { inicio: null, fim: null };
  return {
    inicio: [pontos[1], pontos[0]],
    fim: [pontos[pontos.length - 2], pontos[pontos.length - 1]],
  };
}

// ─────────────────────────────────────────── transformações

/** Leva o canvas para o quadro da caixa: origem no canto, girada e espelhada em volta do centro. */
function entrarNaCaixa(ctx: CanvasRenderingContext2D, c: Caixa, k: number, espelhar: boolean) {
  const w = c.cx * k;
  const h = c.cy * k;
  ctx.translate(c.x * k + w / 2, c.y * k + h / 2);
  let rot = c.rot;
  // O texto não espelha: a forma virada de cabeça para baixo leva a letra
  // de cabeça para baixo, mas nunca ao contrário, como no PowerPoint.
  if (!espelhar && c.flipV) rot += 180;
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  if (espelhar) ctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  ctx.translate(-w / 2, -h / 2);
}

// ─────────────────────────────────────────── texto

function tintaDoTrecho(ctx: CanvasRenderingContext2D, t: Trecho, area: Area): string | CanvasGradient | null {
  if (!t.cor) return null;
  if (t.cor.tipo === "solido") return css(t.cor.cor);
  if (t.cor.tipo === "gradiente") return tintaDoGradiente(ctx, t.cor, area);
  if (t.cor.tipo === "padrao") return css(t.cor.frente);
  return "#000000";
}

function desenharTexto(
  ctx: CanvasRenderingContext2D,
  corpo: CorpoDeTexto,
  area: Area,
  k: number,
  medidor: Medidor,
  sombraDaForma: Sombra | null,
) {
  const m = corpo.margens;
  let interna: Area = {
    x: area.x + m.l * k,
    y: area.y + m.t * k,
    w: Math.max(1, area.w - (m.l + m.r) * k),
    h: Math.max(1, area.h - (m.t + m.b) * k),
  };
  ctx.save();
  if (corpo.vertical !== "horz") {
    // Texto em pé: gira a área e diagrama com largura e altura trocadas.
    if (corpo.vertical === "vert") {
      ctx.translate(interna.x + interna.w, interna.y);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(interna.x, interna.y + interna.h);
      ctx.rotate(-Math.PI / 2);
    }
    interna = { x: 0, y: 0, w: interna.h, h: interna.w };
  }
  const d = diagramar(corpo, interna.w, interna.h, k, medidor);
  const topo = interna.y + topoDoBloco(corpo.ancora, d.altura, interna.h);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const comEspaco = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  for (const linha of d.linhas) {
    for (const q of linha.pedacos) {
      if (q.branco || !q.texto) continue;
      const x = interna.x + q.x;
      const y = topo + linha.base + q.deslocamento;
      const t = q.trecho;
      if (t.realce) {
        ctx.shadowColor = "transparent";
        ctx.fillStyle = css(t.realce);
        ctx.fillRect(x, topo + linha.topo, q.largura, linha.altura);
      }
      ctx.font = fonteCss(q.fonte);
      comEspaco.letterSpacing = `${q.espacamentoPx}px`;
      aplicarSombra(ctx, t.sombra ?? sombraDaForma, k);
      const tinta = tintaDoTrecho(ctx, t, interna);
      if (tinta) {
        ctx.fillStyle = tinta;
        ctx.fillText(q.texto, x, y);
      }
      if (t.contorno) {
        ctx.shadowColor = "transparent";
        ctx.lineWidth = Math.max(0.5, t.contorno.largura * k);
        ctx.strokeStyle = css(t.contorno.cor);
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        ctx.strokeText(q.texto, x, y);
      }
      if (t.sublinhado || t.tachado) {
        ctx.shadowColor = "transparent";
        const espessura = Math.max(1, q.fonte.tamanhoPx / 16);
        ctx.fillStyle = typeof tinta === "string" ? tinta : "#000000";
        if (t.sublinhado) ctx.fillRect(x, y + q.fonte.tamanhoPx * 0.12, q.largura, espessura);
        if (t.tachado) ctx.fillRect(x, y - q.fonte.tamanhoPx * 0.3, q.largura, espessura);
      }
    }
  }
  comEspaco.letterSpacing = "0px";
  ctx.restore();
}

// ─────────────────────────────────────────── itens

interface Pincel {
  ctx: CanvasRenderingContext2D;
  k: number;
  medidor: Medidor;
  imagens: Imagens;
}

async function desenharForma(
  p: Pincel,
  caixa: Caixa,
  geometria: Geometria,
  preenchimento: Preenchimento | null,
  contorno: Contorno | null,
  sombra: Sombra | null,
) {
  const { ctx, k } = p;
  const w = caixa.cx * k;
  const h = caixa.cy * k;
  const tracos: Traco[] = tracosDe(geometria, w, h, 1 / k);
  const linha = soContorno(geometria);
  ctx.save();
  entrarNaCaixa(ctx, caixa, k, true);
  for (const t of tracos) {
    const caminho = caminhoDe(t.comandos);
    if (!linha && t.preencher && preenchimento) {
      aplicarSombra(ctx, sombra, k);
      await pintar(ctx, preenchimento, caminho, { x: 0, y: 0, w, h }, Boolean(t.parImpar), p.imagens, k);
      aplicarSombra(ctx, null, k);
    }
    if (t.contornar && contorno) {
      if (!preenchimento || linha) aplicarSombra(ctx, sombra, k);
      prepararContorno(ctx, contorno, k);
      ctx.stroke(caminho);
      aplicarSombra(ctx, null, k);
      if (contorno.inicio || contorno.fim) {
        const pontas = pontasDoTraco(t.comandos);
        if (pontas.inicio) desenharPonta(ctx, contorno.inicio, pontas.inicio[0], pontas.inicio[1], contorno, k);
        if (pontas.fim) desenharPonta(ctx, contorno.fim, pontas.fim[0], pontas.fim[1], contorno, k);
      }
    }
  }
  ctx.restore();
}

async function desenharCelula(p: Pincel, cel: CelulaDeTabela, a: Area) {
  const { ctx, k } = p;
  if (cel.preenchimento) await pintar(ctx, cel.preenchimento, retangulo(a), a, false, p.imagens, k);
  if (cel.texto) desenharTexto(ctx, cel.texto, a, k, p.medidor, null);
}

async function desenharTabela(p: Pincel, item: Extract<Item, { tipo: "tabela" }>) {
  const { ctx, k } = p;
  const x0 = item.caixa.x * k;
  const y0 = item.caixa.y * k;
  const xs = [x0];
  for (const c of item.colunas) xs.push(xs[xs.length - 1] + c * k);
  // A linha cresce até caber o texto, como no PowerPoint: a altura do
  // arquivo é o mínimo.
  const alturas = item.linhas.map((l) => {
    let h = l.altura * k;
    l.celulas.forEach((cel, j) => {
      if (!cel.texto || cel.continua || cel.linhas > 1) return;
      const largura = xs[Math.min(xs.length - 1, j + cel.colunas)] - xs[j];
      const m = cel.texto.margens;
      const d = diagramar(cel.texto, Math.max(1, largura - (m.l + m.r) * k), 1e9, k, p.medidor);
      h = Math.max(h, d.altura + (m.t + m.b) * k);
    });
    return h;
  });
  const ys = [y0];
  for (const h of alturas) ys.push(ys[ys.length - 1] + h);
  const areaDe = (i: number, j: number, cel: CelulaDeTabela): Area => ({
    x: xs[j],
    y: ys[i],
    w: xs[Math.min(xs.length - 1, j + cel.colunas)] - xs[j],
    h: ys[Math.min(ys.length - 1, i + cel.linhas)] - ys[i],
  });
  for (let i = 0; i < item.linhas.length; i += 1) {
    const linha = item.linhas[i];
    for (let j = 0; j < linha.celulas.length && j < xs.length - 1; j += 1) {
      const cel = linha.celulas[j];
      if (!cel.continua) await desenharCelula(p, cel, areaDe(i, j, cel));
    }
  }
  for (let i = 0; i < item.linhas.length; i += 1) {
    const linha = item.linhas[i];
    for (let j = 0; j < linha.celulas.length && j < xs.length - 1; j += 1) {
      const cel = linha.celulas[j];
      if (cel.continua) continue;
      const a = areaDe(i, j, cel);
      const lados: [Contorno | null, number, number, number, number][] = [
        [cel.bordas.t, a.x, a.y, a.x + a.w, a.y],
        [cel.bordas.b, a.x, a.y + a.h, a.x + a.w, a.y + a.h],
        [cel.bordas.l, a.x, a.y, a.x, a.y + a.h],
        [cel.bordas.r, a.x + a.w, a.y, a.x + a.w, a.y + a.h],
      ];
      for (const [c, xa, ya, xb, yb] of lados) {
        if (!c) continue;
        prepararContorno(ctx, c, k);
        ctx.beginPath();
        ctx.moveTo(xa, ya);
        ctx.lineTo(xb, yb);
        ctx.stroke();
      }
    }
  }
}

async function desenharItem(p: Pincel, item: Item): Promise<void> {
  const { ctx, k } = p;
  if (item.tipo === "grupo") {
    ctx.save();
    if (item.caixa.rot || item.caixa.flipH || item.caixa.flipV) {
      const cx = (item.caixa.x + item.caixa.cx / 2) * k;
      const cy = (item.caixa.y + item.caixa.cy / 2) * k;
      ctx.translate(cx, cy);
      if (item.caixa.rot) ctx.rotate((item.caixa.rot * Math.PI) / 180);
      ctx.scale(item.caixa.flipH ? -1 : 1, item.caixa.flipV ? -1 : 1);
      ctx.translate(-cx, -cy);
    }
    for (const f of item.filhos) await desenharItem(p, f);
    ctx.restore();
    return;
  }
  if (item.tipo === "tabela") {
    await desenharTabela(p, item);
    return;
  }
  if (item.tipo === "imagem") {
    const w = item.caixa.cx * k;
    const h = item.caixa.cy * k;
    const tracos = tracosDe(item.geometria, w, h, 1 / k);
    ctx.save();
    entrarNaCaixa(ctx, item.caixa, k, true);
    const recorte = caminhoDe(tracos.flatMap((t) => t.comandos));
    if (item.sombra) {
      // A sombra da foto é a da forma dela: pinta a forma, com a sombra,
      // antes da imagem por cima.
      aplicarSombra(ctx, item.sombra, k);
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill(recorte);
      aplicarSombra(ctx, null, k);
    }
    await desenharImagem(ctx, item.imagem, { x: 0, y: 0, w, h }, recorte, p.imagens, k);
    if (item.contorno) {
      prepararContorno(ctx, item.contorno, k);
      ctx.stroke(recorte);
    }
    ctx.restore();
    return;
  }
  await desenharForma(p, item.caixa, item.geometria, item.preenchimento, item.contorno, item.sombra);
  if (item.texto) {
    const caixaDoTexto = item.caixaDoTexto ?? item.caixa;
    const w = caixaDoTexto.cx * k;
    const h = caixaDoTexto.cy * k;
    const area = item.caixaDoTexto ? { x: 0, y: 0, w, h } : areaDeTexto(item.geometria, w, h);
    ctx.save();
    entrarNaCaixa(ctx, caixaDoTexto, k, false);
    // Caixa de texto sem fundo nem borda: a sombra da forma é a do texto.
    const sombraDoTexto = !item.preenchimento && !item.contorno ? item.sombra : null;
    desenharTexto(ctx, item.texto, area, k, p.medidor, sombraDoTexto);
    ctx.restore();
  }
}

function familiasDe(itens: Item[], saida: Set<string>) {
  const doCorpo = (c: CorpoDeTexto | null) => {
    for (const par of c?.paragrafos ?? []) for (const t of [...par.trechos, par.vazio]) saida.add(t.fonte);
  };
  for (const item of itens) {
    if (item.tipo === "grupo") familiasDe(item.filhos, saida);
    else if (item.tipo === "forma") doCorpo(item.texto);
    else if (item.tipo === "tabela") for (const l of item.linhas) for (const c of l.celulas) doCorpo(c.texto);
  }
}

/** Desenha cada slide de um .pptx/.ppsx em PNG, na largura do telão. */
export async function desenharPptx(bytes: Uint8Array, larguraPx = 1920): Promise<DesenhoDoPptx> {
  const pacote = abrirZip(bytes);
  const cena = await montarCena(pacote);
  const k = larguraPx / cena.largura;
  const alturaPx = Math.max(1, Math.round(cena.altura * k));
  const tela = document.createElement("canvas");
  tela.width = larguraPx;
  tela.height = alturaPx;
  const ctx = tela.getContext("2d");
  const regua = document.createElement("canvas").getContext("2d");
  if (!ctx || !regua) throw new Error("Não consegui abrir a tela de desenho.");
  const medidor = medidorDo(regua);
  const imagens = new Imagens(pacote);

  const familias = new Set<string>();
  for (const s of cena.slides) familiasDe(s.itens, familias);
  const fontesTrocadas = [...familias].filter((f) => !fonteExiste(regua, f)).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const paginas: Uint8Array[] = [];
  try {
    for (const slide of cena.slides) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      aplicarSombra(ctx, null, k);
      // Papel branco por baixo: slide sem fundo desenhado é branco no PowerPoint.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, larguraPx, alturaPx);
      const inteiro: Area = { x: 0, y: 0, w: larguraPx, h: alturaPx };
      if (slide.fundo) await pintar(ctx, slide.fundo, retangulo(inteiro), inteiro, false, imagens, k);
      const pincel: Pincel = { ctx, k, medidor, imagens };
      for (const item of slide.itens) await desenharItem(pincel, item);
      const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, "image/png"));
      if (!blob) throw new Error(`Não consegui desenhar o slide ${paginas.length + 1}.`);
      paginas.push(new Uint8Array(await blob.arrayBuffer()));
      // Um respiro entre slides: a cabine continua respondendo enquanto a
      // apresentação grande desenha.
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    await imagens.fechar();
  }
  return { titulo: cena.titulo, paginas, fontesTrocadas, faltas: cena.faltas };
}

export type { Rgba };
