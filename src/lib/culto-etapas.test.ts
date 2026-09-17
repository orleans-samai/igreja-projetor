import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { etapaDoItem, indiceNaProgramacao } from "./culto-etapas.ts";

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

describe("indiceNaProgramacao", () => {
  const itens = [
    { type: "song", refId: "s1" },
    { type: "text", refId: "t1" },
    { type: "media", refId: "m1" },
    { type: "song", refId: "s2" },
  ];

  test("acha o item planejado para o culto", () => {
    assert.equal(indiceNaProgramacao(itens, "song", "s1"), 0);
    assert.equal(indiceNaProgramacao(itens, "song", "s2"), 3);
    assert.equal(indiceNaProgramacao(itens, "media", "m1"), 2);
  });

  test("item só do repertório não está na programação", () => {
    assert.equal(indiceNaProgramacao(itens, "song", "s9"), -1);
    assert.equal(indiceNaProgramacao([], "song", "s1"), -1);
  });

  test("id igual em acervos diferentes não se confunde", () => {
    // Um aviso e uma música podem ter o mesmo id; só o par type+refId
    // identifica o que o operador clicou.
    assert.equal(indiceNaProgramacao([{ type: "text", refId: "s1" }], "song", "s1"), -1);
  });
});
