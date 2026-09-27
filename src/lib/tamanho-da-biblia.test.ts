import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCALAS_DA_BIBLIA,
  ESCALA_MINIMA_DO_AJUSTE,
  ESCALA_PADRAO_DA_BIBLIA,
  escalaDaBiblia,
  escalaMaxima,
  escalaMinima,
  degrauAbaixo,
  maiorEscalaQueCabe,
  proximaEscala,
  rotuloDaEscala,
} from "./tamanho-da-biblia.ts";

test("o + e o − andam um degrau e param nas pontas", () => {
  assert.equal(proximaEscala(1, 1), 1.15);
  assert.equal(proximaEscala(1, -1), 0.9);
  const menor = ESCALAS_DA_BIBLIA[0];
  const maior = ESCALAS_DA_BIBLIA[ESCALAS_DA_BIBLIA.length - 1];
  assert.equal(proximaEscala(menor, -1), menor);
  assert.equal(proximaEscala(maior, 1), maior);
  assert.ok(escalaMinima(menor) && !escalaMinima(1));
  assert.ok(escalaMaxima(maior) && !escalaMaxima(1));
});

test("sem escolha, os quadrados vão até o máximo", () => {
  assert.equal(ESCALA_PADRAO_DA_BIBLIA, ESCALAS_DA_BIBLIA[ESCALAS_DA_BIBLIA.length - 1]);
});

test("com espaço de sobra, fica no máximo escolhido", () => {
  assert.equal(maiorEscalaQueCabe(1.5, () => true), 1.5);
});

test("sem espaço, encolhe até o maior tamanho que cabe", () => {
  // Uma tela em que tudo cabe até 1,1: a busca chega a menos de 1% disso.
  const cabe = (e: number) => e <= 1.1;
  const achada = maiorEscalaQueCabe(2, cabe);
  assert.ok(cabe(achada), `a escala achada (${achada}) não cabe`);
  assert.ok(achada > 1.09, `encolheu demais: ${achada}`);
});

test("nunca passa do máximo, nem para caber melhor", () => {
  let maiorMedida = 0;
  maiorEscalaQueCabe(0.9, (e) => {
    maiorMedida = Math.max(maiorMedida, e);
    return true;
  });
  assert.equal(maiorMedida, 0.9);
});

test("o − desce a partir do tamanho que está na tela, não do máximo guardado", () => {
  // Máximo 200%, mas a tela só comporta 110%: o − vai para 100%, que se vê.
  assert.equal(degrauAbaixo(1.1), 1);
  assert.equal(degrauAbaixo(1), 0.9);
  assert.equal(degrauAbaixo(0.8), null);
  assert.equal(degrauAbaixo(0.5), null);
});

test("se nem o mínimo cabe, fica no mínimo (e a tela rola em vez de cortar)", () => {
  assert.equal(maiorEscalaQueCabe(2, () => false), ESCALA_MINIMA_DO_AJUSTE);
});

test("valor estranho guardado volta ao padrão, em vez de sumir com os quadrados", () => {
  for (const estranho of [undefined, null, "1.15", 0, -2, 1.07, 99, Number.NaN]) {
    assert.equal(escalaDaBiblia(estranho), ESCALA_PADRAO_DA_BIBLIA, String(estranho));
  }
  assert.equal(proximaEscala(1.07, -1), 1.75, "de um valor estranho, o − parte do padrão");
});

test("o rótulo mostra a escala em porcentagem", () => {
  assert.equal(rotuloDaEscala(1), "100%");
  assert.equal(rotuloDaEscala(1.15), "115%");
  assert.equal(rotuloDaEscala(0.8), "80%");
});
