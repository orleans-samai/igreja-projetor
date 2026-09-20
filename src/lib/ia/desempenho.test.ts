import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { avaliar, recomendaSobDemanda, ROTULO, type Medidas } from "./desempenho.ts";

const bom: Medidas = {
  carregarMs: 4000,
  respostaMs: 900,
  acertos: 5,
  tentativas: 5,
  livreGB: 8,
  modeloGB: 1.2,
};

describe("avaliar", () => {
  test("rápido, certeiro e com memória sobrando é ótimo", () => {
    assert.equal(avaliar(bom).veredito, "otimo");
  });

  test("memória sem folga reprova, mesmo com o modelo rápido e certeiro", () => {
    // É a projeção que trava, não a IA — por isso este motivo vence os outros.
    const r = avaliar({ ...bom, livreGB: 1.3, modeloGB: 1.2 });
    assert.equal(r.veredito, "nao-recomendado");
    assert.match(r.porque, /memória/i);
  });

  test("errar a maioria dos comandos reprova, mesmo sendo rápido", () => {
    const r = avaliar({ ...bom, acertos: 2, tentativas: 5 });
    assert.equal(r.veredito, "nao-recomendado");
    assert.match(r.porque, /errou/i);
  });

  test("demora que o operador sente vira aviso de lentidão", () => {
    assert.equal(avaliar({ ...bom, respostaMs: 15000 }).veredito, "pode-travar");
    assert.equal(avaliar({ ...bom, carregarMs: 90000 }).veredito, "pode-travar");
  });

  test("bom o bastante, mas não folgado, é adequado", () => {
    assert.equal(avaliar({ ...bom, respostaMs: 6000 }).veredito, "adequado");
    assert.equal(avaliar({ ...bom, livreGB: 2.5, modeloGB: 1.2 }).veredito, "adequado");
    assert.equal(avaliar({ ...bom, acertos: 3, tentativas: 5 }).veredito, "adequado");
  });

  test("sem tentativa nenhuma não se inventa aprovação", () => {
    assert.equal(avaliar({ ...bom, acertos: 0, tentativas: 0 }).veredito, "nao-recomendado");
  });

  test("todo veredito tem rótulo em português", () => {
    for (const v of ["otimo", "adequado", "pode-travar", "nao-recomendado"] as const) {
      assert.ok(ROTULO[v].length > 3, v);
    }
  });
});

describe("recomendaSobDemanda", () => {
  test("o meio-termo é onde 'sob demanda' vale o conselho", () => {
    assert.equal(recomendaSobDemanda("adequado"), true);
    assert.equal(recomendaSobDemanda("pode-travar"), true);
    // Ótimo não precisa, e não-recomendado não se resolve com modo nenhum.
    assert.equal(recomendaSobDemanda("otimo"), false);
    assert.equal(recomendaSobDemanda("nao-recomendado"), false);
  });
});
