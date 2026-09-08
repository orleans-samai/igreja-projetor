import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diagnose,
  isWall,
  optimizeLocal,
  phraseForScreen,
} from "./slide-optimize.ts";
import type { Theme } from "./types.ts";

const JOAO =
  "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito para que todo aquele que nele crê não pereça mas tenha a vida eterna.";

const theme: Theme = {
  id: "t",
  name: "t",
  backgroundType: "image",
  backgroundValue: "/themes/louvor.jpg",
  overlayOpacity: 0.2,
  fontFamily: "Fraunces",
  fontSize: 68,
  fontWeight: 600,
  uppercase: false,
  textColor: "#f4f1ea",
  outlineColor: "#07080b",
  outlineWidth: 1,
  shadow: false,
  alignH: "center",
  alignV: "center",
  lineHeight: 1.22,
  margin: 6,
  showTitle: false,
  showCopyright: false,
  showReference: true,
  applyTo: "both",
};

const settings = {
  maxLines: 5,
  margins: { t: 6, r: 6, b: 6, l: 6 },
  showWallpaper: true,
  baseFill: "dark" as const,
};

describe("phraseForScreen", () => {
  it("breaks João 3.16 into telão-sized slides without dropping words", () => {
    const slides = phraseForScreen(JOAO);
    const joined = slides.join(" ").replace(/\s+/g, " ");
    const original = JOAO.replace(/\s+/g, " ");
    assert.equal(joined, original);
    assert.ok(slides.length >= 3, `expected ≥3 slides, got ${slides.length}: ${JSON.stringify(slides)}`);
    for (const s of slides) {
      const lines = s.split("\n");
      assert.ok(lines.length <= 3, s);
      for (const line of lines) {
        assert.ok(line.length <= 46, `"${line}" is ${line.length} chars`);
      }
    }
  });

  it("packs already-phrased lyrics two lines at a time", () => {
    const raw = "Teu amor me alcançou\nno meio da tempestade\nagora posso cantar\nda tua fidelidade";
    const slides = phraseForScreen(raw);
    assert.equal(slides.length, 2);
    assert.equal(slides[0], "Teu amor me alcançou\nno meio da tempestade");
  });
});

describe("diagnose + optimizeLocal", () => {
  it("flags a wall of text and returns readable slides", () => {
    assert.equal(isWall(JOAO), true);
    const issues = diagnose({
      kind: "text",
      slides: [{ id: "1", label: "Aviso", text: JOAO }],
      raw: JOAO,
      theme,
      settings,
    });
    assert.ok(issues.some((i) => i.kind === "wall"));
    const result = optimizeLocal({
      kind: "text",
      slides: [{ id: "1", label: "Aviso", text: JOAO }],
      raw: JOAO,
      theme,
      settings,
    });
    assert.ok(result.slides.length >= 3);
    assert.ok(result.themePatch.overlayOpacity === 0.52);
    assert.ok(result.settingsPatch.margins?.l === 10);
    const stillWall = result.slides.every((s) => isWall(s.text));
    assert.equal(stillWall, false);
  });
});
