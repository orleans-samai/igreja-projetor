/**
 * Uma cor para cada pessoa no chat.
 *
 * Com três ou quatro pessoas escrevendo no culto — a cabine, o dirigente, o
 * músico, o do som —, ler só o nome em cinza obrigava a parar em cada recado
 * para saber de quem era. Com cor, o olho separa as vozes antes de ler.
 *
 * A cor preferida sai do nome, para a mesma pessoa tender à mesma cor em
 * todas as telas. Se outra pessoa da conversa já estiver com ela, vai para a
 * próxima livre: até oito pessoas, ninguém divide cor.
 *
 * Quem lê a própria mensagem não precisa de cor: ela aparece como "Você".
 *
 * A mesma paleta e a mesma conta moram em `public/chat-equipe.js`, o chat
 * das páginas do celular e do dirigente, que é JavaScript sem build. O teste
 * (`cor-do-chat.test.ts`) confere que os dois continuam iguais.
 */

/** Legíveis sobre o grafite das três telas; nenhuma é o dourado dos avisos. */
export const CORES_DO_CHAT = [
  "#5cc8f5",
  "#b39bfa",
  "#4fd1a1",
  "#f58bc4",
  "#fb9d5c",
  "#3fd6e8",
  "#b5e35a",
  "#f78b8b",
] as const;

/** Quem é quem: a cabine é uma pessoa só, com o nome que tiver. */
export function chaveDaPessoa(m: { de: string; daCabine: boolean }): string {
  return m.daCabine ? "cabine" : `p:${m.de.trim().toLowerCase()}`;
}

function preferida(chave: string): number {
  let h = 0;
  for (let i = 0; i < chave.length; i += 1) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return h % CORES_DO_CHAT.length;
}

/**
 * As cores de uma conversa, na ordem em que as pessoas aparecem.
 *
 * `usadas` guarda chave → índice e é atualizada aqui: quem desenha mensagem
 * por mensagem (as páginas do celular) passa sempre o mesmo mapa.
 */
export function corDaPessoa(chave: string, usadas: Map<string, number>): string {
  const ja = usadas.get(chave);
  if (ja !== undefined) return CORES_DO_CHAT[ja];
  const ocupadas = new Set(usadas.values());
  const inicio = preferida(chave);
  let escolhida = inicio;
  for (let k = 0; k < CORES_DO_CHAT.length; k += 1) {
    const i = (inicio + k) % CORES_DO_CHAT.length;
    if (!ocupadas.has(i)) {
      escolhida = i;
      break;
    }
  }
  usadas.set(chave, escolhida);
  return CORES_DO_CHAT[escolhida];
}
