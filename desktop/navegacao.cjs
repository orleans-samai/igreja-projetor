/**
 * O que é falha de navegação e o que é só uma troca de página.
 *
 * O Chromium devolve ERR_ABORTED (-3) quando uma navegação foi substituída
 * por outra: um reload por cima do carregamento inicial, a janela fechando
 * no meio, a restauração de backup trocando a página de propósito. Nada
 * disso é problema, e nada disso deveria abrir uma caixa vermelha na cara
 * de quem só abriu o app.
 *
 * Fica num arquivo próprio porque o `main.cjs` não se carrega fora do
 * Electron, e esta regra precisa de teste — foi ela que, faltando num dos
 * dois caminhos, virou "ERR_ABORTED (-3) loading 'lumen://app/'" numa
 * caixa de erro ao abrir.
 */

/** @param {unknown} erro */
function abortou(erro) {
  if (!erro) return false;
  const e = /** @type {{ message?: unknown; errno?: unknown; code?: unknown }} */ (erro);
  if (e.errno === -3 || e.code === "ERR_ABORTED") return true;
  return String(e.message ?? erro).includes("ERR_ABORTED");
}

module.exports = { abortou };
