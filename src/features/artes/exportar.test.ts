import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nomeDeArquivo, svgComoUrl } from "./exportar.ts";
import { montar } from "./variacoes.ts";
import { dadosVazios } from "./types.ts";

function arte(nome = "Culto da Benção") {
  return montar({
    id: "a1",
    nome,
    dados: { ...dadosVazios(), titulo: nome },
    semente: 1,
    formatoId: "quadrado",
    largura: 1080,
    altura: 1080,
  });
}

describe("svgComoUrl", () => {
  test("vira um endereço data que o navegador lê", () => {
    const url = svgComoUrl(arte());
    assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.match(decodeURIComponent(url), /<svg /);
  });

  test("acento e símbolo sobrevivem à codificação", () => {
    // Juntando as linhas: o título é grande e pode quebrar em duas, o que
    // não tem nada a ver com codificação. O "&" continua tendo que sair
    // escapado, e é isso que a busca verifica.
    const svg = decodeURIComponent(svgComoUrl(arte("Ação & Louvor")));
    const texto = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]).join(" ");
    assert.match(texto, /Ação &amp; Louvor/);
  });
});

describe("nomeDeArquivo", () => {
  test("vira nome que o Windows aceita", () => {
    assert.equal(nomeDeArquivo(arte("Culto da Benção"), "png"), "Culto-da-Bencao-quadrado.png");
  });

  test("tira o que o sistema recusa", () => {
    assert.equal(nomeDeArquivo(arte('a/b' + String.fromCharCode(92) + 'c:d*e?f"g<h>i|j'), "png"), "abcdefghij-quadrado.png");
  });

  test("nome vazio não vira arquivo sem nome", () => {
    assert.equal(nomeDeArquivo(arte("···"), "jpg"), "arte-quadrado.jpg");
  });

  test("nome gigante é aparado", () => {
    assert.ok(nomeDeArquivo(arte("x".repeat(300)), "png").length < 80);
  });
});
