import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { temaDeVideo } from "./tema-de-video.ts";
import type { Theme } from "./types.ts";

const BASE: Theme = {
  id: "theme-louvor",
  name: "Louvor",
  backgroundType: "color",
  backgroundValue: "#0f1115",
  overlayOpacity: 0.2,
  fontFamily: "Fraunces",
  fontSize: 64,
  fontWeight: 600,
  uppercase: false,
  textColor: "#f7f3ea",
  outlineColor: "#050505",
  outlineWidth: 2,
  shadow: true,
  alignH: "center",
  alignV: "center",
  lineHeight: 1.2,
  margin: 9,
  showTitle: false,
  showCopyright: true,
  showReference: false,
  applyTo: "both",
};

const VIDEO = { url: "lumen://app/__midia/video/Adora%C3%A7%C3%A3o%20suave.webm", titulo: "Adoração suave" };

describe("um vídeo dinâmico como fundo da letra", () => {
  it("vira tema de letra com o vídeo atrás e a letra do tema em uso", () => {
    const t = temaDeVideo(BASE, VIDEO, [BASE]);
    assert.equal(t.backgroundType, "video");
    assert.equal(t.backgroundValue, VIDEO.url);
    assert.equal(t.applyTo, "songs");
    assert.equal(t.name, "Vídeo · Adoração suave");
    for (const campo of ["fontFamily", "fontSize", "textColor", "outlineWidth", "alignV"] as const) {
      assert.equal(t[campo], BASE[campo], campo);
    }
    assert.notEqual(t.id, BASE.id);
  });

  it("põe um véu para a letra não sumir no brilho do vídeo", () => {
    assert.ok(temaDeVideo(BASE, VIDEO, []).overlayOpacity >= 0.35);
    assert.equal(temaDeVideo({ ...BASE, overlayOpacity: 0.6 }, VIDEO, []).overlayOpacity, 0.6);
  });

  it("o mesmo vídeo devolve o mesmo tema, com o ajuste que já tiver", () => {
    const primeiro = temaDeVideo(BASE, VIDEO, []);
    assert.equal(temaDeVideo(BASE, VIDEO, []).id, primeiro.id);
    const ajustado = { ...primeiro, fontSize: 80 };
    assert.deepEqual(temaDeVideo(BASE, VIDEO, [BASE, ajustado]), ajustado);
  });

  it("vídeos diferentes, temas diferentes", () => {
    const outro = { url: "lumen://app/__midia/video/Luzes.webm", titulo: "Luzes" };
    assert.notEqual(temaDeVideo(BASE, VIDEO, []).id, temaDeVideo(BASE, outro, []).id);
  });
});
