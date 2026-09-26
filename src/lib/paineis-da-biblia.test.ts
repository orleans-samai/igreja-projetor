import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARRANJO_PADRAO,
  arranjoValido,
  descreverArranjo,
  ehPadrao,
  trocarLados,
  trocarPartes,
} from "./paineis-da-biblia.ts";

test("trocar duas partes as põe uma no lugar da outra", () => {
  const a = trocarPartes(ARRANJO_PADRAO, "previa", "navegacao");
  assert.deepEqual(a.lugares, ["versiculos", "navegacao", "previa"]);
  assert.equal(ehPadrao(a), false);
  // Trocar de novo volta ao que era.
  assert.equal(ehPadrao(trocarPartes(a, "previa", "navegacao")), true);
  // A mesma parte com ela mesma não muda nada.
  assert.equal(trocarPartes(ARRANJO_PADRAO, "previa", "previa"), ARRANJO_PADRAO);
});

test("com trocas e lados dá para chegar às doze disposições", () => {
  const vistas = new Set<string>();
  const partes = ["versiculos", "previa", "navegacao"] as const;
  let fila = [ARRANJO_PADRAO];
  while (fila.length) {
    const proxima = [];
    for (const a of fila) {
      const chave = `${a.lugares.join(",")}|${a.duplaNa}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      proxima.push(trocarLados(a));
      for (const x of partes) for (const y of partes) proxima.push(trocarPartes(a, x, y));
    }
    fila = proxima;
  }
  assert.equal(vistas.size, 12);
});

test("arranjo guardado estragado vira um arranjo completo", () => {
  assert.deepEqual(arranjoValido(null), ARRANJO_PADRAO);
  assert.deepEqual(arranjoValido({ lugares: ["previa", "previa", "fantasma"], duplaNa: "cima" }), {
    lugares: ["previa", "versiculos", "navegacao"],
    duplaNa: "esquerda",
  });
  assert.deepEqual(arranjoValido({ lugares: ["navegacao", "versiculos", "previa"], duplaNa: "direita" }), {
    lugares: ["navegacao", "versiculos", "previa"],
    duplaNa: "direita",
  });
});

test("a faixa descreve a disposição em palavras", () => {
  assert.equal(
    descreverArranjo(ARRANJO_PADRAO),
    "Versículos e Prévia à esquerda · Livros e capítulos à direita",
  );
  assert.equal(
    descreverArranjo(trocarLados(ARRANJO_PADRAO)),
    "Versículos e Prévia à direita · Livros e capítulos à esquerda",
  );
});
