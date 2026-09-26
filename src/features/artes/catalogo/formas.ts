import type { TipoDeTextura } from "../documento.ts";

/**
 * Formas e texturas desenhadas por código.
 *
 * Os caminhos saem em coordenadas de 0 a 1: a camada guarda o desenho e a
 * caixa, e o Konva estica o desenho até a caixa. Assim a mesma bolha serve a
 * um quadrado de 1080 e a um story de 1920, e o editor pode redimensionar
 * sem refazer nada.
 *
 * Tudo com semente: a mesma arte, reaberta, tem a mesma bolha — e a
 * composição salva guarda o caminho pronto, então nem a semente precisa
 * sobreviver a uma mudança destas funções.
 */

export function aleatorio(semente: number): () => number {
  let a = (Math.floor(semente) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => Number(v.toFixed(4));

/**
 * Uma bolha orgânica: pontos em volta do centro, raio variando pouco, e uma
 * curva suave passando por todos (Catmull-Rom convertida em Bézier).
 */
export function bolha(semente: number, pontos = 7, irregularidade = 0.16): string {
  const r = aleatorio(semente);
  const giro = r() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < pontos; i++) {
    const ang = giro + (i / pontos) * Math.PI * 2;
    const raio = 0.5 * (1 - irregularidade + r() * irregularidade);
    pts.push([0.5 + Math.cos(ang) * raio, 0.5 + Math.sin(ang) * raio]);
  }
  // Normaliza para ocupar a caixa inteira: a bolha não pode ficar menor que
  // a área que o layout reservou para ela.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const norm = pts.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)] as [number, number]);
  return curvaFechada(norm);
}

function curvaFechada(pts: [number, number][]): string {
  const k = pts.length;
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < k; i++) {
    const p0 = pts[(i - 1 + k) % k];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % k];
    const p3 = pts[(i + 2) % k];
    // Os pontos de controle ficam presos à caixa: a curva não vaza para
    // fora da área que o layout reservou.
    const preso = (v: number) => Math.max(0, Math.min(1, v));
    const c1 = [preso(p1[0] + (p2[0] - p0[0]) / 6), preso(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [preso(p2[0] - (p3[0] - p1[0]) / 6), preso(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d} Z`;
}

/** Faixa com a borda de cima ondulada — o chão de uma composição orgânica. */
export function faixaOndulada(semente: number, ciclos = 2, amplitude = 0.18): string {
  const r = aleatorio(semente);
  const fase = r() * Math.PI * 2;
  let d = `M0 1 L0 ${n(0.5 + Math.sin(fase) * amplitude)}`;
  const passos = 24;
  for (let i = 1; i <= passos; i++) {
    const x = i / passos;
    d += ` L${n(x)} ${n(0.5 + Math.sin(fase + x * ciclos * Math.PI * 2) * amplitude)}`;
  }
  return `${d} L1 1 Z`;
}

/** Retângulo com a borda de baixo rasgada, como papel. */
export function papelRasgado(semente: number, dentes = 22): string {
  const r = aleatorio(semente);
  let d = "M0 0 L1 0 L1 0.96";
  for (let i = dentes; i >= 0; i--) d += ` L${n(i / dentes)} ${n(0.93 + r() * 0.07)}`;
  return `${d} Z`;
}

/** Pedaço de fita adesiva: pontas serrilhadas. */
export function fita(semente: number): string {
  const r = aleatorio(semente);
  let d = "M0.03 0";
  d += " L0.97 0";
  for (let i = 0; i <= 6; i++) d += ` L${n(i % 2 ? 1 : 0.96 + r() * 0.02)} ${n(i / 6)}`;
  d += " L0.03 1";
  for (let i = 6; i >= 0; i--) d += ` L${n(i % 2 ? 0 : 0.03 + r() * 0.02)} ${n(i / 6)}`;
  return `${d} Z`;
}

export function estrelaDePontas(pontas = 5, recuo = 0.45): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < pontas * 2; i++) {
    const ang = (Math.PI / pontas) * i - Math.PI / 2;
    const raio = i % 2 === 0 ? 0.5 : 0.5 * recuo;
    pts.push([0.5 + Math.cos(ang) * raio, 0.5 + Math.sin(ang) * raio]);
  }
  return `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")} Z`;
}

/** Rabisco de marcador: uma linha em zigue-zague suave (para contorno). */
export function rabisco(semente: number, voltas = 5): string {
  const r = aleatorio(semente);
  let d = `M0 ${n(0.5 + (r() - 0.5) * 0.4)}`;
  for (let i = 1; i <= voltas; i++) {
    const x = i / voltas;
    const y = i % 2 ? 0.1 + r() * 0.2 : 0.7 + r() * 0.2;
    d += ` Q${n(x - 0.5 / voltas)} ${n(y)} ${n(x)} ${n(0.5 + (r() - 0.5) * 0.3)}`;
  }
  return d;
}

/** Arco de janela: retângulo com o topo em semicírculo (desenhado na caixa). */
export const ARCO = "M0 1 L0 0.5 C0 0.22 0.22 0 0.5 0 C0.78 0 1 0.22 1 0.5 L1 1 Z";

/** Meia-lua deitada: a metade de cima de um círculo. */
export const SEMICIRCULO = "M0 1 C0 0.45 0.22 0 0.5 0 C0.78 0 1 0.45 1 1 Z";

/** Diagonal: um trapézio que corta o quadro. */
export function diagonal(inclinacao = 0.3): string {
  return `M0 ${n(inclinacao)} L1 0 L1 1 L0 1 Z`;
}

/** Asterisco / flor de oito pétalas — enfeite de colagem e infantil. */
export function flor(petalas = 8): string {
  let d = "";
  for (let i = 0; i < petalas; i++) {
    const ang = (i / petalas) * Math.PI * 2;
    const x = 0.5 + Math.cos(ang) * 0.28;
    const y = 0.5 + Math.sin(ang) * 0.28;
    const nx = Math.cos(ang + Math.PI / 2) * 0.1;
    const ny = Math.sin(ang + Math.PI / 2) * 0.1;
    d += `M0.5 0.5 Q${n(x + nx)} ${n(y + ny)} ${n(0.5 + Math.cos(ang) * 0.5)} ${n(0.5 + Math.sin(ang) * 0.5)} Q${n(x - nx)} ${n(y - ny)} 0.5 0.5 Z `;
  }
  return d.trim();
}

// ─────────────────────────────────────────────── texturas

/**
 * O ladrilho de uma textura, como SVG em data URL.
 *
 * Ruído usa `stitchTiles`, que faz o ladrilho emendar sem costura. Cor e
 * opacidade vêm prontas: a camada só repete o ladrilho.
 */
export function ladrilho(t: TipoDeTextura, cor: string, tamanho: number, opacidade: number): string {
  const s = Math.max(6, Math.round(tamanho));
  let corpo = "";
  switch (t) {
    case "papel":
    case "grao": {
      const freq = t === "papel" ? 0.55 : 1.3;
      const oitavas = t === "papel" ? 4 : 2;
      corpo =
        `<filter id="r" x="0" y="0" width="100%" height="100%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oitavas}" stitchTiles="stitch" seed="7"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${t === "papel" ? 1.4 : 1.1} -0.5"/>` +
        `</filter><rect width="${s}" height="${s}" fill="${cor}" filter="url(#r)" opacity="${opacidade}"/>`;
      break;
    }
    case "pontilhado":
      corpo = `<circle cx="${s / 2}" cy="${s / 2}" r="${(s * 0.13).toFixed(2)}" fill="${cor}" opacity="${opacidade}"/>`;
      break;
    case "pautado":
      corpo = `<rect x="0" y="${s - 1.5}" width="${s}" height="1.5" fill="${cor}" opacity="${opacidade}"/>`;
      break;
    case "quadriculado":
      corpo =
        `<rect x="0" y="${s - 1}" width="${s}" height="1" fill="${cor}" opacity="${opacidade}"/>` +
        `<rect x="${s - 1}" y="0" width="1" height="${s}" fill="${cor}" opacity="${opacidade}"/>`;
      break;
    case "hachura":
      corpo =
        `<path d="M0 ${s} L${s} 0 M${-s / 2} ${s / 2} L${s / 2} ${-s / 2} M${s / 2} ${s * 1.5} L${s * 1.5} ${s / 2}" ` +
        `stroke="${cor}" stroke-width="${Math.max(1, s * 0.08).toFixed(2)}" opacity="${opacidade}"/>`;
      break;
    case "ondulado":
      corpo = `<path d="M0 ${s / 2} Q${s / 4} ${s * 0.25} ${s / 2} ${s / 2} T${s} ${s / 2}" fill="none" stroke="${cor}" stroke-width="${Math.max(1, s * 0.07).toFixed(2)}" opacity="${opacidade}"/>`;
      break;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${corpo}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
