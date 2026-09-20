import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { acharJson, lerResposta } from "./protocolo.ts";

describe("acharJson", () => {
  test("acha o JSON embrulhado em cerca de código", () => {
    const r = acharJson('Claro! Aqui está:\n```json\n{"ferramenta":"x"}\n```');
    assert.deepEqual(r, { ferramenta: "x" });
  });

  test("acha o JSON solto no meio da conversa", () => {
    assert.deepEqual(acharJson('Vou fazer isso: {"ferramenta":"y"} pronto.'), { ferramenta: "y" });
  });

  test("acha objeto com objeto dentro", () => {
    // Parar no primeiro "}" cortaria o pedido ao meio.
    assert.deepEqual(acharJson('{"a":{"b":1}}'), { a: { b: 1 } });
  });

  test("texto sem JSON não vira JSON", () => {
    assert.equal(acharJson("Bom dia! Como posso ajudar?"), null);
    assert.equal(acharJson(""), null);
    assert.equal(acharJson("{isto não fecha"), null);
  });
});

describe("lerResposta", () => {
  test("resposta em palavras é fala, não pedido", () => {
    const r = lerResposta("Para criar uma playlist, abra o menu Culto.");
    assert.equal(r.tipo, "fala");
    assert.match(r.texto, /playlist/);
  });

  test("pedido de ferramenta vira pedido, com os argumentos", () => {
    const r = lerResposta('{"ferramenta":"projetar_musica","argumentos":{"id":"s1"}}');
    assert.equal(r.tipo, "pedido");
    assert.equal(r.tipo === "pedido" && r.pedido.ferramenta, "projetar_musica");
    assert.deepEqual(r.tipo === "pedido" && r.pedido.argumentos, { id: "s1" });
  });

  test("aceita os nomes em inglês que o modelo às vezes usa", () => {
    const r = lerResposta('{"tool":"x","arguments":{"a":1}}');
    assert.equal(r.tipo === "pedido" && r.pedido.ferramenta, "x");
    assert.deepEqual(r.tipo === "pedido" && r.pedido.argumentos, { a: 1 });
  });

  test("pergunta vence ferramenta: quem tem dúvida não age", () => {
    // Se o modelo pediu esclarecimento, agir é adivinhar.
    const r = lerResposta('{"pergunta":"Projetar ou preparar?","ferramenta":"projetar_musica"}');
    assert.equal(r.tipo, "pergunta");
    assert.match(r.texto, /Projetar ou preparar/);
  });

  test("a explicação escrita junto do pedido sobrevive, sem as chaves", () => {
    const r = lerResposta('Vou projetar agora.\n{"ferramenta":"projetar_musica","argumentos":{}}');
    assert.equal(r.tipo, "pedido");
    assert.equal(r.texto, "Vou projetar agora.");
  });

  test("resposta truncada não derruba nada", () => {
    for (const lixo of ["", "   ", "{", '{"ferramenta"', "[1,2,3]", "null"]) {
      const r = lerResposta(lixo);
      assert.ok(r.tipo === "fala" || r.tipo === "pedido", lixo);
    }
  });

  test("nome de ferramenta vazio não vira pedido", () => {
    assert.equal(lerResposta('{"ferramenta":"   "}').tipo, "fala");
    assert.equal(lerResposta('{"ferramenta":123}').tipo, "fala");
  });

  test("argumentos que não são objeto viram objeto vazio", () => {
    const r = lerResposta('{"ferramenta":"x","argumentos":"tudo"}');
    assert.deepEqual(r.tipo === "pedido" && r.pedido.argumentos, {});
  });

  test("resposta gigante é aparada antes de virar tela ou registro", () => {
    const r = lerResposta("a".repeat(50000));
    assert.ok(r.texto.length <= 4000, String(r.texto.length));
  });

  test("caractere de controle não passa", () => {
    const r = lerResposta("oi\u0000\u0007 tudo bem");
    assert.equal(r.texto, "oi tudo bem");
  });

  test("um monte de argumentos não vira um monte de argumentos", () => {
    const muitos: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) muitos[`a${i}`] = i;
    const r = lerResposta(JSON.stringify({ ferramenta: "x", argumentos: muitos }));
    assert.equal(Object.keys(r.tipo === "pedido" ? r.pedido.argumentos : {}).length, 20);
  });
});
