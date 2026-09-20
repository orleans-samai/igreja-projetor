import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LADO_MAX_LOGO,
  caberEm,
  ehImagemAceita,
  ehVetor,
  pesoDoDataUrl,
  pesoLegivel,
} from "./logo-imagem.ts";

describe("caberEm", () => {
  test("foto grande encolhe mantendo a proporção", () => {
    assert.deepEqual(caberEm(4000, 3000), { largura: 640, altura: 480 });
    assert.deepEqual(caberEm(1000, 4000), { largura: 160, altura: 640 });
    assert.deepEqual(caberEm(2000, 2000), { largura: 640, altura: 640 });
  });

  test("logo pequena não é esticada", () => {
    // Esticar só deixaria borrado e mais pesado.
    assert.deepEqual(caberEm(120, 60), { largura: 120, altura: 60 });
    assert.deepEqual(caberEm(LADO_MAX_LOGO, 100), { largura: LADO_MAX_LOGO, altura: 100 });
  });

  test("faixa muito fina não some", () => {
    // Arredondar para baixo daria altura zero, e o canvas recusa desenhar.
    const r = caberEm(4000, 3);
    assert.equal(r.largura, 640);
    assert.equal(r.altura, 1);
  });

  test("medida inválida não vira desenho", () => {
    assert.deepEqual(caberEm(0, 100), { largura: 0, altura: 0 });
    assert.deepEqual(caberEm(NaN, 100), { largura: 0, altura: 0 });
    assert.deepEqual(caberEm(-10, -10), { largura: 0, altura: 0 });
  });

  test("dá para pedir outro lado", () => {
    assert.deepEqual(caberEm(1000, 500, 100), { largura: 100, altura: 50 });
  });
});

describe("tipos de imagem", () => {
  test("aceita o que uma igreja costuma ter", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) {
      assert.equal(ehImagemAceita(t), true, t);
    }
    assert.equal(ehImagemAceita("IMAGE/PNG"), true);
  });

  test("recusa o que não é imagem", () => {
    assert.equal(ehImagemAceita("application/pdf"), false);
    assert.equal(ehImagemAceita("text/html"), false);
    assert.equal(ehImagemAceita(undefined), false);
    assert.equal(ehImagemAceita(""), false);
  });

  test("só o SVG escapa da redução", () => {
    assert.equal(ehVetor("image/svg+xml"), true);
    assert.equal(ehVetor("image/png"), false);
  });
});

describe("peso", () => {
  test("conta o que está guardado, não o texto do endereço", () => {
    // "AAAA" em base64 são 3 bytes de verdade.
    assert.equal(pesoDoDataUrl("data:image/png;base64,AAAA"), 3);
    assert.equal(pesoDoDataUrl("data:image/png;base64,AAA="), 2);
    assert.equal(pesoDoDataUrl("data:image/png;base64,AA=="), 1);
    assert.equal(pesoDoDataUrl(undefined), 0);
    assert.equal(pesoDoDataUrl(""), 0);
  });

  test("endereço que não é base64 vale o tamanho do corpo", () => {
    assert.equal(pesoDoDataUrl("data:image/svg+xml,%3Csvg%3E"), "%3Csvg%3E".length);
  });

  test("o número aparece em palavra de gente", () => {
    assert.equal(pesoLegivel(0), "0 KB");
    assert.equal(pesoLegivel(512), "512 B");
    assert.equal(pesoLegivel(2048), "2 KB");
    assert.equal(pesoLegivel(3 * 1024 * 1024), "3.0 MB");
  });
});
