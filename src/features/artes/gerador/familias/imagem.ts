import { misturar } from "../../catalogo/cores.ts";
import { bolha, faixaOndulada, fita, papelRasgado } from "../../catalogo/formas.ts";
import { luminosidadeDe } from "../../catalogo/paletas.ts";
import type { CamadaImagem, Protecao } from "../../documento.ts";
import { dentro, protecaoPara, type Compositor, type Ret, type Visual } from "../compositor.ts";
import {
  blocoPrincipal,
  coluna,
  fundoDaPaleta,
  fotoPrincipal,
  ilustracaoPrincipal,
  imagemNaRegiao,
  naArea,
  q,
  segundoVisual,
  visualPrincipal,
  type Familia,
  type Variante,
} from "./comum.ts";

/**
 * Famílias em que a imagem manda: Fotografia, Colagem e Orgânica.
 *
 * Fotografia só entra com foto de verdade — ilustração esticada em tela
 * cheia não é "fotografia dominante", é fundo genérico. A proteção do texto
 * é local e medida: escurece o lado onde o texto está, na força que a luz
 * daquele pedaço da foto pede. Foto que já é escura ali quase não recebe
 * nada. Colagem e Orgânica aceitam foto ou desenho.
 */

// ─────────────────────────────────────────────── B. Fotografia dominante

type Lado = Protecao["lado"];

/** A variação de luz de uma região da foto: baixa = lugar calmo para texto. */
function calma(camada: CamadaImagem, mapa: number[] | undefined, fx0: number, fy0: number, fx1: number, fy1: number): { media: number; variacao: number } {
  if (!mapa || mapa.length !== 64) return { media: 0.5, variacao: 0.05 };
  const valores: number[] = [];
  const rc = camada.recorte;
  for (let yy = 0; yy < 8; yy++) {
    for (let xx = 0; xx < 8; xx++) {
      const sx = (xx + 0.5) / 8;
      const sy = (yy + 0.5) / 8;
      // fração do quadro onde este pedaço da foto aparece
      const qx = (sx - rc.x) / rc.largura;
      const qy = (sy - rc.y) / rc.altura;
      if (qx >= fx0 && qx <= fx1 && qy >= fy0 && qy <= fy1) valores.push(mapa[yy * 8 + xx]);
    }
  }
  if (!valores.length) return { media: 0.5, variacao: 0.05 };
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variacao = valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length;
  return { media, variacao };
}

const fotoAreaReservada: Variante = {
  id: "fotografia-area-reservada",
  familia: "fotografia",
  descricao: "Foto na página inteira; o texto vai para a região mais calma da foto (a de menor variação de luz, longe do ponto focal), com proteção só daquele lado.",
  requisitos: { imagem: "foto" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop } = c.amb;
    const v = fotoPrincipal(c);
    if (!v || v.tipo !== "foto") return false;
    fundoDaPaleta(c, "liso");
    const { camada } = c.visual({ x: 0, y: 0, w: L, h: A }, v);
    const candidatos: { lado: Lado; f: [number, number, number, number] }[] =
      prop === "paisagem"
        ? [{ lado: "esquerda", f: [0, 0, 0.5, 1] }, { lado: "direita", f: [0.5, 0, 1, 1] }, { lado: "baixo", f: [0, 0.55, 1, 1] }]
        : prop === "quadrado"
          ? [{ lado: "baixo", f: [0, 0.5, 1, 1] }, { lado: "cima", f: [0, 0, 1, 0.48] }, { lado: "esquerda", f: [0, 0, 0.55, 1] }]
          : [{ lado: "baixo", f: [0, 0.52, 1, 1] }, { lado: "cima", f: [0, 0, 1, 0.45] }];
    const foco = v.foto.pontoFocal;
    const focoNoQuadro = { x: (foco.x - camada.recorte.x) / camada.recorte.largura, y: (foco.y - camada.recorte.y) / camada.recorte.altura };
    const avaliados = candidatos.map((k) => {
      const m = calma(camada, v.foto.mapaDeLuz, ...k.f);
      const temFoco = focoNoQuadro.x >= k.f[0] && focoNoQuadro.x <= k.f[2] && focoNoQuadro.y >= k.f[1] && focoNoQuadro.y <= k.f[3];
      return { ...k, ...m, nota: m.variacao * 20 + (temFoco ? 1 : 0) };
    });
    const melhor = avaliados.reduce((a, b) => (b.nota < a.nota ? b : a));
    const [fx0, fy0, fx1, fy1] = melhor.f;
    // O platô cobre a zona de texto inteira; depois esmaece rápido. O resto
    // da foto fica como veio.
    const profundidade = melhor.lado === "baixo" ? 1 - fy0 : melhor.lado === "cima" ? fy1 : melhor.lado === "esquerda" ? fx1 : 1 - fx0;
    camada.protecao = protecaoPara(melhor.lado, melhor.media, "#08080a", profundidade + 0.22, profundidade);
    const zona = dentro({ x: Math.max(seg.x, L * fx0 + u * 2), y: Math.max(seg.y, A * fy0 + u * 2), w: 0, h: 0 }, 0);
    zona.w = Math.min(seg.x + seg.w, L * fx1 - u * 2) - zona.x;
    zona.h = Math.min(seg.y + seg.h, A * fy1 - u * 2) - zona.y;
    const al = melhor.lado === "direita" ? "right" : "left";
    return coluna(c, zona, {
      topo: [c.itemSobretitulo(), c.itemTitulo(u * 13, u * 5.5, 3), ...c.itensDeApoio({ versiculo: false }).slice(0, 1)],
      base: c.itensDeInfo(),
      marca: true,
      alinhamento: al,
      verticalTopo: melhor.lado === "baixo" ? "bottom" : "top",
      fracaoDaBase: 0.42,
    });
  },
};

const fotoSuperiorPainel: Variante = {
  id: "fotografia-superior-painel",
  familia: "fotografia",
  descricao: "Foto no alto (à esquerda na paisagem) e painel sólido com todo o texto; uma aba de cor atravessa a divisa com o tema ou a data.",
  requisitos: { imagem: "foto" },
  centralizada: false,
  compor(c) {
    const { u, seg, prop, m } = c.amb;
    const p = c.p;
    const v = fotoPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    const paisagem = prop === "paisagem";
    const corte = paisagem ? 0.56 : prop === "vertical" ? 0.5 : prop === "retrato" ? 0.55 : 0.56;
    const foto = paisagem ? q(c, 0, 0, corte, 1) : q(c, 0, 0, 1, corte);
    c.visual(foto, v);
    const painel = paisagem ? q(c, corte, 0, 1 - corte, 1) : q(c, 0, corte, 1, 1 - corte);
    c.bloco(painel, p.superficie, { papel: "painel", nome: "Painel de texto" });
    const aba = c.itemSobretitulo() ?? c.itensDeInfo({ quandoEmDestaque: true })[0] ?? null;
    let area: Ret = paisagem
      ? { x: painel.x + u * 5, y: seg.y, w: painel.w - u * 5 - m, h: seg.h }
      : { x: seg.x, y: painel.y + u * 5, w: seg.w, h: seg.y + seg.h - painel.y - u * 5 };
    const usarAba = !!aba && !paisagem;
    if (usarAba && aba) {
      const medida = c.medir({ ...aba, max: u * 2.8, min: u * 2.2, estilo: c.t.sobretitulo }, seg.w * 0.7);
      if (medida) {
        const w = medida.largura + u * 5;
        const h = medida.altura + u * 2.6;
        const r = { x: seg.x, y: painel.y - h / 2, w, h };
        c.bloco(r, p.destaque, { papel: "painel", nome: "Aba" });
        c.texto(dentro(r, u * 1.3), { ...aba, max: u * 2.8, min: u * 2.2, estilo: c.t.sobretitulo, cor: p.textoSobreDestaque });
        area = { ...area, y: r.y + r.h + u * 3, h: area.y + area.h - (r.y + r.h + u * 3) };
      }
    }
    return coluna(c, area, {
      topo: [usarAba ? null : c.itemSobretitulo(), c.itemTitulo(u * 11, u * 5, 3), ...c.itensDeApoio({ versiculo: false })],
      base: c.itensDeInfo({ quandoEmDestaque: usarAba ? false : undefined }).filter((i) => !(usarAba && aba && i.texto === aba.texto)),
      marca: true,
      fracaoDaBase: 0.45,
    });
  },
};

const fotoDeslocada: Variante = {
  id: "fotografia-deslocada",
  familia: "fotografia",
  descricao: "Foto deslocada para um canto, sem sangrar dos quatro lados; um bloco sólido de cor avança sobre a quina dela e carrega o título; informação no espaço que sobra.",
  requisitos: { imagem: "foto" },
  centralizada: false,
  compor(c) {
    const { u, prop } = c.amb;
    const p = c.p;
    const v = fotoPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    // Foto num canto, sem sangrar dos quatro lados; bloco sólido avança
    // sobre a quina dela com o título. Informação na coluna sob a foto, à
    // direita do bloco; apoio sob o bloco.
    const g =
      prop === "paisagem"
        ? { foto: q(c, 0.4, 0, 0.6, 0.8), bloco: q(c, 0, 0.26, 0.52, 0.5), info: q(c, 0.56, 0.82, 0.44, 0.18), apoio: q(c, 0, 0.8, 0.52, 0.2) }
        : prop === "vertical"
          ? { foto: q(c, 0.2, 0, 0.8, 0.5), bloco: q(c, 0, 0.4, 0.76, 0.26), info: q(c, 0, 0.7, 1, 0.3), apoio: null }
          : { foto: q(c, 0.3, 0, 0.7, 0.6), bloco: q(c, 0, 0.4, 0.62, 0.32), info: q(c, 0.64, 0.62, 0.36, 0.38), apoio: q(c, 0, 0.74, 0.62, 0.26) };
    c.visual(g.foto, v);
    const corBloco = c.amb.r() < 0.5 ? p.destaque : p.superficie;
    c.bloco(g.bloco, corBloco, { papel: "painel", nome: "Bloco do título" });
    if (!c.pilha(naArea(c, dentro(g.bloco, u * 4)), [c.itemSobretitulo(), c.itemTitulo(u * 10, u * 4.8, 4)], { vertical: "middle" })) return false;
    const info = naArea(c, dentro(g.info, u * 2));
    if (prop === "vertical") return coluna(c, info, { topo: c.itensDeApoio({ versiculo: false }).slice(0, 1), base: c.itensDeInfo(), marca: true, fracaoDaBase: 0.62 });
    if (!coluna(c, info, { topo: [], base: c.itensDeInfo(), marca: true, fracaoDaBase: 1, alinhamento: "left" })) return false;
    if (g.apoio) {
      const apoio = c.itensDeApoio({ versiculo: false }).slice(0, 1);
      if (apoio.length && !c.pilha(naArea(c, dentro(g.apoio, u * 2)), apoio, { vertical: "top" })) return false;
    }
    return true;
  },
};

// ─────────────────────────────────────────────── D. Colagem

/** Um cartão de colagem: papel, imagem e fita, girados juntos. */
function cartao(c: Compositor, r: Ret, v: Visual, graus: number, estilo: "polaroide" | "recorte"): boolean {
  const u = c.amb.u;
  const p = c.p;
  const papel = luminosidadeDe(p) === "escura" ? misturar(p.texto, p.fundo, 0.08) : "#fbfaf6";
  return c.grupo(estilo === "polaroide" ? "Cartão com imagem" : "Recorte", graus, () => {
    c.bloco(r, papel, { papel: "painel", nome: "Papel", raio: u * 0.3 });
    const borda = estilo === "polaroide" ? { l: u * 2, t: u * 2, b: u * 7 } : { l: u * 1.2, t: u * 1.2, b: u * 1.2 };
    const img = { x: r.x + borda.l, y: r.y + borda.t, w: r.w - borda.l * 2, h: r.h - borda.t - borda.b };
    imagemNaRegiao(c, img, v, { painel: v.tipo === "ilustracao" ? p.fundo2 : undefined, respiro: Math.min(img.w, img.h) * 0.1 });
    const fw = r.w * 0.34;
    const fitaCor = misturar(p.acento, "#ffffff", 0.35);
    c.caminho({ x: r.x + r.w / 2 - fw / 2, y: r.y - u * 1.6, w: fw, h: u * 3.8 }, fita(c.amb.semente + Math.round(graus * 10)), fitaCor, { nome: "Fita adesiva", opacidade: 0.85 });
    return true;
  });
}

const colagemRecortes: Variante = {
  id: "colagem-recortes-sobrepostos",
  familia: "colagem",
  descricao: "Dois ou três recortes de papel sobrepostos e girados, presos com fita, sobre papel texturizado; o texto fica numa área própria, separada dos recortes.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { u, seg, prop } = c.amb;
    const p = c.p;
    const v1 = visualPrincipal(c);
    const v2 = segundoVisual(c);
    if (!v1) return false;
    fundoDaPaleta(c, "liso");
    c.textura({ x: 0, y: 0, w: c.amb.L, h: c.amb.A }, "papel", luminosidadeDe(p) === "escura" ? "#ffffff" : "#5a4a36", 360, 0.22, "Textura de papel");
    const area =
      prop === "paisagem" ? q(c, 0.5, 0.06, 0.46, 0.86) : prop === "quadrado" ? q(c, 0.36, 0.05, 0.6, 0.6) : q(c, 0.07, 0.04, 0.86, prop === "vertical" ? 0.5 : 0.54);
    const principal = { x: area.x + area.w * 0.02, y: area.y + area.h * 0.04, w: area.w * 0.66, h: area.h * 0.84 };
    if (!cartao(c, principal, v1, -4, "polaroide")) return false;
    if (v2) {
      const menor = { x: area.x + area.w * 0.56, y: area.y + area.h * 0.36, w: area.w * 0.42, h: area.h * 0.56 };
      if (!cartao(c, menor, v2, 6, "recorte")) return false;
    }
    const texto =
      prop === "paisagem"
        ? { x: seg.x, y: seg.y, w: area.x - seg.x - u * 5, h: seg.h }
        : prop === "quadrado"
          ? { x: seg.x, y: seg.y + seg.h * 0.1, w: seg.w, h: seg.h * 0.9 }
          : { x: seg.x, y: area.y + area.h + u * 5, w: seg.w, h: seg.y + seg.h - (area.y + area.h + u * 5) };
    if (prop === "quadrado") {
      // o texto contorna os recortes: título à esquerda do alto, info embaixo na largura toda
      const alto = { x: seg.x, y: seg.y, w: area.x - seg.x - u * 4, h: area.y + area.h - seg.y };
      if (!c.pilha(alto, [c.itemSobretitulo(), c.itemTitulo(u * 9, u * 4.8, 5)], { vertical: "top" })) return false;
      const baixo = { x: seg.x, y: area.y + area.h + u * 5, w: seg.w, h: seg.y + seg.h - (area.y + area.h + u * 5) };
      return coluna(c, baixo, { topo: c.itensDeApoio({ versiculo: false }).slice(0, 1), base: c.itensDeInfo(), marca: true, fracaoDaBase: 0.62 });
    }
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
  },
};

const colagemDuasImagens: Variante = {
  id: "colagem-duas-imagens",
  familia: "colagem",
  descricao: "Duas imagens em cartões nas pontas de uma diagonal e um bloco principal de informação entre elas, levemente girado.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { u, prop } = c.amb;
    const p = c.p;
    const v1 = visualPrincipal(c);
    const v2 = segundoVisual(c);
    if (!v1 || !v2) return false;
    fundoDaPaleta(c, "gradiente");
    const g =
      prop === "paisagem"
        ? { a: q(c, 0.04, 0.08, 0.28, 0.62), b: q(c, 0.68, 0.3, 0.28, 0.62), bloco: q(c, 0.33, 0.12, 0.34, 0.76) }
        : prop === "vertical"
          ? { a: q(c, 0.06, 0.05, 0.5, 0.3), b: q(c, 0.46, 0.66, 0.48, 0.28), bloco: q(c, 0.08, 0.33, 0.84, 0.33) }
          : prop === "retrato"
            ? { a: q(c, 0.05, 0.04, 0.5, 0.36), b: q(c, 0.5, 0.64, 0.45, 0.32), bloco: q(c, 0.08, 0.38, 0.84, 0.26) }
            : { a: q(c, 0.05, 0.05, 0.42, 0.44), b: q(c, 0.55, 0.52, 0.4, 0.43), bloco: q(c, 0.1, 0.5, 0.48, 0.44) };
    if (!cartao(c, g.a, v1, -3, "polaroide")) return false;
    if (!cartao(c, g.b, v2, 4, "polaroide")) return false;
    const corBloco = c.amb.r() < 0.5 ? p.superficie : p.destaque;
    const ok = c.grupo("Bloco principal", prop === "paisagem" ? 0 : -1.5, () => {
      c.bloco(g.bloco, corBloco, { papel: "painel", nome: "Bloco principal", raio: u * 0.8 });
      return coluna(c, dentro(g.bloco, u * 3.4), { topo: [c.itemSobretitulo(), c.itemTitulo(u * 9, u * 4.6, 4)], base: c.itensDeInfo(), fracaoDaBase: 0.5 });
    });
    if (!ok) return false;
    // O que sobra do apoio vai para o canto livre, fora do bloco.
    const livre = naArea(c, prop === "paisagem" ? q(c, 0.04, 0.74, 0.28, 0.2) : prop === "quadrado" ? q(c, 0.55, 0.06, 0.4, 0.4) : q(c, 0.6, 0.06, 0.34, 0.28));
    const apoio = c.itensDeApoio({ versiculo: false }).slice(0, 1);
    if (apoio.length && !c.pilha(livre, apoio, { vertical: "top", alinhamento: prop === "paisagem" ? "left" : "right" })) return false;
    const marca = naArea(c, prop === "paisagem" ? q(c, 0.68, 0.06, 0.28, 0.16) : prop === "quadrado" ? q(c, 0.55, 0.36, 0.4, 0.1) : q(c, 0.06, 0.85, 0.36, 0.08));
    c.rodapeDeMarca(marca, "left");
    return true;
  },
};

const colagemPaineis: Variante = {
  id: "colagem-paineis-de-papel",
  familia: "colagem",
  descricao: "Painéis de papel rasgado em camadas, com textura; o grande leva o título, o menor (de outra cor e girado ao contrário) leva a informação, e uma ilustração espia pela borda.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { L, A, u, prop } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "liso");
    c.textura({ x: 0, y: 0, w: L, h: A }, "papel", luminosidadeDe(p) === "escura" ? "#ffffff" : "#4a3b2a", 360, 0.25, "Textura de papel");
    const g =
      prop === "paisagem"
        ? { grande: q(c, 0.05, 0.08, 0.6, 0.6), menor: q(c, 0.52, 0.52, 0.42, 0.38), ilus: q(c, 0.68, 0.06, 0.26, 0.4) }
        : prop === "vertical"
          ? { grande: q(c, 0.06, 0.12, 0.88, 0.42), menor: q(c, 0.14, 0.58, 0.8, 0.26), ilus: q(c, 0.52, 0.02, 0.4, 0.14) }
          : { grande: q(c, 0.06, 0.1, 0.84, 0.5), menor: q(c, 0.26, 0.6, 0.68, 0.3), ilus: q(c, 0.62, 0.0, 0.32, 0.16) };
    const v = ilustracaoPrincipal(c) ?? visualPrincipal(c);
    if (v && v.tipo === "ilustracao") c.visual(g.ilus, v, { alinhar: { x: 0.5, y: 1 } });
    const ok1 = c.grupo("Painel do título", -1.8, () => {
      c.caminho(g.grande, papelRasgado(c.amb.semente), p.superficie, { papel: "painel", nome: "Papel rasgado" });
      return !!c.pilha(naArea(c, dentro(g.grande, u * 4.5)), blocoPrincipal(c, { tituloMax: u * 11, versiculo: false }), { vertical: "middle" });
    });
    if (!ok1) return false;
    const ok2 = c.grupo("Painel da informação", 2.2, () => {
      c.caminho(g.menor, papelRasgado(c.amb.semente + 7), c.corDiferenteDe(p.superficie), { papel: "painel", nome: "Papel rasgado" });
      return coluna(c, naArea(c, dentro(g.menor, u * 3.6)), { topo: [], base: c.itensDeInfo(), fracaoDaBase: 1 });
    });
    if (!ok2) return false;
    const marca = naArea(c, prop === "paisagem" ? q(c, 0.05, 0.76, 0.4, 0.14) : q(c, 0.06, prop === "vertical" ? 0.85 : 0.88, 0.5, 0.08));
    c.rodapeDeMarca(marca, "left");
    return true;
  },
};

// ─────────────────────────────────────────────── J. Orgânica

const organicaImagemRecortada: Variante = {
  id: "organica-imagem-recortada",
  familia: "organica",
  descricao: "Imagem recortada numa forma orgânica, com duas manchas suaves atrás; o texto ocupa a área limpa do lado oposto.",
  requisitos: { imagem: "qualquer" },
  centralizada: false,
  compor(c) {
    const { u, seg, prop, semente } = c.amb;
    const p = c.p;
    const v = visualPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    const forma =
      prop === "paisagem" ? q(c, 0.5, 0.08, 0.46, 0.84) : prop === "quadrado" ? q(c, 0.42, 0.05, 0.54, 0.6) : q(c, 0.1, 0.04, 0.84, prop === "vertical" ? 0.46 : 0.5);
    c.caminho({ x: forma.x - forma.w * 0.08, y: forma.y + forma.h * 0.1, w: forma.w * 0.9, h: forma.h * 0.95 }, bolha(semente + 3, 6, 0.2), p.acento, { opacidade: 0.45, nome: "Mancha" });
    c.caminho({ x: forma.x + forma.w * 0.3, y: forma.y - forma.h * 0.04, w: forma.w * 0.75, h: forma.h * 0.6 }, bolha(semente + 11, 5, 0.25), p.fundo2, { opacidade: 0.9, nome: "Mancha" });
    imagemNaRegiao(c, forma, v, { mascara: { tipo: "caminho", d: bolha(semente, 7, 0.14) }, painel: p.superficie });
    const texto =
      prop === "paisagem"
        ? { x: seg.x, y: seg.y, w: forma.x - seg.x - u * 5, h: seg.h }
        : prop === "quadrado"
          ? { x: seg.x, y: seg.y, w: seg.w * 0.5, h: seg.h }
          : { x: seg.x, y: forma.y + forma.h + u * 5, w: seg.w, h: seg.y + seg.h - (forma.y + forma.h + u * 5) };
    if (prop === "quadrado") {
      if (!c.pilha({ x: seg.x, y: forma.y + forma.h * 0.65, w: forma.x - seg.x - u * 2, h: seg.h * 0.2 }, [c.itemSobretitulo()], { vertical: "top" })) return false;
      const baixo = { x: seg.x, y: forma.y + forma.h + u * 4, w: seg.w, h: seg.y + seg.h - (forma.y + forma.h + u * 4) };
      const alto = { x: seg.x, y: seg.y, w: forma.x - seg.x - u * 3, h: forma.y + forma.h * 0.6 - seg.y };
      if (!c.pilha(alto, [c.itemTitulo(u * 9, u * 4.8, 5)], { vertical: "top" })) return false;
      return coluna(c, baixo, { topo: c.itensDeApoio({ versiculo: false }).slice(0, 1), base: c.itensDeInfo(), marca: true, fracaoDaBase: 0.62 });
    }
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
  },
};

const organicaIlustracaoSobreForma: Variante = {
  id: "organica-ilustracao-sobre-forma",
  familia: "organica",
  descricao: "Uma grande forma orgânica sangrando pelo canto, com a ilustração apoiada nela; texto na área limpa, sem nada por trás.",
  requisitos: { imagem: "ilustracao" },
  centralizada: false,
  compor(c) {
    const { u, seg, prop, semente } = c.amb;
    const p = c.p;
    const v = ilustracaoPrincipal(c);
    if (!v) return false;
    fundoDaPaleta(c, "liso");
    const forma =
      prop === "paisagem" ? q(c, 0.5, 0.12, 0.58, 1.0) : prop === "vertical" ? q(c, 0.12, 0.58, 1.0, 0.5) : q(c, 0.36, 0.42, 0.74, 0.7);
    c.caminho(forma, bolha(semente + 5, 8, 0.12), p.superficie, { papel: "painel", nome: "Forma orgânica" });
    const ilus = prop === "paisagem" ? q(c, 0.56, 0.2, 0.38, 0.56) : prop === "vertical" ? q(c, 0.24, 0.6, 0.66, 0.26) : q(c, 0.46, 0.46, 0.48, 0.38);
    c.visual(ilus, v, { alinhar: { x: 0.5, y: 1 }, sobreClaro: false });
    const texto =
      prop === "paisagem"
        ? { x: seg.x, y: seg.y, w: forma.x - seg.x - u * 4, h: seg.h }
        : prop === "vertical"
          ? { x: seg.x, y: seg.y, w: seg.w, h: forma.y - seg.y - u * 4 }
          : { x: seg.x, y: seg.y, w: seg.w * 0.62, h: forma.y + forma.h * 0.1 - seg.y };
    if (prop === "quadrado" || prop === "retrato") {
      if (!c.pilha(texto, blocoPrincipal(c, { tituloMax: u * 10, versiculo: false }), { vertical: "top" })) return false;
      const pe = { x: seg.x, y: forma.y + u * 6, w: forma.x - seg.x - u * 3, h: seg.y + seg.h - forma.y - u * 6 };
      return coluna(c, pe, { topo: [], base: c.itensDeInfo(), marca: true, fracaoDaBase: 1 });
    }
    return coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 11 }), base: c.itensDeInfo(), marca: true });
  },
};

const organicaCamadasSuaves: Variante = {
  id: "organica-camadas-suaves",
  familia: "organica",
  descricao: "Três faixas onduladas empilhadas no pé, em tons da paleta; título assimétrico no alto à esquerda e a informação sobre a faixa mais funda.",
  requisitos: { imagem: "opcional" },
  centralizada: false,
  compor(c) {
    const { L, A, u, seg, prop, semente } = c.amb;
    const p = c.p;
    fundoDaPaleta(c, "gradiente");
    // As faixas ficam no pé, como terreno; o texto mora acima delas, e só
    // a assinatura da igreja pousa na faixa mais funda — na parte cheia
    // dela, abaixo da onda.
    const alturaFaixas = A * (prop === "paisagem" ? 0.34 : prop === "vertical" ? 0.24 : 0.3);
    const topoFaixas = A - alturaFaixas;
    c.caminho({ x: 0, y: topoFaixas, w: L, h: alturaFaixas * 0.6 }, faixaOndulada(semente, 1.5, 0.22), p.fundo2, { nome: "Faixa ondulada" });
    c.caminho({ x: 0, y: topoFaixas + alturaFaixas * 0.22, w: L, h: alturaFaixas * 0.55 }, faixaOndulada(semente + 1, 2, 0.2), misturar(p.acento, p.fundo, 0.35), { nome: "Faixa ondulada" });
    const ultima = { x: 0, y: topoFaixas + alturaFaixas * 0.4, w: L, h: alturaFaixas * 0.6 };
    c.caminho(ultima, faixaOndulada(semente + 2, 1.2, 0.12), p.superficie, { papel: "painel", nome: "Faixa ondulada" });
    const v = ilustracaoPrincipal(c);
    const comDesenho = !!v && prop !== "vertical";
    if (v && comDesenho) c.visual({ x: L * 0.64, y: topoFaixas - A * 0.22, w: L * 0.3, h: A * 0.26 }, v, { alinhar: { x: 0.5, y: 1 } });
    const texto = { x: seg.x, y: seg.y, w: seg.w * (comDesenho ? 0.58 : 0.86), h: topoFaixas - seg.y - u * 3 };
    if (!coluna(c, texto, { topo: blocoPrincipal(c, { tituloMax: u * 12, versiculo: false }), base: c.itensDeInfo(), marca: false, fracaoDaBase: 0.45 })) return false;
    const solido = { x: seg.x, y: ultima.y + ultima.h * 0.66, w: seg.w, h: Math.min(seg.y + seg.h, A - u * 2) - (ultima.y + ultima.h * 0.66) };
    if (solido.h > u * 4) c.rodapeDeMarca(solido, "right");
    return true;
  },
};

export const FOTOGRAFIA: Familia = { id: "fotografia", nome: "Fotografia", variantes: [fotoAreaReservada, fotoSuperiorPainel, fotoDeslocada] };
export const COLAGEM: Familia = { id: "colagem", nome: "Colagem", variantes: [colagemRecortes, colagemDuasImagens, colagemPaineis] };
export const ORGANICA: Familia = { id: "organica", nome: "Orgânica", variantes: [organicaImagemRecortada, organicaIlustracaoSobreForma, organicaCamadasSuaves] };

