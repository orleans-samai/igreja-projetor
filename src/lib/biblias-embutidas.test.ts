/**
 * As Bíblias que vão dentro do app, lidas do disco como o app as lê.
 *
 * O que se prova aqui é o que o operador perceberia no culto: a versão
 * abre, tem os livros que diz ter, João 3:16 está onde deveria, e o
 * versículo que a tradução omite não empurra a numeração nem vira slide
 * em branco no telão.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BUILTIN_BIBLES,
  carregarVersao,
  chapterCount,
  chapterSlides,
  getBible,
  getVerseText,
  listVersions,
  loadBuiltinBible,
  versaoTemLivro,
} from "./bible.ts";
import type { CompactBible } from "./types.ts";

const PUBLICO = path.resolve(import.meta.dirname, "..", "..", "public");

function doDisco(url: string): CompactBible {
  return JSON.parse(readFileSync(path.join(PUBLICO, url), "utf8")) as CompactBible;
}

// O app busca `/bible/<id>.json` pelo protocolo lumen://; aqui o mesmo
// caminho sai de public/, que é de onde o build copia.
before(() => {
  globalThis.fetch = (async (url: string) => {
    try {
      const dados = doDisco(String(url));
      return { ok: true, json: async () => dados };
    } catch {
      return { ok: false, json: async () => null };
    }
  }) as unknown as typeof fetch;
});

describe("Bíblias embutidas", () => {
  test("são cinco versões, cada uma com nome e licença", () => {
    assert.equal(BUILTIN_BIBLES.length, 5);
    assert.equal(new Set(BUILTIN_BIBLES.map((b) => b.id)).size, 5);
    for (const b of BUILTIN_BIBLES) {
      assert.ok(b.name.trim(), `${b.id} sem nome`);
      assert.ok(b.license.trim(), `${b.id} sem licença`);
    }
  });

  for (const meta of BUILTIN_BIBLES) {
    test(`${meta.id}: o arquivo é da versão que a lista promete`, () => {
      const b = doDisco(meta.url);
      assert.equal(b.id, meta.id);
      assert.equal(b.name, meta.name, "o nome no arquivo e o da lista divergem");
    });
  }

  test("todas têm o capítulo de cada livro que a Almeida tem", () => {
    const almeida = doDisco("/bible/almeida-1819.json");
    for (const meta of BUILTIN_BIBLES) {
      const b = doDisco(meta.url);
      for (const livro of b.books) {
        const ref = almeida.books.find((l) => l.i === livro.i);
        assert.equal(
          livro.c.length,
          ref?.c.length,
          `${meta.id}: livro ${livro.i} com ${livro.c.length} capítulos`,
        );
      }
    }
  });

  test("as completas trazem os 66 livros, na ordem; a BLT, os 27 do Novo Testamento", () => {
    for (const meta of BUILTIN_BIBLES) {
      const b = doDisco(meta.url);
      const ids = b.books.map((l) => l.i);
      const esperado =
        meta.id === "blt-2022"
          ? Array.from({ length: 27 }, (_, i) => i + 40)
          : Array.from({ length: 66 }, (_, i) => i + 1);
      assert.deepEqual(ids, esperado, meta.id);
    }
  });

  test("João 3:16 está no lugar em todas", async () => {
    for (const meta of BUILTIN_BIBLES) {
      await loadBuiltinBible(meta.id);
      const texto = getVerseText(meta.id, 43, 3, 16) ?? "";
      assert.match(texto, /Deus/, `${meta.id}: ${texto}`);
      assert.match(texto, /mundo/, `${meta.id}: ${texto}`);
      assert.match(texto, /Filho/, `${meta.id}: ${texto}`);
    }
  });

  test("nenhum versículo sai com espaço solto antes da vírgula na versão arrumada", () => {
    const b = doDisco("/bible/bpm-2026.json");
    const soltos = b.books.flatMap((l) => l.c.flat()).filter((v) => /\s[,.;:!?]/.test(v));
    assert.equal(soltos.length, 0, soltos.slice(0, 3).join(" | "));
  });
});

// A BLT segue os manuscritos mais antigos e deixa 17 versículos vazios
// (Mateus 17:21, Atos 8:37…); a Portuguesa Mundial, 5.
describe("versículo omitido pela tradução", () => {
  test("Mateus 17:21 fica vazio e o 22 continua sendo o 22", async () => {
    await loadBuiltinBible("blt-2022");
    assert.equal(getVerseText("blt-2022", 40, 17, 21), "");
    assert.match(getVerseText("blt-2022", 40, 17, 22) ?? "", /Galileia/);
  });

  test("não vira slide em branco no telão", async () => {
    await loadBuiltinBible("blt-2022");
    const slides = chapterSlides("blt-2022", 40, 17, 3);
    assert.equal(slides.some((s) => s.reference === "Mateus 17:21"), false);
    assert.equal(slides.some((s) => s.reference === "Mateus 17:22"), true);
    assert.equal(slides.some((s) => !s.text.trim()), false);
  });
});

describe("carregarVersao e versaoTemLivro", () => {
  test("embutida carrega e passa a responder por ela mesma, não pela Almeida", async () => {
    assert.equal(await carregarVersao("bpm-2026"), true);
    assert.equal(getBible("bpm-2026")?.id, "bpm-2026");
  });

  test("versão que não existe devolve false", async () => {
    assert.equal(await carregarVersao("nao-existe"), false);
  });

  test("a BLT não tem Gênesis, e diz isso em vez de cair na Almeida", async () => {
    await carregarVersao("blt-2022");
    assert.equal(versaoTemLivro("blt-2022", 1), false);
    assert.equal(versaoTemLivro("blt-2022", 43), true);
    assert.equal(chapterCount("blt-2022", 1), 0);
    assert.equal(chapterSlides("blt-2022", 1, 1, 3).length, 0);
  });

  test("a lista de versões traz as cinco com o nome que vai no telão", () => {
    const nomes = listVersions().map((v) => v.name);
    for (const b of BUILTIN_BIBLES) assert.ok(nomes.includes(b.name), b.name);
  });
});
