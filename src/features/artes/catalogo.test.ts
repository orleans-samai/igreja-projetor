import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS, categoriaEfetiva } from "./catalogo/categorias.ts";
import { contraste } from "./catalogo/cores.ts";
import { bolha, ladrilho, papelRasgado } from "./catalogo/formas.ts";
import { ILUSTRACOES } from "./catalogo/ilustracoes.ts";
import { PALETAS, conferirPaleta, luminosidadeDe, montarPaletasDaMarca, paletasDaMarca } from "./catalogo/paletas.ts";
import { CONJUNTOS, FONTES, familiasDoConjunto } from "./catalogo/tipografia.ts";
import { FAMILIAS } from "./gerador/familias/index.ts";

describe("paletas", () => {
  test("todo par que carrega texto passa no contraste", () => {
    for (const p of PALETAS) assert.deepEqual(conferirPaleta(p), [], p.id);
  });

  test("há claras, intermediárias e escuras — preto com dourado é uma entre várias", () => {
    const n = { clara: 0, media: 0, escura: 0 };
    for (const p of PALETAS) n[luminosidadeDe(p)] += 1;
    assert.ok(n.clara >= 6 && n.media >= 4 && n.escura >= 6, JSON.stringify(n));
    const pretoEOuro = PALETAS.filter((p) => contraste(p.fundo, "#000000") < 1.3 && /d[0-9a-f]b/.test(p.destaque));
    assert.ok(pretoEOuro.length <= 1);
  });

  test("paletas da marca passam no contraste para qualquer matiz", () => {
    let reprovadas = 0;
    for (let h = 0; h < 360; h += 15) {
      for (const [s, l] of [[0.9, 0.5], [0.6, 0.35], [0.5, 0.7], [0.2, 0.45]]) {
        const c = (n: number) => {
          const k = (n + h / 30) % 12;
          const a = s * Math.min(l, 1 - l);
          return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        const hex = "#" + [c(0), c(8), c(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
        for (const p of montarPaletasDaMarca([hex, "#1d3557"])) if (conferirPaleta(p).length) reprovadas += 1;
      }
    }
    assert.equal(reprovadas, 0);
    assert.ok(paletasDaMarca(["#e63946", "#1d3557"]).length >= 2);
  });
});

describe("tipografia", () => {
  test("no máximo duas famílias por conjunto, todas embutidas e com os pesos pedidos", () => {
    for (const c of CONJUNTOS) {
      const fams = familiasDoConjunto(c);
      assert.ok(fams.length <= 2, `${c.id}: ${fams.join(", ")}`);
      for (const papel of [c.titulo, c.apoio, c.info, c.destaque, c.sobretitulo]) {
        const f = FONTES.find((x) => x.familia === papel.fonte);
        assert.ok(f, `${c.id}: fonte ${papel.fonte} não está no catálogo`);
        assert.ok(f!.pesos.includes(papel.peso), `${c.id}: ${papel.fonte} não tem peso ${papel.peso}`);
        if (papel.estilo === "italic") assert.ok(f!.italico, `${c.id}: ${papel.fonte} sem itálico`);
      }
      for (const fam of c.familias) assert.ok(FAMILIAS.some((f) => f.id === fam), `${c.id}: família ${fam}`);
    }
  });

  test("toda fonte é OFL e vem de pacote embutido", () => {
    for (const f of FONTES) {
      assert.equal(f.licenca, "OFL-1.1");
      assert.match(f.pacote, /^@fontsource(-variable)?\//);
    }
  });
});

describe("ilustrações", () => {
  test("cada uma tem metadados, origem, licença e desenha um SVG com as cores recebidas", () => {
    const cores = { a: "#aa0000", b: "#00aa00", p: "#fafafa", e: "#111111", t: "#0000aa" };
    const ids = new Set<string>();
    for (const il of ILUSTRACOES) {
      assert.ok(!ids.has(il.id), `id repetido: ${il.id}`);
      ids.add(il.id);
      assert.ok(il.assuntos.length > 0 && il.publico.length > 0, il.id);
      assert.ok(il.origem && il.licenca, il.id);
      assert.ok(il.pontoFocal.x >= 0 && il.pontoFocal.x <= 1, il.id);
      const svg = il.desenhar(cores);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"/, il.id);
      assert.ok(Object.values(cores).some((c) => svg.includes(c)), `${il.id} ignorou a paleta`);
      assert.equal((svg.match(/<svg/g) ?? []).length, (svg.match(/<\/svg>/g) ?? []).length, `${il.id}: SVG mal fechado`);
      assert.ok(!/NaN|undefined/.test(svg), `${il.id}: número inválido no desenho`);
    }
    assert.ok(ILUSTRACOES.length >= 30);
  });

  test("Escola Bíblica tem estudo em grupo, livro, caderno e cena de estudo", () => {
    const cat = categoriaEfetiva("escola-biblica", "adultos");
    const doAssunto = ILUSTRACOES.filter((il) => il.assuntos.some((a) => cat.assuntos.includes(a))).map((il) => il.id);
    for (const id of ["grupo-de-estudo", "livro-aberto", "caderno", "mesa-de-estudo", "pilha-de-livros"]) assert.ok(doAssunto.includes(id), id);
  });

  test("símbolo religioso não entra em qualquer evento", () => {
    const pomba = ILUSTRACOES.find((il) => il.id === "pomba")!;
    const calice = ILUSTRACOES.find((il) => il.id === "pao-e-calice")!;
    for (const cat of ["escola-biblica", "encontro-jovens", "institucional", "culto-infantil"]) {
      const assuntos = categoriaEfetiva(cat, "").assuntos;
      assert.ok(!pomba.assuntos.some((a) => assuntos.includes(a)), `pomba em ${cat}`);
      assert.ok(!calice.assuntos.some((a) => assuntos.includes(a)), `cálice em ${cat}`);
    }
  });
});

describe("categorias", () => {
  test("toda categoria aponta para paletas, tipografias e assuntos que existem", () => {
    const tags = new Set(PALETAS.flatMap((p) => p.tags));
    const assuntos = new Set(ILUSTRACOES.flatMap((i) => i.assuntos));
    for (const c of CATEGORIAS) {
      for (const t of c.paletas) assert.ok(tags.has(t), `${c.id}: tag ${t}`);
      for (const t of c.tipografias) assert.ok(CONJUNTOS.some((x) => x.id === t), `${c.id}: tipografia ${t}`);
      assert.ok(c.assuntos.some((a) => assuntos.has(a)), `${c.id}: nenhum assunto com desenho`);
      assert.equal(Object.keys(c.familias).length, 12, c.id);
    }
  });

  test("o ajuste da igreja muda a tabela sem tocar na de fábrica", () => {
    const antes = categoriaEfetiva("escola-biblica", "adultos");
    const depois = categoriaEfetiva("escola-biblica", "adultos", { "escola-biblica": { familiasDesligadas: ["cartaz"], assuntosExtras: ["cafe"], assuntosRemovidos: ["livro"] } });
    assert.equal(depois.familias.cartaz, 0);
    assert.ok(depois.assuntos.includes("cafe") && !depois.assuntos.includes("livro"));
    assert.ok(categoriaEfetiva("escola-biblica", "adultos").assuntos.includes("livro"));
    assert.ok(antes.familias.cartaz > 0);
  });

  test("público infantil puxa desenho, forma orgânica e letra arredondada", () => {
    const c = categoriaEfetiva("escola-biblica", "criancas");
    assert.ok(c.familias.ilustrada >= 3 && c.familias.institucional < 0.5);
    assert.equal(c.tipografias[0], "infantil");
  });
});

describe("formas e texturas", () => {
  test("bolha e papel rasgado cabem na caixa 0–1 e se repetem pela semente", () => {
    for (const d of [bolha(7), papelRasgado(7)]) {
      const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      assert.ok(nums.every((n) => n >= -0.001 && n <= 1.001), d.slice(0, 60));
    }
    assert.equal(bolha(7), bolha(7));
    assert.notEqual(bolha(7), bolha(8));
  });

  test("todo ladrilho de textura é um SVG pronto", () => {
    for (const t of ["papel", "pontilhado", "pautado", "quadriculado", "grao", "hachura", "ondulado"] as const) {
      const url = ladrilho(t, "#222222", 24, 0.5);
      assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
      assert.match(decodeURIComponent(url), /<svg[^>]*width="24"/);
    }
  });
});
