import { test } from "node:test";
import assert from "node:assert/strict";
import { lerJsonDeBiblia, nomePeloArquivo, normalizeImported } from "./bible.ts";

/**
 * Importar a Bíblia que a igreja tem licença para usar (NVI, NAA…).
 *
 * O Lúmen não traz versões com direitos autorais; o que ele precisa é ler
 * bem o arquivo que a igreja já tem — nos formatos em que ele circula.
 */

function livros(quantos: number) {
  return Array.from({ length: quantos }, (_, k) => ({
    abbrev: `l${k + 1}`,
    name: `Livro ${k + 1}`,
    chapters: [[`Versículo 1 do livro ${k + 1}`, `Versículo 2 do livro ${k + 1} `]],
  }));
}

test("lista de 66 livros com capítulos vira uma versão, na ordem canônica", () => {
  const b = normalizeImported(livros(66), "nvi.json");
  assert.equal(b.name, "NVI");
  assert.equal(b.id, "importada-nvi");
  assert.equal(b.books.length, 66);
  assert.equal(b.books[0].i, 1);
  assert.equal(b.books[0].o, "Gen");
  assert.equal(b.books[42].i, 43);
  assert.equal(b.books[42].o, "John");
  // Espaço sobrando no fim do versículo não vai para o telão.
  assert.equal(b.books[0].c[0][1], "Versículo 2 do livro 1");
});

test("só o Novo Testamento (27 livros) começa em Mateus", () => {
  const b = normalizeImported(livros(27), "nt.json");
  assert.equal(b.books[0].i, 40);
  assert.equal(b.books[0].o, "Matt");
  assert.equal(b.books[26].i, 66);
});

test("número de livros que não é Bíblia é recusado com o motivo", () => {
  assert.throws(() => normalizeImported(livros(12), "x.json"), /66 livros/);
  assert.throws(() => normalizeImported([{ abbrev: "gn" }], "x.json"), /66 livros/);
});

test("o nome vem do arquivo quando o JSON não traz", () => {
  assert.equal(nomePeloArquivo("nvi.json"), "NVI");
  assert.equal(nomePeloArquivo("C:\\Bíblias\\naa.JSON"), "NAA");
  assert.equal(nomePeloArquivo("almeida_revista_atualizada.json"), "almeida revista atualizada");
  assert.equal(nomePeloArquivo(""), "Versão importada");
  // Formato compacto sem nome também usa o arquivo.
  const compacto = normalizeImported({ books: [{ i: 1, o: "Gen", c: [["No princípio"]] }] }, "ara.json");
  assert.equal(compacto.name, "ARA");
});

test("arquivo salvo com BOM (Bloco de Notas) é lido", () => {
  const bom = String.fromCharCode(0xfeff);
  assert.deepEqual(lerJsonDeBiblia(`${bom}[1, 2]`), [1, 2]);
  assert.throws(() => lerJsonDeBiblia("não é json"), /JSON válido/);
});
