import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  conferir,
  consertar,
  contraste,
  contrasteSuficiente,
  ehHex,
  linhasEstimadas,
  textoLegivelSobre,
} from "./validacao.ts";
import { VERSAO_DOCUMENTO, dadosVazios, type Documento, type ElementoTexto } from "./types.ts";

function texto(extra: Partial<ElementoTexto> = {}): ElementoTexto {
  return {
    tipo: "texto",
    id: "t1",
    texto: "Culto da Benção",
    caixa: { x: 0.1, y: 0.4, largura: 0.8, altura: 0.2 },
    tamanho: 0.08,
    peso: 700,
    cor: "#ffffff",
    alinhamento: "center",
    entrelinha: 1.15,
    espacamento: 0,
    maiuscula: false,
    fonte: "display",
    sombra: false,
    ...extra,
  };
}

function doc(elementos: Documento["elementos"], largura = 1080, altura = 1080): Documento {
  return {
    v: VERSAO_DOCUMENTO,
    id: "d1",
    nome: "Arte",
    formatoId: "quadrado",
    largura,
    altura,
    templateId: "x",
    semente: 1,
    dados: dadosVazios(),
    elementos,
    criadoEm: 0,
    atualizadoEm: 0,
  };
}

const FUNDO_ESCURO = {
  tipo: "fundo" as const,
  id: "f",
  estilo: "solido" as const,
  cores: ["#101318"],
  angulo: 0,
  veu: 0,
};

describe("contraste", () => {
  test("mede como o WCAG manda", () => {
    assert.equal(contraste("#ffffff", "#000000"), 21);
    assert.equal(contraste("#ffffff", "#ffffff"), 1);
  });

  test("cor inválida não vira medida inventada", () => {
    // Devolver 21 aqui faria a validação aprovar o que não sabe medir.
    assert.equal(contraste("azul", "#000000"), 0);
    assert.equal(contraste("#12", "#000000"), 0);
    assert.equal(ehHex("#abc"), true);
    assert.equal(ehHex("rgb(0,0,0)"), false);
  });

  test("texto grande passa com menos contraste que texto pequeno", () => {
    // Cinza médio sobre branco: lê num título, não lê numa linha de rodapé.
    const cinza = "#8a8a8a";
    assert.equal(contrasteSuficiente(cinza, "#ffffff", 0.08), true);
    assert.equal(contrasteSuficiente(cinza, "#ffffff", 0.02), false);
  });

  test("escolhe preto ou branco pelo que lê melhor", () => {
    assert.equal(textoLegivelSobre("#101318"), "#ffffff");
    assert.equal(textoLegivelSobre("#f4f1ea"), "#111111");
  });
});

describe("linhasEstimadas", () => {
  test("texto curto cabe numa linha", () => {
    assert.equal(linhasEstimadas("Culto", 0.8, 0.08, 1), 1);
  });

  test("texto comprido quebra em várias", () => {
    const n = linhasEstimadas(
      "Conferência de jovens com o ministério de louvor da igreja",
      0.8,
      0.08,
      1,
    );
    assert.ok(n >= 3, String(n));
  });

  test("quebra por palavra, não por caractere", () => {
    // Uma palavra só, comprida, não vira três linhas.
    assert.equal(linhasEstimadas("Pentecostes", 0.9, 0.05, 1), 1);
  });

  test("texto vazio não ocupa linha", () => {
    assert.equal(linhasEstimadas("", 0.8, 0.08, 1), 0);
    assert.equal(linhasEstimadas("   ", 0.8, 0.08, 1), 0);
  });
});

describe("conferir", () => {
  test("texto que some no fundo é erro, não aviso", () => {
    const d = doc([FUNDO_ESCURO, texto({ cor: "#151a20" })]);
    const erro = conferir(d).find((a) => a.gravidade === "erro");
    assert.ok(erro, "devia reclamar de contraste");
    assert.match(erro.texto, /contraste/);
  });

  test("texto que não cabe na caixa é erro", () => {
    const d = doc([
      FUNDO_ESCURO,
      texto({
        texto: "Conferência de jovens e adolescentes da igreja local com louvor",
        caixa: { x: 0.1, y: 0.4, largura: 0.8, altura: 0.09 },
        tamanho: 0.07,
      }),
    ]);
    const erro = conferir(d).find((a) => /não cabe/.test(a.texto));
    assert.ok(erro, JSON.stringify(conferir(d)));
  });

  test("elemento encostado na borda vira aviso", () => {
    const d = doc([FUNDO_ESCURO, texto({ caixa: { x: 0.005, y: 0.4, largura: 0.5, altura: 0.1 } })]);
    assert.ok(conferir(d).some((a) => /borda/.test(a.texto)));
  });

  test("letra pequena demais para celular é avisada", () => {
    const d = doc([FUNDO_ESCURO, texto({ tamanho: 0.01, cor: "#ffffff" })]);
    assert.ok(conferir(d).some((a) => /pequena/.test(a.texto)));
  });

  test("arte bem-feita não gera reclamação", () => {
    const d = doc([FUNDO_ESCURO, texto()]);
    assert.deepEqual(conferir(d), []);
  });

  test("sobre foto não reclama de contraste com a cor de baixo", () => {
    // A cor sólida não é o que está atrás do texto; o véu é quem resolve.
    const d = doc([
      { ...FUNDO_ESCURO, estilo: "foto", src: "x.jpg", veu: 0.4, cores: ["#ffffff"] },
      texto({ cor: "#ffffff" }),
    ]);
    assert.ok(!conferir(d).some((a) => /contraste/.test(a.texto)));
  });
});

describe("consertar", () => {
  test("troca a cor que não lê pela que lê", () => {
    const d = doc([FUNDO_ESCURO, texto({ cor: "#151a20" })]);
    const arrumado = consertar(d);
    assert.equal((arrumado.elementos[1] as ElementoTexto).cor, "#ffffff");
    assert.deepEqual(conferir(arrumado).filter((a) => a.gravidade === "erro"), []);
  });

  test("encolhe a letra até o texto caber", () => {
    const d = doc([
      FUNDO_ESCURO,
      texto({
        texto: "Conferência de jovens e adolescentes da igreja local com louvor",
        caixa: { x: 0.1, y: 0.4, largura: 0.8, altura: 0.09 },
        tamanho: 0.07,
      }),
    ]);
    const arrumado = consertar(d);
    const depois = arrumado.elementos[1] as ElementoTexto;
    assert.ok(depois.tamanho < 0.07, String(depois.tamanho));
    assert.ok(!conferir(arrumado).some((a) => /não cabe/.test(a.texto)));
  });

  test("não encolhe até virar ilegível: prefere avisar", () => {
    const d = doc([
      FUNDO_ESCURO,
      texto({
        texto: "um texto enorme ".repeat(40),
        caixa: { x: 0.1, y: 0.4, largura: 0.8, altura: 0.05 },
        tamanho: 0.06,
      }),
    ]);
    const arrumado = consertar(d);
    assert.ok((arrumado.elementos[1] as ElementoTexto).tamanho >= 0.018);
    assert.ok(conferir(arrumado).length > 0, "devia continuar reclamando");
  });

  test("traz para dentro da margem quem estava na borda", () => {
    const d = doc([FUNDO_ESCURO, texto({ caixa: { x: 0, y: 0, largura: 0.5, altura: 0.1 } })]);
    const caixa = (consertar(d).elementos[1] as ElementoTexto).caixa;
    assert.ok(caixa.x >= 0.06, String(caixa.x));
    assert.ok(caixa.y >= 0.06, String(caixa.y));
  });

  test("elemento travado não é mexido", () => {
    const d = doc([FUNDO_ESCURO, texto({ cor: "#151a20", travado: true })]);
    assert.equal((consertar(d).elementos[1] as ElementoTexto).cor, "#151a20");
  });
});
