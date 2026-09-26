import type { FamiliaId } from "../documento.ts";
import type { PreferenciaDeIntensidade, PublicoId } from "../briefing.ts";

/**
 * Tabela explícita: tipo de evento → recursos visuais.
 *
 * Nada aqui é adivinhado a partir do texto. "Escola Bíblica" puxa livro,
 * caderno e estudo em grupo porque está escrito nesta tabela — e a igreja
 * pode mudar a tabela (ver `AjusteDeCategoria`), porque quem sabe que o
 * encontro de casais deles é na praia são eles.
 *
 * Os pesos das famílias vão de 0 (nunca) a 3 (primeira escolha). Nenhuma
 * categoria religiosa recebe cruz, raio de luz ou fundo preto por padrão:
 * isso só entra onde o assunto pede (vigília, Páscoa), e mesmo lá divide
 * espaço com o resto.
 */

export interface Categoria {
  id: string;
  nome: string;
  publicoPadrao: PublicoId;
  /** Assuntos que escolhem ilustração, textura e ícone. */
  assuntos: string[];
  /** Tags de paleta preferidas. */
  paletas: string[];
  /** Conjuntos tipográficos preferidos. */
  tipografias: string[];
  familias: Record<FamiliaId, number>;
  intensidade: PreferenciaDeIntensidade;
}

const pesos = (p: Partial<Record<FamiliaId, number>>, base = 1): Record<FamiliaId, number> => ({
  editorial: base,
  fotografia: base,
  tipografica: base,
  colagem: base,
  geometrica: base,
  minimalista: base,
  ilustrada: base,
  institucional: base,
  molduras: base,
  organica: base,
  cartaz: base,
  capa: base,
  ...p,
});

export const CATEGORIAS: readonly Categoria[] = [
  {
    id: "culto",
    nome: "Culto",
    publicoPadrao: "todos",
    assuntos: ["comunhao", "igreja", "musica", "natureza", "luz"],
    paletas: ["sobrio", "caloroso", "editorial", "natureza"],
    tipografias: ["fraunces-suave", "classico-editorial", "serifa-display", "institucional"],
    familias: pesos({ editorial: 2, capa: 2, fotografia: 2, minimalista: 2, molduras: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "culto-domingo",
    nome: "Culto de domingo",
    publicoPadrao: "todos",
    assuntos: ["comunhao", "igreja", "familia", "natureza"],
    paletas: ["caloroso", "sobrio", "fresco"],
    tipografias: ["fraunces-suave", "institucional", "classico-editorial"],
    familias: pesos({ editorial: 2, institucional: 2, fotografia: 2, capa: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "escola-biblica",
    nome: "Escola Bíblica",
    publicoPadrao: "adultos",
    assuntos: ["estudo", "livro", "biblia", "anotacao", "conhecimento", "grupo", "conversa", "aprendizado"],
    paletas: ["ensino", "editorial", "sobrio", "natureza"],
    tipografias: ["livro", "fraunces-suave", "classico-editorial", "institucional", "minimal-mono"],
    familias: pesos({ editorial: 3, capa: 3, ilustrada: 3, colagem: 2, minimalista: 2, molduras: 2, fotografia: 2, organica: 1, geometrica: 1, institucional: 1 }),
    intensidade: "equilibrado",
  },
  {
    id: "celula",
    nome: "Célula",
    publicoPadrao: "todos",
    assuntos: ["grupo", "conversa", "casa", "cafe", "comunhao", "estudo"],
    paletas: ["caloroso", "suave", "natureza"],
    tipografias: ["fraunces-suave", "manuscrito", "grotesca-leve"],
    familias: pesos({ ilustrada: 3, organica: 3, editorial: 2, colagem: 2, molduras: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "culto-jovens",
    nome: "Culto de jovens",
    publicoPadrao: "jovens",
    assuntos: ["juventude", "energia", "musica", "cidade", "noite", "celebracao"],
    paletas: ["jovem", "vibrante", "noturno", "cartaz"],
    tipografias: ["cartaz-condensado", "cartaz-pesado", "grotesca-jovem", "fraunces-cheia", "minimal-mono"],
    familias: pesos({ cartaz: 3, tipografica: 3, colagem: 3, geometrica: 3, fotografia: 2, institucional: 0.4, molduras: 0.7 }),
    intensidade: "expressivo",
  },
  {
    id: "encontro-jovens",
    nome: "Encontro de jovens",
    publicoPadrao: "jovens",
    assuntos: ["juventude", "energia", "grupo", "celebracao", "musica", "natureza"],
    paletas: ["jovem", "vibrante", "fresco", "festivo"],
    tipografias: ["grotesca-jovem", "cartaz-condensado", "fraunces-cheia", "cartaz-pesado"],
    familias: pesos({ cartaz: 3, tipografica: 3, colagem: 3, geometrica: 2, organica: 2, fotografia: 2, institucional: 0.4 }),
    intensidade: "expressivo",
  },
  {
    id: "culto-infantil",
    nome: "Culto infantil",
    publicoPadrao: "criancas",
    assuntos: ["crianca", "brincar", "aprendizado", "celebracao", "natureza", "livro"],
    paletas: ["infantil", "festivo", "fresco"],
    tipografias: ["infantil", "manuscrito", "fraunces-cheia"],
    familias: pesos({ ilustrada: 3, organica: 3, geometrica: 2, colagem: 2, molduras: 2, cartaz: 1, institucional: 0.2, editorial: 0.5, capa: 0.5, minimalista: 0.4 }),
    intensidade: "expressivo",
  },
  {
    id: "gratidao",
    nome: "Culto de gratidão",
    publicoPadrao: "todos",
    assuntos: ["gratidao", "colheita", "natureza", "familia", "celebracao"],
    paletas: ["gratidao", "caloroso", "natureza", "suave"],
    tipografias: ["classico-editorial", "fraunces-suave", "manuscrito", "serifa-display", "playfair-italico"],
    familias: pesos({ organica: 3, editorial: 2, molduras: 2, capa: 2, ilustrada: 2, fotografia: 2, minimalista: 2, institucional: 0.5 }),
    intensidade: "equilibrado",
  },
  {
    id: "institucional",
    nome: "Evento institucional",
    publicoPadrao: "adultos",
    assuntos: ["institucional", "lideranca", "igreja", "calendario", "conversa"],
    paletas: ["institucional", "sobrio", "editorial"],
    tipografias: ["institucional", "livro", "minimal-mono", "classico-editorial"],
    familias: pesos({ institucional: 3, editorial: 3, minimalista: 2, geometrica: 2, capa: 2, fotografia: 2, colagem: 0.5, organica: 0.5, ilustrada: 0.5 }),
    intensidade: "discreto",
  },
  {
    id: "conferencia",
    nome: "Conferência",
    publicoPadrao: "adultos",
    assuntos: ["conhecimento", "grupo", "igreja", "musica", "lideranca"],
    paletas: ["editorial", "vibrante", "institucional", "noturno"],
    tipografias: ["cartaz-condensado", "serifa-display", "institucional", "grotesca-jovem"],
    familias: pesos({ cartaz: 3, capa: 3, editorial: 2, fotografia: 2, geometrica: 2, tipografica: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "congresso",
    nome: "Congresso",
    publicoPadrao: "todos",
    assuntos: ["grupo", "celebracao", "musica", "igreja", "conhecimento"],
    paletas: ["vibrante", "festivo", "editorial"],
    tipografias: ["cartaz-condensado", "cartaz-pesado", "grotesca-jovem", "serifa-display"],
    familias: pesos({ cartaz: 3, tipografica: 2, geometrica: 2, capa: 2, fotografia: 2, colagem: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "campanha",
    nome: "Campanha",
    publicoPadrao: "todos",
    assuntos: ["oracao", "comunhao", "calendario", "luz"],
    paletas: ["sobrio", "vibrante", "cartaz"],
    tipografias: ["cartaz-condensado", "institucional", "serifa-display"],
    familias: pesos({ cartaz: 3, tipografica: 3, geometrica: 2, minimalista: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "vigilia",
    nome: "Vigília",
    publicoPadrao: "todos",
    assuntos: ["oracao", "noite", "luz"],
    paletas: ["noturno", "sobrio", "vigilia"],
    tipografias: ["serifa-display", "classico-editorial", "cartaz-condensado"],
    familias: pesos({ minimalista: 3, tipografica: 2, capa: 2, fotografia: 2, geometrica: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "santa-ceia",
    nome: "Santa Ceia",
    publicoPadrao: "todos",
    assuntos: ["ceia", "pao", "calice", "comunhao", "colheita"],
    paletas: ["ceia", "caloroso", "sobrio"],
    tipografias: ["classico-editorial", "serifa-display", "livro"],
    familias: pesos({ minimalista: 3, molduras: 3, editorial: 2, capa: 2, ilustrada: 2, cartaz: 0.5 }),
    intensidade: "discreto",
  },
  {
    id: "culto-mulheres",
    nome: "Culto de mulheres",
    publicoPadrao: "mulheres",
    assuntos: ["natureza", "comunhao", "celebracao", "conversa"],
    paletas: ["mulheres", "suave", "caloroso"],
    tipografias: ["playfair-italico", "classico-editorial", "grotesca-leve", "manuscrito"],
    familias: pesos({ organica: 3, molduras: 3, capa: 2, editorial: 2, fotografia: 2, minimalista: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "culto-homens",
    nome: "Culto de homens",
    publicoPadrao: "homens",
    assuntos: ["comunhao", "conversa", "cafe", "natureza"],
    paletas: ["sobrio", "natureza", "institucional"],
    tipografias: ["cartaz-condensado", "institucional", "serifa-display"],
    familias: pesos({ cartaz: 2, geometrica: 2, editorial: 2, fotografia: 2, tipografica: 2, organica: 0.5 }),
    intensidade: "equilibrado",
  },
  {
    id: "encontro-casais",
    nome: "Encontro de casais",
    publicoPadrao: "adultos",
    assuntos: ["casal", "familia", "conversa", "cafe", "natureza"],
    paletas: ["casais", "caloroso", "suave"],
    tipografias: ["playfair-italico", "serifa-display", "fraunces-suave"],
    familias: pesos({ molduras: 3, capa: 2, organica: 2, editorial: 2, fotografia: 3, colagem: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "batismo",
    nome: "Batismo",
    publicoPadrao: "todos",
    assuntos: ["agua", "natureza", "celebracao", "familia"],
    paletas: ["batismo", "fresco", "natureza"],
    tipografias: ["classico-editorial", "fraunces-suave", "grotesca-leve"],
    familias: pesos({ organica: 3, minimalista: 2, fotografia: 2, capa: 2, geometrica: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "casamento",
    nome: "Casamento",
    publicoPadrao: "todos",
    assuntos: ["casal", "celebracao", "natureza"],
    paletas: ["casais", "suave", "editorial"],
    tipografias: ["playfair-italico", "classico-editorial", "serifa-display"],
    familias: pesos({ molduras: 3, minimalista: 3, capa: 2, organica: 2, fotografia: 2, cartaz: 0.3 }),
    intensidade: "discreto",
  },
  {
    id: "aniversario-igreja",
    nome: "Aniversário da igreja",
    publicoPadrao: "todos",
    assuntos: ["igreja", "celebracao", "gratidao", "calendario"],
    paletas: ["festivo", "caloroso", "vibrante"],
    tipografias: ["fraunces-cheia", "serifa-display", "cartaz-condensado"],
    familias: pesos({ cartaz: 3, tipografica: 2, capa: 2, geometrica: 2, colagem: 2, institucional: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "natal",
    nome: "Natal",
    publicoPadrao: "todos",
    assuntos: ["natal", "celebracao", "familia", "luz"],
    paletas: ["festivo", "caloroso", "natureza"],
    tipografias: ["classico-editorial", "fraunces-cheia", "manuscrito", "serifa-display"],
    familias: pesos({ ilustrada: 3, capa: 2, organica: 2, molduras: 2, cartaz: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "pascoa",
    nome: "Páscoa",
    publicoPadrao: "todos",
    assuntos: ["pascoa", "natureza", "luz", "celebracao"],
    paletas: ["caloroso", "suave", "natureza", "festivo"],
    tipografias: ["serifa-display", "classico-editorial", "fraunces-suave"],
    familias: pesos({ capa: 3, organica: 2, minimalista: 2, ilustrada: 2, fotografia: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "evento-musical",
    nome: "Evento musical",
    publicoPadrao: "todos",
    assuntos: ["musica", "celebracao", "noite", "energia"],
    paletas: ["vibrante", "noturno", "jovem"],
    tipografias: ["cartaz-condensado", "cartaz-pesado", "grotesca-jovem", "serifa-display"],
    familias: pesos({ cartaz: 3, tipografica: 3, geometrica: 2, fotografia: 3, colagem: 2 }),
    intensidade: "expressivo",
  },
  {
    id: "aviso",
    nome: "Aviso",
    publicoPadrao: "todos",
    assuntos: ["calendario", "igreja", "conversa"],
    paletas: ["institucional", "sobrio", "fresco"],
    tipografias: ["institucional", "minimal-mono", "fraunces-suave"],
    familias: pesos({ institucional: 3, minimalista: 3, editorial: 2, geometrica: 2, tipografica: 2, fotografia: 0.5 }),
    intensidade: "discreto",
  },
  {
    id: "convite",
    nome: "Convite",
    publicoPadrao: "todos",
    assuntos: ["celebracao", "comunhao", "familia"],
    paletas: ["caloroso", "editorial", "suave"],
    tipografias: ["classico-editorial", "playfair-italico", "fraunces-suave"],
    familias: pesos({ molduras: 3, capa: 2, editorial: 2, minimalista: 2, organica: 2 }),
    intensidade: "equilibrado",
  },
  {
    id: "publicacao-livre",
    nome: "Publicação livre",
    publicoPadrao: "todos",
    assuntos: ["natureza", "comunhao", "conhecimento"],
    paletas: ["editorial", "fresco", "caloroso"],
    tipografias: ["fraunces-suave", "institucional", "grotesca-leve"],
    familias: pesos({}),
    intensidade: "equilibrado",
  },
];

/**
 * O que a igreja mudou na tabela, por categoria. Fica guardado junto das
 * artes; a tabela de fábrica nunca é alterada.
 */
export interface AjusteDeCategoria {
  familiasDesligadas?: FamiliaId[];
  assuntosExtras?: string[];
  assuntosRemovidos?: string[];
  paletasExtras?: string[];
  tipografiasExtras?: string[];
}

export type AjustesDeCategoria = Record<string, AjusteDeCategoria>;

export function acharCategoria(id: string): Categoria {
  return CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS.find((c) => c.id === "publicacao-livre")!;
}

/**
 * A categoria como vale agora: a de fábrica com o ajuste da igreja e com o
 * público do briefing puxando para o lado certo. Escola Bíblica para
 * crianças é Escola Bíblica — com a cara de culto infantil.
 */
export function categoriaEfetiva(id: string, publico: PublicoId, ajustes: AjustesDeCategoria = {}): Categoria {
  const base = acharCategoria(id);
  const aj = ajustes[base.id] ?? {};
  const familias = { ...base.familias };
  let assuntos = [...base.assuntos];
  let paletas = [...base.paletas];
  let tipografias = [...base.tipografias];
  let intensidade = base.intensidade;

  if (publico === "criancas") {
    familias.ilustrada = Math.max(familias.ilustrada, 3);
    familias.organica = Math.max(familias.organica, 2.5);
    familias.institucional = Math.min(familias.institucional, 0.3);
    familias.minimalista = Math.min(familias.minimalista, 0.6);
    assuntos = [...new Set(["crianca", "brincar", "aprendizado", ...assuntos])];
    paletas = [...new Set(["infantil", "festivo", "fresco", ...paletas])];
    tipografias = [...new Set(["infantil", "manuscrito", ...tipografias])];
    intensidade = "expressivo";
  } else if (publico === "jovens" || publico === "adolescentes") {
    familias.cartaz = Math.max(familias.cartaz, 2.5);
    familias.tipografica = Math.max(familias.tipografica, 2.5);
    familias.colagem = Math.max(familias.colagem, 2);
    assuntos = [...new Set([...assuntos, "juventude", "energia"])];
    paletas = [...new Set(["jovem", ...paletas])];
    tipografias = [...new Set([...tipografias, "grotesca-jovem", "cartaz-condensado"])];
  } else if (publico === "mulheres") {
    paletas = [...new Set(["mulheres", ...paletas])];
  } else if (publico === "lideranca") {
    familias.institucional = Math.max(familias.institucional, 2.5);
  }

  for (const f of aj.familiasDesligadas ?? []) familias[f] = 0;
  assuntos = [...new Set([...assuntos, ...(aj.assuntosExtras ?? [])])].filter((a) => !(aj.assuntosRemovidos ?? []).includes(a));
  paletas = [...new Set([...(aj.paletasExtras ?? []), ...paletas])];
  tipografias = [...new Set([...(aj.tipografiasExtras ?? []), ...tipografias])];
  return { ...base, familias, assuntos, paletas, tipografias, intensidade };
}
