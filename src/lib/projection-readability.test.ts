import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastRatio, projectionReadability } from "./projection-readability.ts";
import type { Theme } from "./types.ts";
const theme = { fontSize: 64, margin: 8, backgroundType: "color", backgroundValue: "#000000", textColor: "#ffffff", overlayOpacity: 0 } as Theme;
const settings = { margins: { t: 8, r: 8, b: 8, l: 8 }, showWallpaper: true, baseFill: "dark" as const };
test("4:3 cover detects cropped text; contain preserves it", () => {
  const cover = projectionReadability(theme, settings, 1024, 768, "cover");
  const contain = projectionReadability(theme, settings, 1024, 768, "contain");
  assert.ok(cover.issues.some((s) => s.includes("corta")));
  assert.equal(contain.cropX, 0);
  assert.equal(contain.cropY, 0);
  assert.equal(contain.issues.length, 0);
});
test("small output warns about physical font pixels even when canvas fits", () => {
  const report = projectionReadability(theme, settings, 640, 360, "contain");
  assert.equal(report.fontPixels, 21);
  assert.ok(report.issues.some((s) => s.includes("21 pixels")));
});
test("contrast uses linear light and understands shorthand hex", () => {
  assert.equal(contrastRatio("#fff", "#000"), 21);
  assert.equal(contrastRatio("#fff", "#fff"), 1);
  assert.equal(contrastRatio("var(--color)", "#fff"), null);
  assert.ok((contrastRatio("#fff", "#fff", 0.7) ?? 0) > 4.5);
});
