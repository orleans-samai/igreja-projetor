import type { FitMode, Theme, Settings } from "./types.ts";

// Slides use a fixed 1920×1080 canvas. The output resolution changes physical
// pixel size and, in cover mode, how much of that canvas is cropped.
export function projectionReadability(theme: Theme, settings: Pick<Settings, "margins" | "showWallpaper" | "baseFill">,
  width: number, height: number, fit: FitMode) {
  const scale = (fit === "cover" ? Math.max : Math.min)(width / 1920, height / 1080);
  const cropX = Math.max(0, (1920 - width / scale) / 2);
  const cropY = Math.max(0, (1080 - height / scale) / 2);
  const marginX = Math.min(Math.max(theme.margin, settings.margins.l), Math.max(theme.margin, settings.margins.r)) * 19.2;
  const marginY = Math.min(Math.max(theme.margin, settings.margins.t), Math.max(theme.margin, settings.margins.b)) * 10.8;
  const fontPixels = Math.round(theme.fontSize * scale);
  const issues: string[] = [];
  if (cropX > marginX || cropY > marginY) issues.push("O preenchimento corta a área do texto. Use Ajustar para preservar as bordas.");
  if (fontPixels < 28) issues.push(`Fonte com aproximadamente ${fontPixels} pixels nesta saída. Aumente a letra e confira do fundo da igreja.`);
  const contrast = settings.showWallpaper && theme.backgroundType === "color"
    ? contrastRatio(theme.textColor, theme.backgroundValue, theme.overlayOpacity) : null;
  if (contrast !== null && contrast < 4.5) issues.push(`Contraste estimado ${contrast.toFixed(1)}:1. Reforce a diferença entre a letra e o fundo.`);
  return { fontPixels, cropX, cropY, contrast, issues };
}

function rgb(hex: string): number[] | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[a-f0-9]{3}$/i.test(h)) h = [...h].map((v) => v + v).join("");
  if (!/^[a-f0-9]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function luminance(color: number[]) {
  const linear = color.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
export function contrastRatio(fg: string, bg: string, overlay = 0): number | null {
  const a = rgb(fg), b = rgb(bg);
  if (!a || !b) return null;
  const l1 = luminance(a), l2 = luminance(b.map((c) => c * (1 - Math.max(0, Math.min(1, overlay)))));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
