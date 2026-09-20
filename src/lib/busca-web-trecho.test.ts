import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { consultasDoTrecho, ordenarPeloTrecho } from "./busca-web-trecho.ts";

describe("consultasDoTrecho", () => {
  test("nome curto vai inteiro, uma ida à rede só", () => {
    assert.deepEqual(consultasDoTrecho("Castelo Forte"), ["Castelo Forte"]);
    assert.deepEqual(consultasDoTrecho("Porque Ele vive"), ["Porque Ele vive"]);
  });

  test("frase comprida também tenta o começo, onde mora o título", () => {
    // "Porque Ele vive" é o nome da música; a frase inteira não casa com
    // título nenhum no catálogo.
    const c = consultasDoTrecho("Porque Ele vive posso crer no amanhã");
    assert.equal(c[0], "Porque Ele vive posso crer no amanhã");
    assert.ok(c.includes("Porque Ele vive"));
  });

  test("descarta artigo e preposição para achar o título do meio", () => {
    // "e o" no começo não é título de nada; "amor me alcançou" é. Pronome
    // fica: em louvor ele costuma fazer parte do nome ("Me leva", "Teu amor
    // me alcançou").
    const c = consultasDoTrecho("e o teu amor me alcançou");
    assert.ok(c.includes("amor me alcançou"), c.join(" | "));
  });

  test("nunca mais que três idas à rede", () => {
    const c = consultasDoTrecho("um dois três quatro cinco seis sete oito nove dez");
    assert.ok(c.length <= 3, String(c.length));
    assert.equal(new Set(c).size, c.length, "consulta repetida seria rede gasta à toa");
  });

  test("vazio não vira busca", () => {
    assert.deepEqual(consultasDoTrecho(""), []);
    assert.deepEqual(consultasDoTrecho("   "), []);
  });
});

describe("ordenarPeloTrecho", () => {
  const hits = [
    { title: "Outra", lyrics: "Nada a ver com isso" },
    { title: "Certa", lyrics: "Levantamos os olhos\nDo vale até o monte" },
    { title: "Terceira", lyrics: "Outro louvor qualquer" },
  ];

  test("quem tem o trecho na letra vem na frente, e diz por quê", () => {
    const r = ordenarPeloTrecho(hits, "os olhos do vale");
    assert.equal(r[0].title, "Certa");
    assert.equal(r[0].note, "Contém o trecho que você procurou.");
    // Os outros continuam na lista, sem promessa nenhuma.
    assert.deepEqual(r.slice(1).map((h) => h.title), ["Outra", "Terceira"]);
  });

  test("busca de uma palavra só não reordena nada", () => {
    // Uma palavra casa com meio catálogo; prometer certeza seria mentira.
    const r = ordenarPeloTrecho(hits, "vale");
    assert.deepEqual(r.map((h) => h.title), ["Outra", "Certa", "Terceira"]);
  });

  test("resultado sem letra não é promovido", () => {
    const r = ordenarPeloTrecho([{ title: "Sem letra", lyrics: "" }], "os olhos do vale");
    assert.equal(r[0].note, undefined);
  });

  test("empate mantém a ordem que o catálogo mandou", () => {
    const dois = [
      { title: "A", lyrics: "os olhos do vale" },
      { title: "B", lyrics: "os olhos do vale" },
    ];
    assert.deepEqual(
      ordenarPeloTrecho(dois, "os olhos do vale").map((h) => h.title),
      ["A", "B"],
    );
  });
});
