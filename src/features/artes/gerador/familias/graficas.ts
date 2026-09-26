import { misturar } from "../../catalogo/cores.ts";
import { dentro, type ItemDeTexto, type Ret } from "../compositor.ts";
import {
  blocoPrincipal,
  colunas,
  coluna,
  fundoDaPaleta,
  ilustracaoPrincipal,
  imagemNaRegiao,
  naArea,
  q,
  visualPrincipal,
  type Familia,
  type Variante,
} from "./comum.ts";

/**
 * Famílias de construção gráfica: Geométrica, Ilustrada e Institucional.
 *
 * Geométrica organiza a página com forma pura — círculo, bloco, diagonal.
 * Ilustrada põe o desenho no centro da conversa, e só entra quando há
 * ilustração do assunto (livro para Escola Bíblica, não um enfeite
 * qualquer). Institucional é a da identidade: cabeçalho, painel de marca,
 * informação em grade — e por isso pede logo ou nome da organização.
 */

// ─────────────────────────────────────────────── E. Geométrica

const geometricaCirculo: Variante = {
  id: "geometrica-circulo-janela",
  familia: "geometrica",
  descricao: "Um círculo grande serve de janela para a imagem, com um anel vazado deslocado atrás; o texto ocupa a coluna ao lado e a faixa de baixo.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const p = c.p;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    let circ: Ret;
    if (prop === "paisagem") {
      const d = A * 0.78;
      circ = { x: L * 0.54, y: A * 0.11, w: d, h: d };
    } else if (prop === "vertical") {
      const d = L * 0.78;
      circ = { x: L * 0.11, y: A * 0.07, w: d, h: d };
    } else {
      const d = L * (prop === "retrato" ? 0.6 : 0.54);
      circ = { x: L * 0.42, y: A * 0.05, w: d, h: d };
    }
    const anel = { x: circ.x + u * 4, y: circ.y + u * 4, w: circ.w, h: circ.h };
    c.circulo(anel, null, { contorno: { cor: p.destaque, espessura: Math.max(3, u * 0.6) }, nome: "Anel" });
    imagemNaRegiao(c, circ, v, { mascara: { tipo: "circulo" }, painel: p.fundo2 });
    if (prop === "paisagem") {
      const col = { x: seg.x, y: seg.y, w: circ.x - seg.x - u * 6, h: seg.h };
      return coluna(c, col, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
    }
    if (prop === "vertical") {
      const baixo = { x: seg.x, y: anel.y + anel.h + u * 5, w: seg.w, h: seg.y + seg.h - (anel.y + anel.h + u * 5) };
      return coluna(c, baixo, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
    }
    const lateral = { x: seg.x, y: seg.y, w: circ.x - seg.x - u * 4, h: circ.y + circ.h - seg.y };
    if (!c.pilha(lateral, [c.itemSobretitulo(), c.itemTitulo(u * 9, u * 4.6, 5)], { vertical: "bottom" })) return false;
    const y = anel.y + anel.h + u * 4;
    const baixo = { x: seg.x, y, w: seg.w, h: seg.y + seg.h - y };
    if (baixo.h < u * 10) return false;
    const [esq, dir] = colunas(baixo, [0.52, 0.48], u * 5);
    if (!c.pilha(esq, c.itensDeApoio({ versiculo: false }).slice(0, 2), { vertical: "top" })) return false;
    return coluna(c, dir, { topo: [], base: c.itensDeInfo(), marca: true, fracaoDaBase: 1 });
  },
};

const geometricaBlocos: Variante = {
  id: "geometrica-blocos-assimetricos",
  familia: "geometrica",
  descricao: "Blocos retangulares de cor, de tamanhos diferentes, sangrando nas bordas: um com o título, um com a imagem (ou padrão), um de destaque com a data; faixa de informação no pé.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { u, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const g =
      prop === "paisagem"
        ? { tit: q(c, 0, 0, 0.4, 1), img: q(c, 0.4, 0, 0.36, 0.6), dest: q(c, 0.76, 0, 0.24, 0.6), pe: q(c, 0.4, 0.6, 0.6, 0.4) }
        : prop === "vertical"
          ? { img: q(c, 0, 0, 1, 0.3), tit: q(c, 0, 0.3, 0.68, 0.38), dest: q(c, 0.68, 0.3, 0.32, 0.38), pe: q(c, 0, 0.68, 1, 0.32) }
          : prop === "retrato"
            ? { tit: q(c, 0, 0, 0.54, 0.64), img: q(c, 0.54, 0, 0.46, 0.4), dest: q(c, 0.54, 0.4, 0.46, 0.24), pe: q(c, 0, 0.64, 1, 0.36) }
            : { tit: q(c, 0, 0, 0.46, 0.7), img: q(c, 0.46, 0, 0.54, 0.46), dest: q(c, 0.46, 0.46, 0.54, 0.24), pe: q(c, 0, 0.7, 1, 0.3) };
    c.bloco(g.tit, p.superficie, { papel: "painel", nome: "Bloco do título" });
    const corDestaque = c.corDiferenteDe(p.superficie);
    c.bloco(g.dest, corDestaque, { papel: "painel", nome: "Bloco de destaque" });
    const v = visualPrincipal(c);
    if (v) imagemNaRegiao(c, g.img, v, { painel: p.fundo2 });
    else {
      c.bloco(g.img, p.fundo2, { papel: "painel", nome: "Bloco" });
      c.textura(g.img, "quadriculado", p.texto, u * 4, 0.18);
      const d = Math.min(g.img.w, g.img.h) * 0.5;
      c.circulo({ x: g.img.x + g.img.w - d * 0.8, y: g.img.y + g.img.h - d * 0.8, w: d, h: d }, p.acento, { nome: "Círculo" });
    }
    const pad = u * 5;
    const areaTit = naArea(c, dentro(g.tit, pad));
    if (!c.pilha(areaTit, blocoPrincipal(c, { tituloMax: u * 11, versiculo: false }), { vertical: prop === "vertical" ? "middle" : "bottom" })) return false;
    const conteudo = c.amb.conteudo;
    const destaque: ItemDeTexto | null = conteudo.quando
      ? { ...c.itensDeInfo({ quandoEmDestaque: true })[0], cor: undefined, linhas: 3 }
      : conteudo.mensagem
        ? { papel: "mensagem", nome: "Mensagem", campo: "mensagem", texto: conteudo.mensagem.texto, estilo: c.t.destaque, max: u * 4.6, min: u * 2.6, linhas: 5 }
        : null;
    if (destaque && !c.pilha(naArea(c, dentro(g.dest, u * 3.5)), [destaque], { vertical: "middle" })) return false;
    const info = c.itensDeInfo().filter((i) => !(destaque && i.campo === destaque.campo));
    return coluna(c, naArea(c, dentro(g.pe, u * 4)), { topo: [], base: info, marca: true, fracaoDaBase: 1 });
  },
};

const geometricaDiagonal: Variante = {
  id: "geometrica-diagonais",
  familia: "geometrica",
  descricao: "Uma diagonal corta a página em dois tons, com faixas finas de cor correndo junto; o título fica acima do corte e a informação abaixo, alinhada à direita.",
  requisitos: { imagem: "nenhuma" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const tudo = { x: 0, y: 0, w: L, h: A };
    if (prop === "paisagem") {
      c.caminho(tudo, "M0.58 0 L1 0 L1 1 L0.44 1 Z", p.superficie, { papel: "painel", nome: "Corte diagonal" });
      c.caminho(tudo, "M0.555 0 L0.575 0 L0.435 1 L0.415 1 Z", p.destaque, { nome: "Faixa" });
      c.caminho(tudo, "M0.52 0 L0.527 0 L0.387 1 L0.38 1 Z", p.acento, { nome: "Faixa fina" });
      const esq = { x: seg.x, y: seg.y, w: L * 0.36 - seg.x, h: seg.h };
      if (!c.pilha(esq, blocoPrincipal(c, { tituloMax: u * 12, versiculo: false }), { vertical: "top" })) return false;
      const dir = { x: L * 0.62, y: seg.y, w: seg.x + seg.w - L * 0.62, h: seg.h };
      return coluna(c, dir, { topo: [], base: c.itensDeInfo(), marca: true, alinhamento: "right", fracaoDaBase: 1 });
    }
    const yEsq = prop === "vertical" ? 0.58 : 0.64;
    const yDir = prop === "vertical" ? 0.42 : 0.36;
    c.caminho(tudo, `M0 ${yEsq} L1 ${yDir} L1 1 L0 1 Z`, p.superficie, { papel: "painel", nome: "Corte diagonal" });
    c.caminho(tudo, `M0 ${yEsq - 0.03} L1 ${yDir - 0.03} L1 ${yDir - 0.012} L0 ${yEsq - 0.012} Z`, p.destaque, { nome: "Faixa" });
    c.caminho(tudo, `M0 ${yEsq - 0.055} L1 ${yDir - 0.055} L1 ${yDir - 0.049} L0 ${yEsq - 0.049} Z`, p.acento, { nome: "Faixa fina" });
    const alto = { x: seg.x, y: seg.y, w: seg.w, h: (yDir - 0.07) * A - seg.y };
    if (!c.pilha(alto, blocoPrincipal(c, { tituloMax: u * 12, versiculo: false }), { vertical: "top" })) return false;
    const y = yEsq * A + u * 4;
    const baixo = { x: seg.x + seg.w * 0.2, y, w: seg.w * 0.8, h: seg.y + seg.h - y };
    return coluna(c, baixo, { topo: [], base: c.itensDeInfo(), marca: true, alinhamento: "right", fracaoDaBase: 1 });
  },
};

// ─────────────────────────────────────────────── G. Ilustrada

const ilustradaCenaNaBase: Variante = {
  id: "ilustrada-cena-na-base",
  familia: "ilustrada",
  descricao: "Uma cena ilustrada assentada no pé da página, de borda a borda; título e informação no céu livre acima dela, centralizados.",
  requisitos: { imagem: "ilustracao" },
  centralizada: true,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = ilustracaoPrincipal(c, true);
    if (!v || v.tipo !== "ilustracao") return false;
    fundoDaPaleta(c, "gradiente");
    const largura = prop === "paisagem" ? L * 0.62 : L * 0.96;
    const altura = Math.min(A * (prop === "vertical" ? 0.4 : 0.5), (largura * v.il.altura) / v.il.largura);
    const cena = { x: prop === "paisagem" ? L - largura - u * 2 : (L - largura) / 2, y: A - altura - u * 1.5, w: largura, h: altura };
    const ocupada = c.visual(cena, v, { alinhar: { x: 0.5, y: 1 } }).ret;
    if (prop === "paisagem") {
      const col = { x: seg.x, y: seg.y, w: ocupada.x - seg.x - u * 4, h: seg.h };
      return coluna(c, col, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
    }
    const ceu = { x: seg.x, y: seg.y, w: seg.w, h: ocupada.y - seg.y - u * 4 };
    return coluna(c, ceu, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true, alinhamento: "center", fracaoDaBase: 0.4 });
  },
};

const ilustradaLateral: Variante = {
  id: "ilustrada-lateral",
  familia: "ilustrada",
  descricao: "Ilustração grande numa lateral, sobre uma mancha circular suave; a coluna de informação corre do outro lado.",
  requisitos: { imagem: "ilustracao" },
  centralizada: false,
  compor(c) {
    const { L, u, seg, prop } = c.amb;
    const p = c.p;
    const v = ilustracaoPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    let area: Ret;
    let texto: Ret;
    if (prop === "vertical") {
      area = q(c, 0.26, 0.04, 0.7, 0.4);
      texto = { x: seg.x, y: area.y + area.h + u * 6, w: seg.w, h: seg.y + seg.h - (area.y + area.h + u * 6) };
    } else {
      const f = prop === "paisagem" ? 0.46 : 0.46;
      area = { x: seg.x, y: seg.y + seg.h * 0.08, w: L * f - seg.x, h: seg.h * 0.84 };
      texto = { x: L * f + u * 5, y: seg.y, w: seg.x + seg.w - (L * f + u * 5), h: seg.h };
    }
    const d = Math.min(area.w, area.h) * 1.05;
    c.circulo({ x: area.x + (area.w - d) / 2, y: area.y + (area.h - d) / 2, w: d, h: d }, misturar(p.acento, p.fundo, 0.55), { nome: "Mancha" });
    c.visual(dentro(area, Math.min(area.w, area.h) * 0.08), v, { alinhar: { x: 0.5, y: 0.6 } });
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true, divisor: true });
  },
};

const ilustradaCentral: Variante = {
  id: "ilustrada-elemento-central",
  familia: "ilustrada",
  descricao: "Um desenho principal no centro, cercado por três ou quatro desenhos pequenos de apoio do mesmo assunto; título centralizado embaixo.",
  requisitos: { imagem: "ilustracao" },
  centralizada: true,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = ilustracaoPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "radial");
    const alturaDesenho = A * (prop === "paisagem" ? 0.5 : prop === "vertical" ? 0.34 : 0.42);
    const lado = Math.min(alturaDesenho, L * 0.5);
    const centro = { x: (L - lado) / 2, y: seg.y + u * 3, w: lado, h: lado };
    const principal = c.visual(centro, v, { alinhar: { x: 0.5, y: 0.5 } }).ret;
    const apoios = c.amb.apoios.filter((il) => il.id !== v.id).slice(0, 4);
    const pequeno = u * (prop === "vertical" ? 13 : 11);
    const lugares = [
      { x: principal.x - pequeno * 1.2, y: principal.y + principal.h * 0.05 },
      { x: principal.x + principal.w + pequeno * 0.2, y: principal.y + principal.h * 0.1 },
      { x: principal.x - pequeno * 0.9, y: principal.y + principal.h - pequeno * 0.8 },
      { x: principal.x + principal.w - pequeno * 0.1, y: principal.y + principal.h - pequeno * 0.7 },
    ];
    apoios.forEach((il, k) => {
      const l = lugares[k];
      if (!l) return;
      const r = { x: Math.max(u * 2, Math.min(L - pequeno - u * 2, l.x)), y: l.y, w: pequeno, h: pequeno };
      c.visual(r, { tipo: "ilustracao", id: il.id, il }, { nome: `Apoio: ${il.nome}`, ajustar: false });
    });
    const y = principal.y + principal.h + u * 6;
    const texto = { x: seg.x + seg.w * 0.06, y, w: seg.w * 0.88, h: seg.y + seg.h - y };
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 10 }), base: c.itensDeInfo(), marca: true, alinhamento: "center", fracaoDaBase: 0.45 });
  },
};

// ─────────────────────────────────────────────── H. Institucional

const institucionalCabecalho: Variante = {
  id: "institucional-cabecalho-grade",
  familia: "institucional",
  descricao: "Cabeçalho de identidade (logo e nome da organização) numa faixa; embaixo, título e a informação em módulos de grade separados por fios.",
  requisitos: { imagem: "nenhuma", identidade: true },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const p = c.p;
    if (!c.amb.briefing.logo && !c.amb.conteudo.organizacao) return false;
    fundoDaPaleta(c, "liso");
    // A faixa começa na borda e termina abaixo da área segura de cima: no
    // story, o topo da tela é do aplicativo, e a identidade tem de caber
    // inteira dentro da faixa, abaixo dele.
    const alturaFaixa = seg.y + Math.max(u * 12, A * 0.08);
    const faixa = { x: 0, y: 0, w: L, h: alturaFaixa };
    c.bloco(faixa, p.superficie, { papel: "painel", nome: "Cabeçalho" });
    const dentroFaixa = { x: seg.x, y: seg.y, w: seg.w, h: alturaFaixa - seg.y - u * 2.5 };
    c.rodapeDeMarca(dentroFaixa, "left");
    const y = alturaFaixa + u * 6;
    const corpo = { x: seg.x, y, w: seg.w, h: seg.y + seg.h - y };
    const conteudo = c.amb.conteudo;
    const grupos: ItemDeTexto[][] = [];
    const info = c.itensDeInfo();
    const achar = (campos: string[]) => info.filter((i) => campos.includes(i.campo ?? ""));
    const g1 = achar(["data", "horario", "data+horario"]);
    const g2 = achar(["local", "endereco"]);
    const g3 = achar(["pregador", "ministerio", "contato", "redes", "contato+redes"]);
    for (const g of [g1, g2, g3]) if (g.length) grupos.push(g);
    const alturaGrade = prop === "vertical" ? corpo.h * 0.42 : corpo.h * 0.34;
    const grade = { x: corpo.x, y: corpo.y + corpo.h - alturaGrade, w: corpo.w, h: alturaGrade };
    if (grupos.length) {
      const empilhar = prop === "vertical";
      const partes = empilhar ? [grade] : colunas(grade, grupos.map(() => 1), u * 4);
      if (empilhar) {
        let yy = grade.y;
        for (const g of grupos) {
          c.linha(grade.x, yy, grade.x + grade.w, yy, p.linha, Math.max(1.5, u * 0.2), { nome: "Fio" });
          const r = c.pilha({ x: grade.x, y: yy + u * 1.6, w: grade.w, h: grade.h / grupos.length - u * 2 }, g, { vertical: "top", espaco: u * 0.6 });
          if (!r) return false;
          yy = r.y + r.h + u * 2.5;
        }
      } else {
        for (let k = 0; k < grupos.length; k++) {
          const r = partes[k];
          c.bloco({ x: r.x, y: r.y, w: r.w, h: Math.max(3, u * 0.5) }, p.destaque, { nome: "Fio do módulo" });
          if (!c.pilha({ x: r.x, y: r.y + u * 2.5, w: r.w, h: r.h - u * 2.5 }, grupos[k], { vertical: "top", espaco: u * 0.6 })) return false;
        }
      }
    }
    const alto = { x: corpo.x, y: corpo.y, w: prop === "paisagem" ? corpo.w * 0.72 : corpo.w, h: grade.y - corpo.y - u * 5 };
    return !!c.pilha(alto, [c.itemSobretitulo(), c.itemTitulo(u * 11, u * 5, 4), ...c.itensDeApoio({ versiculo: !!conteudo.versiculo })], { vertical: "top" });
  },
};

const institucionalImagemHorizontal: Variante = {
  id: "institucional-imagem-horizontal",
  familia: "institucional",
  descricao: "Faixa de imagem horizontal na largura da página, título logo abaixo e a informação em colunas; assinatura da organização no pé, à direita.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    const alturaImg = A * (prop === "paisagem" ? 0.42 : prop === "vertical" ? 0.3 : prop === "retrato" ? 0.34 : 0.36);
    const img = { x: seg.x, y: seg.y, w: seg.w, h: alturaImg };
    imagemNaRegiao(c, img, v);
    const y = img.y + img.h + u * 5;
    const resto = { x: seg.x, y, w: seg.w, h: seg.y + seg.h - y };
    const alturaPe = u * 8;
    const corpo = { ...resto, h: resto.h - alturaPe - u * 2 };
    c.rodapeDeMarca({ x: seg.x, y: seg.y + seg.h - alturaPe, w: seg.w, h: alturaPe }, "right");
    if (prop === "vertical") return coluna(c, corpo, { topo: blocoPrincipal(c, { tituloMax: u * 11, versiculo: false }), base: c.itensDeInfo(), fracaoDaBase: 0.45 });
    const [esq, dir] = colunas(corpo, [0.58, 0.42], u * 6);
    if (!c.pilha(esq, blocoPrincipal(c, { tituloMax: u * 10, versiculo: false }), { vertical: "top" })) return false;
    return !!c.pilha(dir, c.itensDeInfo({ contato: true }), { vertical: "top", espaco: u * 1 });
  },
};

const institucionalPainelLateral: Variante = {
  id: "institucional-painel-lateral",
  familia: "institucional",
  descricao: "Painel lateral na cor da marca com a logo, o nome da organização e a data; o conteúdo principal ocupa o resto da página. No story o painel vira faixa no alto.",
  requisitos: { imagem: "nenhuma", identidade: true },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop, m } = c.amb;
    const p = c.p;
    if (!c.amb.briefing.logo && !c.amb.conteudo.organizacao) return false;
    fundoDaPaleta(c, "liso");
    const vertical = prop === "vertical";
    const painel = vertical ? { x: 0, y: 0, w: L, h: A * 0.24 } : { x: 0, y: 0, w: L * (prop === "paisagem" ? 0.27 : 0.32), h: A };
    c.bloco(painel, p.superficie, { papel: "painel", nome: "Painel da marca" });
    const miolo = vertical ? { x: seg.x, y: seg.y, w: seg.w, h: painel.h - seg.y - u * 3 } : { x: m, y: seg.y, w: painel.w - m - u * 4, h: seg.h };
    const logo = c.amb.briefing.logo ? c.logo({ x: miolo.x, y: miolo.y, w: miolo.w * (vertical ? 0.4 : 0.8), h: u * (vertical ? 9 : 12) }, { x: 0, y: 0 }) : null;
    let yy = logo ? logo.y + logo.h + u * 3 : miolo.y;
    const org = c.itemOrganizacao();
    if (org) {
      const r = c.texto({ x: miolo.x, y: yy, w: miolo.w, h: u * 10 }, { ...org, max: u * 3.2, linhas: 3 });
      if (r) yy = r.y + r.h;
    }
    const quando = c.itensDeInfo({ quandoEmDestaque: true })[0];
    const temQuando = quando && quando.papel === "data";
    if (temQuando) {
      const alvo = vertical ? { x: miolo.x + miolo.w * 0.5, y: miolo.y, w: miolo.w * 0.5, h: miolo.h } : { x: miolo.x, y: yy + u * 4, w: miolo.w, h: miolo.y + miolo.h - yy - u * 4 };
      if (!c.pilha(alvo, [{ ...quando, linhas: 4 }], { vertical: "bottom", alinhamento: vertical ? "right" : "left" })) return false;
    }
    const corpo = vertical
      ? { x: seg.x, y: painel.h + u * 6, w: seg.w, h: seg.y + seg.h - painel.h - u * 6 }
      : { x: painel.w + u * 6, y: seg.y, w: seg.x + seg.w - painel.w - u * 6, h: seg.h };
    const info = c.itensDeInfo().filter((i) => !(temQuando && i.campo === quando.campo));
    return coluna(c, corpo, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: info, marca: false });
  },
};

export const GEOMETRICA: Familia = { id: "geometrica", nome: "Geométrica", variantes: [geometricaCirculo, geometricaBlocos, geometricaDiagonal] };
export const ILUSTRADA: Familia = { id: "ilustrada", nome: "Ilustrada", variantes: [ilustradaCenaNaBase, ilustradaLateral, ilustradaCentral] };
export const INSTITUCIONAL: Familia = { id: "institucional", nome: "Institucional", variantes: [institucionalCabecalho, institucionalImagemHorizontal, institucionalPainelLateral] };
