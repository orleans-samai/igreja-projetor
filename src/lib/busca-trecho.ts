import { fold } from "./fold.ts";
import { stripChords } from "./lyrics.ts";

/**
 * Achar a música pelo pedaço da letra que se lembra.
 *
 * O operador raramente lembra o nome do louvor; lembra "aquele que fala em
 * teu altar". A busca já varria a letra, mas comparava o texto cru — com
 * quebra de linha, marcação de seção e cifra no meio. Quem digitasse uma
 * frase que atravessa duas linhas não achava nada, e concluía, com razão,
 * que só dava para procurar por nome.
 *
 * Aqui a letra vira uma linha só antes de comparar. "os olhos do vale" passa
 * a achar um verso que está escrito em duas linhas.
 */

/** Marcação de seção: [Verso 1], [Coro], [Ponte]. */
const SECAO = /\[[^\]\n]*\]/g;

/**
 * A letra numa linha só, sem seção nem cifra, mantendo acento e maiúscula.
 *
 * É esta versão que aparece na tela quando a busca mostra onde bateu — por
 * isso ela preserva o texto como a igreja canta, e não o texto dobrado.
 */
export function letraLisa(bruto: string): string {
  return stripChords(String(bruto ?? ""))
    .replace(SECAO, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Onde a busca bate na letra — ou -1.
 *
 * Trabalha sobre a letra lisa, então atravessa quebra de linha. Devolve
 * índice em vez de booleano porque quem chama precisa recortar o trecho para
 * mostrar, e procurar duas vezes seria desperdício.
 */
export function posicaoDoTrecho(lisa: string, consulta: string): number {
  const alvo = fold(consulta).replace(/\s+/g, " ").trim();
  if (!alvo) return -1;
  const agulha = fold(lisa);
  // `fold` preserva o tamanho nas letras que uma letra de louvor tem; se
  // algum caractere exótico mudar isso, o índice deixaria de apontar para o
  // lugar certo no texto visível, e é melhor não recortar nada.
  if (agulha.length !== lisa.length) return lisa.toLowerCase().indexOf(alvo) ;
  return agulha.indexOf(alvo);
}

/** Se a letra contém o trecho, ignorando quebra, acento, cifra e seção. */
export function letraContem(bruto: string, consulta: string): boolean {
  return posicaoDoTrecho(letraLisa(bruto), consulta) >= 0;
}

/**
 * O pedaço da letra em volta do que se procurou, para mostrar na lista.
 *
 * Sem isto o operador vê uma música aparecer na busca e não sabe por quê —
 * o nome não bate, o autor não bate, e o motivo está escondido no meio da
 * letra. Reticências avisam que o verso continua antes ou depois.
 */
export function trechoQueBate(bruto: string, consulta: string, contexto = 34): string | null {
  const lisa = letraLisa(bruto);
  const onde = posicaoDoTrecho(lisa, consulta);
  if (onde < 0) return null;
  const tamanho = fold(consulta).replace(/\s+/g, " ").trim().length;
  const inicio = Math.max(0, onde - contexto);
  const fim = Math.min(lisa.length, onde + tamanho + contexto);
  return (inicio > 0 ? "…" : "") + lisa.slice(inicio, fim).trim() + (fim < lisa.length ? "…" : "");
}
