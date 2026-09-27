import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CorpoDeTexto, Paragrafo, Trecho } from "./cena.ts";
import { diagramar, topoDoBloco, type Medidor } from "./texto.ts";

/** Uma régua de mentira: cada letra mede meio corpo; a linha tem um corpo de altura. */
const REGUA: Medidor = {
  largura: (texto, fonte, espacamento) => Array.from(texto).length * (fonte.tamanhoPx * 0.5 + espacamento),
  metricas: (fonte) => ({ ascendente: fonte.tamanhoPx * 0.8, descendente: fonte.tamanhoPx * 0.2 }),
};

/** 1 EMU = 1/12700 px: com isto, 1 ponto vira 1 pixel e as contas ficam redondas. */
const PX_POR_EMU = 1 / 12700;

function trecho(texto: string, tamanho = 10, extra: Partial<Trecho> = {}): Trecho {
  return {
    texto,
    fonte: "Arial",
    tamanho,
    negrito: false,
    italico: false,
    sublinhado: false,
    tachado: false,
    caixaAlta: "none",
    espacamento: 0,
    base: 0,
    cor: null,
    contorno: null,
    sombra: null,
    realce: null,
    ...extra,
  };
}

function paragrafo(trechos: Trecho[], extra: Partial<Paragrafo> = {}): Paragrafo {
  return {
    alinhamento: "l",
    margemEsq: 0,
    margemDir: 0,
    recuo: 0,
    linha: { pct: 1 },
    antes: { pts: 0 },
    depois: { pts: 0 },
    marcador: null,
    trechos,
    vazio: trecho("", trechos[0]?.tamanho ?? 10),
    ...extra,
  };
}

function corpo(paragrafos: Paragrafo[], extra: Partial<CorpoDeTexto> = {}): CorpoDeTexto {
  return {
    margens: { l: 0, t: 0, r: 0, b: 0 },
    ancora: "t",
    quebrar: true,
    autoajuste: { tipo: "nenhum" },
    vertical: "horz",
    paragrafos,
    ...extra,
  };
}

const palavras = (l: { pedacos: { texto: string; branco: boolean }[] }) =>
  l.pedacos.filter((p) => !p.branco).map((p) => p.texto).join(" ");

describe("a diagramação do texto", () => {
  it("quebra na palavra que não cabe, nunca no meio dela", () => {
    // Cada letra 5 px; "Graça e paz" = 11 letras; largura 40 px.
    const d = diagramar(corpo([paragrafo([trecho("Graça e paz sobre vós")])]), 40, 1000, PX_POR_EMU, REGUA);
    assert.deepEqual(d.linhas.map(palavras), ["Graça e", "paz", "sobre", "vós"]);
    assert.equal(d.altura, 40);
  });

  it("palavra maior que a linha inteira é partida por letra", () => {
    const d = diagramar(corpo([paragrafo([trecho("Aleluiaaaa")])]), 25, 1000, PX_POR_EMU, REGUA);
    // 10 letras de 5 px numa linha de 25 px: cinco por linha, sem perder nenhuma.
    assert.deepEqual(
      d.linhas.map((l) => l.pedacos.map((p) => p.texto).join("")),
      ["Aleluia".slice(0, 5), "iaaaa"],
    );
    for (const l of d.linhas) {
      const fim = Math.max(...l.pedacos.map((p) => p.x + p.largura));
      assert.ok(fim <= 25 + 0.5, `linha passou da caixa: ${fim}`);
    }
  });

  it("centralizado divide a sobra dos dois lados; à direita, encosta na borda", () => {
    const centro = diagramar(corpo([paragrafo([trecho("Paz")], { alinhamento: "ctr" })]), 100, 100, PX_POR_EMU, REGUA);
    assert.equal(centro.linhas[0].pedacos[0].x, (100 - 15) / 2);
    const direita = diagramar(corpo([paragrafo([trecho("Paz")], { alinhamento: "r" })]), 100, 100, PX_POR_EMU, REGUA);
    assert.equal(direita.linhas[0].pedacos[0].x, 85);
  });

  it("justificado estica os espaços, menos na última linha", () => {
    const d = diagramar(
      corpo([paragrafo([trecho("aa bb cc dd ee")], { alinhamento: "just" })]),
      40,
      100,
      PX_POR_EMU,
      REGUA,
    );
    const primeira = d.linhas[0].pedacos.filter((p) => !p.branco);
    const ultimaPalavra = primeira[primeira.length - 1];
    assert.equal(ultimaPalavra.x + ultimaPalavra.largura, 40);
    const ultima = d.linhas[d.linhas.length - 1].pedacos.filter((p) => !p.branco);
    assert.equal(ultima[0].x, 0);
  });

  it("marcador no recuo, texto na margem: o 'deslocamento' do PowerPoint", () => {
    const p = paragrafo([trecho("Oração")], {
      margemEsq: 20 * 12700,
      recuo: -20 * 12700,
      marcador: { texto: "•", fonte: null, cor: null, tamanhoPct: 1 },
    });
    const d = diagramar(corpo([p]), 200, 100, PX_POR_EMU, REGUA);
    const [marcador, texto] = d.linhas[0].pedacos;
    assert.equal(marcador.texto, "•");
    assert.equal(marcador.x, 0);
    assert.equal(texto.x, 20);
  });

  it("espaço entre linhas de 150% e espaço depois do parágrafo somam na altura", () => {
    const d = diagramar(
      corpo([
        paragrafo([trecho("um")], { linha: { pct: 1.5 }, depois: { pts: 6 } }),
        paragrafo([trecho("dois")]),
      ]),
      200,
      100,
      PX_POR_EMU,
      REGUA,
    );
    assert.equal(d.linhas[0].altura, 15);
    assert.equal(d.linhas[1].topo, 21);
    assert.equal(d.altura, 31);
  });

  it("'ajustar texto à forma' encolhe a letra até caber na caixa", () => {
    const longo = Array.from({ length: 30 }, () => "Santo").join(" ");
    const c = corpo([paragrafo([trecho(longo, 20)])], { autoajuste: { tipo: "encolher", escala: 1, reducao: 0 } });
    const d = diagramar(c, 200, 60, PX_POR_EMU, REGUA);
    assert.ok(d.escala < 1, `não encolheu: ${d.escala}`);
    assert.ok(d.altura <= 60.5, `continuou maior que a caixa: ${d.altura}`);
    // Sem o ajuste ligado, o texto passa da caixa, como no PowerPoint.
    const solto = diagramar(corpo([paragrafo([trecho(longo, 20)])]), 200, 60, PX_POR_EMU, REGUA);
    assert.equal(solto.escala, 1);
    assert.ok(solto.altura > 60);
  });

  it("a escala que o PowerPoint guardou vale quando cabe", () => {
    const c = corpo([paragrafo([trecho("Glória", 20)])], { autoajuste: { tipo: "encolher", escala: 0.8, reducao: 0.1 } });
    const d = diagramar(c, 400, 400, PX_POR_EMU, REGUA);
    assert.equal(d.escala, 0.8);
    assert.equal(d.linhas[0].pedacos[0].fonte.tamanhoPx, 16);
  });

  it("quebra de linha forçada e caixa-alta", () => {
    const d = diagramar(
      corpo([paragrafo([trecho("aleluia", 10, { caixaAlta: "all" }), { ...trecho(""), quebra: true }, trecho("amém")])]),
      500,
      100,
      PX_POR_EMU,
      REGUA,
    );
    assert.deepEqual(d.linhas.map(palavras), ["ALELUIA", "amém"]);
  });

  it("o bloco fica em cima, no meio ou embaixo da caixa, como a âncora pede", () => {
    assert.equal(topoDoBloco("t", 20, 100), 0);
    assert.equal(topoDoBloco("ctr", 20, 100), 40);
    assert.equal(topoDoBloco("b", 20, 100), 80);
  });
});
