/**
 * Transição entre slides do telão.
 *
 * A cabine grava `settings.transition` ("fade" ou "cut") e `settings.fadeMs`;
 * o telão, o palco e o preview usam estes valores para dissolver um slide no
 * outro. Corte seco = 0ms, sem animação.
 */

import type { LiveFrame } from "./types";

/** Abaixo disso o olho não vê a dissolução — vira corte. */
export const MIN_FADE_MS = 60;
/** Acima disso a letra some por tempo demais no meio do louvor. */
export const MAX_FADE_MS = 1200;

type TransitionSettings = Pick<LiveFrame["settings"], "transition" | "fadeMs">;

/**
 * Duração real da dissolução, em ms. Retorna 0 para corte seco ou para
 * ajustes inválidos vindos de uma sessão antiga gravada no navegador.
 */
export function fadeDurationMs(settings: TransitionSettings | undefined): number {
  if (!settings || settings.transition !== "fade") return 0;
  const ms = Number(settings.fadeMs);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(MAX_FADE_MS, Math.max(MIN_FADE_MS, Math.round(ms)));
}

/**
 * Identidade do que o público está vendo. Muda só quando troca o slide —
 * editar o tema ou disparar um aviso não deve redisparar a transição.
 */
export function slideKey(deckRefId: string | undefined, slideId: string | undefined): string {
  if (!slideId) return "vazio";
  return `${deckRefId ?? ""}#${slideId}`;
}
