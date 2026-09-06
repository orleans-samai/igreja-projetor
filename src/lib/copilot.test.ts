import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeIntent, parseCommand } from "./copilot.ts";

describe("parseCommand", () => {
  it("reconhece João 3:16 mesmo com versão", () => {
    const a = parseCommand("Coloque João 3:16 na NVI.");
    assert.equal(a.type, "bible");
    if (a.type === "bible") {
      assert.match(a.query, /jo[aã]o\s*3/i);
      assert.equal(a.present, true);
    }
  });

  it("reconhece atalho jo 14 6", () => {
    const a = parseCommand("jo 14:6");
    assert.equal(a.type, "bible");
  });

  it("próximo slide, refrão, preto, fundo escuro, contagem", () => {
    assert.equal(parseCommand("Próximo slide.").type, "next");
    assert.equal(parseCommand("Volte para o refrão.").type, "section");
    assert.equal(parseCommand("Tela preta.").type, "black");
    const ov = parseCommand("Deixe o fundo mais escuro.");
    assert.equal(ov.type, "overlay");
    const cd = parseCommand("Coloque contagem regressiva de cinco minutos.");
    assert.equal(cd.type, "countdown");
    if (cd.type === "countdown") assert.equal(cd.seconds, 300);
    assert.equal(parseCommand("Prepare a próxima música.").type, "prepareNext");
  });

  it("modo operador e emergência", () => {
    const live = parseCommand("modo operador");
    assert.equal(live.type, "liveMode");
    assert.equal(parseCommand("emergência").type, "emergency");
  });

  it("busca por tema da letra", () => {
    const a = parseCommand("música que fala Tu és fiel");
    assert.equal(a.type, "search");
    if (a.type === "search") assert.match(a.query.toLowerCase(), /fiel/);
  });

  it("describeIntent em português", () => {
    assert.equal(describeIntent({ type: "black" }), "Tela preta");
    assert.match(describeIntent({ type: "bible", query: "João 3:16", present: true }), /Projetar/);
  });
});
