import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chaveDeMusica, lerMusicasJson, prepararImportacao } from "./songs-json.ts";
import type { Song } from "./types.ts";

const EXEMPLO_DO_PEDIDO = {
  titulo: "Nome da Música",
  autor: "Autor",
  estrofes: ["Primeira estrofe", "Segunda estrofe"],
  refrao: "Texto do refrão",
  ponte: "Texto da ponte",
};

describe("lerMusicasJson", () => {
  test("lê o formato do pedido e monta a letra com rótulos de slide", () => {
    const r = lerMusicasJson(EXEMPLO_DO_PEDIDO);
    assert.equal(r.falhas.length, 0);
    assert.equal(r.musicas.length, 1);
    const m = r.musicas[0];
    assert.equal(m.titulo, "Nome da Música");
    assert.equal(m.artista, "Autor");
    // Refrão depois da primeira estrofe, que é como se canta.
    assert.equal(
      m.letra,
      "[Verso 1]\nPrimeira estrofe\n\n[Coro]\nTexto do refrão\n\n[Verso 2]\nSegunda estrofe\n\n[Ponte]\nTexto da ponte",
    );
  });

  test("aceita uma música só, uma lista, ou um envelope", () => {
    const uma = lerMusicasJson(EXEMPLO_DO_PEDIDO);
    const lista = lerMusicasJson([EXEMPLO_DO_PEDIDO, EXEMPLO_DO_PEDIDO]);
    const envelope = lerMusicasJson({ musicas: [EXEMPLO_DO_PEDIDO] });
    const outroEnvelope = lerMusicasJson({ songs: [EXEMPLO_DO_PEDIDO] });
    assert.equal(uma.musicas.length, 1);
    assert.equal(lista.musicas.length, 2);
    assert.equal(envelope.musicas.length, 1);
    assert.equal(outroEnvelope.musicas.length, 1);
  });

  test("aceita nomes de campo alternativos, inclusive em inglês", () => {
    const r = lerMusicasJson({
      title: "Porque Ele Vive",
      artist: "Bill Gaither",
      key: "G",
      lyrics: "Porque Ele vive\n\nPosso o amanhã enfrentar",
    });
    assert.equal(r.musicas[0].titulo, "Porque Ele Vive");
    assert.equal(r.musicas[0].artista, "Bill Gaither");
    assert.equal(r.musicas[0].tom, "G");
    assert.match(r.musicas[0].letra, /Porque Ele vive/);
  });

  test("estrofe como lista de linhas vira um bloco só", () => {
    const r = lerMusicasJson({
      titulo: "Hino",
      estrofes: [["Primeira linha", "Segunda linha"]],
    });
    assert.equal(r.musicas[0].letra, "[Verso 1]\nPrimeira linha\nSegunda linha");
  });

  test("estrofe com rótulo próprio não ganha rótulo genérico por cima", () => {
    const r = lerMusicasJson({
      titulo: "Hino",
      estrofes: [{ rotulo: "Intro", texto: "Só música" }, "Agora canta"],
    });
    assert.equal(r.musicas[0].letra, "[Intro]\nSó música\n\n[Verso 2]\nAgora canta");
  });

  test("música sem nada para projetar vira falha, e diz qual campo", () => {
    const r = lerMusicasJson([{ titulo: "Vazia" }]);
    assert.equal(r.musicas.length, 0);
    assert.equal(r.falhas.length, 1);
    assert.equal(r.falhas[0].onde, "“Vazia”");
    assert.match(r.falhas[0].campo, /letra/);
    assert.match(r.falhas[0].motivo, /projetar/);
  });

  test("uma música quebrada não impede as outras de entrar", () => {
    const r = lerMusicasJson([
      EXEMPLO_DO_PEDIDO,
      { titulo: "Sem letra" },
      "isto nem é objeto",
      { titulo: "Boa", letra: "tem letra" },
    ]);
    assert.deepEqual(
      r.musicas.map((m) => m.titulo),
      ["Nome da Música", "Boa"],
    );
    assert.equal(r.falhas.length, 2);
    assert.equal(r.falhas[1].onde, "música 3");
  });

  test("sem título a música entra mesmo assim, com nome provisório", () => {
    const r = lerMusicasJson([{ letra: "tem letra" }]);
    assert.equal(r.musicas[0].titulo, "Sem título");
  });

  test("lixo não derruba a leitura", () => {
    for (const entrada of [null, undefined, 42, "texto", [], {}]) {
      const r = lerMusicasJson(entrada);
      assert.equal(Array.isArray(r.musicas), true);
      assert.equal(Array.isArray(r.falhas), true);
    }
  });
});

describe("prepararImportacao", () => {
  const existente: Song = {
    id: "s1",
    title: "Porque Ele Vive",
    artist: "Bill Gaither",
    groupId: "g1",
    key: "",
    copyright: "",
    lyricsRaw: "x",
    slides: [],
    createdAt: 0,
    updatedAt: 0,
  };

  test("pula o que já existe no repertório, sem duplicar", () => {
    const relatorio = lerMusicasJson([
      { titulo: "Porque Ele Vive", autor: "Bill Gaither", letra: "outra letra" },
      { titulo: "Nova", letra: "letra nova" },
    ]);
    const r = prepararImportacao(relatorio, [existente], "g1");
    assert.equal(r.novas.length, 1);
    assert.equal(r.novas[0].title, "Nova");
    assert.equal(r.duplicadas.length, 1);
  });

  test("duplicata repetida dentro do mesmo arquivo também é pulada", () => {
    const relatorio = lerMusicasJson([
      { titulo: "Igual", letra: "a" },
      { titulo: "Igual", letra: "b" },
    ]);
    const r = prepararImportacao(relatorio, [], "g1");
    assert.equal(r.novas.length, 1);
    assert.equal(r.duplicadas.length, 1);
  });

  test("acento e caixa não criam música repetida", () => {
    assert.equal(chaveDeMusica("Está Tudo Bem", "João"), chaveDeMusica("esta tudo bem", "joao"));
    assert.notEqual(chaveDeMusica("Hino A", ""), chaveDeMusica("Hino B", ""));
  });

  test("a música importada já vem com slides prontos para projetar", () => {
    const r = prepararImportacao(lerMusicasJson(EXEMPLO_DO_PEDIDO), [], "g1");
    const s = r.novas[0];
    assert.ok(s.slides.length >= 4, `esperava 4+ slides, veio ${s.slides.length}`);
    assert.equal(s.groupId, "g1");
    assert.equal(s.slides[0].label, "Verso 1");
    assert.equal(s.slides[1].label, "Coro");
  });
});
