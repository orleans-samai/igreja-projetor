import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_FADE_MS, MIN_FADE_MS, fadeDurationMs, slideKey } from "./transition.ts";

describe("fadeDurationMs", () => {
  it("corte seco não anima", () => {
    assert.equal(fadeDurationMs({ transition: "cut", fadeMs: 220 }), 0);
  });

  it("fade usa o tempo dos ajustes", () => {
    assert.equal(fadeDurationMs({ transition: "fade", fadeMs: 220 }), 220);
  });

  it("prende o tempo entre o mínimo e o máximo", () => {
    assert.equal(fadeDurationMs({ transition: "fade", fadeMs: 5 }), MIN_FADE_MS);
    assert.equal(fadeDurationMs({ transition: "fade", fadeMs: 9000 }), MAX_FADE_MS);
  });

  it("sessão antiga com valor inválido vira corte", () => {
    assert.equal(fadeDurationMs({ transition: "fade", fadeMs: Number.NaN }), 0);
    assert.equal(fadeDurationMs({ transition: "fade", fadeMs: 0 }), 0);
    assert.equal(fadeDurationMs(undefined), 0);
  });
});

describe("slideKey", () => {
  it("muda quando troca o slide", () => {
    assert.notEqual(slideKey("song-1", "a"), slideKey("song-1", "b"));
  });

  it("muda quando troca a música mesmo com id de slide repetido", () => {
    assert.notEqual(slideKey("song-1", "a"), slideKey("song-2", "a"));
  });

  it("não muda quando só o tema ou o aviso mudou", () => {
    assert.equal(slideKey("song-1", "a"), slideKey("song-1", "a"));
  });

  it("telão sem slide tem chave estável", () => {
    assert.equal(slideKey("song-1", undefined), slideKey(undefined, undefined));
  });
});
