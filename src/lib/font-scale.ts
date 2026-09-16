/**
 * Corpo de letra do telão, num lugar só.
 *
 * O tema guarda o tamanho da fonte; isto é um multiplicador por cima, que o
 * operador mexe no A+ / A− sem precisar editar tema nenhum — e que vale para
 * música, Bíblia, aviso e texto ao mesmo tempo.
 *
 * O padrão é maior que 1 de propósito: os temas nasceram com corpo de 48 a 72
 * px num quadro de 1920×1080, o que se lê bem no monitor da cabine e mal no
 * fundo da igreja. Quem já tinha o Lúmen instalado também ganha o aumento,
 * porque o valor mora nos ajustes, não no tema.
 */

export const FONT_SCALE_PADRAO = 1.2;
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 2;
/** Um passo que se nota no telão sem exigir dez cliques. */
export const FONT_SCALE_PASSO = 0.1;

export function limitarFontScale(valor: number): number {
  if (!Number.isFinite(valor)) return FONT_SCALE_PADRAO;
  // Uma casa decimal: evita 1.2000000000000002 depois de alguns passos.
  const preso = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, valor));
  return Math.round(preso * 100) / 100;
}

export function fontScaleDe(settings: { fontScale?: number } | undefined): number {
  return limitarFontScale(settings?.fontScale ?? FONT_SCALE_PADRAO);
}

/** Rótulo para a cabine: 120% diz mais ao operador do que 1.2. */
export function rotuloFontScale(valor: number): string {
  return `${Math.round(limitarFontScale(valor) * 100)}%`;
}
