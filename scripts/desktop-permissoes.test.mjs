import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import * as daCabine from "../src/lib/permissoes.ts";

const require = createRequire(import.meta.url);
const doServidor = require("../desktop/permissoes.cjs");

// O servidor decide; a cabine mostra. Se os dois lerem a mesma permissão de
// jeitos diferentes, a tela diz "pode" e o celular ouve "não pode".
const CASOS = [
  [],
  "chat",
  "editor",
  "controle",
  ["completo"],
  ["midia"],
  ["culto", "letras"],
  ["controle", "midia", "culto", "letras"],
  ["letras", "letras", "lixo"],
  undefined,
  null,
  42,
  { completo: true },
];

test("servidor e cabine leem as permissões do mesmo jeito", () => {
  for (const caso of CASOS) {
    assert.deepEqual(doServidor.normalizarPermissoes(caso), daCabine.normalizarPermissoes(caso), JSON.stringify(caso));
    for (const c of doServidor.CAPACIDADES) {
      assert.equal(doServidor.pode(caso, c), daCabine.pode(caso, c), `${JSON.stringify(caso)} → ${c}`);
    }
  }
  assert.deepEqual([...doServidor.CAPACIDADES], [...daCabine.CAPACIDADES]);
});

test("tocar um vídeo é da mídia e do controle; ver o que está no ar é de quem tem mais que o chat", () => {
  assert.equal(doServidor.podeAlguma(["midia"], ["midia", "controle"]), true);
  assert.equal(doServidor.podeAlguma(["letras"], ["midia", "controle"]), false);
  assert.equal(doServidor.alemDoChat([]), false);
  assert.equal(doServidor.alemDoChat("chat"), false);
  assert.equal(doServidor.alemDoChat(["culto"]), true);
});
