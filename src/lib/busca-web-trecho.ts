import { letraContem } from "./busca-trecho.ts";

/**
 * Procurar na internet pelo trecho que se lembra.
 *
 * Os catálogos públicos (LRCLIB, lyrics.ovh) procuram por nome de música e
 * de artista — nenhum deles indexa o conteúdo da letra. Então não dá para
 * prometer "busca por trecho na internet" e pronto; dá para fazer duas
 * coisas honestas, e é o que este módulo faz.
 *
 * A primeira é tentar pedaços mais curtos da frase. Em louvor, a linha que
 * a pessoa lembra costuma ser o próprio nome da música — "Porque Ele vive",
 * "Tua graça me basta" — e uma frase comprida não casa com nenhum título,
 * enquanto as três primeiras palavras dela casam.
 *
 * A segunda é conferir a letra que voltou. O catálogo devolve o texto junto
 * com o resultado, então dá para saber quais realmente contêm o que foi
 * digitado, pôr esses na frente e dizer por que estão ali.
 */

/** Palavras curtas demais para servirem de busca sozinhas. */
const VAZIAS = new Set([
  "a", "à", "ao", "aos", "as", "às", "da", "das", "de", "do", "dos", "e", "em", "na", "nas",
  "no", "nos", "o", "os", "que", "se", "um", "uma", "por", "para", "com", "meu", "minha",
  "teu", "tua", "seu", "sua",
]);

/**
 * Quais consultas mandar ao catálogo, da mais fiel para a mais solta.
 *
 * Nunca mais que três: cada uma é uma ida à rede, e numa igreja com internet
 * ruim a espera é o que o operador sente.
 */
export function consultasDoTrecho(bruto: string): string[] {
  const frase = String(bruto ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!frase) return [];
  const palavras = frase.split(" ");
  if (palavras.length <= 3) return [frase];

  const saida = [frase];
  // O começo da frase: é quase sempre onde mora o título.
  saida.push(palavras.slice(0, 3).join(" "));
  // As palavras com peso, sem artigo e preposição — serve quando a frase
  // lembrada começa com "e o", "que a", e o título está no meio.
  const fortes = palavras.filter((p) => !VAZIAS.has(p.toLowerCase())).slice(0, 3);
  if (fortes.length >= 2) saida.push(fortes.join(" "));

  return [...new Set(saida)].slice(0, 3);
}

/**
 * Põe na frente o que de fato contém o trecho.
 *
 * Estável de propósito: entre dois resultados igualmente certos, a ordem que
 * o catálogo devolveu é a que fica, porque ela já vem ordenada por
 * relevância de quem tem o acervo.
 */
export function ordenarPeloTrecho<T extends { lyrics?: string; note?: string }>(
  hits: readonly T[],
  consulta: string,
): (T & { note?: string })[] {
  const frase = String(consulta ?? "").trim();
  if (frase.split(/\s+/).length < 2) return [...hits];
  const casa = (h: T) => Boolean(h.lyrics) && letraContem(h.lyrics as string, frase);
  const certos = hits.filter(casa).map((h) => ({ ...h, note: "Contém o trecho que você procurou." }));
  const resto = hits.filter((h) => !casa(h));
  return [...certos, ...resto];
}
