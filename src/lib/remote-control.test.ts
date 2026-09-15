import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enderecosDeAcesso, estadoRemoto } from "./remote-control.ts";
import type { Deck } from "./types.ts";

const deck: Deck = {
  kind: "song",
  refId: "s1",
  title: "Grande é o Senhor",
  subtitle: "",
  slides: [
    { id: "1", label: "Verso 1", text: "a", sortOrder: 0 },
    { id: "2", label: "Verso 2", text: "b", sortOrder: 1 },
    { id: "3", label: "Verso 3", text: "c", sortOrder: 2 },
  ],
};

describe("estadoRemoto", () => {
  it("descreve o que está no ar, não o preview", () => {
    assert.deepEqual(estadoRemoto("presenting", deck, 1), {
      titulo: "Grande é o Senhor",
      slideAtual: 2,
      slideTotal: 3,
      noAr: true,
      preto: false,
    });
  });

  it("sem nada apresentado, os números ficam a zero", () => {
    assert.deepEqual(estadoRemoto("idle", null, 0), {
      titulo: null,
      slideAtual: 0,
      slideTotal: 0,
      noAr: false,
      preto: false,
    });
  });

  it("telão preto marca preto mesmo com uma música por trás", () => {
    const r = estadoRemoto("black", deck, 0);
    assert.equal(r.preto, true);
    assert.equal(r.noAr, false);
    assert.equal(r.titulo, "Grande é o Senhor");
  });
});

describe("enderecosDeAcesso", () => {
  it("monta o endereço completo com a porta", () => {
    const enderecos = enderecosDeAcesso({
      ligado: true,
      porta: 51234,
      pin: "123456",
      enderecos: ["192.168.0.10", "192.168.0.11"],
      sessoesAtivas: 0,
    });
    assert.deepEqual(enderecos, [
      "http://192.168.0.10:51234",
      "http://192.168.0.11:51234",
    ]);
  });

  it("desligado não oferece endereço nenhum", () => {
    assert.deepEqual(
      enderecosDeAcesso({ ligado: false, porta: null, pin: null, enderecos: [], sessoesAtivas: 0 }),
      [],
    );
  });
});
