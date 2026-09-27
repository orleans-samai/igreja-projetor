import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acessoCompleto,
  alternarCapacidade,
  normalizarPermissoes,
  pode,
  resumoDasPermissoes,
} from "./permissoes.ts";

describe("as permissões do celular, por parte", () => {
  it("só chat é a lista vazia: não pode nenhuma parte", () => {
    for (const c of ["culto", "midia", "letras", "controle"] as const) assert.equal(pode([], c), false, c);
    assert.equal(resumoDasPermissoes([]), "Só chat");
  });

  it("uma ou mais partes, sem as outras", () => {
    const p = ["midia", "culto"];
    assert.equal(pode(p, "midia"), true);
    assert.equal(pode(p, "culto"), true);
    assert.equal(pode(p, "letras"), false);
    assert.equal(pode(p, "controle"), false);
    // Na ordem de sempre, não na ordem em que foram marcadas.
    assert.equal(resumoDasPermissoes(p), "Culto · Mídia");
  });

  it("acesso completo pode tudo", () => {
    for (const c of ["culto", "midia", "letras", "controle"] as const) assert.equal(pode(["completo"], c), true, c);
    assert.equal(acessoCompleto(["completo", "midia"]), true);
    assert.equal(resumoDasPermissoes(["completo"]), "Acesso completo");
  });

  it("os degraus antigos viram partes: ninguém perde nem ganha nada ao atualizar", () => {
    assert.deepEqual(normalizarPermissoes("chat"), []);
    assert.deepEqual(normalizarPermissoes("editor"), ["culto", "midia", "letras"]);
    assert.deepEqual(normalizarPermissoes("controle"), ["completo"]);
  });

  it("lixo guardado vira só chat, nunca mais permissão", () => {
    for (const lixo of [undefined, null, 3, "admin", { controle: true }, ["tudo", "root"]]) {
      assert.deepEqual(normalizarPermissoes(lixo), [], String(lixo));
    }
    assert.deepEqual(normalizarPermissoes(["letras", "letras", "hack"]), ["letras"]);
  });

  it("ligar e desligar uma parte; tirar uma do completo deixa as outras três", () => {
    assert.deepEqual(alternarCapacidade([], "culto"), ["culto"]);
    assert.deepEqual(alternarCapacidade(["culto"], "culto"), []);
    assert.deepEqual(alternarCapacidade(["completo"], "controle"), ["culto", "midia", "letras"]);
  });
});
