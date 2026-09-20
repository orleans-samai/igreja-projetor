import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chatEhColuna, chatVisivel } from "./chat-visivel.ts";

describe("chatVisivel", () => {
  test("como coluna o chat fica, aberto ou não", () => {
    // É a correção: o painel nascia fechado e o recado do celular chegava
    // sem ninguém ver. Na fileira ele não cobre nada, então não há motivo
    // para sumir.
    assert.equal(chatVisivel("coluna", false), true);
    assert.equal(chatVisivel("coluna", true), true);
  });

  test("flutuante ainda pode ser dispensado", () => {
    // Só ele sobrepõe o trabalho; o que sobrepõe tem que ter como sair.
    assert.equal(chatVisivel("flutuante", true), true);
    assert.equal(chatVisivel("flutuante", false), false);
  });

  test("oculto é oculto", () => {
    assert.equal(chatVisivel("oculto", true), false);
    assert.equal(chatVisivel("oculto", false), false);
  });
});

describe("chatEhColuna", () => {
  test("só a coluna entra na fileira arrastável", () => {
    // É o que decide se o chat aparece no Reorganizar junto com repertório,
    // programação, no ar e temas.
    assert.equal(chatEhColuna("coluna"), true);
    assert.equal(chatEhColuna("flutuante"), false);
    assert.equal(chatEhColuna("oculto"), false);
  });
});
