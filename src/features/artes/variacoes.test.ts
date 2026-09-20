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
import { larguraMediaDoCaractere } from "./largura-do-texto.ts";
import { temCaixa } from "./types.ts";
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
      if (!temCaixa(el)) continue;
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

describe("hierarquia tipográfica", () => {
  const base = (extra: Partial<DadosDoEvento> = {}): DadosDoEvento => ({
    ...dadosVazios(),
    titulo: "Páscoa",
    ...extra,
  });

  const arte = (dados: DadosDoEvento, semente = 7) =>
    montar({
      id: "t",
      nome: "t",
      dados,
      semente,
      formatoId: "quadrado",
      largura: 1080,
      altura: 1080,
    });

  const textos = (dados: DadosDoEvento, semente = 7) =>
    arte(dados, semente).elementos.filter((e): e is ElementoTexto => e.tipo === "texto");

  const doTitulo = (dados: DadosDoEvento, semente = 7) =>
    textos(dados, semente).find((t) => t.campo === "titulo");

  test("título curto ocupa a folha; título longo se comporta", () => {
    // É a conta que um diagramador faz sem pensar: o tamanho da manchete
    // é consequência de quanto ela tem a dizer.
    const curto = doTitulo(base({ titulo: "Páscoa" }));
    const longo = doTitulo(
      base({ titulo: "Conferência de Jovens da Região Metropolitana em 2026" }),
    );
    assert.ok(curto && longo);
    assert.ok(curto.tamanho > longo.tamanho * 1.7, `${curto.tamanho} vs ${longo.tamanho}`);
  });

  test("o título é cartaz, não legenda", () => {
    // 8,2% da altura era o que fazia as artes parecerem slide.
    const t = doTitulo(base({ titulo: "Páscoa" }));
    assert.ok(t);
    assert.ok(t.tamanho >= 0.13, `título saiu a ${(t.tamanho * 100).toFixed(1)}% da altura`);
  });

  test("a escada entre título e apoio é de verdade", () => {
    const dados = base({
      titulo: "Santa Ceia",
      data: "6 de abril",
      local: "Igreja Central",
      endereco: "Rua das Flores, 120",
    });
    const lista = textos(dados);
    const titulo = lista.find((t) => t.campo === "titulo");
    const rodape = lista.find((t) => t.campo === "endereco");
    assert.ok(titulo && rodape);
    assert.ok(
      titulo.tamanho / rodape.tamanho >= 4,
      `escada de só ${(titulo.tamanho / rodape.tamanho).toFixed(1)}×`,
    );
  });

  test("o título é sempre o maior texto da arte", () => {
    for (let semente = 0; semente < 40; semente += 1) {
      const dados = base({
        titulo: "Culto da Família",
        subtitulo: "Todos juntos",
        data: "10 de maio",
        pregador: "Pr. Elias",
        local: "Igreja Central",
      });
      const lista = textos(dados, semente * 13 + 1);
      const titulo = lista.find((t) => t.campo === "titulo");
      if (!titulo) continue;
      for (const outro of lista) {
        if (outro.campo === "titulo") continue;
        assert.ok(
          titulo.tamanho >= outro.tamanho,
          `semente ${semente}: ${outro.campo} ficou maior que o título`,
        );
      }
    }
  });

  test("arte cheia aperta o apoio antes da manchete", () => {
    // O comportamento que faltava: quem cede é o endereço, não o título.
    const vazia = base({ titulo: "Missões", data: "20 de junho" });
    const cheia = base({
      titulo: "Missões",
      subtitulo: "Semana missionária da igreja",
      palavraBase: "Ide por todo o mundo",
      referencia: "Marcos 16:15",
      textoBiblico: "E disse-lhes: Ide por todo o mundo e pregai o evangelho a toda criatura.",
      data: "20 a 24 de junho",
      horario: "19h30",
      local: "Templo Central",
      endereco: "Rua das Flores, 120 — Centro",
      pregador: "Pr. Elias Moreira",
      contato: "(11) 90000-0000",
    });
    const tv = doTitulo(vazia);
    const tc = doTitulo(cheia);
    const rv = textos(vazia).find((t) => t.campo === "data");
    const rc = textos(cheia).find((t) => t.campo === "data");
    assert.ok(tv && tc && rv && rc);
    const cedeuTitulo = 1 - tc.tamanho / tv.tamanho;
    const cedeuApoio = 1 - rc.tamanho / rv.tamanho;
    assert.ok(
      cedeuTitulo <= cedeuApoio + 0.001,
      `o título cedeu ${(cedeuTitulo * 100).toFixed(0)}% e o apoio só ${(cedeuApoio * 100).toFixed(0)}%`,
    );
  });

  test("título grande fecha a entreletra, senão fica solto", () => {
    // Compara pelo tamanho que saiu, não pelo texto: num cartaz com só o
    // título, até um título longo cresce e merece a entreletra fechada.
    const solto = doTitulo(
      base({
        titulo: "Conferência de Jovens da Região Metropolitana",
        subtitulo: "Três noites de avivamento na cidade inteira",
        palavraBase: "Levanta-te e resplandece",
        referencia: "Isaías 60:1",
        textoBiblico: "Levanta-te, resplandece, porque vem a tua luz, e a glória do Senhor vai nascendo sobre ti.",
        data: "14 a 16 de março",
        horario: "19h30",
        local: "Igreja Central",
        endereco: "Rua das Flores, 120 — Centro",
        pregador: "Pr. Elias Moreira",
        contato: "(11) 90000-0000",
      }),
    );
    const cheio = doTitulo(base({ titulo: "Fé" }));
    assert.ok(solto && cheio);
    assert.ok(cheio.tamanho > solto.tamanho, "o cenário não produziu tamanhos diferentes");
    assert.ok(
      cheio.espacamento < solto.espacamento,
      `${cheio.tamanho.toFixed(3)} com ${cheio.espacamento} e ${solto.tamanho.toFixed(3)} com ${solto.espacamento}`,
    );
  });
});

describe("nada sai cortado", () => {
  // Foi o defeito que apareceu quando o título cresceu: "Páscoa" é uma
  // palavra só, quebrar linha não ajuda, e ela saía cortada pelos dois
  // lados. A regra é o corpo ceder até a maior palavra caber.
  const TITULOS = [
    "Fé",
    "Páscoa",
    "Santa Ceia",
    "Culto da Família",
    "Conferência de Jovens",
    "Congresso",
    "Missões",
    "Ressurreição",
    "Interdenominacional",
    "Conferência de Jovens da Região Metropolitana em 2026",
  ];

  test("a maior palavra de todo texto cabe na caixa, em todo formato", () => {
    for (const titulo of TITULOS) {
      for (const formato of FORMATOS) {
        for (let semente = 0; semente < 12; semente += 1) {
          const doc = montar({
            id: "c",
            nome: "c",
            dados: {
              ...dadosVazios(),
              titulo,
              subtitulo: "Três noites de avivamento",
              data: "14 a 16 de março",
              local: "Igreja Central",
              contato: "contato@igrejadavila.org.br",
            },
            semente: semente * 91 + 3,
            formatoId: formato.id,
            largura: formato.largura,
            altura: formato.altura,
          });
          const proporcao = formato.largura / formato.altura;
          for (const el of doc.elementos) {
            if (el.tipo !== "texto" || !el.texto.trim()) continue;
            const maior = el.texto.trim().split(/\s+/).reduce((m, p) => Math.max(m, p.length), 0);
            const largura =
              maior *
              el.tamanho *
              larguraMediaDoCaractere(el.fonte, el.peso, el.maiuscula, el.espacamento);
            assert.ok(
              largura <= el.caixa.largura * proporcao + 0.001,
              `${formato.id}/${semente} "${titulo}": ${el.campo} precisa de ` +
                `${largura.toFixed(3)} e tem ${(el.caixa.largura * proporcao).toFixed(3)}`,
            );
          }
        }
      }
    }
  });
});
