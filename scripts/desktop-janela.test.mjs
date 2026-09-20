import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CORTE_COLUNAS, MOLDURA, alturaDaCabine, cabemAsColunas, larguraDaCabine } =
  require("../desktop/janela.cjs");

/** Telas que existem em igreja de verdade, da menor à maior. */
const TELAS = [
  { nome: "notebook 1366×768", largura: 1366, altura: 728 },
  { nome: "Full HD 100%", largura: 1920, altura: 1032 },
  { nome: "Full HD 125%", largura: 1536, altura: 824 },
  { nome: "Full HD 150%", largura: 1280, altura: 688 },
  { nome: "1440p", largura: 2560, altura: 1392 },
  { nome: "4K a 150%", largura: 2560, altura: 1392 },
];

test("em toda tela que comporta, a cabine nasce no desenho de colunas", () => {
  for (const t of TELAS) {
    if (t.largura < CORTE_COLUNAS + MOLDURA) continue;
    assert.equal(
      cabemAsColunas(t.largura),
      true,
      `${t.nome}: a cabine nasceria estreita, sem a coluna da direita`,
    );
  }
});

test("a Full HD a 100% era o caso quebrado, e agora passa", () => {
  // 1280 de janela davam 1264 de área útil: dois pixels abaixo do corte.
  assert.equal(1280 - MOLDURA < CORTE_COLUNAS, true, "o caso antigo não era mais o caso antigo");
  assert.equal(cabemAsColunas(1920), true);
  assert.ok(larguraDaCabine(1920) - MOLDURA >= CORTE_COLUNAS);
});

test("nunca maior que a tela — janela fora do monitor não se arrasta de volta", () => {
  for (const t of TELAS) {
    assert.ok(larguraDaCabine(t.largura) <= t.largura, `${t.nome}: largura estourou`);
    assert.ok(alturaDaCabine(t.altura) <= t.altura, `${t.nome}: altura estourou`);
  }
  assert.equal(larguraDaCabine(800), 800);
  assert.equal(alturaDaCabine(600), 600);
});

test("em tela pequena de verdade, o desenho estreito é a resposta certa", () => {
  // Não é falha: ali as colunas não cabem mesmo, e insistir seria pior.
  assert.equal(cabemAsColunas(1024), false);
  assert.equal(cabemAsColunas(800), false);
});

test("cresce com a tela até o tamanho pretendido, e para ali", () => {
  assert.ok(larguraDaCabine(3840) === larguraDaCabine(2560));
  assert.ok(larguraDaCabine(1366) < larguraDaCabine(1920));
});
