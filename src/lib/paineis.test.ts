import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ORDEM_PADRAO, ordemValida, trocar, type PainelId } from "./paineis.ts";

describe("ordemValida", () => {
  it("aceita uma ordem inteira e a mantém", () => {
    const ordem: PainelId[] = ["preview", "temas", "chat", "biblioteca", "culto"];
    assert.deepEqual(ordemValida(ordem), ordem);
  });

  it("devolve o padrão quando não há nada guardado", () => {
    assert.deepEqual(ordemValida(undefined), [...ORDEM_PADRAO]);
    assert.deepEqual(ordemValida(null), [...ORDEM_PADRAO]);
    assert.deepEqual(ordemValida("preview"), [...ORDEM_PADRAO]);
  });

  it("completa o painel que faltou, em vez de deixá-lo sumir", () => {
    // O chat entrou depois: uma ordem gravada antes dele não pode deixar a
    // coluna sumir da cabine sem caminho de volta.
    assert.deepEqual(ordemValida(["preview", "culto"]), [
      "preview",
      "culto",
      "biblioteca",
      "temas",
      "chat",
    ]);
  });

  it("descarta repetido e desconhecido", () => {
    const saida = ordemValida(["temas", "temas", "inventado", 7, "culto"]);
    assert.deepEqual(saida, ["temas", "culto", "biblioteca", "preview", "chat"]);
    assert.equal(new Set(saida).size, saida.length);
  });

  it("seja qual for a entrada, a cabine fica com todos os painéis", () => {
    for (const entrada of [[], ["x"], ["temas"], [1, 2, 3], {}, ORDEM_PADRAO]) {
      const saida = ordemValida(entrada);
      assert.equal(saida.length, ORDEM_PADRAO.length);
      for (const id of ORDEM_PADRAO) assert.ok(saida.includes(id), `${id} sumiu`);
    }
  });
});

describe("trocar", () => {
  it("troca dois painéis de lugar", () => {
    assert.deepEqual(trocar(ORDEM_PADRAO, "biblioteca", "preview"), [
      "preview",
      "culto",
      "biblioteca",
      "temas",
      "chat",
    ]);
  });

  it("soltar em cima de si mesmo não muda nada", () => {
    assert.deepEqual(trocar(ORDEM_PADRAO, "culto", "culto"), [...ORDEM_PADRAO]);
  });

  it("não inventa painel que não está na ordem", () => {
    assert.deepEqual(trocar(["culto", "preview"], "culto", "temas"), ["culto", "preview"]);
  });
});
