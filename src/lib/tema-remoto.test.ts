import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TETO_DE_TEMAS, temaDaMusica, temasUsados } from "./tema-remoto.ts";
import type { Song, Theme } from "./types.ts";

function tema(id: string): Theme {
  return {
    id,
    name: id,
    backgroundType: "color",
    backgroundValue: "#000",
    overlayOpacity: 0,
    fontFamily: "Inter",
    fontSize: 60,
    fontWeight: 700,
    uppercase: false,
    textColor: "#fff",
    outlineColor: "#000",
    outlineWidth: 0,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.2,
    margin: 6,
    showTitle: false,
    showCopyright: false,
    showReference: false,
    applyTo: "songs",
  };
}

function musica(id: string, themeId?: string): Song {
  return {
    id,
    title: id,
    artist: "",
    groupId: "g-louvor",
    key: "",
    copyright: "",
    themeId,
    lyricsRaw: "a",
    slides: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("temaDaMusica", () => {
  it("o preso na música ganha do padrão", () => {
    assert.equal(temaDaMusica(musica("s1", "t-natal"), "t-padrao"), "t-natal");
  });

  it("sem tema preso, vale o padrão", () => {
    assert.equal(temaDaMusica(musica("s1"), "t-padrao"), "t-padrao");
    // Campo vazio no disco é o mesmo que campo ausente.
    assert.equal(temaDaMusica(musica("s1", ""), "t-padrao"), "t-padrao");
  });
});

describe("temasUsados", () => {
  it("manda o padrão e os presos, e deixa o resto em casa", () => {
    const temas = [tema("t-padrao"), tema("t-natal"), tema("t-ninguem")];
    const escolhidos = temasUsados(temas, [musica("s1"), musica("s2", "t-natal")], "t-padrao");
    assert.deepEqual(
      escolhidos.map((t) => t.id),
      ["t-padrao", "t-natal"],
    );
  });

  it("o padrão vai na frente, porque é o teto que corta o fim", () => {
    const temas = [tema("t-natal"), tema("t-padrao")];
    const escolhidos = temasUsados(temas, [musica("s1", "t-natal")], "t-padrao");
    assert.equal(escolhidos[0].id, "t-padrao");
  });

  it("o padrão vai mesmo quando música nenhuma o usa", () => {
    const temas = [tema("t-padrao"), tema("t-natal")];
    const escolhidos = temasUsados(temas, [musica("s1", "t-natal")], "t-padrao");
    assert.deepEqual(
      escolhidos.map((t) => t.id),
      ["t-padrao", "t-natal"],
    );
  });

  it("segura o teto: fundo de imagem é decodificado num PC que projeta", () => {
    const temas = Array.from({ length: 20 }, (_, i) => tema(`t${i}`));
    const musicas = temas.map((t, i) => musica(`s${i}`, t.id));
    const escolhidos = temasUsados(temas, musicas, "t0");
    assert.equal(escolhidos.length, TETO_DE_TEMAS);
    assert.equal(escolhidos[0].id, "t0");
  });

  it("padrão que não existe na coleção não inventa tema", () => {
    const escolhidos = temasUsados([tema("t-natal")], [musica("s1", "t-natal")], "sumiu");
    assert.deepEqual(
      escolhidos.map((t) => t.id),
      ["t-natal"],
    );
  });
});
