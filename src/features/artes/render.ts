import { LARGURA_MEDIA_PADRAO } from "./largura-do-texto.ts";

/**
 * O que sobrou do renderizador SVG da v1: a quebra de linha e o escape.
 *
 * O desenho agora é do Konva (konva/desenho.tsx). Estas duas funções ficam
 * porque a conversão das artes salvas na v1 (migracao-v1.ts) precisa
 * quebrar o texto exatamente como a v1 quebrava — senão a arte reaberta
 * mudaria de cara.
 */

/**
 * Escapa o que vai para dentro do SVG.
 *
 * O texto vem de um formulário que qualquer pessoa da igreja preenche. Sem
 * isto, um "&" no nome do evento quebraria o arquivo, e um "<script>" seria
 * bem pior do que quebrar.
 */
export function escapar(bruto: string): string {
  return String(bruto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A mesma largura média de caractere que a validação usa. */
const LARGURA_MEDIA_DO_CARACTERE = LARGURA_MEDIA_PADRAO;

/**
 * Parte o texto em linhas que cabem na largura dada.
 *
 * Respeita a quebra que a pessoa digitou — um endereço em duas linhas foi
 * escrito assim de propósito.
 */
export function quebrarTexto(
  texto: string,
  larguraPx: number,
  corpoPx: number,
  /** Largura média do caractere, em fração do corpo. Ver largura-do-texto. */
  larguraDoCaractere = LARGURA_MEDIA_DO_CARACTERE,
): string[] {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return [];
  const cabem = Math.max(1, Math.floor(larguraPx / (corpoPx * larguraDoCaractere)));
  const saida: string[] = [];
  for (const paragrafo of limpo.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.trim().split(/\s+/)) {
      if (!palavra) continue;
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (tentativa.length > cabem && atual) {
        saida.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    saida.push(atual);
  }
  return saida.filter((l) => l.length > 0);
}
