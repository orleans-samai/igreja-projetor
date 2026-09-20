import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COMBINACOES,
  DISPOSICOES,
  PALETAS,
  TIPOGRAFIAS,
  montar,
  receitaDe,
  sementesPara,
  sorteio,
} from "./variacoes.ts";
import { FORMATOS } from "./formatos.ts";
import { conferir, contraste, contrasteSuficiente } from "./validacao.ts";
import { dadosVazios, type DadosDoEvento, type ElementoTexto } from "./types.ts";

function dados(extra: Partial<DadosDoEvento> = {}): DadosDoEvento {
  return {
    ...dadosVazios(),
    titulo: "Culto da Benção",
    subtitulo: "Toda quarta-feira",
    tema: "Conferência",
    referencia: "João 3:16",
    data: "12 de março",
    horario: "19h30",
    local: "Templo sede",
    pregador: "Pr. Antônio",
    igreja: "Igreja Local",
    ...extra,
  };
}

function arte(semente: number, formatoId = "quadrado", d = dados()) {
  const f = FORMATOS.find((x) => x.id === formatoId)!;
  return montar({
    id: "a1",
    nome: "Teste",
    dados: d,
    semente,
    formatoId: f.id,
    largura: f.largura,
    altura: f.altura,
  });
}

describe("o sorteio é determinístico", () => {
  test("a mesma semente dá a mesma sequência, sempre", () => {
    const a = sorteio(42);
    const b = sorteio(42);
    for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
  });

  test("sementes diferentes dão receitas diferentes", () => {
    const vistas = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(receitaDe(i + 1))),
    );
    assert.ok(vistas.size > 25, `só ${vistas.size} receitas em 40 sementes`);
  });

  test("a mesma semente dá exatamente a mesma arte", () => {
    // É o que faz "gerar mais opções" não perder a que a pessoa gostou.
    assert.deepEqual(
      { ...arte(7), criadoEm: 0, atualizadoEm: 0 },
      { ...arte(7), criadoEm: 0, atualizadoEm: 0 },
    );
  });

  test("a grade de opções é estável para a mesma base", () => {
    assert.deepEqual(sementesPara(5, 12), sementesPara(5, 12));
    assert.equal(new Set(sementesPara(5, 12)).size, 12, "semente repetida na grade");
  });

  test("semente inválida não trava o gerador", () => {
    for (const s of [0, -1, NaN, 1.7]) {
      assert.ok(receitaDe(s).paleta, String(s));
    }
  });
});

describe("as peças combinam sem sair feio", () => {
  test("toda paleta lê sobre o próprio fundo", () => {
    // É o que impede a combinação ilegível antes mesmo de existir.
    for (const p of PALETAS) {
      for (const f of p.fundo) {
        assert.ok(
          contrasteSuficiente(p.texto, f, 0.05),
          `${p.id}: texto ${p.texto} sobre ${f} dá ${contraste(p.texto, f)}:1`,
        );
      }
    }
  });

  test("o destaque também lê, senão a data some", () => {
    for (const p of PALETAS) {
      assert.ok(
        contrasteSuficiente(p.destaque, p.fundo[0], 0.05),
        `${p.id}: destaque ${p.destaque} dá ${contraste(p.destaque, p.fundo[0])}:1`,
      );
    }
  });

  test("há variedade de verdade, não cinco artes repetidas", () => {
    assert.ok(COMBINACOES > 500, String(COMBINACOES));
    assert.ok(PALETAS.length >= 8 && TIPOGRAFIAS.length >= 4 && DISPOSICOES.length >= 4);
  });
});

describe("nenhuma combinação sai quebrada", () => {
  test("cinquenta sementes, em todos os formatos, sem um erro sequer", () => {
    // O teste que vale por todos: se o motor puder gerar arte ilegível ou
    // com texto cortado, ele gera aqui.
    const problemas: string[] = [];
    for (const f of FORMATOS) {
      for (let s = 1; s <= 50; s += 1) {
        for (const a of conferir(arte(s, f.id))) {
          if (a.gravidade === "erro") problemas.push(`${f.id}/${s}: ${a.texto}`);
        }
      }
    }
    assert.deepEqual(problemas.slice(0, 5), [], `${problemas.length} problema(s)`);
  });

  test("com muito texto continua inteira", () => {
    const cheio = dados({
      titulo: "Conferência de Jovens e Adolescentes da Igreja Local",
      subtitulo: "Uma noite inteira de louvor, palavra e comunhão",
      textoBiblico: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito",
      informacoes: "Traga um agasalho e um alimento não perecível para a campanha",
      endereco: "Rua das Palmeiras, 1200 — Jardim São Paulo",
      chamada: "Chame um amigo e venha participar conosco desta noite",
      contato: "(11) 90000-0000",
      redes: "@igrejalocal",
      ministerio: "Ministério de Louvor Adoradores",
    });
    for (const f of FORMATOS) {
      const erros = conferir(arte(3, f.id, cheio)).filter((a) => a.gravidade === "erro");
      assert.deepEqual(erros, [], `${f.id}: ${JSON.stringify(erros)}`);
    }
  });

  test("com quase nada continua uma arte, não uma tela vazia", () => {
    const magro = { ...dadosVazios(), titulo: "Vigília" };
    const doc = arte(9, "story", magro);
    const textos = doc.elementos.filter((e) => e.tipo === "texto");
    assert.equal(textos.length, 1);
    assert.equal((textos[0] as ElementoTexto).texto, "Vigília");
    assert.deepEqual(conferir(doc).filter((a) => a.gravidade === "erro"), []);
  });

  test("campo vazio não vira caixa vazia na arte", () => {
    const doc = arte(4, "quadrado", dados({ pregador: "", local: "" }));
    for (const el of doc.elementos) {
      if (el.tipo !== "texto") continue;
      assert.ok(el.texto.trim().length > 0, `${el.id} entrou vazio`);
    }
  });
});

describe("o mesmo conteúdo em formatos diferentes", () => {
  test("não é a mesma arte esticada: a disposição recalcula", () => {
    const quadrado = arte(11, "quadrado");
    const story = arte(11, "story");
    const tQ = quadrado.elementos.find((e) => e.id === "txt-titulo") as ElementoTexto;
    const tS = story.elementos.find((e) => e.id === "txt-titulo") as ElementoTexto;
    // Mesma receita, caixas diferentes — é o que "responsivo" quer dizer aqui.
    assert.equal(quadrado.semente, story.semente);
    assert.notDeepEqual(tQ.caixa, tS.caixa);
  });

  test("o cartaz A4 usa o mesmo documento, só com mais pixels", () => {
    const a4 = arte(11, "a4");
    assert.equal(a4.largura, 2480);
    // As coordenadas continuam em fração: nada aqui é pixel.
    for (const el of a4.elementos) {
      if (el.tipo === "fundo") continue;
      assert.ok(el.caixa.x >= -0.5 && el.caixa.x <= 1.5, el.id);
      assert.ok(el.caixa.largura <= 1.5, el.id);
    }
  });
});

describe("foto de fundo", () => {
  test("com foto, o texto vira claro e ganha sombra", () => {
    const comFoto = arte(2, "quadrado", dados({ imagem: "lumen://midia/foto.jpg" }));
    const fundo = comFoto.elementos[0];
    assert.equal(fundo.tipo === "fundo" && fundo.estilo, "foto");
    assert.ok(fundo.tipo === "fundo" && fundo.veu > 0, "sem véu o texto some na foto");
    const titulo = comFoto.elementos.find((e) => e.id === "txt-titulo") as ElementoTexto;
    assert.equal(titulo.sombra, true);
  });

  test("a foto entra como endereço, nunca como bytes", () => {
    const comFoto = arte(2, "quadrado", dados({ imagem: "lumen://midia/foto.jpg" }));
    const fundo = comFoto.elementos[0];
    assert.equal(fundo.tipo === "fundo" && fundo.src, "lumen://midia/foto.jpg");
    assert.ok(!JSON.stringify(comFoto).includes("data:image"), "imagem embutida no documento");
  });
});
