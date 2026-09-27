/**
 * Em que pé está cada item da programação do culto.
 *
 * Três estados, lidos de relance: o que está no ar agora, o que vem logo
 * depois e o resto. Quem opera precisa achar a própria posição na lista sem
 * ler item por item.
 *
 * Já houve um quarto, "concluído", para o que tinha passado — e ele saía
 * apagado na tela. A igreja pediu para tirar: projetar um item só para ver,
 * voltar a ele e achá-lo com cara de travado atrapalhava mais do que
 * ajudava. O que já passou é um item como os outros, sempre pronto para
 * projetar de novo.
 */
export type Etapa = "no-ar" | "proximo" | "pendente";

/**
 * O "Enviado por" de um item que chegou de fora da cabine.
 *
 * Toma o lugar do "Pendente": para o que o dirigente mandou, "Pendente"
 * parecia arquivo parado esperando alguma coisa — e o que a cabine precisa
 * saber é de quem veio.
 */
export function enviadoPor(nome: string | undefined): string | null {
  const limpo = (nome ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return limpo ? `Enviado por ${limpo}` : null;
}

/**
 * @param indice    posição do item na lista
 * @param indiceNoAr posição do que está no ar, ou -1 quando o culto não começou
 */
export function etapaDoItem(indice: number, indiceNoAr: number): Etapa {
  if (indiceNoAr < 0) return indice === 0 ? "proximo" : "pendente";
  if (indice === indiceNoAr) return "no-ar";
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
