import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  carregadoAte,
  duracaoUtil,
  porcento,
  proximaVelocidade,
  relogio,
  restante,
  rotuloVelocidade,
  tempoDoPonto,
} from "./media-player.ts";

/** TimeRanges de mentira, que é tudo que estas contas precisam. */
function faixas(pares: [number, number][]): TimeRanges {
  return {
    length: pares.length,
    start: (i: number) => pares[i][0],
    end: (i: number) => pares[i][1],
  } as TimeRanges;
}

describe("relogio", () => {
  test("mostra minutos e segundos, e horas quando precisa", () => {
    assert.equal(relogio(0), "0:00");
    assert.equal(relogio(9), "0:09");
    assert.equal(relogio(75), "1:15");
    assert.equal(relogio(3725), "1:02:05");
  });

  test("não quebra com valor ausente, negativo ou infinito", () => {
    assert.equal(relogio(-30), "0:00");
    assert.equal(relogio(NaN), "0:00");
    assert.equal(relogio(Infinity), "0:00");
  });
});

describe("duracaoUtil", () => {
  test("só aceita duração que dá para desenhar", () => {
    assert.equal(duracaoUtil(120), true);
    assert.equal(duracaoUtil(0), false);
    assert.equal(duracaoUtil(undefined), false);
    // Antes dos metadados chegarem é NaN; numa transmissão contínua, Infinity.
    assert.equal(duracaoUtil(NaN), false);
    assert.equal(duracaoUtil(Infinity), false);
  });
});

describe("restante", () => {
  test("conta para trás, com o menos na frente", () => {
    assert.equal(restante(0, 1813), "-30:13");
    assert.equal(restante(1006, 2820), "-30:14");
  });

  test("no fim chega a zero, e não passa disso", () => {
    assert.equal(restante(2820, 2820), "-0:00");
    assert.equal(restante(3000, 2820), "-0:00");
  });

  test("sem duração conhecida não inventa um fim", () => {
    // "-0:00" diria que o arquivo acabou, o que é mentira enquanto carrega.
    assert.equal(restante(10, undefined), "--:--");
    assert.equal(restante(10, NaN), "--:--");
    assert.equal(restante(10, Infinity), "--:--");
    assert.equal(restante(10, 0), "--:--");
  });
});

describe("porcento", () => {
  test("mede a fração da duração", () => {
    assert.equal(porcento(0, 100), 0);
    assert.equal(porcento(36, 100), 36);
    assert.equal(porcento(50, 200), 25);
  });

  test("fica preso entre 0 e 100", () => {
    assert.equal(porcento(-10, 100), 0);
    assert.equal(porcento(150, 100), 100);
  });

  test("sem duração não preenche nada", () => {
    for (const d of [0, undefined, NaN, Infinity]) {
      assert.equal(porcento(30, d as number), 0, String(d));
    }
    assert.equal(porcento(NaN, 100), 0);
  });
});

describe("carregadoAte", () => {
  test("segue o pedaço que contém o ponto atual", () => {
    // Um arquivo buscado várias vezes tem pedaços soltos; o último não é o
    // daqui, e usá-lo mostraria a barra cheia com o vídeo ainda travando.
    const b = faixas([
      [0, 30],
      [120, 200],
    ]);
    assert.equal(carregadoAte(b, 10), 30);
    assert.equal(carregadoAte(b, 150), 200);
  });

  test("fora de qualquer pedaço, usa o último conhecido", () => {
    assert.equal(carregadoAte(faixas([[0, 30]]), 90), 30);
  });

  test("sem nada carregado responde zero", () => {
    assert.equal(carregadoAte(faixas([]), 5), 0);
    assert.equal(carregadoAte(undefined, 5), 0);
  });
});

describe("tempoDoPonto", () => {
  const caixa = { left: 100, width: 200 };

  test("traduz o clique em segundos", () => {
    assert.equal(tempoDoPonto(100, caixa, 60), 0);
    assert.equal(tempoDoPonto(200, caixa, 60), 30);
    assert.equal(tempoDoPonto(300, caixa, 60), 60);
  });

  test("clique fora da barra não sai da mídia", () => {
    assert.equal(tempoDoPonto(0, caixa, 60), 0);
    assert.equal(tempoDoPonto(999, caixa, 60), 60);
  });

  test("sem duração ou sem largura, não busca nada", () => {
    assert.equal(tempoDoPonto(200, caixa, undefined), 0);
    assert.equal(tempoDoPonto(200, { left: 0, width: 0 }, 60), 0);
  });
});

describe("velocidade", () => {
  test("roda 1 → 1.25 → 1.5 → 2 → 1", () => {
    assert.equal(proximaVelocidade(1), 1.25);
    assert.equal(proximaVelocidade(1.25), 1.5);
    assert.equal(proximaVelocidade(1.5), 2);
    assert.equal(proximaVelocidade(2), 1);
  });

  test("valor estranho volta para 1×", () => {
    assert.equal(proximaVelocidade(undefined), 1.25);
    assert.equal(proximaVelocidade(3.7), 1);
  });

  test("o rótulo não carrega zero sobrando", () => {
    assert.equal(rotuloVelocidade(1), "1×");
    assert.equal(rotuloVelocidade(1.25), "1.25×");
    assert.equal(rotuloVelocidade(2), "2×");
    assert.equal(rotuloVelocidade(undefined), "1×");
  });
});
