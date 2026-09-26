/**
 * Onde fica cada parte da tela da Bíblia.
 *
 * São três partes — os versículos do capítulo, a prévia com o Projetar e o
 * mosaico de livros, capítulos e versículos — em dois lugares de coluna:
 * uma coluna com duas partes empilhadas e outra com uma parte só. Arrastar
 * uma parte sobre outra troca as duas (o mesmo gesto das colunas da cabine),
 * e "Trocar lados" passa a coluna dupla para o outro lado. Com os dois, dá
 * para montar qualquer disposição das três.
 *
 * Como a ordem das colunas, é do operador: quem clica o livro com a mão
 * esquerda quer o mosaico na esquerda.
 */

export type ParteDaBiblia = "versiculos" | "previa" | "navegacao";

export interface ArranjoDaBiblia {
  /** [em cima na coluna dupla, embaixo na coluna dupla, a coluna sozinha]. */
  lugares: [ParteDaBiblia, ParteDaBiblia, ParteDaBiblia];
  duplaNa: "esquerda" | "direita";
}

export const PARTES_DA_BIBLIA: readonly ParteDaBiblia[] = ["versiculos", "previa", "navegacao"];

export const ARRANJO_PADRAO: ArranjoDaBiblia = {
  lugares: ["versiculos", "previa", "navegacao"],
  duplaNa: "esquerda",
};

export const NOME_DA_PARTE: Record<ParteDaBiblia, string> = {
  versiculos: "Versículos",
  previa: "Prévia",
  navegacao: "Livros e capítulos",
};

/**
 * Conserta o arranjo guardado — veio do disco, talvez de outra versão do
 * app. Parte repetida, desconhecida ou faltando viraria uma parte duas vezes
 * na tela ou uma parte sumida sem caminho de volta; em todos os casos sai um
 * arranjo completo, respeitando o que der.
 */
export function arranjoValido(bruto: unknown): ArranjoDaBiblia {
  const dados = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<ArranjoDaBiblia>;
  const vistos = new Set<ParteDaBiblia>();
  const lugares: ParteDaBiblia[] = [];
  for (const p of Array.isArray(dados.lugares) ? dados.lugares : []) {
    if (!PARTES_DA_BIBLIA.includes(p as ParteDaBiblia) || vistos.has(p as ParteDaBiblia)) continue;
    vistos.add(p as ParteDaBiblia);
    lugares.push(p as ParteDaBiblia);
  }
  for (const p of ARRANJO_PADRAO.lugares) if (!vistos.has(p)) lugares.push(p);
  return {
    lugares: lugares.slice(0, 3) as ArranjoDaBiblia["lugares"],
    duplaNa: dados.duplaNa === "direita" ? "direita" : "esquerda",
  };
}

/** Troca duas partes de lugar. */
export function trocarPartes(a: ArranjoDaBiblia, x: ParteDaBiblia, y: ParteDaBiblia): ArranjoDaBiblia {
  const i = a.lugares.indexOf(x);
  const j = a.lugares.indexOf(y);
  if (i < 0 || j < 0 || i === j) return a;
  const lugares = [...a.lugares] as ArranjoDaBiblia["lugares"];
  lugares[i] = y;
  lugares[j] = x;
  return { ...a, lugares };
}

/** A coluna dupla vai para o outro lado. */
export function trocarLados(a: ArranjoDaBiblia): ArranjoDaBiblia {
  return { ...a, duplaNa: a.duplaNa === "esquerda" ? "direita" : "esquerda" };
}

export function ehPadrao(a: ArranjoDaBiblia): boolean {
  return (
    a.duplaNa === ARRANJO_PADRAO.duplaNa &&
    a.lugares.every((p, i) => p === ARRANJO_PADRAO.lugares[i])
  );
}

/** "Versículos e Prévia à esquerda · Livros e capítulos à direita". */
export function descreverArranjo(a: ArranjoDaBiblia): string {
  const outroLado = a.duplaNa === "esquerda" ? "direita" : "esquerda";
  return `${NOME_DA_PARTE[a.lugares[0]]} e ${NOME_DA_PARTE[a.lugares[1]]} à ${a.duplaNa} · ${NOME_DA_PARTE[a.lugares[2]]} à ${outroLado}`;
}
