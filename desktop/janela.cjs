/**
 * De que tamanho a cabine abre.
 *
 * A cabine tem dois desenhos: colunas lado a lado, que é o dela, e um
 * empilhado em abas para tela estreita. A troca acontece em 1280px de
 * área útil.
 *
 * A janela abria com 1280 de largura externa. Numa tela Full HD a 100% —
 * o PC de igreja mais comum que existe — as bordas comem uns 16px e
 * sobram 1264 de área útil: dois pixels abaixo do corte. O resultado é
 * que a cabine nascia no desenho estreito, e a coluna da direita, com os
 * temas e os vídeos, só aparecia se o operador maximizasse a janela.
 *
 * Ninguém vai adivinhar isso. Então a janela nasce larga o bastante para
 * o desenho de colunas caber, e continua presa ao tamanho da tela: num
 * notebook de 1366 ela ocupa os 1366, e o desenho de colunas ainda cabe.
 */

/** Onde a cabine troca de desenho. É o `xl` do Tailwind. */
const CORTE_COLUNAS = 1280;
/** Quanto a moldura do Windows come de cada lado, somado. Folga generosa. */
const MOLDURA = 24;
/** Largura pretendida, antes de caber na tela. */
const LARGURA_PRETENDIDA = 1440;
const ALTURA_PRETENDIDA = 900;

/** @param {number} larguraDaArea */
function larguraDaCabine(larguraDaArea) {
  const querida = Math.max(LARGURA_PRETENDIDA, CORTE_COLUNAS + MOLDURA);
  return Math.min(querida, larguraDaArea);
}

/** @param {number} alturaDaArea */
function alturaDaCabine(alturaDaArea) {
  return Math.min(ALTURA_PRETENDIDA, alturaDaArea);
}

/**
 * Se a cabine vai caber no desenho de colunas nessa tela.
 *
 * Numa tela pequena de verdade a resposta é não, e está certo: ali o
 * desenho de abas é o que serve.
 *
 * @param {number} larguraDaArea
 */
function cabemAsColunas(larguraDaArea) {
  return larguraDaCabine(larguraDaArea) - MOLDURA >= CORTE_COLUNAS;
}

module.exports = {
  CORTE_COLUNAS,
  MOLDURA,
  LARGURA_PRETENDIDA,
  ALTURA_PRETENDIDA,
  larguraDaCabine,
  alturaDaCabine,
  cabemAsColunas,
};
