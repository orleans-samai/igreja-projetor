import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { briefingVazio, soOQueOFormularioPede, type Briefing, type ImagemDoUsuario } from "../briefing.ts";
import { distancia } from "../catalogo/cores.ts";
import { PALETAS, coresDa, luminosidadeDe } from "../catalogo/paletas.ts";
import { caixaVisual, todasAsCamadas, type DocumentoDeArte } from "../documento.ts";
import { assinar, parecidas } from "./assinatura.ts";
import { FAMILIAS, acharVariante } from "./familias/index.ts";
import { adaptar, areaSegura, gerarLote, planoDeLuz, preservarTravadas, regenerar } from "./lote.ts";
import { proporcaoDe } from "./compositor.ts";
import { validar } from "./validar.ts";
import { medidorAproximado } from "./texto.ts";

/**
 * O gerador de lotes, provado com o medidor aproximado (sem canvas).
 *
 * O que se prova é o que a especificação pede: reprodutível pela semente,
 * variedade de verdade medida pela estrutura (não pela cor), respeito ao
 * conteúdo e às restrições, e nada inventado.
 */

const mapa = (base: number) => Array.from({ length: 64 }, (_, i) => Math.min(1, Math.max(0, base + ((i * 37) % 11) / 40 - 0.12)));
const foto = (nome: string, largura: number, altura: number, luz = 0.5): ImagemDoUsuario => ({
  src: `lumen://app/__artes/${nome}.jpg`,
  nome,
  largura,
  altura,
  tipo: "foto",
  pontoFocal: { x: 0.5, y: 0.45 },
  mapaDeLuz: mapa(luz),
  transparente: false,
});
const LOGO_CLARA = { src: "lumen://app/__artes/logo.png", largura: 600, altura: 200, luz: 0.92, transparente: true };

function briefing(extra: Partial<Briefing> = {}): Briefing {
  return {
    ...briefingVazio(),
    categoria: "escola-biblica",
    publico: "adultos",
    titulo: "Escola Bíblica Dominical",
    subtitulo: "Estudo no livro de Romanos",
    data: "12 de outubro",
    horario: "9h",
    local: "Salão de estudos",
    organizacao: "Igreja Batista Central",
    ...extra,
  };
}

function textos(doc: DocumentoDeArte): string[] {
  const t: string[] = [];
  for (const { camada } of todasAsCamadas(doc.camadas)) if (camada.tipo === "texto" && !camada.oculta) t.push(camada.texto);
  return t;
}

describe("catálogo de composições", () => {
  test("12 famílias com 3 variantes cada, ids únicos, requisitos declarados", () => {
    assert.equal(FAMILIAS.length, 12);
    const ids = FAMILIAS.flatMap((f) => f.variantes.map((v) => v.id));
    assert.equal(ids.length, 36);
    assert.equal(new Set(ids).size, 36);
    for (const f of FAMILIAS) {
      assert.equal(f.variantes.length, 3, f.id);
      for (const v of f.variantes) {
        assert.equal(v.familia, f.id);
        assert.ok(v.descricao.length > 30, `${v.id} sem descrição`);
        assert.ok(v.requisitos.imagem, `${v.id} sem requisito de imagem`);
      }
    }
  });

  test("as três variantes de uma família não são a mesma geometria com outra cor", () => {
    // Mesmo briefing, mesma paleta, mesma tipografia: se duas variantes
    // derem a mesma assinatura, são um layout só com nomes diferentes.
    const lote = gerarLote({ briefing: briefing({ fotos: [foto("a", 2000, 1333), foto("b", 1200, 1500)], logo: LOGO_CLARA }), formatoId: "quadrado", semente: 5, quantidade: 16 });
    for (let i = 0; i < lote.opcoes.length; i++) {
      for (let j = i + 1; j < lote.opcoes.length; j++) {
        const a = lote.opcoes[i];
        const b = lote.opcoes[j];
        if (a.familia !== b.familia) continue;
        assert.notEqual(a.variante, b.variante);
        assert.notDeepEqual([a.assinatura.titulo, a.assinatura.imagens], [b.assinatura.titulo, b.assinatura.imagens], `${a.variante} e ${b.variante}`);
      }
    }
  });
});

describe("reprodutibilidade", () => {
  test("mesmo briefing, mesma semente: o mesmo lote, camada por camada", () => {
    const b = briefing({ fotos: [foto("a", 2000, 1333)] });
    const x = gerarLote({ briefing: b, formatoId: "quadrado", semente: 42 });
    const y = gerarLote({ briefing: b, formatoId: "quadrado", semente: 42 });
    assert.deepEqual(y.opcoes, x.opcoes);
  });

  test("outra semente, outro lote", () => {
    const b = briefing();
    const x = gerarLote({ briefing: b, formatoId: "quadrado", semente: 1 });
    const y = gerarLote({ briefing: b, formatoId: "quadrado", semente: 2 });
    assert.notDeepEqual(
      y.opcoes.map((o) => o.variante),
      x.opcoes.map((o) => o.variante),
    );
  });

  test("espaço sobrando no briefing não muda o lote", () => {
    const x = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 9 });
    const y = gerarLote({ briefing: briefing({ titulo: "  Escola  Bíblica Dominical ", local: "Salão de estudos " }), formatoId: "quadrado", semente: 9 });
    assert.deepEqual(y.opcoes.map((o) => o.camadas), x.opcoes.map((o) => o.camadas));
  });

  test("a arte guarda a composição inteira, não só a semente", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 3 }).opcoes;
    assert.ok(o.camadas.length > 3);
    assert.deepEqual(o.original, o.camadas);
    assert.ok(o.versaoGerador >= 1 && o.versaoCatalogo >= 1);
  });
});

describe("diversidade do lote", () => {
  for (const [nome, b] of [
    ["sem fotos", briefing()],
    ["com fotos e logo", briefing({ fotos: [foto("a", 2000, 1333), foto("b", 1080, 1350)], logo: LOGO_CLARA })],
    ["infantil", briefing({ publico: "criancas", titulo: "EBD Kids", subtitulo: "" })],
  ] as const) {
    test(`8 opções ${nome}: famílias, variantes, centralização e luz`, () => {
      for (const formatoId of ["quadrado", "retrato", "story", "projecao"]) {
        const lote = gerarLote({ briefing: b, formatoId, semente: 77 });
        const o = lote.opcoes;
        assert.equal(o.length, 8, `${formatoId}: ${lote.limitacoes.join(" ")}`);
        assert.ok(new Set(o.map((x) => x.familia)).size >= 6, `${formatoId}: famílias`);
        assert.equal(new Set(o.map((x) => x.variante)).size, 8, `${formatoId}: variante repetida`);
        assert.ok(o.filter((x) => x.assinatura.centralizada).length <= 2, `${formatoId}: centralizadas demais`);
        const luzes = new Set(o.map((x) => x.direcao.luminosidade));
        assert.ok(luzes.size >= 2, `${formatoId}: uma luz só`);
        for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) assert.ok(!parecidas(o[i].assinatura, o[j].assinatura), `${formatoId}: ${o[i].variante} ≈ ${o[j].variante}`);
      }
    });
  }

  test("a mesma foto domina no máximo duas opções quando há desenho do assunto", () => {
    const lote = gerarLote({ briefing: briefing({ categoria: "gratidao", fotos: [foto("colheita", 2000, 1333)] }), formatoId: "quadrado", semente: 11 });
    const dominantes = lote.opcoes.map((o) => o.assinatura.imagemDominante).filter((i) => i === "usuario:0");
    assert.ok(dominantes.length <= 2, `a foto dominou ${dominantes.length} opções`);
  });

  test("com uma foto só, ela aparece em relações diferentes com o layout", () => {
    const lote = gerarLote({ briefing: briefing({ fotos: [foto("unica", 2000, 1333)], preferencias: { luz: "misto", linguagem: "fotografico", intensidade: "equilibrado", identidade: "explorar" } }), formatoId: "quadrado", semente: 13 });
    const comFoto = lote.opcoes.filter((o) => o.assinatura.recursos.includes("usuario:0"));
    assert.ok(comFoto.length >= 2);
    const posicoes = new Set(comFoto.map((o) => o.assinatura.imagens.join(",")));
    assert.ok(posicoes.size >= 2, "a foto ficou sempre no mesmo lugar");
  });

  test("o histórico do projeto afasta o lote seguinte do anterior", () => {
    const b = briefing();
    const primeiro = gerarLote({ briefing: b, formatoId: "quadrado", semente: 21 });
    const segundo = gerarLote({ briefing: b, formatoId: "quadrado", semente: 22, historico: primeiro.opcoes.map((o) => o.assinatura) });
    const antes = new Set(primeiro.opcoes.map((o) => o.variante));
    const repetidas = segundo.opcoes.filter((o) => antes.has(o.variante)).length;
    assert.ok(repetidas <= 3, `${repetidas} variantes repetidas do lote anterior`);
  });

  test("o plano de luz de criança pende para o claro", () => {
    const p = planoDeLuz("misto", 8, "criancas");
    assert.ok(p.filter((l) => l === "escura").length <= 1);
    assert.ok(planoDeLuz("misto", 8).includes("escura"));
    assert.ok(!planoDeLuz("claro", 8).includes("escura"));
  });
});

describe("limite de tentativas e limitações", () => {
  test("pedido que o catálogo não atende vem com menos opções e o porquê — sem duplicata disfarçada", () => {
    const b = briefing({
      categoria: "aviso",
      titulo: "Ensaio",
      subtitulo: "",
      data: "",
      horario: "",
      local: "",
      organizacao: "",
      quantidade: 16,
      preferencias: { luz: "claro", linguagem: "tipografico", intensidade: "discreto", identidade: "explorar" },
    });
    const lote = gerarLote({ briefing: b, formatoId: "quadrado", semente: 4 });
    assert.ok(lote.tentativas <= 16 * 10);
    assert.equal(new Set(lote.opcoes.map((o) => o.variante)).size, lote.opcoes.length);
    if (lote.opcoes.length < 16) assert.match(lote.limitacoes.join(" "), /deu para montar \d+/);
  });

  test("cores proibidas que eliminam o catálogo inteiro viram explicação, não lote vazio mudo", () => {
    const todas = [...new Set(PALETAS.flatMap((p) => [p.fundo, p.texto]))];
    const lote = gerarLote({ briefing: briefing({ coresProibidas: todas }), formatoId: "quadrado", semente: 1 });
    assert.equal(lote.opcoes.length, 0);
    assert.match(lote.limitacoes[0], /cores proibidas/i);
  });

  test("sem título não gera", () => {
    const lote = gerarLote({ briefing: briefing({ titulo: "  " }), formatoId: "quadrado", semente: 1 });
    assert.equal(lote.opcoes.length, 0);
    assert.match(lote.limitacoes[0], /título/);
  });
});

describe("conteúdo e restrições", () => {
  test("nada é inventado: todo texto da arte vem do briefing", () => {
    const b = briefing({ mensagem: "Traga sua Bíblia", pregador: "Pr. João", logo: LOGO_CLARA });
    const fontes = [b.titulo, b.subtitulo, b.mensagem, b.data, b.horario, b.local, b.organizacao, b.pregador].join(" | ");
    for (const formatoId of ["quadrado", "story"]) {
      for (const o of gerarLote({ briefing: b, formatoId, semente: 8 }).opcoes) {
        for (const t of textos(o)) {
          for (const palavra of t.replace(new RegExp(String.fromCharCode(0xa0), "g"), " ").replace(/·/g, " ").split(/\s+/).filter(Boolean)) {
            assert.ok(fontes.includes(palavra), `“${palavra}” não está no briefing (${o.variante})`);
          }
        }
      }
    }
  });

  test("campo vazio não aparece e o título aparece inteiro", () => {
    const b = briefing({ subtitulo: "", local: "", organizacao: "" });
    for (const o of gerarLote({ briefing: b, formatoId: "retrato", semente: 6 }).opcoes) {
      const t = textos(o);
      assert.ok(!t.some((x) => /Salão|Romanos|Batista/.test(x)), o.variante);
      assert.equal(t.filter((x, i, l) => l.indexOf(x) === i).join(" ").replace(/\s+/g, " ").includes("Escola") || t.some((x) => x.includes("Escola")), true);
      const titulo = [...todasAsCamadas(o.camadas)].filter(({ camada }) => camada.tipo === "texto" && camada.papel === "titulo").map(({ camada }) => (camada.tipo === "texto" ? camada.texto : "")).join(" ");
      assert.equal(titulo.replace(/\s+/g, " ").trim(), "Escola Bíblica Dominical", o.variante);
    }
  });

  test("título longo cabe sem cortar palavra e sem encolher abaixo do legível", () => {
    const titulo = "Encontro de Jovens: Raízes que Sustentam a Nossa Fé em Tempos Difíceis";
    const b = briefing({ categoria: "encontro-jovens", publico: "jovens", titulo });
    for (const formatoId of ["quadrado", "retrato", "story", "projecao"]) {
      const lote = gerarLote({ briefing: b, formatoId, semente: 31 });
      assert.ok(lote.opcoes.length >= 6, `${formatoId}: só ${lote.opcoes.length}`);
      for (const o of lote.opcoes) {
        const u = Math.min(o.largura, o.altura) / 100;
        const partes = [...todasAsCamadas(o.camadas)].filter(({ camada }) => camada.tipo === "texto" && camada.papel === "titulo").map(({ camada }) => camada);
        const junto = partes.map((c) => (c.tipo === "texto" ? c.texto : "")).join(" ").replace(/\s+/g, " ");
        assert.equal(junto, titulo, o.variante);
        for (const c of partes) if (c.tipo === "texto") assert.ok(c.tamanho >= u * 4.2, `${o.variante}: título a ${c.tamanho}px`);
        for (const c of partes) if (c.tipo === "texto" && c.quebras) assert.equal(c.quebras.split("\n").join(" "), c.maiusculas ? c.texto.toLocaleUpperCase("pt-BR") : c.texto, `${o.variante}: quebra mudou o texto`);
      }
    }
  });

  test("a logo nunca é deformada e ganha placa quando não contrasta", () => {
    const b = briefing({ logo: LOGO_CLARA });
    let comPlaca = 0;
    for (const formatoId of ["quadrado", "story", "projecao"]) {
      for (const o of gerarLote({ briefing: b, formatoId, semente: 12 }).opcoes) {
        for (const { camada } of todasAsCamadas(o.camadas)) {
          if (camada.tipo !== "logo") continue;
          assert.ok(Math.abs(camada.largura / camada.altura - 3) < 0.01, `${o.variante}: logo ${camada.largura}×${camada.altura}`);
          assert.equal(camada.manterProporcao, true);
          if (camada.placa) comPlaca += 1;
        }
      }
    }
    assert.ok(comPlaca > 0, "logo clara em fundo claro sem placa em nenhuma opção");
  });

  test("cores proibidas não aparecem na paleta de nenhuma opção", () => {
    const proibida = "#b8532f";
    for (const o of gerarLote({ briefing: briefing({ coresProibidas: [proibida] }), formatoId: "quadrado", semente: 2 }).opcoes) {
      const paleta = PALETAS.find((p) => p.id === o.direcao.paletaId);
      if (paleta) assert.ok(!coresDa(paleta).some((c) => distancia(c, proibida) < 18), `${paleta.id} tem a cor proibida`);
    }
  });

  test("cor obrigatória com “seguir a identidade” entra na paleta de todas as opções", () => {
    const lote = gerarLote({ briefing: briefing({ coresObrigatorias: ["#1f6fb2"], preferencias: { luz: "misto", linguagem: "misto", intensidade: "equilibrado", identidade: "seguir" } }), formatoId: "quadrado", semente: 2 });
    assert.ok(lote.opcoes.length > 0);
    for (const o of lote.opcoes) assert.ok(o.direcao.paletaId.startsWith("marca-") || coresDa(PALETAS.find((p) => p.id === o.direcao.paletaId)!).some((c) => distancia(c, "#1f6fb2") < 18), o.direcao.paletaId);
  });

  test("dia e mês só viram número grande quando a data tem os dois", () => {
    const sem = gerarLote({ briefing: briefing({ data: "Todo sábado" }), formatoId: "quadrado", semente: 3, quantidade: 16 });
    assert.ok(!sem.opcoes.some((o) => o.variante === "cartaz-numero-grande"));
  });

  test("sem foto, nenhuma composição de fotografia entra", () => {
    const lote = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 3, quantidade: 16 });
    assert.ok(!lote.opcoes.some((o) => o.familia === "fotografia"));
  });
});

describe("toda opção aceita passa na conferência", () => {
  test("sem texto fora da área, sem colisão, sem contraste baixo, nos quatro formatos", () => {
    const b = briefing({ fotos: [foto("a", 2000, 1333, 0.7)], logo: LOGO_CLARA, mensagem: "Traga sua Bíblia e um amigo" });
    for (const formatoId of ["quadrado", "retrato", "story", "projecao"]) {
      for (const o of gerarLote({ briefing: b, formatoId, semente: 55 }).opcoes) {
        const prop = proporcaoDe(o.largura, o.altura);
        const { seg } = areaSegura(o.largura, o.altura, prop);
        const paleta = PALETAS.find((p) => p.id === o.direcao.paletaId) ?? PALETAS[0];
        const erros = validar(o.camadas, { L: o.largura, A: o.altura, u: Math.min(o.largura, o.altura) / 100, seg, paleta, briefing: o.briefing }).filter((p) => p.gravidade === "erro");
        assert.deepEqual(erros, [], `${formatoId} ${o.variante}`);
        for (const { camada, x, y } of todasAsCamadas(o.camadas)) {
          if (camada.tipo !== "texto") continue;
          const r = caixaVisual({ ...camada, x, y });
          assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.w <= o.largura + 1 && r.y + r.h <= o.altura + 1, `${o.variante}: texto fora do quadro`);
        }
      }
    }
  });
});

describe("nenhuma linha passa da própria caixa", () => {
  test("em todas as famílias, formatos e tipografias — o Konva corta o que passa", () => {
    const b = briefing({ categoria: "gratidao", titulo: "Culto de Gratidão", fotos: [foto("a", 2000, 1333)] });
    for (const formatoId of ["quadrado", "retrato", "story", "projecao"]) {
      for (const semente of [1, 2, 3]) {
        for (const o of gerarLote({ briefing: b, formatoId, semente, quantidade: 12 }).opcoes) {
          for (const { camada } of todasAsCamadas(o.camadas)) {
            if (camada.tipo !== "texto" || !camada.quebras) continue;
            const estilo = { fonte: camada.fonte, peso: camada.peso, estilo: camada.estilo, maiusculas: false, espacamento: camada.espacamento / camada.tamanho, entrelinha: camada.entrelinha };
            const texto = camada.maiusculas ? camada.quebras.toLocaleUpperCase("pt-BR") : camada.quebras;
            for (const linha of texto.split("\n")) {
              const w = medidorAproximado.largura(linha, estilo, camada.tamanho);
              assert.ok(w <= camada.largura + 0.5, `${o.variante} ${formatoId}: “${linha}” mede ${w.toFixed(1)} numa caixa de ${camada.largura.toFixed(1)}`);
            }
          }
        }
      }
    }
  });
});

describe("formatos, regeneração e edição", () => {
  test("cada formato sai com as dimensões exatas", () => {
    const dims: Record<string, [number, number]> = { quadrado: [1080, 1080], retrato: [1080, 1350], story: [1080, 1920], projecao: [1920, 1080] };
    for (const [f, [l, a]] of Object.entries(dims)) {
      const [o] = gerarLote({ briefing: briefing(), formatoId: f, semente: 1 }).opcoes;
      assert.equal(o.largura, l);
      assert.equal(o.altura, a);
      const fundo = o.camadas.find((c) => c.tipo === "fundo")!;
      assert.equal(fundo.largura, l);
      assert.equal(fundo.altura, a);
    }
  });

  test("outro formato recompõe a mesma opção (família, paleta, tipografia), não estica", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 17 }).opcoes;
    const story = adaptar(o, "story");
    assert.ok(story, "não adaptou");
    assert.equal(story!.familia, o.familia);
    assert.equal(story!.direcao.paletaId, o.direcao.paletaId);
    assert.equal(story!.direcao.tipografiaId, o.direcao.tipografiaId);
    assert.equal(story!.altura, 1920);
    const tituloQ = o.camadas.find((c) => c.tipo === "texto" && c.papel === "titulo")!;
    const tituloS = story!.camadas.find((c) => c.tipo === "texto" && c.papel === "titulo")!;
    // Recomposto: a posição relativa muda com a proporção.
    assert.notDeepEqual([tituloS.y / 1920], [tituloQ.y / 1080]);
  });

  test("outra paleta mantém a composição e troca a cor", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 19 }).opcoes;
    const n = regenerar(o, "paleta", 99);
    assert.ok(n);
    assert.equal(n!.variante, o.variante);
    assert.notEqual(n!.direcao.paletaId, o.direcao.paletaId);
  });

  test("o que foi travado sobrevive à regeneração", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 19 }).opcoes;
    const titulo = o.camadas.find((c) => c.tipo === "texto" && c.papel === "titulo")!;
    const travado = { ...o, camadas: o.camadas.map((c) => (c.id === titulo.id ? { ...c, x: 7, y: 9, travada: true } : c)) };
    const n = regenerar(travado, "paleta", 5)!;
    const t = n.camadas.find((c) => c.id === titulo.id)!;
    assert.equal(t.x, 7);
    assert.equal(t.y, 9);
    assert.equal(t.travada, true);
    const semNada = preservarTravadas(o, n);
    assert.equal(semNada.camadas.length, n.camadas.length);
  });

  test("texto editado na arte volta ao briefing ao adaptar o formato", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 23 }).opcoes;
    const editado = { ...o, camadas: o.camadas.map((c) => (c.tipo === "texto" && c.campo === "local" ? { ...c, texto: "Templo novo" } : c)) };
    const temLocal = o.camadas.some((c) => c.tipo === "texto" && c.campo === "local");
    const r = adaptar(editado, "retrato");
    if (temLocal && r) assert.ok(textos(r).some((t) => t.includes("Templo novo")));
  });

  test("a assinatura ignora a cor", () => {
    const [o] = gerarLote({ briefing: briefing(), formatoId: "quadrado", semente: 29 }).opcoes;
    const recolorida = o.camadas.map((c) => (c.tipo === "texto" ? { ...c, cor: "#ff00ff" } : c));
    const a = assinar(o.camadas, o.largura, o.altura, o.familia, o.variante, false, "clara");
    const b = assinar(recolorida, o.largura, o.altura, o.familia, o.variante, false, "escura");
    assert.ok(parecidas(a, b));
    assert.ok(acharVariante(o.variante));
    assert.equal(luminosidadeDe(PALETAS[0]), "clara");
  });
});

describe("só título e referência bíblica", () => {
  test("o formulário apaga o resto, inclusive o que vinha guardado", () => {
    const b = soOQueOFormularioPede({ ...briefing(), referencia: "Romanos 12:2", textoBiblico: "Não vos conformeis" });
    assert.equal(b.titulo, "Escola Bíblica Dominical");
    assert.equal(b.referencia, "Romanos 12:2");
    for (const campo of ["subtitulo", "data", "horario", "local", "organizacao", "textoBiblico"] as const) {
      assert.equal(b[campo], "", campo);
    }
  });

  test("oito opções variadas em cada formato, sem uma palavra além das duas", () => {
    const b = soOQueOFormularioPede({ ...briefing(), referencia: "Romanos 12:2" });
    const permitidas = new Set(
      `${b.titulo} ${b.referencia}`.toLowerCase().split(/[\s·]+/).filter(Boolean),
    );
    for (const formatoId of ["quadrado", "retrato", "story", "projecao"]) {
      const lote = gerarLote({ briefing: b, formatoId, semente: 11 });
      assert.equal(lote.opcoes.length, 8, formatoId);
      assert.ok(new Set(lote.opcoes.map((o) => o.familia)).size >= 6, formatoId);
      for (const doc of lote.opcoes) {
        for (const t of textos(doc)) {
          for (const palavra of t.toLowerCase().replace(new RegExp(String.fromCharCode(0xa0), "g"), " ").split(/[\s·]+/).filter(Boolean)) {
            assert.ok(permitidas.has(palavra), `${doc.variante} (${formatoId}) escreveu “${palavra}”`);
          }
        }
      }
    }
  });
});
