/**
 * Quanto a faixa de letras rola para acompanhar o slide.
 *
 * Avançando só com as setas, o cartão amarelo (o que está no telão) saía
 * pela direita da faixa, e o operador tinha de ir à barra de rolagem no
 * meio do louvor para achar onde estava. A faixa passa a rolar sozinha:
 * o slide atual sempre à vista, e os dois seguintes junto dele — é olhando
 * o que vem que o operador se prepara.
 *
 * Posições em pixels dentro do conteúdo rolável: `inicio` e `fim` de cada
 * cartão, e a vista que aparece (a rolagem atual e a largura).
 */

interface Trecho {
  inicio: number;
  fim: number;
}

/**
 * A rolagem nova, ou null quando o atual e os seguintes já aparecem.
 *
 * @param atual   o cartão do slide atual
 * @param ultimo  o último cartão que deve aparecer junto (o atual + 2, ou o fim da música)
 */
export function rolagemDaFaixa(
  atual: Trecho,
  ultimo: Trecho,
  vista: { inicio: number; largura: number },
  folga = 8,
): number | null {
  const fimDaVista = vista.inicio + vista.largura;
  // Voltando (seta para a esquerda), o atual encosta na borda esquerda.
  if (atual.inicio - folga < vista.inicio) return Math.max(0, atual.inicio - folga);
  // Indo em frente, os seguintes entram pela direita — sem empurrar o
  // atual para fora pela esquerda, se a faixa for estreita demais.
  if (ultimo.fim + folga > fimDaVista) {
    return Math.max(0, Math.min(ultimo.fim + folga - vista.largura, atual.inicio - folga));
  }
  return null;
}

/*
  Dois blocos, um em cima do outro.

  Numa fileira só, uma música longa (21 slides) mostrava 9 e escondia o
  resto atrás da barra de rolagem. Com os dois blocos, a letra enche o de
  cima (o principal) e continua no de baixo (o secundário); só o que não
  couber nem no de baixo fica para a barra de rolagem — que é dele.
*/

/** Quantos cartões inteiros cabem numa fileira: nenhum sai cortado na borda. */
export function cartoesQueCabem(larguraUtil: number, larguraDoCartao: number, vao = 8): number {
  if (!(larguraUtil > 0) || !(larguraDoCartao > 0)) return 1;
  return Math.max(1, Math.floor((larguraUtil + vao) / (larguraDoCartao + vao)));
}

/**
 * Que cartões do bloco de baixo precisam aparecer para o atual e os dois
 * seguintes ficarem à vista, ou null quando todos estão no bloco de cima —
 * que nunca rola, porque o que está nele sempre cabe.
 *
 * @param inicioDoSecundario  o índice do primeiro slide do bloco de baixo
 */
export function vistaNoSecundario(
  atual: number,
  total: number,
  inicioDoSecundario: number,
): { de: number; ate: number } | null {
  const ate = Math.min(total - 1, atual + 2);
  if (ate < inicioDoSecundario) return null;
  return { de: Math.max(atual, inicioDoSecundario), ate };
}
