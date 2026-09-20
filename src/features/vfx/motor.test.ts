import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fatorDeVelocidade,
  faseDe,
  forcaDe,
  opacidadeNoTempo,
  particulaEm,
  quantasParticulas,
  sorteio,
} from "./motor.ts";
import { PADRAO } from "./padroes.ts";
import type { VfxComposicao } from "./tipos.ts";

const comp = (patch: Partial<VfxComposicao> = {}): VfxComposicao => ({ ...PADRAO, ...patch });

describe("fatorDeVelocidade", () => {
  it("cada ritmo tem o seu, e rápido é mais que lento", () => {
    assert.ok(fatorDeVelocidade(comp({ ritmo: "rapida" })) > fatorDeVelocidade(comp({ ritmo: "normal" })));
    assert.ok(fatorDeVelocidade(comp({ ritmo: "normal" })) > fatorDeVelocidade(comp({ ritmo: "lenta" })));
  });

  it("manual usa o número, preso entre 0,1 e 3", () => {
    assert.equal(fatorDeVelocidade(comp({ ritmo: "manual", velocidade: 2.2 })), 2.2);
    assert.equal(fatorDeVelocidade(comp({ ritmo: "manual", velocidade: 99 })), 3);
    assert.equal(fatorDeVelocidade(comp({ ritmo: "manual", velocidade: -5 })), 0.1);
    assert.equal(fatorDeVelocidade(comp({ ritmo: "manual", velocidade: NaN })), 1);
  });
});

describe("faseDe", () => {
  it("dá a volta quando repete", () => {
    const c = comp({ duracao: 10, repetir: true });
    assert.equal(faseDe(c, 0), 0);
    assert.equal(faseDe(c, 5), 0.5);
    assert.ok(Math.abs(faseDe(c, 12) - 0.2) < 1e-9);
    // Vinte e dois segundos é o mesmo ponto que dois: é isso que faz o
    // vídeo renderizado poder emendar nele mesmo sem salto.
    assert.ok(Math.abs(faseDe(c, 22) - faseDe(c, 2)) < 1e-9);
  });

  it("sem repetir, para no fim em vez de voltar", () => {
    const c = comp({ duracao: 10, repetir: false });
    assert.equal(faseDe(c, 12), 1);
    assert.equal(faseDe(c, -3), 0);
  });
});

describe("opacidadeNoTempo", () => {
  it("entra do zero e chega ao cheio", () => {
    const c = comp({ duracao: 10, entrada: 2, saida: 2, opacidade: 100, repetir: true });
    assert.equal(opacidadeNoTempo(c, 0), 0);
    assert.equal(opacidadeNoTempo(c, 1), 0.5);
    assert.equal(opacidadeNoTempo(c, 5), 1);
  });

  it("sai até o zero no fim do ciclo", () => {
    const c = comp({ duracao: 10, entrada: 2, saida: 2, opacidade: 100, repetir: true });
    assert.equal(opacidadeNoTempo(c, 9), 0.5);
    assert.ok(opacidadeNoTempo(c, 9.99) < 0.01);
  });

  it("a opacidade escolhida é o teto, não o valor no meio da entrada", () => {
    const c = comp({ duracao: 10, entrada: 2, saida: 2, opacidade: 50 });
    assert.equal(opacidadeNoTempo(c, 5), 0.5);
    assert.equal(opacidadeNoTempo(c, 1), 0.25);
  });

  it("sem repetir, depois do fim é zero e não o último quadro congelado", () => {
    const c = comp({ duracao: 6, repetir: false, entrada: 0, saida: 0 });
    assert.equal(opacidadeNoTempo(c, 6.5), 0);
  });

  it("entrada e saída maiores que o ciclo não invertem o fade", () => {
    const c = comp({ duracao: 4, entrada: 10, saida: 10, opacidade: 100 });
    for (let t = 0; t <= 4; t += 0.25) {
      const v = opacidadeNoTempo(c, t);
      assert.ok(v >= 0 && v <= 1, `t=${t} deu ${v}`);
    }
  });
});

describe("forcaDe", () => {
  it("é a intensidade em 0..1, e aguenta campo torto", () => {
    assert.equal(forcaDe(comp({ intensidade: 0 })), 0);
    assert.equal(forcaDe(comp({ intensidade: 70 })), 0.7);
    assert.equal(forcaDe(comp({ intensidade: 500 })), 1);
    assert.equal(forcaDe({ ...PADRAO, intensidade: undefined } as unknown as VfxComposicao), 1);
  });
});

describe("sorteio", () => {
  it("é sempre o mesmo para a mesma semente — é o que faz o vídeo repetir", () => {
    assert.equal(sorteio(42), sorteio(42));
    assert.notEqual(sorteio(42), sorteio(43));
  });

  it("fica entre 0 e 1", () => {
    for (let i = 0; i < 500; i += 1) {
      const v = sorteio(i);
      assert.ok(v >= 0 && v < 1, `semente ${i} deu ${v}`);
    }
  });
});

describe("particulaEm", () => {
  it("o mesmo instante dá a mesma partícula, sempre", () => {
    assert.deepEqual(particulaEm(7, 3.5, 1920, 1080, 30), particulaEm(7, 3.5, 1920, 1080, 30));
  });

  it("sobe com o tempo e volta por baixo em vez de sumir", () => {
    const alturas: number[] = [];
    for (let t = 0; t < 40; t += 0.5) alturas.push(particulaEm(3, t, 800, 600, 30).y);
    assert.ok(Math.min(...alturas) > -600 * 0.2);
    assert.ok(Math.max(...alturas) <= 600);
  });

  it("o raio nunca vira zero nem negativo", () => {
    for (const tamanho of [0, 1, 50, 100]) {
      for (let i = 0; i < 30; i += 1) {
        assert.ok(particulaEm(i, 1, 320, 180, tamanho).raio > 0);
      }
    }
  });
});

describe("quantasParticulas", () => {
  it("zero é zero: o laço nem começa", () => {
    assert.equal(quantasParticulas(0, 1920), 0);
  });

  it("cresce com a densidade e com a largura da tela", () => {
    assert.ok(quantasParticulas(100, 1920) > quantasParticulas(50, 1920));
    assert.ok(quantasParticulas(50, 1920) > quantasParticulas(50, 320));
  });

  it("não explode numa tela enorme", () => {
    assert.ok(quantasParticulas(100, 7680) <= 180);
  });
});
