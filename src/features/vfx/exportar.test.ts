import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BITRATE,
  MAX_BYTES,
  MAX_SEGUNDOS,
  MIN_SEGUNDOS,
  RESOLUCOES,
  cabeNaPasta,
  nomeDoArquivo,
  tamanhoEstimado,
} from "./exportar.ts";
import type { VfxQualidade } from "./tipos.ts";

const QUALIDADES: VfxQualidade[] = ["leve", "equilibrado", "alta"];

describe("nomeDoArquivo", () => {
  it("põe a extensão e não a duplica", () => {
    assert.equal(nomeDoArquivo("Adoração"), "Adoração.webm");
    assert.equal(nomeDoArquivo("Adoração.webm"), "Adoração.webm");
    assert.equal(nomeDoArquivo("Adoração.WEBM"), "Adoração.WEBM");
  });

  it("tira o que o Windows recusa num nome de arquivo", () => {
    assert.equal(nomeDoArquivo('cul:to/do "dia"?'), "cul-to-do -dia--.webm");
  });

  it("nome vazio ainda dá um arquivo com nome", () => {
    assert.equal(nomeDoArquivo("   "), "Vídeo dinâmico.webm");
    assert.equal(nomeDoArquivo(""), "Vídeo dinâmico.webm");
  });

  it("não deixa o nome crescer sem fim", () => {
    assert.ok(nomeDoArquivo("a".repeat(500)).length <= 86);
  });
});

describe("tamanho do arquivo", () => {
  it("o máximo de cada qualidade cabe nos 64 MB da pasta", () => {
    for (const q of QUALIDADES) {
      assert.ok(
        cabeNaPasta(MAX_SEGUNDOS, q),
        `${q}: ${tamanhoEstimado(MAX_SEGUNDOS, q)} passa de ${MAX_BYTES}`,
      );
    }
  });

  it("a conta é a taxa de bits vezes o tempo", () => {
    assert.equal(tamanhoEstimado(10, "alta"), Math.round((BITRATE.alta / 8) * 10));
  });

  it("qualidade maior pesa mais, no mesmo tempo", () => {
    assert.ok(tamanhoEstimado(30, "alta") > tamanhoEstimado(30, "equilibrado"));
    assert.ok(tamanhoEstimado(30, "equilibrado") > tamanhoEstimado(30, "leve"));
  });

  it("duração negativa não vira arquivo negativo", () => {
    assert.equal(tamanhoEstimado(-5, "alta"), 0);
  });
});

describe("resoluções", () => {
  it("são todas 16:9, que é o formato do telão", () => {
    for (const r of RESOLUCOES) {
      assert.ok(Math.abs(r.largura / r.altura - 16 / 9) < 0.02, `${r.rotulo} não é 16:9`);
    }
  });

  it("a primeira é a que abre o diálogo, e não é a mais pesada", () => {
    assert.equal(RESOLUCOES[0].id, "720");
    const maior = Math.max(...RESOLUCOES.map((r) => r.largura));
    assert.ok(RESOLUCOES[0].largura < maior);
  });
});

describe("limites de duração", () => {
  it("o mínimo é curto o bastante para um teste e o máximo não é uma tarde", () => {
    assert.ok(MIN_SEGUNDOS >= 1 && MIN_SEGUNDOS <= 5);
    assert.ok(MAX_SEGUNDOS <= 180);
    assert.ok(MAX_SEGUNDOS > MIN_SEGUNDOS);
  });
});
