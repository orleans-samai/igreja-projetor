import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { etapaDoItem } from "./culto-etapas.ts";

describe("etapaDoItem", () => {
  test("antes do culto começar, o primeiro item é o próximo", () => {
    assert.equal(etapaDoItem(0, -1), "proximo");
    assert.equal(etapaDoItem(1, -1), "pendente");
    assert.equal(etapaDoItem(5, -1), "pendente");
  });

  test("com algo no ar, a lista se parte em feito, agora, próximo e resto", () => {
    const noAr = 2;
    assert.equal(etapaDoItem(0, noAr), "concluido");
    assert.equal(etapaDoItem(1, noAr), "concluido");
    assert.equal(etapaDoItem(2, noAr), "no-ar");
    assert.equal(etapaDoItem(3, noAr), "proximo");
    assert.equal(etapaDoItem(4, noAr), "pendente");
  });

  test("no último item não existe próximo", () => {
    assert.equal(etapaDoItem(3, 3), "no-ar");
    assert.equal(etapaDoItem(2, 3), "concluido");
  });
});
