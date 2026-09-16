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
