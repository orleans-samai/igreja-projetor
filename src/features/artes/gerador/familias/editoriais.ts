import { ARCO } from "../../catalogo/formas.ts";
import { misturar } from "../../catalogo/cores.ts";
import { luminosidadeDe } from "../../catalogo/paletas.ts";
import { dentro, protecaoPara, type Compositor, type Ret } from "../compositor.ts";
import {
  blocoPrincipal,
  colunas,
  coluna,
  corDePainel,
  fundoDaPaleta,
  imagemNaRegiao,
  linhas,
  naArea,
  q,
  segundoVisual,
  sortearFundo,
  visualPrincipal,
  type Familia,
  type Variante,
} from "./comum.ts";

/**
 * Famílias de página impressa: Editorial, Capa e Molduras.
 *
 * O que as une é a grade — coluna de texto com medida de livro, imagem com
 * borda definida, informação no pé. O que as separa é a relação entre texto
 * e imagem: lado a lado (editorial), imagem sob a manchete (capa) e imagem
 * emoldurada com o texto de fora (molduras).
 */

// ─────────────────────────────────────────────── A. Editorial

const editorialTextoEsquerda: Variante = {
  id: "editorial-texto-esquerda",
  familia: "editorial",
  descricao: "Coluna de texto à esquerda, imagem sangrando à direita; no story, a imagem vira uma faixa alta à direita e o título corre ao lado dela.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    if (prop === "vertical") {
      const img = q(c, 0.46, 0, 0.54, 0.54);
      imagemNaRegiao(c, img, v);
      const topo = { x: seg.x, y: seg.y + u * 4, w: img.x - seg.x - u * 3, h: img.h - seg.y - u * 4 };
      if (!c.pilha(topo, [c.itemSobretitulo(), c.itemTitulo(u * 10, u * 5, 6)], { vertical: "bottom" })) return false;
      const baixo = { x: seg.x, y: img.h + u * 6, w: seg.w, h: seg.y + seg.h - img.h - u * 6 };
      return coluna(c, baixo, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true, divisor: true });
    }
    const corte = prop === "paisagem" ? 0.5 : 0.54;
    const alturaImg = prop === "retrato" ? 0.7 : 1;
    const img = q(c, corte, 0, 1 - corte, alturaImg);
    imagemNaRegiao(c, img, v);
    const col = { x: seg.x, y: seg.y, w: L * corte - seg.x - u * 5, h: seg.h };
    if (prop === "retrato") {
      const y = A * alturaImg + u * 4;
      const pe = { x: seg.x, y, w: seg.w, h: seg.y + seg.h - y };
      if (!coluna(c, pe, { topo: [], base: c.itensDeInfo(), marca: true, fracaoDaBase: 1 })) return false;
      return coluna(c, { ...col, h: A * alturaImg - seg.y - u * 3 }, { topo: blocoPrincipal(c) });
    }
    return coluna(c, col, { topo: blocoPrincipal(c), base: c.itensDeInfo(), marca: true, divisor: true });
  },
};

const editorialImagemEsquerda: Variante = {
  id: "editorial-imagem-esquerda",
  familia: "editorial",
  descricao: "Imagem à esquerda dentro da margem, título no alto da coluna oposta separada por um fio; no story, a imagem desce para o pé e o título manda no alto.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, sortearFundo(c) === "radial" ? "liso" : "gradiente");
    if (prop === "vertical") {
      const img = { x: seg.x, y: A * 0.6, w: seg.w, h: seg.y + seg.h - A * 0.6 };
      imagemNaRegiao(c, img, v);
      const col = { x: seg.x, y: seg.y, w: seg.w, h: img.y - seg.y - u * 5 };
      return coluna(c, col, { topo: blocoPrincipal(c, { tituloMax: u * 14 }), base: [...c.itensDeInfo()], marca: true, fracaoDaBase: 0.4 });
    }
    const larg = prop === "paisagem" ? 0.44 : 0.47;
    const img = prop === "retrato" ? q(c, 0, 0, larg, 1) : { x: seg.x, y: seg.y, w: L * larg - seg.x, h: seg.h };
    imagemNaRegiao(c, img, v);
    const x0 = img.x + img.w + u * 6;
    c.linha(x0 - u * 3, seg.y, x0 - u * 3, seg.y + seg.h, c.p.linha, Math.max(2, u * 0.2), { nome: "Fio vertical" });
    const col = { x: x0, y: seg.y, w: seg.x + seg.w - x0, h: seg.h };
    return coluna(c, col, { topo: blocoPrincipal(c, { tituloMax: u * 12 }), base: c.itensDeInfo(), marca: true });
  },
};

const editorialGrade: Variante = {
  id: "editorial-grade-modular",
  familia: "editorial",
  descricao: "Grade de módulos com respiro entre eles: imagem, título, informação e um módulo de destaque (data ou chamada), cada um num painel.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { L, A, u, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const g = u * 1.6;
    const area = dentro({ x: 0, y: 0, w: L, h: A }, u * 4);
    const pad = u * 3.2;
    let mImg: Ret, mTit: Ret, mInfo: Ret, mDest: Ret;
    if (prop === "paisagem") {
      const [c1, c2, c3] = colunas(area, [0.38, 0.34, 0.28], g);
      mImg = c1;
      [mTit, mInfo] = linhas(c2, [0.62, 0.38], g);
      [mDest] = linhas(c3, [1], g);
    } else if (prop === "vertical") {
      const [r1, r2, r3] = linhas(area, [0.36, 0.34, 0.3], g);
      mImg = r1;
      mTit = r2;
      [mInfo, mDest] = colunas(r3, [0.56, 0.44], g);
    } else if (prop === "retrato") {
      const [r1, r2, r3] = linhas(area, [0.4, 0.33, 0.27], g);
      mImg = r1;
      mTit = r2;
      [mInfo, mDest] = colunas(r3, [0.56, 0.44], g);
    } else {
      const [r1, r2] = linhas(area, [0.56, 0.44], g);
      [mTit, mImg] = colunas(r1, [0.52, 0.48], g);
      [mInfo, mDest] = colunas(r2, [0.58, 0.42], g);
    }
    const raio = u * 1.2;
    const v = visualPrincipal(c);
    if (v) imagemNaRegiao(c, mImg, v, { mascara: { tipo: "retangulo", raio } });
    else {
      c.bloco(mImg, p.fundo2, { papel: "painel", raio, nome: "Módulo" });
      c.textura(dentro(mImg, u), "pontilhado", p.destaque, u * 3, 0.5);
    }
    c.bloco(mTit, corDePainel(c), { papel: "painel", raio, nome: "Módulo do título" });
    if (!c.pilha(naArea(c, dentro(mTit, pad)), [c.itemSobretitulo(), c.itemTitulo(u * 10, u * 4.8, 5)], { vertical: "bottom" })) return false;
    c.bloco(mInfo, p.fundo2, { papel: "painel", raio, nome: "Módulo de informação" });
    const apoio = c.itensDeApoio({ versiculo: false });
    if (!c.pilha(naArea(c, dentro(mInfo, pad)), [...apoio.slice(0, 1), ...c.itensDeInfo({ contato: false })], { vertical: "top", espaco: u * 1 })) return false;
    c.bloco(mDest, p.destaque, { papel: "painel", raio, nome: "Módulo de destaque" });
    const dest = naArea(c, dentro(mDest, pad));
    const conteudo = c.amb.conteudo;
    const destaque =
      conteudo.quando
        ? { ...c.itensDeInfo({ quandoEmDestaque: true })[0], cor: p.textoSobreDestaque }
        : conteudo.mensagem
          ? { papel: "mensagem" as const, nome: "Mensagem", campo: "mensagem", texto: conteudo.mensagem.texto, estilo: c.t.destaque, max: u * 5, min: u * 2.6, linhas: 5, cor: p.textoSobreDestaque }
          : null;
    const temMarca = !!c.amb.briefing.logo || !!conteudo.organizacao;
    let limite = dest.y + dest.h;
    if (temMarca) {
      const mk = c.rodapeDeMarca({ x: dest.x, y: dest.y + dest.h - u * 6, w: dest.w, h: u * 6 });
      if (mk && mk.h) limite = mk.y - u * 2;
    }
    if (destaque && !c.pilha({ ...dest, h: limite - dest.y }, [destaque], { vertical: "top" })) return false;
    return true;
  },
};

// ─────────────────────────────────────────────── L. Capa editorial

const capaTituloAlto: Variante = {
  id: "capa-titulo-alto",
  familia: "capa",
  descricao: "Manchete no alto na largura toda, imagem no centro, linha de detalhes no pé (subtítulo de um lado, data do outro).",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    let y = seg.y;
    const org = c.itemOrganizacao();
    if (org) {
      const t = c.texto({ x: seg.x, y, w: seg.w, h: u * 5 }, org);
      if (!t) return false;
      y = t.y + t.h + u * 1.5;
      c.linha(seg.x, y, seg.x + seg.w, y, c.p.texto, Math.max(2, u * 0.25), { nome: "Fio da manchete" });
      y += u * 2.5;
    }
    const alturaTitulo = A * (prop === "vertical" ? 0.22 : prop === "paisagem" ? 0.3 : 0.26);
    const tit = c.pilha({ x: seg.x, y, w: seg.w, h: alturaTitulo }, [c.itemSobretitulo(), c.itemTitulo(u * 15, u * 6, 3)], { vertical: "top", espaco: u });
    if (!tit) return false;
    y = tit.y + tit.h + u * 3;
    const alturaPe = A * (prop === "vertical" ? 0.2 : 0.18);
    const img = { x: seg.x, y, w: seg.w, h: seg.y + seg.h - alturaPe - y };
    if (img.h < A * 0.2) return false;
    imagemNaRegiao(c, img, v);
    const pe = { x: seg.x, y: img.y + img.h + u * 3, w: seg.w, h: seg.y + seg.h - (img.y + img.h + u * 3) };
    if (prop === "vertical") return coluna(c, pe, { topo: c.itensDeApoio({ versiculo: false }), base: c.itensDeInfo(), marca: false });
    const [esq, dir] = colunas(pe, [0.58, 0.42], u * 4);
    if (!c.pilha(esq, c.itensDeApoio({ versiculo: false }).slice(0, 2), { vertical: "top" })) return false;
    return !!c.pilha(dir, c.itensDeInfo(), { alinhamento: "right", vertical: "top", espaco: u * 0.8 });
  },
};

const capaTituloLateral: Variante = {
  id: "capa-titulo-lateral",
  familia: "capa",
  descricao: "Título girado lendo de baixo para cima na borda esquerda, imagem vertical ocupando o resto; informação no pé, à direita.",
  requisitos: { imagem: "qualquer", tituloMax: 42 },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    const faixa = prop === "paisagem" ? A * 0.26 : L * 0.2;
    const alturaPe = prop === "paisagem" ? 0 : A * (prop === "vertical" ? 0.2 : 0.24);
    const slot = { x: seg.x, y: seg.y, w: faixa, h: seg.h };
    const girado = c.textoGirado(slot, { ...c.itemTitulo(faixa * 0.9, u * 6, 2), linhas: 2 });
    if (!girado) return false;
    const x0 = girado.x + girado.w + u * 4;
    const larguraImg = prop === "paisagem" ? L * 0.42 : L - x0;
    const img = { x: x0, y: 0, w: larguraImg, h: prop === "paisagem" ? A : A - alturaPe - u * 2 };
    imagemNaRegiao(c, img, v);
    if (prop === "paisagem") {
      const col = { x: img.x + img.w + u * 5, y: seg.y, w: seg.x + seg.w - (img.x + img.w + u * 5), h: seg.h };
      return coluna(c, col, { topo: [c.itemSobretitulo(), ...c.itensDeApoio()], base: c.itensDeInfo(), marca: true });
    }
    const pe = { x: x0, y: img.h + u * 4, w: seg.x + seg.w - x0, h: seg.y + seg.h - img.h - u * 4 };
    return coluna(c, pe, { topo: [c.itemSobretitulo(), ...c.itensDeApoio({ versiculo: false })], base: c.itensDeInfo(), marca: false, fracaoDaBase: 0.6 });
  },
};

const capaPublicacao: Variante = {
  id: "capa-publicacao",
  familia: "capa",
  descricao: "Capa de revista: nome da organização como logotipo no alto, chamadas de capa à esquerda sobre a imagem, data como número da edição.",
  requisitos: { imagem: "qualquer", identidade: true },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    const manchete = c.amb.conteudo.organizacao?.texto ?? c.amb.conteudo.sobretitulo?.texto;
    if (!v || !manchete) return false;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const topo = c.texto(
      { x: seg.x, y: seg.y, w: seg.w, h: A * 0.16 },
      { papel: "organizacao", nome: "Logotipo da capa", campo: c.amb.conteudo.organizacao ? "organizacao" : "tema", texto: manchete, estilo: { ...c.t.titulo, maiusculas: true, espacamento: 0.02 }, max: u * 11, min: u * 4, linhas: 1 },
    );
    if (!topo) return false;
    let y = topo.y + topo.h + u * 1.5;
    c.linha(seg.x, y, seg.x + seg.w, y, p.texto, Math.max(2, u * 0.3), { nome: "Fio da capa" });
    y += u * 2;
    const quando = c.itensDeInfo()[0];
    if (quando) {
      const edicao = c.texto({ x: seg.x, y, w: seg.w, h: u * 5 }, { ...quando, estilo: c.t.sobretitulo, max: u * 2.8, min: u * 2.2 }, { alinhamento: "right" });
      if (!edicao) return false;
      y = edicao.y + edicao.h + u * 2;
    }
    // Da faixa da manchete para baixo, a imagem. Foto sangra até o pé, com
    // proteção só do lado das chamadas; ilustração fica à direita delas.
    const largura = prop === "paisagem" ? L * 0.4 : prop === "vertical" ? seg.w : L * 0.5;
    const topoImagem = y + u;
    if (v.tipo === "foto") {
      const lado = prop === "vertical" || prop === "retrato" ? "baixo" : "esquerda";
      const foto = { x: 0, y: topoImagem, w: L, h: A - topoImagem };
      const plato = lado === "baixo" ? 0.55 : (largura + seg.x + u * 3) / L;
      c.visual(foto, v, { protecao: protecaoPara(lado, 0.75, "#08080a", plato + 0.25, plato) });
    } else {
      const r = prop === "vertical" ? { x: seg.x + seg.w * 0.3, y: topoImagem, w: seg.w * 0.7, h: A * 0.34 } : { x: seg.x + largura + u * 4, y: topoImagem, w: seg.x + seg.w - (seg.x + largura + u * 4), h: seg.y + seg.h - topoImagem };
      imagemNaRegiao(c, r, v, { painel: null, alinhar: { x: 1, y: prop === "vertical" ? 0 : 1 } });
      if (prop === "vertical") y = r.y + r.h + u * 3;
    }
    const chamadas = { x: seg.x, y: v.tipo === "foto" ? topoImagem + u * 3 : y, w: largura, h: seg.y + seg.h - (v.tipo === "foto" ? topoImagem + u * 3 : y) };
    return coluna(c, chamadas, {
      topo: [],
      base: [c.itemTitulo(u * 12, u * 5.2, 4), ...c.itensDeApoio({ versiculo: false }), ...c.itensDeInfo().slice(quando ? 1 : 0)],
      marca: !!c.amb.briefing.logo,
      // O nome da igreja já é o logotipo da capa: não repete no pé.
      marcaSemNome: !!c.amb.conteudo.organizacao,
      fracaoDaBase: 1,
    });
  },
};

// ─────────────────────────────────────────────── I. Molduras e janelas

function corDoPasseParTout(c: Compositor): string {
  const p = c.p;
  return luminosidadeDe(p) === "escura" ? misturar(p.fundo, p.texto, 0.1) : misturar(p.fundo, "#ffffff", 0.75);
}

const molduraTituloExterno: Variante = {
  id: "moldura-titulo-externo",
  familia: "molduras",
  descricao: "Imagem dentro de moldura com passe-partout e fio fino; o título fica do lado de fora — ao lado no quadrado e na paisagem, embaixo no retrato e no story.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, sortearFundo(c));
    let moldura: Ret;
    let texto: Ret;
    if (prop === "quadrado" || prop === "paisagem") {
      const w = L * (prop === "paisagem" ? 0.4 : 0.5);
      moldura = { x: seg.x, y: seg.y, w, h: seg.h * (prop === "paisagem" ? 1 : 0.9) };
      texto = { x: seg.x + w + u * 6, y: seg.y, w: seg.w - w - u * 6, h: seg.h };
    } else {
      const h = A * (prop === "vertical" ? 0.47 : 0.5);
      moldura = { x: seg.x + (prop === "retrato" ? u * 6 : 0), y: seg.y + u * 2, w: seg.w - (prop === "retrato" ? u * 12 : 0), h };
      texto = { x: seg.x, y: moldura.y + h + u * 6, w: seg.w, h: seg.y + seg.h - (moldura.y + h + u * 6) };
    }
    c.bloco(moldura, corDoPasseParTout(c), { papel: "painel", nome: "Passe-partout", contorno: { cor: c.p.linha, espessura: Math.max(2, u * 0.25) } });
    imagemNaRegiao(c, dentro(moldura, u * 3.2), v, { painel: c.p.fundo2 });
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true, divisor: true });
  },
};

const molduraBordaEditorial: Variante = {
  id: "moldura-borda-editorial",
  familia: "molduras",
  descricao: "Fio contornando a página inteira com cantoneiras; título no alto à esquerda, informação no pé à direita, imagem pequena opcional deslocada à direita.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop, m } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const borda = dentro({ x: 0, y: 0, w: L, h: A }, m * 0.45);
    c.bloco(borda, null, { contorno: { cor: p.texto, espessura: Math.max(2, u * 0.22) }, nome: "Borda" });
    const canto = u * 3;
    for (const [x, y] of [[borda.x, borda.y], [borda.x + borda.w - canto, borda.y], [borda.x, borda.y + borda.h - canto], [borda.x + borda.w - canto, borda.y + borda.h - canto]]) {
      c.bloco({ x, y, w: canto, h: canto }, p.destaque, { nome: "Cantoneira" });
    }
    const v = visualPrincipal(c);
    const interno = dentro(seg, u * 2);
    let largTexto = interno.w * (prop === "paisagem" ? 0.58 : 0.8);
    if (v) {
      const lado = prop === "vertical" ? interno.w * 0.46 : prop === "paisagem" ? interno.w * 0.34 : interno.w * 0.38;
      const r = { x: interno.x + interno.w - lado, y: interno.y + interno.h * (prop === "paisagem" ? 0.1 : 0.34), w: lado, h: lado * (v.tipo === "foto" ? 1.25 : 1) };
      imagemNaRegiao(c, r, v, { painel: v.tipo === "ilustracao" ? null : undefined });
      if (prop !== "vertical") largTexto = Math.min(largTexto, r.x - interno.x - u * 4);
    }
    const topo = { x: interno.x, y: interno.y, w: largTexto, h: interno.h * (prop === "vertical" ? 0.34 : 0.55) };
    if (!c.pilha(topo, blocoPrincipal(c, { tituloMax: u * 12 }), { vertical: "top" })) return false;
    const pe = { x: interno.x + interno.w * 0.35, y: interno.y + interno.h * 0.62, w: interno.w * 0.65, h: interno.h * 0.38 };
    return coluna(c, pe, { topo: [], base: c.itensDeInfo(), marca: true, alinhamento: "right", fracaoDaBase: 1 });
  },
};

const molduraDuasJanelas: Variante = {
  id: "moldura-duas-janelas",
  familia: "molduras",
  descricao: "Duas janelas em arco de alturas diferentes, lado a lado, e um bloco de informação ao lado delas (ou embaixo, no story).",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v1 = visualPrincipal(c);
    const v2 = segundoVisual(c);
    if (!v1 || !v2) return false;
    fundoDaPaleta(c, "liso");
    const empilhado = prop === "vertical" || prop === "retrato";
    const areaJanelas = empilhado ? { x: seg.x, y: seg.y, w: seg.w, h: A * (prop === "vertical" ? 0.46 : 0.5) } : { x: seg.x, y: seg.y, w: L * 0.54, h: seg.h };
    const [j1, j2] = colunas(areaJanelas, [1, 1], u * 3);
    const alta = { ...j1 };
    const baixa = { ...j2, y: j2.y + j2.h * 0.18, h: j2.h * 0.82 };
    imagemNaRegiao(c, alta, v1, { mascara: { tipo: "caminho", d: ARCO } });
    imagemNaRegiao(c, baixa, v2, { mascara: { tipo: "caminho", d: ARCO }, painel: c.p.fundo2 });
    const texto = empilhado
      ? { x: seg.x, y: areaJanelas.y + areaJanelas.h + u * 6, w: seg.w, h: seg.y + seg.h - (areaJanelas.y + areaJanelas.h + u * 6) }
      : { x: areaJanelas.x + areaJanelas.w + u * 6, y: seg.y, w: seg.x + seg.w - (areaJanelas.x + areaJanelas.w + u * 6), h: seg.h };
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
  },
};

export const EDITORIAL: Familia = { id: "editorial", nome: "Editorial", variantes: [editorialTextoEsquerda, editorialImagemEsquerda, editorialGrade] };
export const CAPA: Familia = { id: "capa", nome: "Capa editorial", variantes: [capaTituloAlto, capaTituloLateral, capaPublicacao] };
export const MOLDURAS: Familia = { id: "molduras", nome: "Molduras e janelas", variantes: [molduraTituloExterno, molduraBordaEditorial, molduraDuasJanelas] };
