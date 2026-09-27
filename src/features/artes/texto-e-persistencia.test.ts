import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analisar, briefingVazio, diaEMes, normalizar, palavraPrincipal } from "./briefing.ts";
import { CONJUNTOS } from "./catalogo/tipografia.ts";
import { VERSAO_ESQUEMA, textoDesenhado } from "./documento.ts";
import { SEPARADOR, conteudoDe } from "./gerador/conteudo.ts";
import { ajustar, medidorAproximado, quebrarEm } from "./gerador/texto.ts";
import { HISTORICO_POR_PROJETO, PROJETOS_NO_HISTORICO, lerGuardado, registrarNoHistorico } from "./persistencia.ts";
import { dadosVazios, VERSAO_DOCUMENTO, type Documento } from "./types.ts";

const estilo = CONJUNTOS.find((c) => c.id === "livro")!.titulo;
const medir = (s: string) => medidorAproximado.largura(s, estilo, 40);

describe("quebra de linha", () => {
  test("não corta palavra e não deixa preposição pendurada no fim da linha", () => {
    const palavras = "Encontro de Jovens com a Palavra de Deus".split(" ");
    for (let k = 2; k <= 4; k++) {
      const q = quebrarEm(palavras, k, 520, medir);
      if (!q) continue;
      assert.equal(q.linhas.join(" "), palavras.join(" "));
      for (const l of q.linhas.slice(0, -1)) assert.ok(!/\b(de|a|com|e)$/i.test(l), `linha terminando em preposição: “${l}”`);
    }
  });

  test("palavra maior que a largura no menor tamanho: o bloco não serve (não encolhe sem fim)", () => {
    const r = ajustar({ texto: "Pneumoultramicroscopicossilicovulcanoconiose", estilo, larguraMax: 300, alturaMax: 1000, tamanhoMax: 80, tamanhoMin: 40, maxLinhas: 3 }, medidorAproximado);
    assert.equal(r, null);
  });

  test("o maior tamanho que cabe, dentro do limite", () => {
    const r = ajustar({ texto: "Culto de Gratidão", estilo, larguraMax: 900, alturaMax: 400, tamanhoMax: 140, tamanhoMin: 50, maxLinhas: 3 }, medidorAproximado)!;
    assert.ok(r.tamanho <= 140 && r.tamanho >= 50);
    assert.ok(r.altura <= 400);
    assert.equal(r.linhas.join(" "), "Culto de Gratidão");
  });

  test("a quebra que a pessoa escreveu é respeitada", () => {
    const r = ajustar({ texto: "Primeira linha\nSegunda linha", estilo, larguraMax: 2000, alturaMax: 1000, tamanhoMax: 40, tamanhoMin: 20, maxLinhas: 6 }, medidorAproximado)!;
    assert.deepEqual(r.linhas, ["Primeira linha", "Segunda linha"]);
  });

  test("data e horário não se separam no “·”", () => {
    const c = conteudoDe({ ...briefingVazio(), titulo: "X", data: "12 de outubro", horario: "19h30" });
    assert.equal(c.quando!.texto, `12 de outubro${SEPARADOR}19h30`);
    // Largura para o trecho inseparável, mas não para a linha inteira.
    const r = ajustar({ texto: c.quando!.texto, estilo, larguraMax: medir(`outubro${SEPARADOR}19h30`) + 5, alturaMax: 1000, tamanhoMax: 40, tamanhoMin: 40, maxLinhas: 4 }, medidorAproximado)!;
    assert.ok(r.linhas.length >= 2);
    for (const l of r.linhas) assert.ok(!l.startsWith("·") && !l.endsWith("·"), JSON.stringify(r.linhas));
  });
});

describe("briefing", () => {
  test("dia e mês só quando a data tem os dois", () => {
    assert.deepEqual(diaEMes("12 de março"), { dia: "12", mes: "março" });
    assert.deepEqual(diaEMes("30/11"), { dia: "30", mes: "11" });
    assert.equal(diaEMes("Todo sábado"), null);
    assert.equal(diaEMes("45/13"), null);
  });

  test("normalizar tira espaço sobrando, valida cor e limita a quantidade", () => {
    const b = normalizar({ ...briefingVazio(), titulo: "  Culto   de  Oração ", coresObrigatorias: ["#ABC", "azul", "#123456"], quantidade: 99 });
    assert.equal(b.titulo, "Culto de Oração");
    assert.deepEqual(b.coresObrigatorias, ["#aabbcc", "#123456"]);
    assert.equal(b.quantidade, 16);
  });

  test("palavra principal ignora as miúdas", () => {
    assert.equal(palavraPrincipal("Encontro de Jovens"), "Encontro");
    assert.equal(palavraPrincipal("A Graça"), "Graça");
    assert.equal(analisar({ ...briefingVazio(), titulo: "Uma noite para lembrar a fidelidade de Deus e agradecer" }).classeDoTitulo, "longo");
  });

  test("caixa alta é estilo: o texto guardado é o que a pessoa escreveu", () => {
    const c = { texto: "Culto de Gratidão", quebras: "Culto de\nGratidão", maiusculas: true } as Parameters<typeof textoDesenhado>[0];
    assert.equal(textoDesenhado(c), "CULTO DE\nGRATIDÃO");
    assert.equal(c.texto, "Culto de Gratidão");
  });
});

describe("persistência", () => {
  const v1: Documento = {
    v: VERSAO_DOCUMENTO,
    id: "velha",
    nome: "Arte antiga",
    formatoId: "quadrado",
    largura: 1080,
    altura: 1080,
    templateId: "t",
    semente: 3,
    dados: { ...dadosVazios(), titulo: "Culto de Santa Ceia", data: "5 de maio", igreja: "IBC" },
    elementos: [
      { tipo: "fundo", id: "fundo", estilo: "gradiente", cores: ["#101010", "#303030"], angulo: 90, veu: 0 },
      { tipo: "atmosfera", id: "atm", atmosfera: "nevoa", cor: "#e0b352", semente: 4, clara: false },
      { tipo: "texto", id: "t1", campo: "titulo", texto: "Culto de Santa Ceia", caixa: { x: 0.1, y: 0.3, largura: 0.8, altura: 0.2 }, tamanho: 0.08, peso: 700, cor: "#ffffff", alinhamento: "center", entrelinha: 1.1, espacamento: 0, maiuscula: false, fonte: "display", sombra: false },
      { tipo: "forma", id: "f1", forma: "circulo", caixa: { x: 0.4, y: 0.7, largura: 0.2, altura: 0.2 }, cor: "#e0b352", opacidade: 0.8, raio: 0 },
    ],
    criadoEm: 1,
    atualizadoEm: 2,
  };

  test("arte da v1 abre convertida, no mesmo lugar e com o mesmo texto", () => {
    const g = lerGuardado({ projetos: [v1] });
    assert.equal(g.projetos.length, 1);
    const d = g.projetos[0];
    assert.equal(d.v, VERSAO_ESQUEMA);
    assert.equal(d.nome, "Arte antiga");
    assert.equal(d.briefing.titulo, "Culto de Santa Ceia");
    assert.equal(d.briefing.organizacao, "IBC");
    const titulo = d.camadas.find((c) => c.tipo === "texto")!;
    assert.equal(titulo.tipo === "texto" && titulo.texto, "Culto de Santa Ceia");
    assert.equal(Math.round(titulo.x), 108);
    assert.ok(d.camadas.some((c) => c.tipo === "imagem" && c.recursoId === "atmosfera:nevoa"), "a atmosfera se perdeu");
    assert.equal(d.camadas[0].tipo, "fundo");
  });

  test("arte corrompida ou de versão futura fica de fora sem derrubar as outras", () => {
    const g = lerGuardado({ projetos: [v1, null, { v: 99, camadas: [] }, "lixo", { v: 1 }] });
    assert.equal(g.projetos.length, 1);
    assert.deepEqual(lerGuardado(undefined).projetos, []);
  });

  test("o histórico tem teto por projeto e por quantidade de projetos", () => {
    const sig = { variante: "x" } as never;
    let h = {};
    for (let i = 0; i < PROJETOS_NO_HISTORICO + 5; i++) h = registrarNoHistorico(h, `p${i}`, [sig]);
    assert.equal(Object.keys(h).length, PROJETOS_NO_HISTORICO);
    let um = {};
    for (let i = 0; i < HISTORICO_POR_PROJETO + 20; i++) um = registrarNoHistorico(um, "p", [sig]);
    assert.equal((um as Record<string, unknown[]>).p.length, HISTORICO_POR_PROJETO);
  });
});

describe("formato padrão", () => {
  test("arte nova e briefing sem formato saem em Projeção Full HD", () => {
    assert.deepEqual(briefingVazio().formatos, ["projecao"]);
    assert.deepEqual(normalizar({ ...briefingVazio(), titulo: "Culto", formatos: [] }).formatos, ["projecao"]);
    // O que a igreja escolheu continua valendo.
    assert.deepEqual(normalizar({ ...briefingVazio(), titulo: "Culto", formatos: ["quadrado"] }).formatos, ["quadrado"]);
  });
});
