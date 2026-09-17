import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { legendaDoRodape } from "./slide-rodape.ts";

describe("legendaDoRodape", () => {
  test("música mostra o título", () => {
    assert.equal(legendaDoRodape("Tua armadura usei", ""), "Tua armadura usei");
  });

  test("versículo mostra a referência", () => {
    assert.equal(legendaDoRodape("", "Efésios 6.11"), "Efésios 6.11");
  });

  test("os dois juntos dividem uma linha, não duas", () => {
    // Uma segunda linha empurraria o versículo para cima a cada slide que a
    // tivesse — o rodapé tem altura fixa justamente para não dançar.
    assert.equal(legendaDoRodape("Castelo Forte", "Salmo 46"), "Castelo Forte · Salmo 46");
  });

  test("sem nada fixo, o rodapé não existe", () => {
    assert.equal(legendaDoRodape("", ""), "");
    assert.equal(legendaDoRodape(undefined, undefined), "");
    assert.equal(legendaDoRodape("   ", "\n"), "");
  });

  test("espaço sobrando não vira separador solto", () => {
    assert.equal(legendaDoRodape("  Aleluia  ", ""), "Aleluia");
    assert.equal(legendaDoRodape(" ", "João 3.16"), "João 3.16");
  });
});
