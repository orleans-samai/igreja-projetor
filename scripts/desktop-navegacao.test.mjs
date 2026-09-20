import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { abortou } = require("../desktop/navegacao.cjs");

test("navegação abortada não é falha para mostrar ao operador", () => {
  // O formato que o Electron devolve quando o loadURL é substituído.
  assert.equal(abortou(new Error("ERR_ABORTED (-3) loading 'lumen://app/'")), true);
  assert.equal(abortou(Object.assign(new Error("qualquer"), { errno: -3 })), true);
  assert.equal(abortou(Object.assign(new Error("qualquer"), { code: "ERR_ABORTED" })), true);
});

test("falha de verdade continua chegando ao operador", () => {
  // Estas precisam abrir a caixa: sem elas, a janela fica preta e ninguém
  // fica sabendo por quê.
  assert.equal(abortou(new Error("ERR_FILE_NOT_FOUND (-6) loading 'lumen://app/'")), false);
  assert.equal(abortou(new Error("Interface ausente. Reinstale o Lúmen.")), false);
  assert.equal(abortou(Object.assign(new Error("outro"), { errno: -6 })), false);
});

test("não quebra com o que não é erro", () => {
  assert.equal(abortou(null), false);
  assert.equal(abortou(undefined), false);
  assert.equal(abortou(""), false);
  assert.equal(abortou("ERR_ABORTED"), true);
  assert.equal(abortou({}), false);
});
