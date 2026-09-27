import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCALAS_DA_BIBLIA,
  ESCALA_PADRAO_DA_BIBLIA,
  escalaDaBiblia,
  escalaMaxima,
  escalaMinima,
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

test("valor estranho guardado volta ao padrão, em vez de sumir com os quadrados", () => {
  for (const estranho of [undefined, null, "1.15", 0, -2, 1.07, 99, Number.NaN]) {
    assert.equal(escalaDaBiblia(estranho), ESCALA_PADRAO_DA_BIBLIA, String(estranho));
  }
  assert.equal(proximaEscala(1.07, 1), 1.15, "de um valor estranho, o + parte do padrão");
});

test("o rótulo mostra a escala em porcentagem", () => {
  assert.equal(rotuloDaEscala(1), "100%");
  assert.equal(rotuloDaEscala(1.15), "115%");
  assert.equal(rotuloDaEscala(0.8), "80%");
});
