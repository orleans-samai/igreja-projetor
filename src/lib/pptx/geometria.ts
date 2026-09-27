import { filho, filhos, numero, type No } from "./xml.ts";

/**
 * As formas do PowerPoint, em caminhos que o canvas desenha.
 *
 * O PowerPoint tem quase duzentas formas prontas; um slide de culto usa
 * umas vinte — retângulo, retângulo arredondado, elipse, faixas, setas,
 * balões, estrela — e as desenhadas à mão (`custGeom`), que é onde moram as
 * ondas e os recortes dos modelos de igreja. Estas saem como no PowerPoint,
 * com os ajustes (o arredondado, a ponta da seta) que o autor puxou. Forma
 * desconhecida vira retângulo: a cor e o lugar dela chegam ao telão, que é
 * o que mais pesa.
 */

export type Comando =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Q"; x1: number; y1: number; x: number; y: number }
  | { op: "A"; cx: number; cy: number; rx: number; ry: number; inicio: number; fim: number; antiHorario: boolean }
  | { op: "Z" };

export interface Traco {
  comandos: Comando[];
  preencher: boolean;
  contornar: boolean;
  /** Buraco no meio (rosca, moldura): preenche pela regra par-ímpar. */
  parImpar?: boolean;
}

export type Geometria = { tipo: "preset"; nome: string; ajustes: Record<string, number> } | { tipo: "custom"; no: No };

/** A área de texto dentro da forma, em pixels do canto da forma. */
export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRAU = Math.PI / 180;
/** Ângulos do DrawingML vêm em 60 000 avos de grau. */
const ANGULO = 60000;

class Caneta {
  comandos: Comando[] = [];
  m(x: number, y: number) {
    this.comandos.push({ op: "M", x, y });
    return this;
  }
  l(x: number, y: number) {
    this.comandos.push({ op: "L", x, y });
    return this;
  }
  c(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.comandos.push({ op: "C", x1, y1, x2, y2, x, y });
    return this;
  }
  /** Arco de elipse pelo centro, em radianos. */
  a(cx: number, cy: number, rx: number, ry: number, inicio: number, fim: number, antiHorario = false) {
    this.comandos.push({ op: "A", cx, cy, rx: Math.max(0, rx), ry: Math.max(0, ry), inicio, fim, antiHorario });
    return this;
  }
  z() {
    this.comandos.push({ op: "Z" });
    return this;
  }
  poligono(pontos: [number, number][]) {
    pontos.forEach(([x, y], i) => (i === 0 ? this.m(x, y) : this.l(x, y)));
    return this.z();
  }
}

function cheio(c: Caneta, extra: Partial<Traco> = {}): Traco[] {
  return [{ comandos: c.comandos, preencher: true, contornar: true, ...extra }];
}

/** Retângulo com cantos redondos (r por canto: sup. esq., sup. dir., inf. dir., inf. esq.). */
function retanguloRedondo(w: number, h: number, [a, b, c, d]: [number, number, number, number]): Caneta {
  const k = new Caneta().m(a, 0).l(w - b, 0);
  if (b > 0) k.a(w - b, b, b, b, -Math.PI / 2, 0);
  k.l(w, h - c);
  if (c > 0) k.a(w - c, h - c, c, c, 0, Math.PI / 2);
  k.l(d, h);
  if (d > 0) k.a(d, h - d, d, d, Math.PI / 2, Math.PI);
  k.l(0, a);
  if (a > 0) k.a(a, a, a, a, Math.PI, Math.PI * 1.5);
  return k.z();
}

/** Retângulo com cantos cortados (d por canto, na mesma ordem). */
function retanguloCortado(w: number, h: number, [a, b, c, d]: [number, number, number, number]): Caneta {
  return new Caneta().poligono([
    [a, 0],
    [w - b, 0],
    [w, b],
    [w, h - c],
    [w - c, h],
    [d, h],
    [0, h - d],
    [0, a],
  ]);
}

function estrela(w: number, h: number, pontas: number, razao: number): Caneta {
  const cx = w / 2;
  const cy = h / 2;
  const pontos: [number, number][] = [];
  for (let i = 0; i < pontas * 2; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / pontas;
    const r = i % 2 === 0 ? 1 : razao;
    pontos.push([cx + (w / 2) * r * Math.cos(ang), cy + (h / 2) * r * Math.sin(ang)]);
  }
  return new Caneta().poligono(pontos);
}

/** O balão com ponta: a ponta vai até o ponto que o autor arrastou. */
function balao(w: number, h: number, corpo: Caneta, ax: number, ay: number): Traco[] {
  const px = w / 2 + (w * ax) / 100000;
  const py = h / 2 + (h * ay) / 100000;
  const ss = Math.min(w, h);
  const meia = ss / 10;
  const ponta = new Caneta();
  // A base da ponta fica no lado do corpo mais perto de onde ela aponta.
  if (Math.abs(px - w / 2) / w > Math.abs(py - h / 2) / h) {
    const x = px < w / 2 ? meia : w - meia;
    const y = Math.min(h - meia * 2, Math.max(meia * 2, py));
    ponta.poligono([[x, y - meia], [px, py], [x, y + meia]]);
  } else {
    const y = py < h / 2 ? meia : h - meia;
    const x = Math.min(w - meia * 2, Math.max(meia * 2, px));
    ponta.poligono([[x - meia, y], [px, py], [x + meia, y]]);
  }
  return [{ comandos: [...corpo.comandos, ...ponta.comandos], preencher: true, contornar: true }];
}

/**
 * Os traços de uma forma pronta, em pixels, no quadro 0..w × 0..h.
 * `aj(nome, padrao)` é o ajuste do autor (avLst), na escala do PowerPoint.
 */
function tracosDoPreset(nome: string, w: number, h: number, aj: (n: string, p: number) => number): Traco[] {
  const ss = Math.min(w, h);
  const hc = w / 2;
  const vc = h / 2;
  switch (nome) {
    case "line":
    case "straightConnector1":
      return [{ comandos: new Caneta().m(0, 0).l(w, h).comandos, preencher: false, contornar: true }];
    case "bentConnector2":
      return [{ comandos: new Caneta().m(0, 0).l(w, 0).l(w, h).comandos, preencher: false, contornar: true }];
    case "bentConnector3":
    case "bentConnector4":
    case "bentConnector5": {
      const x = (w * aj("adj1", 50000)) / 100000;
      return [{ comandos: new Caneta().m(0, 0).l(x, 0).l(x, h).l(w, h).comandos, preencher: false, contornar: true }];
    }
    case "curvedConnector2":
    case "curvedConnector3":
    case "curvedConnector4":
    case "curvedConnector5": {
      const x = (w * aj("adj1", 50000)) / 100000;
      return [{ comandos: new Caneta().m(0, 0).c(x, 0, x, h, w, h).comandos, preencher: false, contornar: true }];
    }
    case "ellipse":
    case "flowChartConnector":
    case "flowChartSummingJunction":
    case "flowChartOr":
    case "cloud":
    case "cloudCallout":
      if (nome === "cloudCallout") return balao(w, h, new Caneta().a(hc, vc, w / 2, h / 2, 0, Math.PI * 2).z(), aj("adj1", -20833), aj("adj2", 62500));
      return cheio(new Caneta().a(hc, vc, w / 2, h / 2, 0, Math.PI * 2).z());
    case "roundRect": {
      const r = Math.min((ss * aj("adj", 16667)) / 100000, ss / 2);
      return cheio(retanguloRedondo(w, h, [r, r, r, r]));
    }
    case "flowChartAlternateProcess": {
      const r = ss / 6;
      return cheio(retanguloRedondo(w, h, [r, r, r, r]));
    }
    case "round1Rect": {
      const r = Math.min((ss * aj("adj", 16667)) / 100000, ss / 2);
      return cheio(retanguloRedondo(w, h, [0, r, 0, 0]));
    }
    case "round2SameRect": {
      const r1 = Math.min((ss * aj("adj1", 16667)) / 100000, ss / 2);
      const r2 = Math.min((ss * aj("adj2", 0)) / 100000, ss / 2);
      return cheio(retanguloRedondo(w, h, [r1, r1, r2, r2]));
    }
    case "round2DiagRect": {
      const r1 = Math.min((ss * aj("adj1", 16667)) / 100000, ss / 2);
      const r2 = Math.min((ss * aj("adj2", 0)) / 100000, ss / 2);
      return cheio(retanguloRedondo(w, h, [r1, r2, r1, r2]));
    }
    case "snip1Rect": {
      const d = Math.min((ss * aj("adj", 16667)) / 100000, ss / 2);
      return cheio(retanguloCortado(w, h, [0, d, 0, 0]));
    }
    case "snip2SameRect": {
      const d1 = Math.min((ss * aj("adj1", 16667)) / 100000, ss / 2);
      const d2 = Math.min((ss * aj("adj2", 0)) / 100000, ss / 2);
      return cheio(retanguloCortado(w, h, [d1, d1, d2, d2]));
    }
    case "snip2DiagRect": {
      const d1 = Math.min((ss * aj("adj1", 0)) / 100000, ss / 2);
      const d2 = Math.min((ss * aj("adj2", 16667)) / 100000, ss / 2);
      return cheio(retanguloCortado(w, h, [d1, d2, d1, d2]));
    }
    case "flowChartTerminator": {
      const rx = Math.min(w * 0.1609, w / 2);
      const k = new Caneta().m(rx, 0).l(w - rx, 0);
      k.a(w - rx, vc, rx, vc, -Math.PI / 2, Math.PI / 2).l(rx, h);
      k.a(rx, vc, rx, vc, Math.PI / 2, Math.PI * 1.5);
      return cheio(k.z());
    }
    case "triangle":
    case "flowChartExtract": {
      const x = nome === "triangle" ? (w * aj("adj", 50000)) / 100000 : hc;
      return cheio(new Caneta().poligono([[x, 0], [w, h], [0, h]]));
    }
    case "flowChartMerge":
      return cheio(new Caneta().poligono([[0, 0], [w, 0], [hc, h]]));
    case "rtTriangle":
      return cheio(new Caneta().poligono([[0, 0], [0, h], [w, h]]));
    case "diamond":
    case "flowChartDecision":
      return cheio(new Caneta().poligono([[hc, 0], [w, vc], [hc, h], [0, vc]]));
    case "parallelogram":
    case "flowChartInputOutput": {
      const x = Math.min((ss * aj("adj", nome === "parallelogram" ? 25000 : 20000)) / 100000, w);
      return cheio(new Caneta().poligono([[x, 0], [w, 0], [w - x, h], [0, h]]));
    }
    case "trapezoid": {
      const x = Math.min((ss * aj("adj", 25000)) / 100000, w / 2);
      return cheio(new Caneta().poligono([[0, h], [x, 0], [w - x, 0], [w, h]]));
    }
    case "flowChartManualOperation":
      return cheio(new Caneta().poligono([[0, 0], [w, 0], [w * 0.8, h], [w * 0.2, h]]));
    case "pentagon":
      return cheio(new Caneta().poligono([[hc, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]]));
    case "hexagon":
    case "flowChartPreparation": {
      const x = Math.min((ss * aj("adj", 25000)) / 100000, w / 2);
      return cheio(new Caneta().poligono([[0, vc], [x, 0], [w - x, 0], [w, vc], [w - x, h], [x, h]]));
    }
    case "octagon": {
      const x = Math.min((ss * aj("adj", 29289)) / 100000, ss / 2);
      return cheio(new Caneta().poligono([[0, x], [x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x]]));
    }
    case "homePlate":
    case "flowChartOffpageConnector": {
      const x = w - Math.min((ss * aj("adj", 50000)) / 100000, w);
      return cheio(new Caneta().poligono([[0, 0], [x, 0], [w, vc], [x, h], [0, h]]));
    }
    case "chevron": {
      const x = Math.min((ss * aj("adj", 50000)) / 100000, w);
      return cheio(new Caneta().poligono([[0, 0], [w - x, 0], [w, vc], [w - x, h], [0, h], [x, vc]]));
    }
    case "rightArrow":
    case "notchedRightArrow":
    case "stripedRightArrow": {
      const dy = (h * aj("adj1", 50000)) / 200000;
      const x = w - Math.min((ss * aj("adj2", 50000)) / 100000, w);
      return cheio(new Caneta().poligono([[0, vc - dy], [x, vc - dy], [x, 0], [w, vc], [x, h], [x, vc + dy], [0, vc + dy]]));
    }
    case "leftArrow": {
      const dy = (h * aj("adj1", 50000)) / 200000;
      const x = Math.min((ss * aj("adj2", 50000)) / 100000, w);
      return cheio(new Caneta().poligono([[w, vc - dy], [x, vc - dy], [x, 0], [0, vc], [x, h], [x, vc + dy], [w, vc + dy]]));
    }
    case "upArrow": {
      const dx = (w * aj("adj1", 50000)) / 200000;
      const y = Math.min((ss * aj("adj2", 50000)) / 100000, h);
      return cheio(new Caneta().poligono([[hc - dx, h], [hc - dx, y], [0, y], [hc, 0], [w, y], [hc + dx, y], [hc + dx, h]]));
    }
    case "downArrow": {
      const dx = (w * aj("adj1", 50000)) / 200000;
      const y = h - Math.min((ss * aj("adj2", 50000)) / 100000, h);
      return cheio(new Caneta().poligono([[hc - dx, 0], [hc + dx, 0], [hc + dx, y], [w, y], [hc, h], [0, y], [hc - dx, y]]));
    }
    case "leftRightArrow": {
      const dy = (h * aj("adj1", 50000)) / 200000;
      const x = Math.min((ss * aj("adj2", 50000)) / 100000, w / 2);
      return cheio(
        new Caneta().poligono([
          [0, vc], [x, 0], [x, vc - dy], [w - x, vc - dy], [w - x, 0], [w, vc],
          [w - x, h], [w - x, vc + dy], [x, vc + dy], [x, h],
        ]),
      );
    }
    case "upDownArrow": {
      const dx = (w * aj("adj1", 50000)) / 200000;
      const y = Math.min((ss * aj("adj2", 50000)) / 100000, h / 2);
      return cheio(
        new Caneta().poligono([
          [hc, 0], [w, y], [hc + dx, y], [hc + dx, h - y], [w, h - y], [hc, h],
          [0, h - y], [hc - dx, h - y], [hc - dx, y], [0, y],
        ]),
      );
    }
    case "plus":
    case "mathPlus": {
      const x = Math.min((ss * aj("adj", 25000)) / 100000, ss / 2);
      return cheio(
        new Caneta().poligono([
          [x, 0], [w - x, 0], [w - x, x], [w, x], [w, h - x], [w - x, h - x],
          [w - x, h], [x, h], [x, h - x], [0, h - x], [0, x], [x, x],
        ]),
      );
    }
    case "star4":
      return cheio(estrela(w, h, 4, aj("adj", 12500) / 50000));
    case "star5":
      return cheio(estrela(w, h, 5, aj("adj", 19098) / 50000));
    case "star6":
      return cheio(estrela(w, h, 6, aj("adj", 28868) / 50000));
    case "star7":
      return cheio(estrela(w, h, 7, aj("adj", 34601) / 50000));
    case "star8":
    case "star12":
    case "star16":
    case "star24":
    case "star32":
      return cheio(estrela(w, h, Number(nome.slice(4)), aj("adj", 37500) / 50000));
    case "star10":
      return cheio(estrela(w, h, 10, aj("adj", 42533) / 50000));
    case "donut": {
      const d = Math.min((ss * aj("adj", 25000)) / 100000, ss / 2);
      const k = new Caneta().a(hc, vc, w / 2, h / 2, 0, Math.PI * 2).z();
      k.a(hc, vc, w / 2 - d, h / 2 - d, 0, Math.PI * 2).z();
      return cheio(k, { parImpar: true });
    }
    case "frame": {
      const d = Math.min((ss * aj("adj1", 12500)) / 100000, ss / 2);
      const k = new Caneta().poligono([[0, 0], [w, 0], [w, h], [0, h]]);
      k.poligono([[d, d], [w - d, d], [w - d, h - d], [d, h - d]]);
      return cheio(k, { parImpar: true });
    }
    case "heart": {
      // A mesma curva do PowerPoint (presetShapeDefinitions): dois Béziers
      // que saem do quarto de cima e se encontram na ponta de baixo.
      const dx1 = (w * 49) / 48;
      const dx2 = (w * 10) / 48;
      const y1 = -h / 3;
      return cheio(
        new Caneta()
          .m(hc, h / 4)
          .c(hc + dx2, y1, hc + dx1, h / 4, hc, h)
          .c(hc - dx1, h / 4, hc - dx2, y1, hc, h / 4)
          .z(),
      );
    }
    case "can":
    case "flowChartMagneticDisk": {
      const ry = Math.min((ss * aj("adj", 25000)) / 200000, h / 2);
      const corpo = new Caneta().m(0, ry).a(hc, ry, w / 2, ry, Math.PI, 0, true).l(w, h - ry).a(hc, h - ry, w / 2, ry, 0, Math.PI).z();
      const tampa = new Caneta().a(hc, ry, w / 2, ry, 0, Math.PI * 2).z();
      return [
        { comandos: corpo.comandos, preencher: true, contornar: true },
        { comandos: tampa.comandos, preencher: true, contornar: true },
      ];
    }
    case "pie": {
      const a1 = (aj("adj1", 0) / ANGULO) * GRAU;
      const a2 = (aj("adj2", 16200000) / ANGULO) * GRAU;
      let fim = a2;
      while (fim <= a1) fim += Math.PI * 2;
      return cheio(new Caneta().m(hc, vc).a(hc, vc, w / 2, h / 2, a1, fim).z());
    }
    case "chord": {
      const a1 = (aj("adj1", 2700000) / ANGULO) * GRAU;
      const a2 = (aj("adj2", 16200000) / ANGULO) * GRAU;
      let fim = a2;
      while (fim <= a1) fim += Math.PI * 2;
      return cheio(new Caneta().a(hc, vc, w / 2, h / 2, a1, fim).z());
    }
    case "arc": {
      const a1 = (aj("adj1", 16200000) / ANGULO) * GRAU;
      const a2 = (aj("adj2", 0) / ANGULO) * GRAU;
      let fim = a2;
      while (fim <= a1) fim += Math.PI * 2;
      return [{ comandos: new Caneta().a(hc, vc, w / 2, h / 2, a1, fim).comandos, preencher: false, contornar: true }];
    }
    case "wedgeRectCallout":
      return balao(w, h, retanguloRedondo(w, h, [0, 0, 0, 0]), aj("adj1", -20833), aj("adj2", 62500));
    case "wedgeRoundRectCallout": {
      const r = Math.min((ss * aj("adj3", 16667)) / 100000, ss / 2);
      return balao(w, h, retanguloRedondo(w, h, [r, r, r, r]), aj("adj1", -20833), aj("adj2", 62500));
    }
    case "wedgeEllipseCallout":
      return balao(w, h, new Caneta().a(hc, vc, w / 2, h / 2, 0, Math.PI * 2).z(), aj("adj1", -20833), aj("adj2", 62500));
    default:
      return cheio(new Caneta().poligono([[0, 0], [w, 0], [w, h], [0, h]]));
  }
}

/**
 * A área de texto de uma forma pronta: numa elipse, o texto fica no
 * retângulo que cabe dentro dela; num triângulo, na metade de baixo. Sem
 * isto, a palavra dentro do círculo encostaria na borda.
 */
export function areaDeTexto(g: Geometria, w: number, h: number): Retangulo {
  if (g.tipo !== "preset") return { x: 0, y: 0, w, h };
  const aj = (n: string, p: number) => g.ajustes[n] ?? p;
  const ss = Math.min(w, h);
  switch (g.nome) {
    case "ellipse":
    case "flowChartConnector": {
      const dx = (w / 2) * (1 - Math.SQRT1_2);
      const dy = (h / 2) * (1 - Math.SQRT1_2);
      return { x: dx, y: dy, w: w - 2 * dx, h: h - 2 * dy };
    }
    case "roundRect": {
      const d = Math.min((ss * aj("adj", 16667)) / 100000, ss / 2) * 0.29289;
      return { x: d, y: d, w: w - 2 * d, h: h - 2 * d };
    }
    case "triangle": {
      const x = (w * aj("adj", 50000)) / 100000;
      return { x: x / 2, y: h / 2, w: (x + w) / 2 - x / 2, h: h / 2 };
    }
    case "diamond":
      return { x: w / 4, y: h / 4, w: w / 2, h: h / 2 };
    case "homePlate": {
      const x = w - Math.min((ss * aj("adj", 50000)) / 100000, w);
      return { x: 0, y: 0, w: (x + w) / 2, h };
    }
    case "chevron": {
      const x = Math.min((ss * aj("adj", 50000)) / 100000, w);
      return { x, y: 0, w: w - 2 * x, h };
    }
    case "rightArrow": {
      const dy = (h * aj("adj1", 50000)) / 200000;
      return { x: 0, y: h / 2 - dy, w, h: dy * 2 };
    }
    case "star5":
      return { x: w * 0.3, y: h * 0.38, w: w * 0.4, h: h * 0.38 };
    default:
      return { x: 0, y: 0, w, h };
  }
}

// ─────────────────────────────────────────── formas desenhadas à mão

/** As variáveis que toda fórmula do DrawingML conhece, a partir do tamanho. */
function variaveis(w: number, h: number): Map<string, number> {
  const ss = Math.min(w, h);
  const ls = Math.max(w, h);
  const v = new Map<string, number>([
    ["w", w], ["h", h], ["l", 0], ["t", 0], ["r", w], ["b", h],
    ["hc", w / 2], ["vc", h / 2], ["ss", ss], ["ls", ls],
    ["cd2", 10800000], ["cd4", 5400000], ["cd8", 2700000],
    ["3cd4", 16200000], ["3cd8", 8100000], ["5cd8", 13500000], ["7cd8", 18900000],
  ]);
  for (const n of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    v.set(`wd${n}`, w / n);
    v.set(`hd${n}`, h / n);
    v.set(`ssd${n}`, ss / n);
  }
  return v;
}

/** Uma fórmula de guia do DrawingML (multiplica e divide, soma e subtrai, seno…), com as variáveis conhecidas. */
function avaliar(formula: string, v: Map<string, number>): number {
  const partes = formula.trim().split(/\s+/);
  const op = partes[0];
  const n = (i: number) => {
    const t = partes[i];
    if (t === undefined) return 0;
    const direto = Number(t);
    return Number.isFinite(direto) ? direto : (v.get(t) ?? 0);
  };
  const ang = (x: number) => (x / ANGULO) * GRAU;
  switch (op) {
    case "*/":
      return n(3) === 0 ? 0 : (n(1) * n(2)) / n(3);
    case "+-":
      return n(1) + n(2) - n(3);
    case "+/":
      return n(3) === 0 ? 0 : (n(1) + n(2)) / n(3);
    case "?:":
      return n(1) > 0 ? n(2) : n(3);
    case "abs":
      return Math.abs(n(1));
    case "at2":
      return (Math.atan2(n(2), n(1)) / GRAU) * ANGULO;
    case "cat2":
      return n(1) * Math.cos(Math.atan2(n(3), n(2)));
    case "cos":
      return n(1) * Math.cos(ang(n(2)));
    case "max":
      return Math.max(n(1), n(2));
    case "min":
      return Math.min(n(1), n(2));
    case "mod":
      return Math.sqrt(n(1) ** 2 + n(2) ** 2 + n(3) ** 2);
    case "pin":
      return n(2) < n(1) ? n(1) : n(2) > n(3) ? n(3) : n(2);
    case "sat2":
      return n(1) * Math.sin(Math.atan2(n(3), n(2)));
    case "sin":
      return n(1) * Math.sin(ang(n(2)));
    case "sqrt":
      return Math.sqrt(Math.max(0, n(1)));
    case "tan":
      return n(1) * Math.tan(ang(n(2)));
    case "val":
      return n(1);
    default:
      return 0;
  }
}

/**
 * Os traços de uma forma desenhada à mão (`a:custGeom`).
 *
 * Cada caminho tem o próprio quadro (w × h do `a:path`), esticado para o
 * tamanho da forma; sem quadro, as coordenadas são as da própria forma, em
 * EMU. `emuPorPx` converte esse caso.
 */
function tracosCustom(no: No, wPx: number, hPx: number, emuPorPx: number): Traco[] {
  const lista = filho(no, "pathLst");
  const guias = filhos(filho(no, "gdLst"), "gd");
  const tracos: Traco[] = [];
  for (const caminho of filhos(lista, "path")) {
    const pw = numero(caminho, "w") ?? wPx * emuPorPx;
    const ph = numero(caminho, "h") ?? hPx * emuPorPx;
    const sx = pw > 0 ? wPx / pw : 0;
    const sy = ph > 0 ? hPx / ph : 0;
    const v = variaveis(pw, ph);
    for (const g of guias) v.set(g.attrs.name ?? "", avaliar(g.attrs.fmla ?? "", v));
    const val = (t: string | undefined) => {
      if (t === undefined) return 0;
      const direto = Number(t);
      return Number.isFinite(direto) ? direto : (v.get(t) ?? 0);
    };
    const ponto = (pt: No | null | undefined): [number, number] => [val(pt?.attrs.x) * sx, val(pt?.attrs.y) * sy];
    const k = new Caneta();
    let atual: [number, number] = [0, 0];
    for (const cmd of caminho.filhos) {
      if (cmd.nome === "moveTo") {
        atual = ponto(filho(cmd, "pt"));
        k.m(...atual);
      } else if (cmd.nome === "lnTo") {
        atual = ponto(filho(cmd, "pt"));
        k.l(...atual);
      } else if (cmd.nome === "cubicBezTo") {
        const [p1, p2, p3] = filhos(cmd, "pt").map(ponto);
        if (p1 && p2 && p3) {
          k.c(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
          atual = p3;
        }
      } else if (cmd.nome === "quadBezTo") {
        const [p1, p2] = filhos(cmd, "pt").map(ponto);
        if (p1 && p2) {
          k.comandos.push({ op: "Q", x1: p1[0], y1: p1[1], x: p2[0], y: p2[1] });
          atual = p2;
        }
      } else if (cmd.nome === "arcTo") {
        const rx = val(cmd.attrs.wR) * sx;
        const ry = val(cmd.attrs.hR) * sy;
        const st = (val(cmd.attrs.stAng) / ANGULO) * GRAU;
        const sw = (val(cmd.attrs.swAng) / ANGULO) * GRAU;
        // Os ângulos do arco são "visuais"; na elipse achatada, o ponto de
        // partida é o do ângulo paramétrico que cai naquela direção.
        const t0 = Math.atan2(rx * Math.sin(st), ry * Math.cos(st));
        const t1 = Math.atan2(rx * Math.sin(st + sw), ry * Math.cos(st + sw));
        const cx = atual[0] - rx * Math.cos(t0);
        const cy = atual[1] - ry * Math.sin(t0);
        let fim = t1;
        if (Math.abs(sw) >= Math.PI * 2 - 1e-9) fim = t0 + Math.sign(sw) * Math.PI * 2;
        else if (sw > 0) while (fim <= t0) fim += Math.PI * 2;
        else while (fim >= t0) fim -= Math.PI * 2;
        k.a(cx, cy, rx, ry, t0, fim, sw < 0);
        atual = [cx + rx * Math.cos(fim), cy + ry * Math.sin(fim)];
      } else if (cmd.nome === "close") {
        k.z();
      }
    }
    tracos.push({
      comandos: k.comandos,
      preencher: caminho.attrs.fill !== "none",
      contornar: caminho.attrs.stroke !== "0" && caminho.attrs.stroke !== "false",
    });
  }
  return tracos;
}

/** A geometria de um `spPr`: pronta (com ajustes) ou desenhada; sem nada, retângulo. */
export function geometriaDe(spPr: No | null | undefined): Geometria {
  const custom = filho(spPr, "custGeom");
  if (custom) return { tipo: "custom", no: custom };
  const prst = filho(spPr, "prstGeom");
  const ajustes: Record<string, number> = {};
  for (const gd of filhos(filho(prst, "avLst"), "gd")) {
    const m = /^val\s+(-?\d+(?:\.\d+)?)$/.exec((gd.attrs.fmla ?? "").trim());
    if (m && gd.attrs.name) ajustes[gd.attrs.name] = Number(m[1]);
  }
  return { tipo: "preset", nome: prst?.attrs.prst ?? "rect", ajustes };
}

export function tracosDe(g: Geometria, wPx: number, hPx: number, emuPorPx = 1): Traco[] {
  if (g.tipo === "custom") return tracosCustom(g.no, wPx, hPx, emuPorPx);
  return tracosDoPreset(g.nome, wPx, hPx, (n, p) => g.ajustes[n] ?? p);
}

/** Linhas e conectores: sem preenchimento, mesmo que o arquivo peça. */
export function soContorno(g: Geometria): boolean {
  return g.tipo === "preset" && /^(line|straightConnector1|bentConnector\d|curvedConnector\d|arc)$/.test(g.nome);
}
