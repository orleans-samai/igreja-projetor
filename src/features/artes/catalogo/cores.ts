/**
 * Contas de cor: contraste, distância e mistura.
 *
 * Contraste é o da WCAG — o mesmo número que qualquer verificador de
 * acessibilidade dá, para ninguém discutir se "dá para ler". Distância é
 * ΔE em Lab: é o que decide se uma cor da paleta "é" a cor proibida, e em
 * RGB duas cores que o olho acha iguais podem ficar longe.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function paraRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function paraHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG), de 0 a 1. */
export function luminancia(hex: string): number {
  const { r, g, b } = paraRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste entre duas luminâncias. */
export function contrasteDeLuz(a: number, b: number): number {
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

export function contraste(a: string, b: string): number {
  return contrasteDeLuz(luminancia(a), luminancia(b));
}

/**
 * O mínimo que o texto precisa, pelo tamanho.
 *
 * Texto grande (título) lê bem com 3:1; informação miúda precisa de 4,5:1.
 * "Grande" é o da WCAG traduzido para arte: corpo ≥ 4% da menor dimensão.
 */
export function contrasteMinimo(tamanhoPx: number, menorLado: number): number {
  return tamanhoPx >= menorLado * 0.04 ? 3 : 4.5;
}

export function misturar(a: string, b: string, t: number): string {
  const x = paraRgb(a);
  const y = paraRgb(b);
  return paraHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export function comAlfa(hex: string, alfa: number): string {
  const { r, g, b } = paraRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alfa)).toFixed(3)})`;
}

function paraLab(hex: string): [number, number, number] {
  const { r, g, b } = paraRgb(hex);
  const [R, G, B] = [canal(r), canal(g), canal(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** ΔE76: abaixo de ~12, a maioria das pessoas diz "é a mesma cor". */
export function distancia(a: string, b: string): number {
  const [l1, a1, b1] = paraLab(a);
  const [l2, a2, b2] = paraLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export const PARECIDA = 18;

/** A cor de texto que mais contrasta com um fundo, entre as candidatas. */
export function melhorContraste(fundo: string, candidatas: string[]): string {
  return candidatas.reduce((a, b) => (contraste(b, fundo) > contraste(a, fundo) ? b : a), candidatas[0] ?? "#000000");
}

/** Saturação HSL, 0 a 1 — para separar cor de marca de cinza. */
export function saturacao(hex: string): number {
  const { r, g, b } = paraRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}
