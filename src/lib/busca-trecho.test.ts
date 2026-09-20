import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { letraContem, letraLisa, posicaoDoTrecho, trechoQueBate } from "./busca-trecho.ts";

const LETRA = `[Verso 1]
Levantamos os olhos
Do vale até o monte

[Coro]
[G]Santo és Tu, [D]Senhor
Em tua presença`;

describe("letraLisa", () => {
  test("vira uma linha só, sem seção nem cifra", () => {
    assert.equal(
      letraLisa(LETRA),
      "Levantamos os olhos Do vale até o monte Santo és Tu, Senhor Em tua presença",
    );
  });

  test("letra vazia não vira espaço em branco", () => {
    assert.equal(letraLisa(""), "");
    assert.equal(letraLisa("\n\n  \n"), "");
  });
});

describe("letraContem", () => {
  test("acha o trecho que atravessa a quebra de linha", () => {
    // Era isto que falhava: quem digitava a frase inteira não achava nada,
    // porque na letra ela está partida em duas linhas.
    assert.equal(letraContem(LETRA, "os olhos do vale"), true);
    assert.equal(letraContem(LETRA, "monte Santo"), true);
  });

  test("ignora acento e maiúscula", () => {
    assert.equal(letraContem(LETRA, "SANTO ES TU"), true);
    assert.equal(letraContem(LETRA, "em tua presenca"), true);
  });

  test("ignora a cifra no meio do verso", () => {
    // "Santo és Tu, Senhor" está escrito com [G] e [D] entre as palavras.
    assert.equal(letraContem(LETRA, "Santo és Tu, Senhor"), true);
  });

  test("espaço sobrando digitado não atrapalha", () => {
    assert.equal(letraContem(LETRA, "  os   olhos   do vale "), true);
  });

  test("o que não está na letra não é achado", () => {
    assert.equal(letraContem(LETRA, "castelo forte"), false);
    assert.equal(letraContem(LETRA, ""), false);
    assert.equal(letraContem("", "qualquer"), false);
  });
});

describe("trechoQueBate", () => {
  test("mostra o verso em volta do que se procurou", () => {
    const t = trechoQueBate(LETRA, "do vale");
    assert.ok(t);
    assert.match(t, /Do vale/);
    // Acento e maiúscula do original, não a versão dobrada da comparação.
    assert.ok(!t.includes("do vale ate"));
  });

  test("avisa com reticências que o verso continua", () => {
    const t = trechoQueBate(LETRA, "Santo", 6) ?? "";
    assert.ok(t.startsWith("…"), t);
    assert.ok(t.endsWith("…"), t);
  });

  test("no começo da letra não inventa reticência à esquerda", () => {
    const t = trechoQueBate(LETRA, "Levantamos", 4) ?? "";
    assert.ok(!t.startsWith("…"), t);
  });

  test("sem casar, não há trecho", () => {
    assert.equal(trechoQueBate(LETRA, "não está aqui"), null);
  });
});

describe("posicaoDoTrecho", () => {
  test("aponta onde bateu, para não procurar duas vezes", () => {
    const lisa = letraLisa(LETRA);
    assert.equal(posicaoDoTrecho(lisa, "Levantamos"), 0);
    assert.equal(posicaoDoTrecho(lisa, "inexistente"), -1);
    assert.equal(posicaoDoTrecho(lisa, "   "), -1);
  });
});
