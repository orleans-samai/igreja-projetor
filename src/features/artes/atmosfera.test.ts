import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATMOSFERAS,
  LIMITE_PARA_LETRA,
  NOME_ATMOSFERA,
  OCUPA_O_CENTRO,
  pintarAtmosfera,
  serveParaLetra,
  type Atmosfera,
} from "./atmosfera.ts";

const L = 1920;
const A = 1080;

function pintar(a: Atmosfera, id = "x", semente = 7, clara = false) {
  return pintarAtmosfera(a, L, A, "#eba63f", semente, id, clara);
}

describe("o catálogo", () => {
  it("toda atmosfera tem nome e ocupação declarados", () => {
    for (const a of ATMOSFERAS) {
      assert.ok(NOME_ATMOSFERA[a], `${a} sem nome`);
      assert.equal(typeof OCUPA_O_CENTRO[a], "number", `${a} sem ocupação`);
      assert.ok(OCUPA_O_CENTRO[a] >= 0 && OCUPA_O_CENTRO[a] <= 1, a);
    }
  });

  it("não tem nome nem ocupação sobrando de uma atmosfera que não existe", () => {
    assert.deepEqual(Object.keys(NOME_ATMOSFERA).sort(), [...ATMOSFERAS].sort());
    assert.deepEqual(Object.keys(OCUPA_O_CENTRO).sort(), [...ATMOSFERAS].sort());
  });
});

describe("pintarAtmosfera", () => {
  it("só 'nenhuma' não desenha nada", () => {
    assert.equal(pintar("nenhuma").corpo, "");
    for (const a of ATMOSFERAS.filter((x) => x !== "nenhuma")) {
      assert.ok(pintar(a).corpo.length > 0, `${a} não desenhou nada`);
    }
  });

  it("o mesmo pedido desenha o mesmo SVG — a arte não muda ao reabrir", () => {
    for (const a of ATMOSFERAS) {
      assert.equal(pintar(a).corpo, pintar(a).corpo, a);
    }
  });

  it("sementes diferentes dão desenhos diferentes onde há sorteio", () => {
    // As que não sorteiam nada — vinheta é um degradê fixo — ficam de fora.
    const sorteiam: Atmosfera[] = ["raios", "nevoa", "bokeh", "montanhas", "brasa", "poeira"];
    for (const a of sorteiam) {
      assert.notEqual(pintar(a, "x", 1).corpo, pintar(a, "x", 999).corpo, a);
    }
  });

  it("cada camada leva o próprio prefixo nos ids, senão uma apaga a outra", () => {
    // Foi por isso que o id fixo "g" do fundo não pôde ser reaproveitado:
    // duas camadas na mesma arte disputariam o mesmo nome no SVG.
    for (const a of ATMOSFERAS) {
      const um = pintar(a, "umaId");
      const outro = pintar(a, "outraId");
      if (!um.defs) continue;
      assert.ok(um.defs.includes("umaId"), `${a}: defs sem o prefixo`);
      assert.ok(!um.defs.includes("outraId"), `${a}: defs com o prefixo errado`);
      assert.notEqual(um.defs, outro.defs, a);
      // E o corpo referencia o próprio defs, não o do vizinho.
      if (um.corpo.includes("url(#")) assert.ok(um.corpo.includes("umaId"), `${a}: corpo aponta para fora`);
    }
  });

  it("todo filtro e gradiente usado no corpo existe no defs", () => {
    for (const a of ATMOSFERAS) {
      const { defs, corpo } = pintar(a);
      for (const m of corpo.matchAll(/url\(#([^)]+)\)/g)) {
        assert.ok(defs.includes(`id="${m[1]}"`), `${a}: ${m[1]} usado e não declarado`);
      }
    }
  });

  it("nada escapa do quadro por um erro de conta", () => {
    for (const a of ATMOSFERAS) {
      const { corpo } = pintar(a);
      for (const m of corpo.matchAll(/(?:cx|cy|x|y)="(-?\d+(?:\.\d+)?)"/g)) {
        const v = Number(m[1]);
        // Uma folga generosa: raios e aurora saem do quadro de propósito.
        assert.ok(v > -A * 2 && v < L * 2, `${a}: coordenada ${v} fora de qualquer quadro`);
      }
      assert.ok(!corpo.includes("NaN"), `${a}: saiu NaN no SVG`);
      assert.ok(!corpo.includes("undefined"), `${a}: saiu undefined no SVG`);
    }
  });

  it("fundo claro inverte a luz em vez de sumir", () => {
    // Sobre papel branco, clarear não é efeito nenhum.
    const escuro = pintar("raios", "x", 7, false).corpo;
    const claro = pintar("raios", "x", 7, true).corpo;
    assert.notEqual(escuro, claro);
    assert.ok(escuro.includes("rgba(255,255,255"), "no escuro a luz devia ser clara");
    assert.ok(!claro.includes("rgba(255,255,255"), "no claro a luz não podia ser branca");
  });

  it("cor inválida não quebra o SVG", () => {
    for (const cor of ["", "azul", "#12", "#gggggg"]) {
      const r = pintarAtmosfera("bokeh", L, A, cor, 3, "id");
      assert.ok(r.corpo.includes("rgba("), cor);
      assert.ok(!r.corpo.includes("NaN"), cor);
    }
  });
});

describe("serveParaLetra", () => {
  it("é o que o número diz, e nada além disso", () => {
    for (const a of ATMOSFERAS) {
      assert.equal(serveParaLetra(a), OCUPA_O_CENTRO[a] <= LIMITE_PARA_LETRA, a);
    }
  });

  it("as que enchem o meio ficam de fora do fundo de letra", () => {
    // Letra de música mora no centro do telão. Atmosfera que ocupa o
    // centro some debaixo da primeira linha — ou pior, briga com ela.
    assert.equal(serveParaLetra("malha"), false);
    assert.equal(serveParaLetra("aurora"), false);
    assert.equal(serveParaLetra("vinheta"), true);
    assert.equal(serveParaLetra("montanhas"), true);
    assert.equal(serveParaLetra("nenhuma"), true);
  });

  it("sobra escolha de verdade para fundo de letra", () => {
    // Uma só não é escolha: se a regra apertasse demais, todo fundo de
    // letra da igreja sairia igual — que é exatamente o defeito de antes.
    const servem = ATMOSFERAS.filter(serveParaLetra);
    assert.ok(servem.length >= 6, `só ${servem.length} servem para letra`);
  });
});
