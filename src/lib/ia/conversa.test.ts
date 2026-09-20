import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { instrucao, montarMensagens, peneirarSegredos, AVISO_PRIVACIDADE } from "./conversa.ts";
import { FERRAMENTAS } from "./ferramentas.ts";

describe("peneirarSegredos", () => {
  test("a senha digitada não sai da janela", () => {
    const r = peneirarSegredos("coloque a senha culto2026 no usuário João");
    assert.equal(r.tirouSegredo, true);
    assert.ok(!r.texto.includes("culto2026"), r.texto);
    // A intenção sobrevive: o modelo ainda entende que se falou de senha, e
    // pode oferecer o formulário.
    assert.match(r.texto, /senha/i);
  });

  test("pega os jeitos comuns de escrever", () => {
    for (const frase of [
      "senha: abc12345",
      "a senha é abc12345",
      'token = "abc12345"',
      "api key abc12345",
      "o PIN é 998877",
    ]) {
      const r = peneirarSegredos(frase);
      assert.equal(r.tirouSegredo, true, frase);
      assert.ok(!/abc12345|998877/.test(r.texto), frase + " -> " + r.texto);
    }
  });

  test("perguntar sobre senha não é mandar senha", () => {
    // Bloquear o assunto deixaria o assistente inútil para ajudar o operador.
    for (const frase of ["como eu troco a senha do celular?", "onde fica a senha?"]) {
      const r = peneirarSegredos(frase);
      assert.equal(r.tirouSegredo, false, frase);
      assert.equal(r.texto, frase);
    }
  });

  test("texto sem segredo passa intacto", () => {
    const frase = "projete João 3:16 no telão";
    assert.deepEqual(peneirarSegredos(frase), { texto: frase, tirouSegredo: false });
  });
});

describe("a instrução do sistema", () => {
  test("lista todas as ferramentas, e manda responder em português", () => {
    const t = instrucao();
    for (const f of FERRAMENTAS) assert.match(t, new RegExp(f.nome), f.nome);
    assert.match(t, /português do Brasil/);
  });

  test("manda perguntar em vez de adivinhar, e proíbe inventar", () => {
    const t = instrucao();
    assert.match(t, /pergunte/i);
    assert.match(t, /Nunca invente/i);
    assert.match(t, /Nunca peça nem repita senhas/i);
  });

  test("é curta: contexto gasto é tempo que o operador espera", () => {
    // 1024 tokens de contexto; a instrução não pode comer metade.
    assert.ok(instrucao().length < 2000, String(instrucao().length));
  });
});

describe("montarMensagens", () => {
  test("a instrução vem primeiro e a pergunta por último", () => {
    const m = montarMensagens([], "projete o hino");
    assert.equal(m[0].role, "system");
    assert.equal(m[m.length - 1].role, "user");
    assert.equal(m[m.length - 1].content, "projete o hino");
  });

  test("leva só as últimas falas: a conversa inteira não cabe", () => {
    const historico = Array.from({ length: 40 }, (_, i) => ({
      papel: i % 2 ? ("assistente" as const) : ("usuario" as const),
      texto: `fala ${i}`,
    }));
    const m = montarMensagens(historico, "e agora?");
    assert.ok(m.length <= 8, String(m.length));
    assert.match(m[m.length - 2].content, /fala 39/);
  });

  test("papel do histórico vira o que o modelo entende", () => {
    const m = montarMensagens([{ papel: "assistente", texto: "oi" }], "tudo bem?");
    assert.equal(m[1].role, "assistant");
  });
});

describe("privacidade", () => {
  test("a frase que a tela mostra promete o que o código cumpre", () => {
    assert.match(AVISO_PRIVACIDADE, /nenhum dado é enviado para a internet/i);
  });
});
