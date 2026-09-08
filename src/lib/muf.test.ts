import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escreverMuf, extrairMusicas, lerMuf, type MusicaDoPacote } from "./muf.ts";

/** Letras inventadas aqui, para o teste não depender de obra de ninguém. */
const DUAS: MusicaDoPacote[] = [
  {
    titulo: "A manhã sobre o vale",
    artista: "Coletivo de teste",
    tom: "G",
    copyright: "domínio público",
    letra: "A manha desce sobre o vale\nE a neblina se levanta devagar",
  },
  {
    titulo: "O rio entre as pedras",
    artista: "",
    tom: "",
    copyright: "",
    letra: "O rio corre firme entre as pedras\nE nao se cansa de seguir",
  },
];

describe("escreverMuf e lerMuf", () => {
  it("o que sai volta igual", async () => {
    const bytes = await escreverMuf(DUAS);
    const lido = await lerMuf(bytes);
    assert.ok(lido.ok, "esperava leitura bem-sucedida");
    assert.deepEqual(lido.musicas, DUAS);
  });

  it("comprime de verdade", async () => {
    // Repetição é o caso real de um hinário: muitos refrões iguais.
    const muitas = Array.from({ length: 200 }, () => DUAS[0]!);
    const bytes = await escreverMuf(muitas);
    const cru = JSON.stringify(muitas).length;
    assert.ok(bytes.length < cru / 4, `esperava compressão, ${bytes.length} vs ${cru}`);
  });

  it("gzip é reconhecido pelos dois primeiros bytes", async () => {
    const bytes = await escreverMuf(DUAS);
    assert.equal(bytes[0], 0x1f);
    assert.equal(bytes[1], 0x8b);
  });

  it("lê também o pacote sem compressão", async () => {
    const cru = new TextEncoder().encode(JSON.stringify({ musicas: DUAS }));
    const lido = await lerMuf(cru);
    assert.ok(lido.ok);
    assert.equal(lido.musicas.length, 2);
  });

  it("lê uma lista solta de músicas", async () => {
    const cru = new TextEncoder().encode(JSON.stringify(DUAS));
    const lido = await lerMuf(cru);
    assert.ok(lido.ok);
    assert.equal(lido.musicas.length, 2);
  });

  it("explica a falha em vez de estourar", async () => {
    for (const [entrada, esperado] of [
      [new Uint8Array(), /vazio/i],
      [new TextEncoder().encode("isto não é json"), /não é um pacote/i],
      [new TextEncoder().encode("[]"), /nenhuma música/i],
      [new TextEncoder().encode(JSON.stringify([{ titulo: "sem letra" }])), /nenhuma música/i],
    ] as const) {
      const lido = await lerMuf(entrada);
      assert.equal(lido.ok, false);
      if (!lido.ok) assert.match(lido.erro, esperado);
    }
  });
});

describe("extrairMusicas", () => {
  it("aceita os nomes de campo de outros programas", () => {
    const achadas = extrairMusicas([
      { title: "Vinda de fora", author: "Alguém", lyrics: "Uma linha\nOutra linha" },
      { nome: "Outra", texto: "Só uma linha" },
    ]);
    assert.equal(achadas.length, 2);
    assert.equal(achadas[0]?.titulo, "Vinda de fora");
    assert.equal(achadas[0]?.artista, "Alguém");
    assert.equal(achadas[1]?.titulo, "Outra");
  });

  it("música sem letra não entra: não há o que projetar", () => {
    const achadas = extrairMusicas([{ titulo: "Só o nome" }, { titulo: "Com letra", letra: "abc" }]);
    assert.equal(achadas.length, 1);
    assert.equal(achadas[0]?.titulo, "Com letra");
  });

  it("letra sem título ganha um nome em vez de ser descartada", () => {
    const achadas = extrairMusicas([{ letra: "uma letra órfã" }]);
    assert.equal(achadas.length, 1);
    assert.equal(achadas[0]?.titulo, "Sem título");
  });

  it("lixo não vira música", () => {
    assert.deepEqual(extrairMusicas(null), []);
    assert.deepEqual(extrairMusicas("texto"), []);
    assert.deepEqual(extrairMusicas({ musicas: "nada" }), []);
    assert.deepEqual(extrairMusicas([1, 2, null, "x"]), []);
  });
});
