/**
 * O que cada aparelho pode fazer pelo celular.
 *
 * Eram degraus — só chat, editor, controle completo —, e quem só podia
 * conversar via as outras abas na tela, bloqueadas. A igreja pediu
 * permissões por parte: culto, mídia, letras e controle, uma ou mais, ou o
 * acesso completo. O chat é de todo mundo que entrou; quem só tem o chat
 * vê só o chat.
 *
 * Cada parte é uma aba do celular e o que se faz nela:
 * - culto: ver a programação, projetar um item dela, tirar um item;
 * - midia: ver a pasta de mídia, projetar, tocar, pausar, volume;
 * - letras: repertório, busca de letras, salvar música, projetar estrofe;
 * - controle: avançar, voltar, preto, logo, parar — o telão inteiro.
 */

const CAPACIDADES = ["culto", "midia", "letras", "controle"];
/** Tudo o que existe hoje e o que vier: não é a soma das quatro. */
const COMPLETO = "completo";

/** Os degraus antigos, como ficaram guardados no remote.json até aqui. */
const DOS_DEGRAUS = { chat: [], editor: ["culto", "midia", "letras"], controle: [COMPLETO] };

/**
 * A lista limpa: só nomes conhecidos, na ordem de sempre, sem repetição.
 * Aceita o degrau antigo (uma palavra) para o remote.json de antes e para
 * quem ainda chama pelo nome velho.
 */
function normalizarPermissoes(bruto) {
  if (typeof bruto === "string") return [...(DOS_DEGRAUS[bruto] ?? [])];
  if (!Array.isArray(bruto)) return [];
  if (bruto.includes(COMPLETO)) return [COMPLETO];
  return CAPACIDADES.filter((c) => bruto.includes(c));
}

function pode(permissoes, capacidade) {
  const lista = normalizarPermissoes(permissoes);
  return lista.includes(COMPLETO) || lista.includes(capacidade);
}

/** Pode alguma destas? Tocar um vídeo, por exemplo, é da mídia e do controle. */
function podeAlguma(permissoes, capacidades) {
  return capacidades.some((c) => pode(permissoes, c));
}

/** Mais que o chat: é o que dá direito a ver o que está no ar. */
function alemDoChat(permissoes) {
  return normalizarPermissoes(permissoes).length > 0;
}

module.exports = { CAPACIDADES, COMPLETO, normalizarPermissoes, pode, podeAlguma, alemDoChat };
