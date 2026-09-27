import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartoesQueCabem, rolagemDaFaixa, vistaNoSecundario } from "./faixa-de-letras.ts";

// Cartões de 200 px com 8 de vão: o cartão n começa em 8 + n × 208.
const cartao = (n: number) => ({ inicio: 8 + n * 208, fim: 8 + n * 208 + 200 });
const vista = (inicio: number) => ({ inicio, largura: 1000 });

describe("a faixa de letras acompanha o slide", () => {
  it("com o atual e os dois seguintes à vista, não mexe", () => {
    assert.equal(rolagemDaFaixa(cartao(1), cartao(3), vista(0)), null);
  });

  it("avançando para o último cartão visível, rola para mostrar os dois seguintes", () => {
    // Na vista de 0 a 1000 cabem os cartões 0 a 3 inteiros; o 4 está cortado.
    const nova = rolagemDaFaixa(cartao(4), cartao(6), vista(0));
    assert.ok(nova !== null);
    const depois = vista(nova);
    for (const n of [4, 5, 6]) {
      assert.ok(cartao(n).inicio >= depois.inicio && cartao(n).fim <= depois.inicio + depois.largura, `cartão ${n} fora da vista`);
    }
  });

  it("voltando para um cartão que saiu pela esquerda, ele volta à vista", () => {
    const nova = rolagemDaFaixa(cartao(2), cartao(4), vista(1200));
    assert.equal(nova, cartao(2).inicio - 8);
  });

  it("faixa estreita demais para três cartões: o atual nunca sai da vista", () => {
    const estreita = { inicio: 0, largura: 300 };
    const nova = rolagemDaFaixa(cartao(5), cartao(7), estreita);
    assert.ok(nova !== null);
    assert.ok(cartao(5).inicio >= nova && cartao(5).fim <= nova + 300 + 8);
  });

  it("nunca pede rolagem negativa", () => {
    assert.equal(rolagemDaFaixa(cartao(0), cartao(2), vista(500)), 0);
  });
});

describe("dois blocos de letras", () => {
  it("o bloco de cima leva só cartões inteiros", () => {
    // 4 cartões de 200 com 3 vãos de 8 = 824; o quinto passaria de 1000.
    assert.equal(cartoesQueCabem(1000, 200), 4);
    // Cinco cabem exatamente em 5 × 200 + 4 × 8 = 1032.
    assert.equal(cartoesQueCabem(1032, 200), 5);
    assert.equal(cartoesQueCabem(1031, 200), 4);
  });

  it("antes de medir, ou numa faixa estreita, o de cima leva ao menos um", () => {
    assert.equal(cartoesQueCabem(0, 200), 1);
    assert.equal(cartoesQueCabem(120, 200), 1);
    assert.equal(cartoesQueCabem(Number.NaN, 200), 1);
  });

  it("com o atual e os seguintes no bloco de cima, o de baixo não rola", () => {
    assert.equal(vistaNoSecundario(3, 21, 9), null);
    assert.equal(vistaNoSecundario(6, 21, 9), null);
  });

  it("no fim do bloco de cima, o de baixo mostra o começo dele", () => {
    // Slide 8 (o último de cima): os dois seguintes são os primeiros de baixo.
    assert.deepEqual(vistaNoSecundario(8, 21, 9), { de: 9, ate: 10 });
  });

  it("no bloco de baixo, ele segue o atual e os dois seguintes", () => {
    assert.deepEqual(vistaNoSecundario(15, 21, 9), { de: 15, ate: 17 });
  });

  it("no fim da música, só o que existe", () => {
    assert.deepEqual(vistaNoSecundario(20, 21, 9), { de: 20, ate: 20 });
    assert.deepEqual(vistaNoSecundario(19, 21, 9), { de: 19, ate: 20 });
  });
});
