import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CODIGOS_EBIBLE, arrumarEspacos, lerVpl } from "./biblia-vpl.ts";

const OPCOES = { id: "teste", name: "Teste", license: "domínio público" };

describe("lerVpl", () => {
  test("lê livro, capítulo e versículo pelo código do eBible", () => {
    const b = lerVpl(
      "GEN 1:1 No princípio criou Deus os céus e a terra.\nJOH 3:16 Porque Deus amou o mundo.",
      OPCOES,
    );
    assert.deepEqual(
      b.books.map((l) => [l.i, l.o]),
      [
        [1, "Gen"],
        [43, "John"],
      ],
    );
    assert.equal(b.books[1]?.c[2]?.[15], "Porque Deus amou o mundo.");
    assert.equal(b.id, "teste");
    assert.equal(b.license, "domínio público");
  });

  test("João é JOH, não JHN — o código do USFM não acha nada", () => {
    // A primeira tentativa procurou por JHN e voltou vazia.
    assert.equal(CODIGOS_EBIBLE.JOH, 43);
    assert.equal(CODIGOS_EBIBLE.JHN, undefined);
    assert.equal(lerVpl("JHN 3:16 Porque Deus amou o mundo.", OPCOES).books.length, 0);
  });

  test("os 66 códigos cobrem o cânone inteiro, cada um uma vez", () => {
    const numeros = Object.values(CODIGOS_EBIBLE).sort((a, b) => a - b);
    assert.deepEqual(
      numeros,
      Array.from({ length: 66 }, (_, i) => i + 1),
    );
  });

  test("versículo omitido ocupa o lugar dele, e o seguinte fica no número certo", () => {
    const b = lerVpl(
      "MAT 17:20 Por causa da pouca fé.\nMAT 17:21\nMAT 17:22 Reunidos na Galileia.",
      OPCOES,
    );
    const cap = b.books[0]?.c[16];
    assert.equal(cap?.[20], "");
    assert.equal(cap?.[21], "Reunidos na Galileia.");
    assert.equal(cap?.length, 22);
  });

  test("versículo que falta no arquivo também não desloca a numeração", () => {
    const b = lerVpl("ACT 8:36 Aqui há água.\nACT 8:38 E desceram à água.", OPCOES);
    const cap = b.books[0]?.c[7];
    assert.equal(cap?.[36], "");
    assert.equal(cap?.[37], "E desceram à água.");
  });

  test("capítulo que o arquivo pula vira lista vazia, não buraco no array", () => {
    const b = lerVpl("PSA 1:1 Bem-aventurado.\nPSA 3:1 Senhor.", OPCOES);
    const c = b.books[0]?.c ?? [];
    assert.equal(c.length, 3);
    assert.deepEqual(c[1], []);
    // `forEach` e `map` passam por cima de buraco; com a lista vazia, não.
    assert.equal(c.filter(Array.isArray).length, 3);
  });

  test("deuterocanônicos e linhas mal formadas ficam de fora", () => {
    const b = lerVpl(
      [
        "TOB 1:1 Livro de Tobias.",
        "1MA 1:1 Macabeus.",
        "lixo sem referência",
        "GEN x:1 capítulo que não é número",
        "GEN 0:1 capítulo zero",
        "",
        "GEN 1:1 No princípio.",
      ].join("\n"),
      OPCOES,
    );
    assert.equal(b.books.length, 1);
    assert.deepEqual(b.books[0]?.c, [["No princípio."]]);
  });

  test("aceita quebra de linha do Windows", () => {
    const b = lerVpl("GEN 1:1 No princípio.\r\nGEN 1:2 E a terra.\r\n", OPCOES);
    assert.deepEqual(b.books[0]?.c[0], ["No princípio.", "E a terra."]);
  });

  test("livros saem na ordem do cânone, não na do arquivo", () => {
    const b = lerVpl("REV 1:1 Revelação.\nGEN 1:1 No princípio.", OPCOES);
    assert.deepEqual(
      b.books.map((l) => l.i),
      [1, 66],
    );
  });

  test("só arruma o espaço antes da pontuação quando pedido", () => {
    const linha = "JOH 3:16 deu o seu Filho unigênito , para que todo";
    assert.equal(lerVpl(linha, OPCOES).books[0]?.c[2]?.[15], "deu o seu Filho unigênito , para que todo");
    assert.equal(
      lerVpl(linha, { ...OPCOES, arrumar: true }).books[0]?.c[2]?.[15],
      "deu o seu Filho unigênito, para que todo",
    );
  });
});

describe("arrumarEspacos", () => {
  test("tira espaço antes de pontuação e espaço dobrado, e nada mais", () => {
    assert.equal(arrumarEspacos("amou  o mundo , de tal maneira ; que deu !"), "amou o mundo, de tal maneira; que deu!");
    assert.equal(arrumarEspacos("  Jesus chorou.  "), "Jesus chorou.");
    assert.equal(arrumarEspacos("Senhor: tu és"), "Senhor: tu és");
  });
});
