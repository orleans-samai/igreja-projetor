import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOperatorShortcut } from "./operator-shortcuts.ts";

describe("atalhos da cabine", () => {
  it("cobre os comandos críticos de projeção", () => {
    assert.equal(resolveOperatorShortcut({ key: "F5" }), "present");
    assert.equal(resolveOperatorShortcut({ key: "Escape" }), "escape");
    assert.equal(resolveOperatorShortcut({ key: "ArrowRight" }), "next");
    assert.equal(resolveOperatorShortcut({ key: "ArrowLeft" }), "previous");
    assert.equal(resolveOperatorShortcut({ key: "b" }), "black");
    assert.equal(resolveOperatorShortcut({ key: "l" }), "logo");
    assert.equal(resolveOperatorShortcut({ key: "F9" }), "emergency");
  });

  it("não troca o telão enquanto o operador digita ou usa um diálogo", () => {
    assert.equal(resolveOperatorShortcut({ key: " ", typing: true }), null);
    assert.equal(resolveOperatorShortcut({ key: "ArrowRight", dialogOpen: true }), null);
    assert.equal(resolveOperatorShortcut({ key: "ArrowRight", bibleOpen: true }), null);
  });

  it("mapeia navegação do culto e bloqueia recarga ao vivo", () => {
    assert.deepEqual(resolveOperatorShortcut({ key: "3", ctrl: true }), {
      type: "playlist-item",
      index: 2,
    });
    assert.equal(resolveOperatorShortcut({ key: "r", ctrl: true, live: true }), "reload-blocked");
    assert.equal(resolveOperatorShortcut({ key: "r", ctrl: true, live: false }), null);
  });
});
