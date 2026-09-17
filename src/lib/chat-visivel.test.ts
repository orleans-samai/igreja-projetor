import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chatVisivel, fecharLeva, mostrarLeva } from "./chat-visivel.ts";

describe("chatVisivel", () => {
  test("na lateral o chat fica, aberto ou não", () => {
    // É a correção: o painel nascia fechado e o recado do celular chegava
    // sem ninguém ver. Na lateral ele não cobre nada, então não há motivo
    // para sumir.
    assert.equal(chatVisivel("direita", false), true);
    assert.equal(chatVisivel("direita", true), true);
    assert.equal(chatVisivel("esquerda", false), true);
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

describe("fechar e mostrar", () => {
  test("fechar na lateral esconde de vez", () => {
    assert.equal(fecharLeva("direita"), "oculto");
    assert.equal(fecharLeva("esquerda"), "oculto");
    assert.equal(fecharLeva("flutuante"), "oculto");
  });

  test("quem já está oculto não tem o que fechar", () => {
    assert.equal(fecharLeva("oculto"), null);
  });

  test("mostrar devolve para o lado de onde saiu", () => {
    assert.equal(mostrarLeva("oculto", "esquerda"), "esquerda");
    assert.equal(mostrarLeva("oculto", "direita"), "direita");
    // Sem lado guardado, ou vindo do flutuante, a direita é o padrão da casa.
    assert.equal(mostrarLeva("oculto", "flutuante"), "direita");
  });

  test("chat que já está à vista não muda de lugar", () => {
    assert.equal(mostrarLeva("direita", "esquerda"), "direita");
    assert.equal(mostrarLeva("flutuante", "esquerda"), "flutuante");
  });
});
