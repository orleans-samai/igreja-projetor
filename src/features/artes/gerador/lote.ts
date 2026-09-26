import { analisar, normalizar, type Analise, type Briefing } from "../briefing.ts";
import { categoriaEfetiva, type AjustesDeCategoria, type Categoria } from "../catalogo/categorias.ts";
import { aleatorio } from "../catalogo/formas.ts";
import { ILUSTRACOES, type Ilustracao } from "../catalogo/ilustracoes.ts";
import { PALETAS, luminosidadeDe, paletasDaMarca, temCorParecida, type Paleta } from "../catalogo/paletas.ts";
import { CONJUNTOS, type ConjuntoTipografico } from "../catalogo/tipografia.ts";
import {
  VERSAO_ESQUEMA,
  VERSAO_GERADOR,
  type Assinatura,
  type Camada,
  type Direcao,
  type DocumentoDeArte,
  type FamiliaId,
  type Luminosidade,
  type RecursoUsado,
} from "../documento.ts";
import { acharFormato } from "../formatos.ts";
import { assinar, parecidas } from "./assinatura.ts";
import { Compositor, proporcaoDe, type Ambiente, type Proporcao, type Visual } from "./compositor.ts";
import { conteudoDe } from "./conteudo.ts";
import { FAMILIAS, VERSAO_CATALOGO, acharFamilia, acharVariante, type Familia, type Variante } from "./familias/index.ts";
import { medidorAproximado, type Medidor } from "./texto.ts";
import { validar, type Problema } from "./validar.ts";

/**
 * O gerador de lotes.
 *
 *   briefing → análise → famílias compatíveis → plano do lote → recursos
 *   → composição → ajuste tipográfico → validação → comparação → galeria
 *
 * Nada aqui é inteligência artificial: é tabela, regra e sorteio com
 * semente. A mesma semente com o mesmo briefing, a mesma versão do gerador
 * e o mesmo catálogo dá o mesmo lote, peça por peça — o teste confere.
 *
 * O sorteio nunca escolhe propriedade solta. Ele escolhe entre conjuntos
 * que já combinam: uma variante que aceita o conteúdo, uma paleta da
 * luminosidade que o plano pediu, um conjunto tipográfico preparado para
 * aquela família, imagens do assunto do evento.
 */

export interface PedidoDeLote {
  briefing: Briefing;
  formatoId: string;
  semente: number;
  quantidade?: number;
  /** Assinaturas dos lotes anteriores deste projeto. */
  historico?: Assinatura[];
  ajustes?: AjustesDeCategoria;
  medidor?: Medidor;
  /** Variantes que não podem entrar (regenerar "outra composição"). */
  excluirVariantes?: string[];
  /** Só esta família ("variações desta opção"). */
  somenteFamilia?: FamiliaId;
  /** Parar no meio: o lote devolve o que já montou. */
  deveParar?: () => boolean;
  /** Avisado a cada opção pronta — para a galeria ir mostrando. */
  aoAvancar?: (prontas: number, total: number) => void;
}

export interface ResultadoDoLote {
  opcoes: DocumentoDeArte[];
  /** Por que vieram menos opções que o pedido, em palavras de gente. */
  limitacoes: string[];
  tentativas: number;
  cancelado: boolean;
}

export interface Recursos {
  fotos: Visual[];
  ilustracoes: Ilustracao[];
}

// ─────────────────────────────────────────────── recursos

/**
 * As ilustrações do assunto do evento, da mais pertinente para a menos.
 *
 * Ilustração sem nenhum assunto em comum com a categoria não entra: melhor
 * uma composição só tipográfica do que um livro num culto de jovens.
 */
export function ilustracoesDoAssunto(categoria: Categoria, publico: Briefing["publico"]): Ilustracao[] {
  const pesoDoAssunto = new Map(categoria.assuntos.map((a, i) => [a, categoria.assuntos.length - i]));
  return ILUSTRACOES.map((il) => {
    let nota = 0;
    for (const a of il.assuntos) nota += pesoDoAssunto.get(a) ?? 0;
    if (publico && !il.publico.includes(publico)) nota = 0;
    return { il, nota };
  })
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.il.id.localeCompare(b.il.id))
    .map((x) => x.il);
}

export function recursosDo(b: Briefing, categoria: Categoria): Recursos {
  const fotos: Visual[] = b.fotos.map((foto, indice) => ({ tipo: "foto" as const, id: `usuario:${indice}`, foto, indice }));
  return { fotos, ilustracoes: ilustracoesDoAssunto(categoria, b.publico) };
}

// ─────────────────────────────────────────────── compatibilidade

export function compativel(v: Variante, a: Analise, r: Recursos, prop: Proporcao, b: Briefing): boolean {
  const q = v.requisitos;
  if (q.proporcoes && !q.proporcoes.includes(prop)) return false;
  if (q.imagem === "foto" && r.fotos.length === 0) return false;
  if (q.imagem === "ilustracao" && r.ilustracoes.length === 0) return false;
  if (q.imagem === "qualquer" && r.fotos.length === 0 && r.ilustracoes.length === 0) return false;
  if (q.duasImagens && r.fotos.length + r.ilustracoes.length < 2) return false;
  if (q.diaEMes && !a.dataMarcavel) return false;
  if (q.quando && !b.data && !b.horario) return false;
  if (q.identidade && !b.logo && !b.organizacao) return false;
  if (q.tituloMax && a.caracteresDoTitulo > q.tituloMax) return false;
  if (q.tituloComPalavras && a.palavrasDoTitulo < q.tituloComPalavras) return false;
  return true;
}

function pesoDaFamilia(f: Familia, cat: Categoria, b: Briefing): number {
  let p = cat.familias[f.id] ?? 1;
  const lg = b.preferencias.linguagem;
  const mult: Partial<Record<FamiliaId, number>> =
    lg === "fotografico"
      ? { fotografia: 2.5, capa: 1.5, molduras: 1.5, editorial: 1.3, colagem: 1.2, ilustrada: 0.4 }
      : lg === "ilustrado"
        ? { ilustrada: 2.5, organica: 1.6, colagem: 1.4, fotografia: 0.5 }
        : lg === "tipografico"
          ? { tipografica: 2.5, cartaz: 1.8, minimalista: 1.8, institucional: 1.2, fotografia: 0.3, ilustrada: 0.4, colagem: 0.6 }
          : {};
  p *= mult[f.id] ?? 1;
  const it = b.preferencias.intensidade;
  const mi: Partial<Record<FamiliaId, number>> =
    it === "discreto"
      ? { minimalista: 1.8, institucional: 1.5, editorial: 1.3, molduras: 1.2, cartaz: 0.6, colagem: 0.6, tipografica: 0.8 }
      : it === "expressivo"
        ? { cartaz: 1.6, tipografica: 1.5, colagem: 1.4, geometrica: 1.3, minimalista: 0.6, institucional: 0.6 }
        : {};
  return p * (mi[f.id] ?? 1);
}

// ─────────────────────────────────────────────── sorteio ponderado

function sortearPonderado<T>(itens: T[], peso: (t: T) => number, r: () => number): T | null {
  const ps = itens.map((i) => Math.max(0, peso(i)));
  const total = ps.reduce((a, b) => a + b, 0);
  if (total <= 0) return itens[0] ?? null;
  let alvo = r() * total;
  for (let i = 0; i < itens.length; i++) {
    alvo -= ps[i];
    if (alvo <= 0) return itens[i];
  }
  return itens[itens.length - 1] ?? null;
}

/** Ordem ponderada sem reposição: famílias mais indicadas tendem a vir antes. */
function ordemPonderada<T>(itens: T[], peso: (t: T) => number, r: () => number): T[] {
  const resto = [...itens];
  const saida: T[] = [];
  while (resto.length) {
    const escolhido = sortearPonderado(resto, peso, r)!;
    saida.push(escolhido);
    resto.splice(resto.indexOf(escolhido), 1);
  }
  return saida;
}

// ─────────────────────────────────────────────── paletas e tipografia

export function paletasPermitidas(b: Briefing): Paleta[] {
  const marca = paletasDaMarca(b.coresObrigatorias);
  let lista: Paleta[];
  if (b.coresObrigatorias.length && b.preferencias.identidade === "seguir") {
    lista = [...marca, ...PALETAS.filter((p) => b.coresObrigatorias.some((c) => temCorParecida(p, c)))];
  } else {
    lista = [...marca, ...PALETAS];
  }
  const semProibidas = lista.filter((p) => !b.coresProibidas.some((c) => temCorParecida(p, c)));
  return semProibidas;
}

function notaDaPaleta(p: Paleta, cat: Categoria, b: Briefing): number {
  let n = 1;
  cat.paletas.forEach((tag, i) => {
    if (p.tags.includes(tag)) n += Math.max(0.5, 3 - i * 0.5);
  });
  if (p.daMarca) n += b.preferencias.identidade === "seguir" ? 6 : 2;
  if (b.coresObrigatorias.some((c) => temCorParecida(p, c))) n += 3;
  return n;
}

function notaDaTipografia(t: ConjuntoTipografico, cat: Categoria): number {
  const i = cat.tipografias.indexOf(t.id);
  // Fora da lista da categoria, a tipografia só entra de vez em quando:
  // serifa de convite de casamento num culto infantil é o erro clássico.
  return i >= 0 ? 10 - Math.min(8, i * 1.5) : 0.3;
}

/**
 * A luminosidade de cada opção, na ordem do lote. Misto alterna claro,
 * escuro e meio-tom; claro e escuro ainda deixam uma em cada três no
 * meio-tom, para o lote não parecer uma opção repetida.
 */
export function planoDeLuz(pref: Briefing["preferencias"]["luz"], n: number, publico: Briefing["publico"] = ""): Luminosidade[] {
  // Criança: o lote pende para o claro e o meio-tom, com uma escura só —
  // "misto" continua misto, mas com o jeito do público.
  const misto: Luminosidade[] =
    publico === "criancas" ? ["clara", "media", "clara", "media", "clara", "escura", "clara", "media"] : ["clara", "escura", "media", "escura", "clara", "media", "clara", "escura"];
  const ciclo: Luminosidade[] = pref === "claro" ? ["clara", "clara", "media"] : pref === "escuro" ? ["escura", "escura", "media"] : misto;
  return Array.from({ length: n }, (_, i) => ciclo[i % ciclo.length]);
}

// ─────────────────────────────────────────────── uma opção

export interface Escolhas {
  familia: FamiliaId;
  variante: string;
  paleta: Paleta;
  tipografia: ConjuntoTipografico;
  visuais: Visual[];
  semente: number;
}

export interface Composta {
  camadas: Camada[];
  avisos: string[];
  problemas: Problema[];
  assinatura: Assinatura;
  escolhas: Escolhas;
}

export interface Contexto {
  briefing: Briefing;
  analise: Analise;
  categoria: Categoria;
  L: number;
  A: number;
  prop: Proporcao;
  formatoId: string;
  medidor: Medidor;
  recursos: Recursos;
}

export function contextoDe(briefing: Briefing, formatoId: string, ajustes: AjustesDeCategoria = {}, medidor: Medidor = medidorAproximado): Contexto | null {
  const f = acharFormato(formatoId);
  if (!f) return null;
  const b = normalizar(briefing);
  const categoria = categoriaEfetiva(b.categoria, b.publico, ajustes);
  return {
    briefing: b,
    analise: analisar(b),
    categoria,
    L: f.largura,
    A: f.altura,
    prop: proporcaoDe(f.largura, f.altura),
    formatoId: f.id,
    medidor,
    recursos: recursosDo(b, categoria),
  };
}

export function areaSegura(L: number, A: number, prop: Proporcao): { m: number; seg: { x: number; y: number; w: number; h: number } } {
  const menor = Math.min(L, A);
  const m = menor * (prop === "paisagem" ? 0.055 : 0.065);
  // Stories: o app do celular cobre o topo e o pé da tela com botões.
  const topo = prop === "vertical" ? A * 0.08 : m;
  const pe = prop === "vertical" ? A * 0.09 : m;
  return { m, seg: { x: m, y: topo, w: L - m * 2, h: A - topo - pe } };
}

/** Compõe uma opção com escolhas fechadas. `null` se a variante desistiu. */
export function compor(ctx: Contexto, e: Escolhas, apoios: Ilustracao[]): Composta | null {
  const variante = acharVariante(e.variante);
  if (!variante) return null;
  const { m, seg } = areaSegura(ctx.L, ctx.A, ctx.prop);
  const amb: Ambiente = {
    L: ctx.L,
    A: ctx.A,
    prop: ctx.prop,
    u: Math.min(ctx.L, ctx.A) / 100,
    m,
    seg,
    paleta: e.paleta,
    tipo: e.tipografia,
    categoria: ctx.categoria,
    briefing: ctx.briefing,
    conteudo: conteudoDe(ctx.briefing),
    analise: ctx.analise,
    intensidade: ctx.briefing.preferencias.intensidade,
    visuais: e.visuais,
    apoios,
    r: aleatorio(e.semente),
    medidor: ctx.medidor,
    semente: e.semente,
  };
  const c = new Compositor(amb);
  let ok = false;
  try {
    ok = variante.compor(c);
  } catch {
    ok = false;
  }
  if (!ok) return null;
  const problemas = validar(c.camadas, { L: ctx.L, A: ctx.A, u: amb.u, seg, paleta: e.paleta, briefing: ctx.briefing });
  const assinatura = assinar(c.camadas, ctx.L, ctx.A, variante.familia, variante.id, variante.centralizada, luminosidadeDe(e.paleta));
  return { camadas: c.camadas, avisos: [...new Set(c.avisos)], problemas, assinatura, escolhas: e };
}

// ─────────────────────────────────────────────── documento

const GENERO: Record<FamiliaId, "m" | "f"> = {
  editorial: "m",
  fotografia: "f",
  tipografica: "f",
  colagem: "f",
  geometrica: "f",
  minimalista: "m",
  ilustrada: "f",
  institucional: "m",
  molduras: "f",
  organica: "f",
  cartaz: "m",
  capa: "f",
};

const NOME_CURTO: Record<FamiliaId, string> = {
  editorial: "Editorial",
  fotografia: "Fotografia",
  tipografica: "Tipográfica",
  colagem: "Colagem",
  geometrica: "Geométrica",
  minimalista: "Minimalista",
  ilustrada: "Ilustrada",
  institucional: "Institucional",
  molduras: "Moldura",
  organica: "Orgânica",
  cartaz: "Cartaz",
  capa: "Capa",
};

export function rotuloDe(familia: FamiliaId, luz: Luminosidade, usaIlustracao: boolean): string {
  const g = GENERO[familia];
  if (usaIlustracao && familia !== "ilustrada") return `${NOME_CURTO[familia]} ${g === "m" ? "ilustrado" : "ilustrada"}`;
  const adj = luz === "media" ? "em meio-tom" : luz === "clara" ? (g === "m" ? "claro" : "clara") : g === "m" ? "escuro" : "escura";
  return `${NOME_CURTO[familia]} ${adj}`;
}

function recursosUsados(camadas: Camada[], b: Briefing): RecursoUsado[] {
  const saida = new Map<string, RecursoUsado>();
  const visitar = (lista: Camada[]) => {
    for (const c of lista) {
      if (c.tipo === "grupo") visitar(c.filhos);
      else if (c.tipo === "imagem") {
        if (c.origem === "usuario") saida.set(c.recursoId, { id: c.recursoId, tipo: "foto", origem: "Foto enviada no briefing", licenca: "Da igreja" });
        else {
          const il = ILUSTRACOES.find((i) => i.id === c.recursoId);
          saida.set(c.recursoId, { id: c.recursoId, tipo: "ilustracao", origem: il?.origem ?? "Lúmen", licenca: il?.licenca ?? "Lúmen" });
        }
      } else if (c.tipo === "textura") saida.set(`textura:${c.textura}`, { id: `textura:${c.textura}`, tipo: "textura", origem: "Gerada por código no Lúmen", licenca: "Mesma licença do projeto Lúmen" });
      else if (c.tipo === "logo") saida.set("logo", { id: "logo", tipo: "logo", origem: "Logo da igreja", licenca: "Da igreja" });
    }
  };
  visitar(camadas);
  void b;
  return [...saida.values()].sort((a, z) => a.id.localeCompare(z.id));
}

export function documentoDe(ctx: Contexto, composta: Composta, id: string, nome: string): DocumentoDeArte {
  const e = composta.escolhas;
  const luz = luminosidadeDe(e.paleta);
  const usaIlustracao = composta.assinatura.imagemDominante ? !composta.assinatura.imagemDominante.startsWith("usuario:") : composta.assinatura.recursos.some((r) => !r.startsWith("usuario:"));
  const direcao: Direcao = {
    paletaId: e.paleta.id,
    tipografiaId: e.tipografia.id,
    luminosidade: luz,
    densidade: composta.assinatura.densidade,
    imagens: e.visuais.map((v) => v.id),
  };
  return {
    v: VERSAO_ESQUEMA,
    id,
    nome,
    formatoId: ctx.formatoId,
    largura: ctx.L,
    altura: ctx.A,
    briefing: ctx.briefing,
    semente: e.semente,
    versaoGerador: VERSAO_GERADOR,
    versaoCatalogo: VERSAO_CATALOGO,
    familia: e.familia,
    variante: e.variante,
    rotulo: rotuloDe(e.familia, luz, usaIlustracao && composta.assinatura.pesoDaImagem > 0),
    direcao,
    recursos: recursosUsados(composta.camadas, ctx.briefing),
    camadas: composta.camadas,
    original: structuredClone(composta.camadas),
    assinatura: composta.assinatura,
    exportacao: { formato: "png", qualidade: 0.92 },
    avisos: [...composta.avisos, ...composta.problemas.filter((p) => p.gravidade === "aviso").map((p) => p.texto)],
    criadoEm: 0,
    atualizadoEm: 0,
  };
}

// ─────────────────────────────────────────────── o lote

/**
 * As imagens de uma opção, na ordem em que a variante vai pegá-las.
 *
 * A primeira é a dominante; o lote evita que a mesma seja dominante em
 * mais de duas opções quando há alternativa. Com uma foto só, ela volta —
 * a variedade vem do recorte e do lugar dela na composição, sem fingir que
 * é outra imagem.
 */
function visuaisDaOpcao(ctx: Contexto, dominantes: Map<string, number>, r: () => number, preferirFoto: boolean, exigeFoto: boolean): Visual[] {
  const fotos = [...ctx.recursos.fotos];
  const ilus: Visual[] = ctx.recursos.ilustracoes.slice(0, 10).map((il) => ({ tipo: "ilustracao", id: il.id, il }));
  const uso = (v: Visual) => dominantes.get(v.id) ?? 0;
  const ordenar = (lista: Visual[]) =>
    [...lista].sort((a, b) => {
      const ua = Math.min(uso(a), 2);
      const ub = Math.min(uso(b), 2);
      if (ua !== ub) return ua - ub;
      return 0;
    });
  const f = ordenar(fotos);
  const i = ordenar(ilus);
  // Um pouco de sorteio entre as de mesmo uso, para o lote não andar em fila.
  if (i.length > 2 && r() < 0.5) [i[0], i[1]] = [i[1], i[0]];
  if (exigeFoto) return [...f, ...i];
  // Foto que já dominou duas opções cede a vez, se há desenho do assunto.
  const livres = f.filter((v) => uso(v) < 2);
  if (preferirFoto && livres.length) return [...livres, ...i, ...f.filter((v) => uso(v) >= 2)];
  if (preferirFoto && i.length === 0) return [...f];
  return [...i, ...f];
}

/** Toda foto já foi dominante duas vezes e há alternativa: a vez é do desenho. */
function fotosEsgotadas(ctx: Contexto, dominantes: Map<string, number>): boolean {
  return ctx.recursos.ilustracoes.length > 0 && ctx.recursos.fotos.length > 0 && ctx.recursos.fotos.every((f) => (dominantes.get(f.id) ?? 0) >= 2);
}

/**
 * O lote, uma opção por vez: a cada opção pronta o gerador cede a vez
 * (`yield`), e quem chama decide se continua. É assim que a galeria mostra
 * as opções chegando e que o botão Parar funciona sem travar a tela.
 */
export function* passosDoLote(pedido: PedidoDeLote): Generator<DocumentoDeArte, ResultadoDoLote, void> {
  const ctx = contextoDe(pedido.briefing, pedido.formatoId, pedido.ajustes, pedido.medidor);
  if (!ctx) return { opcoes: [], limitacoes: ["Formato desconhecido."], tentativas: 0, cancelado: false };
  const b = ctx.briefing;
  const n = Math.max(1, pedido.quantidade ?? b.quantidade);
  const r = aleatorio(pedido.semente);
  const historico = pedido.historico ?? [];
  const recentes = new Set(historico.slice(-16).map((h) => h.variante));
  const limitacoes: string[] = [];

  if (!b.titulo) return { opcoes: [], limitacoes: ["Falta o título do evento."], tentativas: 0, cancelado: false };

  const familias = FAMILIAS.filter((f) => (pedido.somenteFamilia ? f.id === pedido.somenteFamilia : true))
    .filter((f) => pesoDaFamilia(f, ctx.categoria, b) > 0)
    .filter((f) => f.variantes.some((v) => compativel(v, ctx.analise, ctx.recursos, ctx.prop, b) && !pedido.excluirVariantes?.includes(v.id)));
  if (familias.length === 0) return { opcoes: [], limitacoes: ["Nenhuma composição do catálogo aceita este conteúdo neste formato."], tentativas: 0, cancelado: false };

  // Famílias em ordem ponderada; famílias do lote anterior pesam menos.
  const usadasAntes = new Set(historico.slice(-8).map((h) => h.familia));
  // Famílias de peso baixo para a categoria (institucional numa festa de
  // criança) ficam no fim da fila: só entram se as outras não fecharem.
  const peso = (f: Familia) => pesoDaFamilia(f, ctx.categoria, b) * (usadasAntes.has(f.id) ? 0.55 : 1);
  const ordem = [
    ...ordemPonderada(familias.filter((f) => pesoDaFamilia(f, ctx.categoria, b) >= 0.6), peso, r),
    ...ordemPonderada(familias.filter((f) => pesoDaFamilia(f, ctx.categoria, b) < 0.6), peso, r),
  ];
  const luzes = planoDeLuz(b.preferencias.luz, n, b.publico);
  const paletas = paletasPermitidas(b);
  if (paletas.length === 0) return { opcoes: [], limitacoes: ["As cores proibidas eliminaram todas as paletas do catálogo."], tentativas: 0, cancelado: false };
  const preferirFoto = ctx.recursos.fotos.length > 0 && b.preferencias.linguagem !== "ilustrado";
  if (b.preferencias.linguagem === "fotografico" && ctx.recursos.fotos.length === 0) {
    limitacoes.push("Não há fotos no briefing: as composições fotográficas ficaram de fora, e entraram tipográficas e ilustradas.");
  }

  const aceitas: Composta[] = [];
  const opcoes: DocumentoDeArte[] = [];
  const variantesUsadas = new Set<string>();
  const paletasUsadas = new Map<string, number>();
  const tiposUsados = new Map<string, number>();
  const dominantes = new Map<string, number>();
  let centralizadas = 0;
  let tentativas = 0;
  const limiteDeTentativas = n * 10;
  let cancelado = false;

  for (let slot = 0; slot < n && tentativas < limiteDeTentativas; slot++) {
    if (pedido.deveParar?.()) {
      cancelado = true;
      break;
    }
    const luzAlvo = luzes[slot];
    // A família da vez; se ela não fechar, as seguintes da ordem.
    const candidatasDeFamilia = [...ordem.slice(slot % ordem.length), ...ordem.slice(0, slot % ordem.length)];
    let aceita: Composta | null = null;
    for (const familia of candidatasDeFamilia) {
      if (aceita || tentativas >= limiteDeTentativas) break;
      const variantes = familia.variantes.filter(
        (v) =>
          compativel(v, ctx.analise, ctx.recursos, ctx.prop, b) &&
          !variantesUsadas.has(v.id) &&
          !pedido.excluirVariantes?.includes(v.id) &&
          !(v.centralizada && centralizadas >= 2) &&
          !(v.requisitos.imagem === "foto" && fotosEsgotadas(ctx, dominantes)),
      );
      const ordemVariantes = ordemPonderada(variantes, (v) => (recentes.has(v.id) ? 0.25 : 1), r);
      for (const variante of ordemVariantes.slice(0, 2)) {
        if (aceita || tentativas >= limiteDeTentativas) break;
        for (let t = 0; t < 2 && !aceita && tentativas < limiteDeTentativas; t++) {
          tentativas += 1;
          const daLuz = paletas.filter((p) => luminosidadeDe(p) === luzAlvo);
          const pool = daLuz.length ? daLuz : paletas;
          const paleta = sortearPonderado(pool, (p) => notaDaPaleta(p, ctx.categoria, b) / (1 + (paletasUsadas.get(p.id) ?? 0) * 4), r)!;
          const tipos = CONJUNTOS.filter((c) => c.familias.includes(familia.id) && ctx.analise.caracteresDoTitulo <= c.tituloMaximo);
          const tipografia = sortearPonderado(tipos.length ? tipos : [...CONJUNTOS], (c) => notaDaTipografia(c, ctx.categoria) / (1 + (tiposUsados.get(c.id) ?? 0) * 3), r)!;
          const visuais =
            variante.requisitos.imagem === "opcional" && b.preferencias.linguagem === "tipografico"
              ? []
              : visuaisDaOpcao(ctx, dominantes, r, preferirFoto, variante.requisitos.imagem === "foto");
          const semente = Math.floor(r() * 2 ** 31) || 1;
          const composta = compor(ctx, { familia: familia.id, variante: variante.id, paleta, tipografia, visuais, semente }, ctx.recursos.ilustracoes);
          if (!composta) continue;
          if (composta.problemas.some((p) => p.gravidade === "erro")) continue;
          if (aceitas.some((a) => parecidas(a.assinatura, composta.assinatura))) continue;
          if (historico.slice(-16).some((h) => parecidas(h, composta.assinatura, 12))) continue;
          aceita = composta;
        }
      }
    }
    if (!aceita) continue;
    aceitas.push(aceita);
    variantesUsadas.add(aceita.escolhas.variante);
    paletasUsadas.set(aceita.escolhas.paleta.id, (paletasUsadas.get(aceita.escolhas.paleta.id) ?? 0) + 1);
    tiposUsados.set(aceita.escolhas.tipografia.id, (tiposUsados.get(aceita.escolhas.tipografia.id) ?? 0) + 1);
    if (aceita.assinatura.imagemDominante) dominantes.set(aceita.assinatura.imagemDominante, (dominantes.get(aceita.assinatura.imagemDominante) ?? 0) + 1);
    if (aceita.assinatura.centralizada) centralizadas += 1;
    const doc = documentoDe(ctx, aceita, `arte-${pedido.semente}-${aceitas.length - 1}`, b.titulo);
    opcoes.push(doc);
    pedido.aoAvancar?.(aceitas.length, n);
    yield doc;
  }

  if (!cancelado && aceitas.length < n) {
    limitacoes.push(
      `Com este conteúdo e estas restrições deu para montar ${aceitas.length} ${aceitas.length === 1 ? "opção diferente" : "opções diferentes"} de verdade, não ${n}. ` +
        "Repetir uma composição com outra cor não conta como opção nova. Para mais variedade: acrescente fotos, deixe a luz em “misto” ou encurte o título.",
    );
  }

  return { opcoes, limitacoes, tentativas, cancelado };
}

/** O lote inteiro, de uma vez (testes, regeneração, amostras). */
export function gerarLote(pedido: PedidoDeLote): ResultadoDoLote {
  const passos = passosDoLote(pedido);
  for (;;) {
    const r = passos.next();
    if (r.done) return r.value;
  }
}

/**
 * O lote sem travar a tela: entre uma opção e outra devolve o controle ao
 * navegador, que pinta a galeria e atende o Parar.
 */
export async function gerarLoteAos(pedido: PedidoDeLote, aoReceber?: (doc: DocumentoDeArte) => void): Promise<ResultadoDoLote> {
  const passos = passosDoLote(pedido);
  for (;;) {
    const r = passos.next();
    if (r.done) return r.value;
    aoReceber?.(r.value);
    await new Promise((pronto) => setTimeout(pronto, 0));
  }
}

// ─────────────────────────────────────────────── regenerar e adaptar

/** O briefing com os textos que a pessoa editou nas camadas. */
export function briefingDasCamadas(doc: DocumentoDeArte): Briefing {
  const b = { ...doc.briefing };
  const partes = new Map<string, string[]>();
  const visitar = (lista: Camada[]) => {
    for (const c of lista) {
      if (c.tipo === "grupo") visitar(c.filhos);
      else if (c.tipo === "texto" && c.campo && !c.oculta && !c.campo.includes("+")) {
        const lista2 = partes.get(c.campo) ?? [];
        lista2.push(c.texto);
        partes.set(c.campo, lista2);
      }
    }
  };
  visitar(doc.camadas);
  for (const [campo, textos] of partes) {
    // Título quebrado em várias camadas (linhas escalonadas, palavra
    // dominante) volta a ser uma frase só.
    if (campo in b && typeof (b as Record<string, unknown>)[campo] === "string") (b as Record<string, unknown>)[campo] = textos.join(" ");
  }
  return b;
}

/** Traz de volta, por id, as camadas que a pessoa travou. */
export function preservarTravadas(antigo: DocumentoDeArte, novo: DocumentoDeArte): DocumentoDeArte {
  const travadas = antigo.camadas.filter((c) => c.travada);
  if (!travadas.length) return novo;
  const ids = new Set(travadas.map((c) => c.id));
  const camadas = novo.camadas.map((c) => (ids.has(c.id) ? travadas.find((t) => t.id === c.id)! : c));
  for (const t of travadas) if (!camadas.some((c) => c.id === t.id)) camadas.push(t);
  return { ...novo, camadas };
}

export type TipoDeRegeneracao = "composicao" | "paleta" | "tipografia" | "imagens";

/**
 * Outra versão da mesma arte, mudando só o que foi pedido.
 *
 * Paleta, tipografia e imagens mantêm a família e a variante: é a mesma
 * composição com outra roupa, que é exatamente o que a pessoa pediu. Outra
 * composição sai do gerador de lotes, sem a variante atual.
 */
export function regenerar(
  doc: DocumentoDeArte,
  tipo: TipoDeRegeneracao,
  semente: number,
  o: { ajustes?: AjustesDeCategoria; medidor?: Medidor } = {},
): DocumentoDeArte | null {
  const briefing = briefingDasCamadas(doc);
  if (tipo === "composicao") {
    const lote = gerarLote({ briefing, formatoId: doc.formatoId, semente, quantidade: 1, excluirVariantes: [doc.variante], ajustes: o.ajustes, medidor: o.medidor });
    const novo = lote.opcoes[0];
    return novo ? preservarTravadas(doc, { ...novo, id: doc.id, nome: doc.nome }) : null;
  }
  const ctx = contextoDe(briefing, doc.formatoId, o.ajustes, o.medidor);
  if (!ctx) return null;
  const r = aleatorio(semente);
  const paletas = paletasPermitidas(ctx.briefing);
  const paletaAtual = paletas.find((p) => p.id === doc.direcao.paletaId) ?? paletas[0];
  const tipoAtual = CONJUNTOS.find((c) => c.id === doc.direcao.tipografiaId) ?? CONJUNTOS[0];
  const todos = [...ctx.recursos.fotos, ...ctx.recursos.ilustracoes.map((il) => ({ tipo: "ilustracao" as const, id: il.id, il }))];
  const visuaisAtuais = doc.direcao.imagens.map((id) => todos.find((v) => v.id === id)).filter((v): v is Visual => !!v);
  for (let t = 0; t < 12; t++) {
    const paleta = tipo === "paleta" ? sortearPonderado(paletas.filter((p) => p.id !== paletaAtual.id), (p) => notaDaPaleta(p, ctx.categoria, ctx.briefing), r)! : paletaAtual;
    const tipografia =
      tipo === "tipografia"
        ? sortearPonderado(CONJUNTOS.filter((c) => c.id !== tipoAtual.id && c.familias.includes(doc.familia) && ctx.analise.caracteresDoTitulo <= c.tituloMaximo), (c) => notaDaTipografia(c, ctx.categoria), r) ?? tipoAtual
        : tipoAtual;
    let visuais = visuaisAtuais;
    if (tipo === "imagens") {
      const outros = todos.filter((v) => v.id !== visuaisAtuais[0]?.id);
      const k = Math.floor(r() * Math.max(1, outros.length));
      visuais = outros.length ? [outros[k], ...outros.filter((_, i) => i !== k), ...visuaisAtuais] : visuaisAtuais;
    }
    const composta = compor(ctx, { familia: doc.familia, variante: doc.variante, paleta, tipografia, visuais, semente: doc.semente }, ctx.recursos.ilustracoes);
    if (!composta || composta.problemas.some((p) => p.gravidade === "erro")) continue;
    const novo = documentoDe(ctx, composta, doc.id, doc.nome);
    return preservarTravadas(doc, { ...novo, favorito: doc.favorito });
  }
  return null;
}

/**
 * A mesma opção noutro formato: a família e a variante recompõem para a
 * proporção nova, com a mesma paleta, a mesma tipografia e as mesmas
 * imagens. Não estica e não recorta a arte pronta. Se a variante não
 * couber no formato novo, tenta as irmãs dela na mesma família.
 */
export function adaptar(doc: DocumentoDeArte, formatoId: string, o: { ajustes?: AjustesDeCategoria; medidor?: Medidor } = {}): DocumentoDeArte | null {
  const briefing = briefingDasCamadas(doc);
  const ctx = contextoDe(briefing, formatoId, o.ajustes, o.medidor);
  if (!ctx) return null;
  const paleta = paletasPermitidas(ctx.briefing).find((p) => p.id === doc.direcao.paletaId) ?? PALETAS.find((p) => p.id === doc.direcao.paletaId);
  const tipografia = CONJUNTOS.find((c) => c.id === doc.direcao.tipografiaId);
  if (!paleta || !tipografia) return null;
  const todos = [...ctx.recursos.fotos, ...ctx.recursos.ilustracoes.map((il) => ({ tipo: "ilustracao" as const, id: il.id, il }))];
  const visuais = doc.direcao.imagens.map((id) => todos.find((v) => v.id === id)).filter((v): v is Visual => !!v);
  const familia = acharFamilia(doc.familia);
  const variantes = [familia.variantes.find((v) => v.id === doc.variante)!, ...familia.variantes.filter((v) => v.id !== doc.variante)].filter(Boolean);
  for (const variante of variantes) {
    if (!compativel(variante, ctx.analise, ctx.recursos, ctx.prop, ctx.briefing)) continue;
    const composta = compor(ctx, { familia: doc.familia, variante: variante.id, paleta, tipografia, visuais, semente: doc.semente }, ctx.recursos.ilustracoes);
    if (!composta || composta.problemas.some((p) => p.gravidade === "erro")) continue;
    return documentoDe(ctx, composta, `${doc.id}-${formatoId}`, doc.nome);
  }
  return null;
}

/**
 * Variações de uma opção: a mesma arte em outras paletas e tipografia, e
 * as variantes irmãs da mesma família. Aqui a semelhança é o pedido — a
 * pessoa gostou desta e quer ver ao redor dela —, então a regra de
 * diversidade do lote não vale; só não entra duas vezes a mesma coisa.
 */
export function variacoesDe(doc: DocumentoDeArte, semente: number, o: { ajustes?: AjustesDeCategoria; medidor?: Medidor } = {}): DocumentoDeArte[] {
  const saida: DocumentoDeArte[] = [];
  const vistas = new Set([`${doc.variante}|${doc.direcao.paletaId}|${doc.direcao.tipografiaId}`]);
  const aceitar = (d: DocumentoDeArte | null) => {
    if (!d) return;
    const chave = `${d.variante}|${d.direcao.paletaId}|${d.direcao.tipografiaId}`;
    if (vistas.has(chave)) return;
    vistas.add(chave);
    saida.push(d);
  };
  const tipos: TipoDeRegeneracao[] = ["paleta", "paleta", "tipografia", "paleta", "imagens"];
  tipos.forEach((t, i) => aceitar(regenerar(doc, t, semente + i * 7919, o)));
  const irmas = gerarLote({ briefing: briefingDasCamadas(doc), formatoId: doc.formatoId, semente, quantidade: 3, somenteFamilia: doc.familia, excluirVariantes: [doc.variante], ajustes: o.ajustes, medidor: o.medidor });
  irmas.opcoes.forEach(aceitar);
  return saida.map((d, i) => ({ ...d, id: `${doc.id}-variacao-${i}` }));
}
