/**
 * Cor de destaque da cabine — não do que é projetado.
 *
 * "Aço" é o azul-acinzentado de sempre, o padrão de quem nunca tocou nisto.
 * As outras giram só o matiz, na mesma luminosidade e saturação — para
 * nenhuma parecer errada nesta sala escura (ver o comentário no topo de
 * styles.css). Nenhuma toca o laranja do "no ar", o vermelho do destrutivo
 * ou o verde do "ok": cor ali ainda é estado, e esses três continuam fixos.
 */
export type AccentId = "aco" | "verde-agua" | "violeta" | "rosa";

export interface AccentPreset {
  id: AccentId;
  name: string;
  bg: string;
  fg: string;
  ring: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "aco", name: "Aço", bg: "#7d9bb8", fg: "#0f161c", ring: "#b9c6d4" },
  { id: "verde-agua", name: "Verde-água", bg: "#61a6a6", fg: "#091818", ring: "#a9cecd" },
  { id: "violeta", name: "Violeta", bg: "#9f8fbe", fg: "#16131d", ring: "#c9c0dc" },
  { id: "rosa", name: "Rosa", bg: "#bc84a4", fg: "#1d1118", ring: "#deb9cd" },
];

export function accentPresetById(id: AccentId | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

/** Aplica a cor escolhida às três variáveis que o resto do CSS já usa. */
export function applyAccentPreset(id: AccentId | undefined): void {
  if (typeof document === "undefined") return;
  const preset = accentPresetById(id);
  const root = document.documentElement.style;
  root.setProperty("--color-accent", preset.bg);
  root.setProperty("--color-accent-fg", preset.fg);
  root.setProperty("--color-ring", preset.ring);
}
