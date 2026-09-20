import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enderecosDeAcesso, estadoRemoto, volumeDePorcento } from "./remote-control.ts";
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
      // Música não tem play nem pause, nem volume.
      midiaTocando: null,
      midiaVolume: null,
    });
  });

  it("sem nada apresentado, os números ficam a zero", () => {
    assert.deepEqual(estadoRemoto("idle", null, 0), {
      titulo: null,
      slideAtual: 0,
      slideTotal: 0,
      noAr: false,
      preto: false,
      midiaTocando: null,
      midiaVolume: null,
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
      enderecosDeAcesso({ ligado: false, porta: null, enderecos: [], sessoesAtivas: 0 }),
      [],
    );
  });
});

describe("estado da mídia no celular", () => {
  const midia = (extra: Partial<Deck>): Deck => ({
    kind: "media",
    refId: "m1",
    title: "Chamada",
    subtitle: "",
    slides: [],
    ...extra,
  });

  it("vídeo tocando e pausado viram um botão só", () => {
    // O celular não tem espaço para dois botões que nunca servem juntos.
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "video", mediaAcao: "tocar" }), 0).midiaTocando, true);
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "video", mediaAcao: "pausar" }), 0).midiaTocando, false);
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "audio", mediaAcao: "tocar" }), 0).midiaTocando, true);
  });

  it("sem mídia no ar não há o que tocar", () => {
    assert.equal(estadoRemoto("idle", null, 0).midiaTocando, null);
    // Imagem no telão não tem play nem pause.
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "image" }), 0).midiaTocando, null);
    assert.equal(
      estadoRemoto("presenting", { kind: "song", refId: "s1", title: "Hino", subtitle: "", slides: [] }, 0)
        .midiaTocando,
      null,
    );
  });

  it("vídeo parado não conta como tocando", () => {
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "video", mediaAcao: "parar" }), 0).midiaTocando, false);
    assert.equal(estadoRemoto("presenting", midia({ mediaType: "video" }), 0).midiaTocando, false);
  });
});

describe("volume no celular", () => {
  const video = (extra: Partial<Deck>): Deck => ({
    kind: "media",
    refId: "m1",
    title: "Chamada",
    subtitle: "",
    slides: [],
    mediaType: "video",
    ...extra,
  });

  it("o celular recebe o volume em porcento", () => {
    assert.equal(estadoRemoto("presenting", video({ mediaVolume: 1 }), 0).midiaVolume, 100);
    assert.equal(estadoRemoto("presenting", video({ mediaVolume: 0.35 }), 0).midiaVolume, 35);
    // Ausente é 1: nenhuma igreja que já usa o app ouve diferença.
    assert.equal(estadoRemoto("presenting", video({}), 0).midiaVolume, 100);
    assert.equal(estadoRemoto("presenting", video({ mediaMudo: true }), 0).midiaVolume, 0);
  });

  it("sem som no ar não há volume para mexer", () => {
    assert.equal(estadoRemoto("idle", null, 0).midiaVolume, null);
    assert.equal(estadoRemoto("presenting", video({ mediaType: "image" }), 0).midiaVolume, null);
  });

  it("o caminho de volta prende o valor entre 0 e 1", () => {
    // O número vem de um aparelho na rede: aceitar 900 seria estourar o som.
    assert.equal(volumeDePorcento(0), 0);
    assert.equal(volumeDePorcento(50), 0.5);
    assert.equal(volumeDePorcento(100), 1);
    assert.equal(volumeDePorcento(900), 1);
    assert.equal(volumeDePorcento(-5), 0);
    assert.equal(volumeDePorcento("abc"), 1);
    assert.equal(volumeDePorcento(undefined), 1);
  });
});
