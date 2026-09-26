import { diaEMes, palavraPrincipal } from "../../briefing.ts";
import { flor } from "../../catalogo/formas.ts";
import { dentro, type ItemDeTexto, type Ret } from "../compositor.ts";
import {
  blocoPrincipal,
  colunas,
  coluna,
  fundoDaPaleta,
  imagemNaRegiao,
  q,
  sortearFundo,
  visualPrincipal,
  type Familia,
  type Variante,
} from "./comum.ts";

/**
 * Famílias em que a letra é a imagem: Tipográfica, Cartaz e Minimalista.
 *
 * Funcionam sem foto nenhuma — é para elas que o gerador corre quando não
 * há imagem adequada, em vez de pôr uma imagem qualquer. Por isso cada uma
 * tem de se sustentar só com tipografia, forma e espaço.
 */

// ─────────────────────────────────────────────── C. Tipográfica

const tipograficaEscalonada: Variante = {
  id: "tipografica-linhas-escalonadas",
  familia: "tipografica",
  descricao: "Título em linhas de larguras iguais e corpos diferentes (cada linha enche a medida); fio embaixo e o resto em duas colunas, ou numa coluna ao lado na paisagem.",
  requisitos: { imagem: "nenhuma", tituloComPalavras: 2, tituloMax: 48 },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, sortearFundo(c) === "radial" ? "liso" : sortearFundo(c));
    let y = seg.y;
    const sobre = c.itemSobretitulo();
    if (sobre) {
      const t = c.texto({ x: seg.x, y, w: seg.w, h: u * 6 }, sobre);
      if (!t) return false;
      y = t.y + t.h + u * 2.5;
    }
    const palavras = c.amb.conteudo.titulo.split(/\s+/).length;
    const linhasDoTitulo = Math.min(4, Math.max(2, Math.ceil(palavras / 1.6)));
    const larguraTitulo = prop === "paisagem" ? seg.w * 0.6 : seg.w;
    const alturaTitulo = A * (prop === "paisagem" ? 0.72 : prop === "vertical" ? 0.46 : 0.5) - (y - seg.y);
    const t = c.tituloEscalonado({ x: seg.x, y, w: larguraTitulo, h: alturaTitulo }, linhasDoTitulo);
    if (!t) return false;
    const yFio = t.y + t.h + u * 3;
    c.linha(seg.x, yFio, seg.x + (prop === "paisagem" ? larguraTitulo : seg.w), yFio, p.texto, Math.max(2, u * 0.35), { nome: "Fio" });
    if (prop === "paisagem") {
      const col = { x: seg.x + seg.w * 0.66, y: seg.y, w: seg.w * 0.34, h: seg.h };
      c.linha(col.x - u * 3, seg.y, col.x - u * 3, seg.y + seg.h, p.linha, 2, { nome: "Fio vertical" });
      return coluna(c, col, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true });
    }
    const resto = { x: seg.x, y: yFio + u * 4, w: seg.w, h: seg.y + seg.h - yFio - u * 4 };
    if (prop === "vertical") return coluna(c, resto, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true });
    const [esq, dir] = colunas(resto, [0.5, 0.5], u * 5);
    if (!c.pilha(esq, c.itensDeApoio(), { vertical: "top" })) return false;
    return coluna(c, dir, { topo: [], base: c.itensDeInfo(), marca: true, fracaoDaBase: 1 });
  },
};

const tipograficaPalavraDominante: Variante = {
  id: "tipografica-palavra-dominante",
  familia: "tipografica",
  descricao: "A palavra mais forte do título em corpo enorme, numa linha; o resto do título pequeno antes e depois, na ordem original; informação em coluna lateral.",
  requisitos: { imagem: "nenhuma", tituloMax: 60 },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const p = c.p;
    const titulo = c.amb.conteudo.titulo;
    const principal = palavraPrincipal(titulo);
    if (principal.length < 4) return false;
    const i = titulo.indexOf(principal);
    const antes = titulo.slice(0, i).trim();
    const depois = titulo.slice(i + principal.length).trim();
    fundoDaPaleta(c, "liso");
    const largura = prop === "paisagem" ? seg.w * 0.64 : seg.w;
    const est = c.t.titulo;
    const pedaco = (texto: string, nome: string): ItemDeTexto => ({ papel: "titulo", nome, campo: "titulo", texto, estilo: est, max: u * 7, min: u * 4, linhas: 2 });
    const grande: ItemDeTexto = { papel: "titulo", nome: "Título, palavra principal", campo: "titulo", texto: principal, estilo: est, max: u * 36, min: u * 9, linhas: 1, cor: p.destaque };
    const bloco = { x: seg.x, y: seg.y, w: largura, h: A * (prop === "vertical" ? 0.56 : 0.68) };
    const topo = c.pilha(bloco, [c.itemSobretitulo(), antes ? pedaco(antes, "Título, início") : null, grande, depois ? pedaco(depois, "Título, fim") : null], {
      vertical: prop === "vertical" ? "middle" : "top",
      espaco: u * 1.2,
    });
    if (!topo) return false;
    if (prop === "paisagem") {
      const col = { x: seg.x + seg.w * 0.69, y: seg.y, w: seg.w * 0.31, h: seg.h };
      c.linha(col.x - u * 3, seg.y, col.x - u * 3, seg.y + seg.h, p.linha, 2, { nome: "Fio vertical" });
      return coluna(c, col, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true });
    }
    const resto = { x: seg.x, y: topo.y + topo.h + u * 5, w: seg.w, h: seg.y + seg.h - (topo.y + topo.h + u * 5) };
    if (prop === "vertical") return coluna(c, resto, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true });
    const [esq, dir] = colunas(resto, [0.52, 0.48], u * 5);
    if (!c.pilha(esq, c.itensDeApoio(), { vertical: "top" })) return false;
    return coluna(c, dir, { topo: [], base: c.itensDeInfo(), marca: true, alinhamento: "right", fracaoDaBase: 1 });
  },
};

const tipograficaEsquerdaComApoios: Variante = {
  id: "tipografica-esquerda-com-apoios",
  familia: "tipografica",
  descricao: "Título alinhado à esquerda com uma barra de cor ao lado; apoios gráficos (grade de pontos no canto, círculo vazado saindo da página, asterisco) organizam o espaço.",
  requisitos: { imagem: "nenhuma" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const lado = u * (prop === "paisagem" ? 26 : 24);
    c.textura({ x: seg.x + seg.w - lado, y: seg.y, w: lado, h: lado }, "pontilhado", p.destaque, u * 2.6, 0.7, "Grade de pontos");
    const diam = Math.min(L, A) * 0.62;
    c.circulo({ x: L - diam * 0.62, y: A - diam * 0.62, w: diam, h: diam }, null, { contorno: { cor: p.acento, espessura: Math.max(3, u * 0.8) }, nome: "Círculo vazado" });
    const recuo = u * 5;
    const alto = { x: seg.x + recuo, y: seg.y + lado * 0.55, w: (prop === "paisagem" ? seg.w * 0.62 : seg.w * 0.84) - recuo, h: A * (prop === "vertical" ? 0.46 : 0.52) };
    const tit = c.pilha(alto, [c.itemSobretitulo(), c.itemTitulo(u * 12, u * 5.2, 4)], { vertical: "top" });
    if (!tit) return false;
    c.bloco({ x: seg.x, y: tit.y, w: u * 1.4, h: tit.h }, p.destaque, { nome: "Barra" });
    const ast = u * 7;
    c.caminho({ x: Math.min(tit.x + tit.w + u * 3, seg.x + seg.w - ast), y: tit.y + tit.h - ast, w: ast, h: ast }, flor(8), p.acento, { nome: "Asterisco" });
    const resto = { x: seg.x + recuo, y: tit.y + tit.h + u * 5, w: (prop === "paisagem" ? seg.w * 0.6 : seg.w * 0.8) - recuo, h: seg.y + seg.h - (tit.y + tit.h + u * 5) };
    return coluna(c, resto, { topo: c.itensDeApoio(), base: c.itensDeInfo(), marca: true, divisor: true });
  },
};

// ─────────────────────────────────────────────── K. Cartaz de evento

const cartazDataEmDestaque: Variante = {
  id: "cartaz-data-em-destaque",
  familia: "cartaz",
  descricao: "Título dominante ocupando a metade de cima; data e horário num selo redondo de cor de destaque logo abaixo, à direita; informação corrida à esquerda.",
  requisitos: { imagem: "nenhuma", quando: true },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const p = c.p;
    const quando = c.amb.conteudo.quando;
    if (!quando) return false;
    fundoDaPaleta(c, sortearFundo(c));
    const t = c.tamanhos();
    const alto = { x: seg.x, y: seg.y, w: prop === "paisagem" ? seg.w * 0.66 : seg.w, h: A * (prop === "vertical" ? 0.5 : 0.56) };
    const tit = c.pilha(alto, [c.itemSobretitulo(), c.itemTitulo(t.tituloGrande.max, t.tituloGrande.min, 4)], { vertical: "top" });
    if (!tit) return false;
    const d = u * (prop === "paisagem" ? 28 : 26);
    const selo: Ret =
      prop === "paisagem"
        ? { x: seg.x + seg.w - d, y: seg.y + u * 2, w: d, h: d }
        : { x: seg.x + seg.w - d, y: tit.y + tit.h + u * 4, w: d, h: d };
    c.circulo(selo, p.destaque, { papel: "painel", nome: "Selo da data" });
    const miolo = dentro(selo, d * 0.17);
    const texto = [c.amb.briefing.data, c.amb.briefing.horario].filter(Boolean).join("\n");
    if (!c.texto(miolo, { papel: "data", nome: "Data e horário", campo: quando.campo, texto, estilo: c.t.destaque, max: u * 6.5, min: u * 2.8, linhas: 4, cor: p.textoSobreDestaque }, { alinhamento: "center", vertical: "middle" })) return false;
    const resto =
      prop === "paisagem"
        ? { x: seg.x + seg.w * 0.7, y: selo.y + selo.h + u * 4, w: seg.w * 0.3, h: seg.y + seg.h - (selo.y + selo.h + u * 4) }
        : { x: seg.x, y: tit.y + tit.h + u * 4, w: seg.w - d - u * 5, h: seg.y + seg.h - (tit.y + tit.h + u * 4) };
    const info = c.itensDeInfo().filter((i) => i.campo !== quando.campo);
    return coluna(c, resto, { topo: c.itensDeApoio({ versiculo: false }), base: info, marca: true, fracaoDaBase: 0.6 });
  },
};

const cartazNumeroGrande: Variante = {
  id: "cartaz-numero-grande",
  familia: "cartaz",
  descricao: "O dia do mês em corpo gigante com o mês embaixo, tirados da data escrita; imagem na lateral (ou composição geométrica, sem imagem); título e informação no espaço restante.",
  requisitos: { imagem: "opcional", diaEMes: true },
  centralizada: false,
  compor(c) {
    const { u, seg, prop } = c.amb;
    const p = c.p;
    const dm = diaEMes(c.amb.briefing.data);
    if (!dm) return false;
    fundoDaPaleta(c, "liso");
    const v = visualPrincipal(c);
    const regiaoImg = prop === "paisagem" ? q(c, 0, 0, 0.38, 1) : prop === "vertical" ? q(c, 0, 0, 1, 0.4) : q(c, 0.52, 0, 0.48, 1);
    if (v) imagemNaRegiao(c, regiaoImg, v, { painel: p.fundo2 });
    else {
      c.bloco(regiaoImg, p.fundo2, { papel: "painel", nome: "Área de cor" });
      const diam = Math.min(regiaoImg.w, regiaoImg.h) * 0.7;
      c.circulo({ x: regiaoImg.x + (regiaoImg.w - diam) / 2, y: regiaoImg.y + (regiaoImg.h - diam) / 2, w: diam, h: diam }, p.acento, { nome: "Círculo" });
      c.textura(dentro(regiaoImg, u * 4), "hachura", p.fundo, u * 3, 0.35);
    }
    const area: Ret =
      prop === "paisagem"
        ? { x: regiaoImg.w + u * 6, y: seg.y, w: seg.x + seg.w - regiaoImg.w - u * 6, h: seg.h }
        : prop === "vertical"
          ? { x: seg.x, y: regiaoImg.h + u * 5, w: seg.w, h: seg.y + seg.h - regiaoImg.h - u * 5 }
          : { x: seg.x, y: seg.y, w: regiaoImg.x - seg.x - u * 5, h: seg.h };
    const dia: ItemDeTexto = { papel: "data", nome: "Dia", campo: "data", texto: dm.dia, estilo: { ...c.t.destaque, entrelinha: 0.9 }, max: u * (prop === "vertical" ? 34 : 30), min: u * 14, linhas: 1, cor: p.destaque };
    const mes: ItemDeTexto = { papel: "data", nome: "Mês", campo: "data", texto: dm.mes, estilo: { ...c.t.sobretitulo, maiusculas: true }, max: u * 4.4, min: u * 2.6, linhas: 1, antes: u * 0.5 };
    const horario = c.amb.briefing.horario
      ? { papel: "info" as const, nome: "Horário", campo: "horario", texto: c.amb.briefing.horario, estilo: c.t.info, max: u * 3.6, min: u * 2.4, linhas: 1, antes: u * 0.6 }
      : null;
    const [colDia, colTexto] = prop === "vertical" ? colunas(area, [0.42, 0.58], u * 4) : [area, area];
    const numero = c.pilha(prop === "vertical" ? colDia : { ...area, h: area.h * 0.42 }, [dia, mes, horario], { vertical: "top", espaco: u });
    if (!numero) return false;
    const resto = prop === "vertical" ? colTexto : { x: area.x, y: numero.y + numero.h + u * 5, w: area.w, h: area.y + area.h - (numero.y + numero.h + u * 5) };
    const info = c.itensDeInfo().filter((i) => i.campo !== "data" && i.campo !== "data+horario" && i.campo !== "horario");
    return coluna(c, resto, { topo: [c.itemSobretitulo(), c.itemTitulo(u * 9, u * 4.6, 4), ...c.itensDeApoio({ versiculo: false }).slice(0, 1)], base: info, marca: true, fracaoDaBase: 0.5 });
  },
};

const cartazFaixas: Variante = {
  id: "cartaz-faixas-informativas",
  familia: "cartaz",
  descricao: "Faixas horizontais de cor atravessando a página, uma por informação; o título fica deslocado do eixo, levemente girado, acima delas.",
  requisitos: { imagem: "nenhuma" },
  centralizada: false,
  compor(c) {
    const { L, u, seg, prop } = c.amb;
    const p = c.p;
    const info = c.itensDeInfo().slice(0, prop === "vertical" ? 5 : 4);
    if (info.length === 0) return false;
    fundoDaPaleta(c, "liso");
    const alturaFaixa = u * (prop === "paisagem" ? 7.5 : 8);
    const vao = u * 1.2;
    const totalFaixas = info.length * alturaFaixa + (info.length - 1) * vao;
    const topoFaixas = seg.y + seg.h - totalFaixas - (c.amb.briefing.logo || c.amb.conteudo.organizacao ? u * 9 : 0);
    info.forEach((item, k) => {
      const y = topoFaixas + k * (alturaFaixa + vao);
      const cor = k % 2 === 0 ? p.destaque : p.superficie;
      const larg = L * (0.78 + ((k * 37) % 20) / 100);
      c.bloco({ x: k % 2 === 0 ? 0 : L - larg, y, w: larg, h: alturaFaixa }, cor, { papel: "painel", nome: "Faixa" });
    });
    let ok = true;
    info.forEach((item, k) => {
      const y = topoFaixas + k * (alturaFaixa + vao);
      const larg = L * (0.78 + ((k * 37) % 20) / 100);
      const x0 = k % 2 === 0 ? seg.x : L - larg + u * 3;
      const r = { x: x0, y: y + alturaFaixa * 0.18, w: larg - (k % 2 === 0 ? seg.x : 0) - u * 6, h: alturaFaixa * 0.64 };
      if (!c.texto(r, { ...item, linhas: 1, max: Math.min(item.max, alturaFaixa * 0.5), min: u * 2.3 }, { vertical: "middle" })) ok = false;
    });
    if (!ok) return false;
    c.rodapeDeMarca({ x: seg.x, y: seg.y + seg.h - u * 7, w: seg.w, h: u * 7 }, "right");
    const deslocamento = seg.w * 0.08;
    const alto = { x: seg.x + deslocamento, y: seg.y, w: seg.w - deslocamento, h: topoFaixas - seg.y - u * 6 };
    return c.grupo("Título deslocado", -3, () => !!c.pilha(alto, blocoPrincipal(c, { tituloMax: u * 15, versiculo: false }), { vertical: "bottom" }));
  },
};

// ─────────────────────────────────────────────── F. Minimalista

const minimalistaTituloEElemento: Variante = {
  id: "minimalista-titulo-e-elemento",
  familia: "minimalista",
  descricao: "Muito espaço vazio: um pequeno elemento visual no alto, título de corpo moderado no terço de baixo à esquerda, informação miúda à direita.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { A, u, seg, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    const il = c.amb.visuais.find((v) => v.tipo === "ilustracao") ?? (c.amb.apoios[0] ? { tipo: "ilustracao" as const, id: c.amb.apoios[0].id, il: c.amb.apoios[0] } : null);
    const lado = u * (prop === "vertical" ? 22 : 18);
    if (il) c.visual({ x: seg.x, y: seg.y, w: lado, h: lado }, il, { alinhar: { x: 0, y: 0 } });
    else c.circulo({ x: seg.x, y: seg.y, w: u * 6, h: u * 6 }, p.destaque, { nome: "Ponto" });
    c.rodapeDeMarca({ x: seg.x + seg.w * 0.5, y: seg.y, w: seg.w * 0.5, h: u * 6 }, "right");
    const inicio = A * (prop === "vertical" ? 0.52 : 0.46);
    if (prop === "vertical" || prop === "retrato") {
      const r = { x: seg.x, y: inicio, w: seg.w * 0.86, h: seg.y + seg.h - inicio };
      return coluna(c, r, { topo: blocoPrincipal(c, { tituloMax: u * 8.5, tituloMin: u * 4.6 }), base: c.itensDeInfo(), marca: false });
    }
    const [esq, dir] = colunas({ x: seg.x, y: inicio, w: seg.w, h: seg.y + seg.h - inicio }, [0.62, 0.38], u * 6);
    if (!c.pilha(esq, blocoPrincipal(c, { tituloMax: u * 8.5, tituloMin: u * 4.6 }), { vertical: "bottom" })) return false;
    return !!c.pilha(dir, c.itensDeInfo(), { vertical: "bottom", alinhamento: "right", espaco: u * 0.8 });
  },
};

const minimalistaImagemIsolada: Variante = {
  id: "minimalista-imagem-isolada",
  familia: "minimalista",
  descricao: "Uma imagem pequena, isolada no alto com muito espaço em volta; título centralizado embaixo dela e informação miúda no pé.",
  requisitos: { imagem: "qualquer" },
  centralizada: true,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    if (prop === "paisagem") {
      const lado = A * 0.5;
      const img = { x: L * 0.22 - lado / 2, y: (A - lado) / 2, w: lado, h: lado };
      imagemNaRegiao(c, img, v, { painel: null, mascara: { tipo: "retangulo", raio: u } });
      const texto = { x: L * 0.44, y: seg.y, w: seg.x + seg.w - L * 0.44, h: seg.h };
      return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 9 }), base: c.itensDeInfo(), marca: true, alinhamento: "center", verticalTopo: "middle" });
    }
    const lado = L * (prop === "vertical" ? 0.46 : 0.34);
    const img = { x: (L - lado) / 2, y: seg.y + A * 0.05, w: lado, h: lado * (v.tipo === "foto" ? 1.2 : 1) };
    imagemNaRegiao(c, img, v, { painel: null, mascara: { tipo: "retangulo", raio: u } });
    const texto = { x: seg.x + seg.w * 0.08, y: img.y + img.h + u * 6, w: seg.w * 0.84, h: seg.y + seg.h - (img.y + img.h + u * 6) };
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 8.5 }), base: c.itensDeInfo(), marca: true, alinhamento: "center" });
  },
};

const minimalistaLinhas: Variante = {
  id: "minimalista-linhas-divisorias",
  familia: "minimalista",
  descricao: "Tipografia organizada por fios finos, como um programa impresso: título no alto e cada informação numa linha própria, com o par (data | horário, local | endereço) nas duas pontas.",
  requisitos: { imagem: "nenhuma" },
  centralizada: false,
  compor(c) {
    const { u, seg, prop } = c.amb;
    const p = c.p;
    const b = c.amb.briefing;
    fundoDaPaleta(c, "liso");
    const pares: [string, string, string, string][] = [
      ["data", b.data, "horario", b.horario],
      ["local", b.local, "endereco", b.endereco],
      ["pregador", b.pregador, "ministerio", b.ministerio],
      ["contato", b.contato, "redes", b.redes],
    ];
    const linhasInfo = pares.filter(([, a, , z]) => a || z);
    if (linhasInfo.length === 0) return false;
    const larg = prop === "paisagem" ? seg.w * 0.72 : seg.w;
    const altoTitulo = seg.h * (prop === "vertical" ? 0.36 : 0.42);
    const tit = c.pilha({ x: seg.x, y: seg.y, w: larg, h: altoTitulo }, [c.itemSobretitulo(), c.itemTitulo(u * 10, u * 5, 3)], { vertical: "top" });
    if (!tit) return false;
    let y = tit.y + tit.h + u * 5;
    const t = c.tamanhos();
    for (const [ca, a, cz, z] of linhasInfo) {
      c.linha(seg.x, y, seg.x + larg, y, p.linha, Math.max(1.5, u * 0.18), { nome: "Fio" });
      y += u * 1.8;
      const alt = u * 5;
      const [esq, dir] = z && a ? colunas({ x: seg.x, y, w: larg, h: alt }, [0.58, 0.42], u * 3) : [{ x: seg.x, y, w: larg, h: alt }, null];
      let usada = 0;
      if (a) {
        const r = c.texto(esq, { papel: ca === "data" ? "data" : "info", nome: ca, campo: ca, texto: a, estilo: ca === "data" ? { ...c.t.info, peso: Math.min(800, c.t.info.peso + 100) } : c.t.info, ...t.info, linhas: 2 });
        if (!r) return false;
        usada = Math.max(usada, r.h);
      }
      if (z) {
        const r = c.texto(dir ?? esq, { papel: "info", nome: cz, campo: cz, texto: z, estilo: c.t.info, ...t.info, linhas: 2 }, { alinhamento: a ? "right" : "left" });
        if (!r) return false;
        usada = Math.max(usada, r.h);
      }
      y += usada + u * 1.8;
    }
    c.linha(seg.x, y, seg.x + larg, y, p.linha, Math.max(1.5, u * 0.18), { nome: "Fio" });
    const resto = { x: seg.x, y: y + u * 4, w: larg, h: seg.y + seg.h - y - u * 4 };
    if (resto.h < 0) return false;
    return coluna(c, resto, { topo: c.itensDeApoio({ informacoes: true }), base: [], marca: true });
  },
};

export const TIPOGRAFICA: Familia = { id: "tipografica", nome: "Tipográfica", variantes: [tipograficaEscalonada, tipograficaPalavraDominante, tipograficaEsquerdaComApoios] };
export const CARTAZ: Familia = { id: "cartaz", nome: "Cartaz", variantes: [cartazDataEmDestaque, cartazNumeroGrande, cartazFaixas] };
export const MINIMALISTA: Familia = { id: "minimalista", nome: "Minimalista", variantes: [minimalistaTituloEElemento, minimalistaImagemIsolada, minimalistaLinhas] };

