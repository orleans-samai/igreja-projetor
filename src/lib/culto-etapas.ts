/**
 * Em que pé está cada item da programação do culto.
 *
 * Quatro estados, lidos de relance: o que já passou, o que está no ar agora,
 * o que vem logo depois e o que ainda espera. Quem opera precisa achar a
 * própria posição na lista sem ler item por item.
 */
export type Etapa = "concluido" | "no-ar" | "proximo" | "pendente";

/**
 * @param indice    posição do item na lista
 * @param indiceNoAr posição do que está no ar, ou -1 quando o culto não começou
 */
export function etapaDoItem(indice: number, indiceNoAr: number): Etapa {
  if (indiceNoAr < 0) return indice === 0 ? "proximo" : "pendente";
  if (indice === indiceNoAr) return "no-ar";
  if (indice < indiceNoAr) return "concluido";
  if (indice === indiceNoAr + 1) return "proximo";
  return "pendente";
}

/**
 * Onde este item da biblioteca está na programação do culto — ou -1.
 *
 * Dois cliques no repertório projetam na hora. Se a música já foi planejada
 * para o culto, projetar "solta" seria pior que não projetar: a programação
 * continuaria apontando para outro ponto, e o próximo avanço pularia de
 * volta para o lugar errado. Achando o item aqui, o culto anda a partir dele.
 *
 * O tipo entra na conta porque os ids são únicos por acervo, não entre
 * acervos: um aviso e uma música podem carregar o mesmo id.
 */
export function indiceNaProgramacao(
  itens: readonly { type: string; refId: string }[],
  type: string,
  refId: string,
): number {
  return itens.findIndex((i) => i.type === type && i.refId === refId);
}
