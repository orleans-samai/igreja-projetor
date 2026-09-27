import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { midiaDoTelao, trilhaDoVideo, trilhaSobrevive } from "./trilha.ts";
import type { Deck } from "./types.ts";

const VIDEO: Deck = {
  kind: "media",
  refId: "midia:video:Coisas Maiores.mp4",
  title: "Coisas Maiores",
  subtitle: "video",
  slides: [],
  mediaSrc: "lumen://app/__midia/video/Coisas%20Maiores.mp4",
  mediaType: "video",
  mediaAcao: "tocar",
  mediaVolume: 0.7,
  mediaSeq: 4,
};
const LETRA: Deck = { kind: "song", refId: "s1", title: "Grande é o Senhor", subtitle: "", slides: [] };
const IMAGEM: Deck = { ...VIDEO, refId: "midia:image:cruz.jpg", mediaSrc: "lumen://app/__midia/image/cruz.jpg", mediaType: "image" };
const OUTRO_VIDEO: Deck = { ...VIDEO, refId: "midia:video:Outro.mp4", mediaSrc: "lumen://app/__midia/video/Outro.mp4" };
const AUDIO: Deck = { ...VIDEO, refId: "midia:audio:Hino.wav", mediaSrc: "lumen://app/__midia/audio/Hino.wav", mediaType: "audio" };

describe("tirar vídeo, deixar só o áudio", () => {
  it("a trilha nasce do vídeo no ar, com o volume e o ponto em que ele estava", () => {
    const t = trilhaDoVideo(VIDEO);
    assert.ok(t);
    assert.equal(t.mediaSrc, VIDEO.mediaSrc);
    assert.equal(t.mediaVolume, 0.7);
    assert.equal(t.mediaSeq, 4);
    assert.equal(t.title, "Coisas Maiores");
  });

  it("só vídeo vira trilha: letra, imagem e áudio não", () => {
    assert.equal(trilhaDoVideo(LETRA), null);
    assert.equal(trilhaDoVideo(IMAGEM), null);
    assert.equal(trilhaDoVideo(AUDIO), null);
    assert.equal(trilhaDoVideo(null), null);
  });

  it("o vídeo sai da tela, mas o mesmo elemento continua tocando o som", () => {
    const antes = midiaDoTelao(VIDEO, null, false);
    const depois = midiaDoTelao(VIDEO, trilhaDoVideo(VIDEO), false);
    assert.equal(antes.principal?.oculta, false);
    assert.equal(depois.principal?.oculta, true);
    assert.equal(depois.principal?.mediaSrc, antes.principal?.mediaSrc);
  });

  it("a letra entra no telão e a trilha segue tocando por baixo", () => {
    const m = midiaDoTelao(LETRA, trilhaDoVideo(VIDEO), false);
    assert.equal(m.principal?.mediaSrc, VIDEO.mediaSrc);
    assert.equal(m.principal?.oculta, true);
    assert.equal(m.imagem, null);
  });

  it("preto, logo e ocultar letra não calam a trilha", () => {
    assert.equal(midiaDoTelao(LETRA, trilhaDoVideo(VIDEO), true).principal?.oculta, true);
    // Sem trilha, esconder o conteúdo tira o vídeo, como sempre foi.
    assert.equal(midiaDoTelao(VIDEO, null, true).principal, null);
  });

  it("uma imagem no ar aparece, com a trilha tocando por baixo", () => {
    const m = midiaDoTelao(IMAGEM, trilhaDoVideo(VIDEO), false);
    assert.equal(m.principal?.oculta, true);
    assert.equal(m.imagem?.mediaSrc, IMAGEM.mediaSrc);
  });

  it("outro vídeo ou áudio no ar encerra a trilha: dois sons juntos nunca", () => {
    const t = trilhaDoVideo(VIDEO);
    assert.equal(trilhaSobrevive(t, OUTRO_VIDEO), false);
    assert.equal(trilhaSobrevive(t, AUDIO), false);
    assert.equal(midiaDoTelao(OUTRO_VIDEO, t, false).principal?.mediaSrc, OUTRO_VIDEO.mediaSrc);
    assert.equal(trilhaSobrevive(t, LETRA), true);
    assert.equal(trilhaSobrevive(t, IMAGEM), true);
    assert.equal(trilhaSobrevive(t, VIDEO), true);
  });
});
