import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinoDoTema } from "./destino-do-tema.ts";

describe("o tema clicado vai para o que está no telão", () => {
  it("versículo no ar: o tema vai para a Bíblia, seja qual for a categoria dele", () => {
    assert.equal(destinoDoTema({ kind: "bible" }, { kind: "song" }), "bible");
  });

  it("música no ar: o tema vai para as letras, mesmo com a Bíblia aberta na prévia", () => {
    assert.equal(destinoDoTema({ kind: "song" }, { kind: "bible" }), "songs");
  });

  it("nada no ar: vale o que está na prévia, que é o que entra a seguir", () => {
    assert.equal(destinoDoTema(null, { kind: "bible" }), "bible");
    assert.equal(destinoDoTema(null, { kind: "song" }), "songs");
  });

  it("aviso, mídia e apresentação usam o tema das letras, como o telão desenha", () => {
    for (const kind of ["text", "media", "apresentacao", "countdown"] as const) {
      assert.equal(destinoDoTema({ kind }, null), "songs", kind);
    }
    assert.equal(destinoDoTema(null, null), "songs");
  });
});
