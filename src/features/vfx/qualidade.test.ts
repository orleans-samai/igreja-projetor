import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MODELOS, PADRAO } from "./padroes.ts";
import {
  TETO,
  avisoDePeso,
  foiAparada,
  limitarPorQualidade,
  oQuePesa,
  pesoDa,
  qualidadeDoPeso,
} from "./qualidade.ts";
import type { VfxComposicao } from "./tipos.ts";

const tudoNoMaximo: VfxComposicao = {
  ...PADRAO,
  intensidade: 100,
  desfoque: 100,
  ondulacao: 100,
  particulas: 100,
  separacaoRgb: 100,
  glitch: 100,
  glow: 100,
  granulacao: 100,
};

describe("pesoDa", () => {
  it("tudo no máximo é o teto da escala", () => {
    assert.equal(pesoDa(tudoNoMaximo), 100);
  });

  it("nada ligado não custa nada", () => {
    const nada: VfxComposicao = {
      ...PADRAO,
      desfoque: 0,
      ondulacao: 0,
      particulas: 0,
      separacaoRgb: 0,
      glitch: 0,
      glow: 0,
      granulacao: 0,
    };
    assert.equal(pesoDa(nada), 0);
  });

  it("intensidade pela metade é metade do trabalho", () => {
    const meio = { ...tudoNoMaximo, intensidade: 50 };
    assert.equal(pesoDa(meio), 50);
  });

  it("campo ausente ou lixo não vira NaN", () => {
    const torto = { ...PADRAO, desfoque: NaN, glow: undefined } as unknown as VfxComposicao;
    assert.ok(Number.isFinite(pesoDa(torto)));
  });
});

describe("limitarPorQualidade", () => {
  it("no leve, os efeitos que redesenham a tela vão a zero", () => {
    const r = limitarPorQualidade(tudoNoMaximo, "leve");
    assert.equal(r.desfoque, 0);
    assert.equal(r.ondulacao, 0);
    assert.equal(r.separacaoRgb, 0);
    assert.equal(r.glitch, 0);
    // Partícula não vai a zero: um punhado ainda é barato, e é o efeito
    // que faz a composição parecer viva.
    assert.ok(r.particulas > 0 && r.particulas <= 12);
  });

  it("alta qualidade não apara nada", () => {
    assert.deepEqual(limitarPorQualidade(tudoNoMaximo, "alta"), tudoNoMaximo);
    assert.equal(foiAparada(tudoNoMaximo, "alta"), false);
  });

  it("não mexe no que já está abaixo do teto", () => {
    const leve = { ...PADRAO, desfoque: 0, ondulacao: 0, particulas: 5, glow: 10 };
    assert.deepEqual(limitarPorQualidade(leve, "leve"), leve);
    assert.equal(foiAparada(leve, "leve"), false);
  });

  it("aparar é o bastante para caber no teto do modo", () => {
    for (const q of ["leve", "equilibrado"] as const) {
      const aparada = limitarPorQualidade(tudoNoMaximo, q);
      assert.ok(
        pesoDa(aparada) <= TETO[q],
        `${q}: sobrou ${pesoDa(aparada)} para um teto de ${TETO[q]}`,
      );
    }
  });

  it("não devolve o mesmo objeto — a composição do operador não muda sozinha", () => {
    const r = limitarPorQualidade(tudoNoMaximo, "leve");
    assert.notEqual(r, tudoNoMaximo);
    assert.equal(tudoNoMaximo.desfoque, 100);
  });
});

describe("qualidadeDoPeso", () => {
  it("classifica pelos mesmos tetos que limitam", () => {
    assert.equal(qualidadeDoPeso(0), "leve");
    assert.equal(qualidadeDoPeso(TETO.leve), "leve");
    assert.equal(qualidadeDoPeso(TETO.leve + 1), "equilibrado");
    assert.equal(qualidadeDoPeso(TETO.equilibrado + 1), "alta");
  });
});

describe("oQuePesa", () => {
  it("nomeia os caros, do mais caro para o menos", () => {
    const lista = oQuePesa(tudoNoMaximo).map((x) => x.rotulo);
    assert.equal(lista[0], "Desfoque");
    assert.equal(lista[1], "Ondulação");
    assert.ok(lista.includes("Partículas"));
  });

  it("ignora o que está quase desligado", () => {
    const quase = { ...PADRAO, desfoque: 2, ondulacao: 0, particulas: 0, glow: 0, granulacao: 0, glitch: 0, separacaoRgb: 0 };
    assert.deepEqual(oQuePesa(quase), []);
  });
});

describe("avisoDePeso", () => {
  it("cala quando a composição cabe", () => {
    assert.equal(avisoDePeso(PADRAO, "alta"), null);
  });

  it("nomeia os dois controles mais caros, para o operador saber o que baixar", () => {
    const aviso = avisoDePeso(tudoNoMaximo, "leve");
    assert.ok(aviso);
    assert.match(aviso, /Desfoque e Ondulação/);
    // E aponta a saída de verdade, que é renderizar.
    assert.match(aviso, /salve como vídeo/i);
  });
});

describe("os modelos prontos", () => {
  it("todos cabem em Equilibrado sem precisar de corte", () => {
    for (const m of MODELOS) {
      assert.ok(
        pesoDa(m.comp) <= TETO.equilibrado,
        `${m.nome} pesa ${pesoDa(m.comp)}, acima de ${TETO.equilibrado}`,
      );
    }
  });

  it("o minimalista cabe até no Leve — é a razão de ele existir", () => {
    const min = MODELOS.find((m) => m.id === "minimalista");
    assert.ok(min);
    assert.ok(pesoDa(min.comp) <= TETO.leve, `pesou ${pesoDa(min.comp)}`);
    assert.equal(min.comp.particulas, 0);
  });

  it("cada modelo tem id, nome e descrição próprios", () => {
    const ids = new Set(MODELOS.map((m) => m.id));
    assert.equal(ids.size, MODELOS.length);
    assert.equal(MODELOS.length, 6);
    for (const m of MODELOS) {
      assert.ok(m.nome.trim().length > 0);
      assert.ok(m.descricao.trim().length > 0);
      assert.ok(m.comp.duracao >= 3);
    }
  });
});
