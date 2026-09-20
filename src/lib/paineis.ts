/**
 * A ordem das colunas da cabine.
 *
 * Cada igreja opera de um jeito: quem projeta sozinho quer o preview perto da
 * mão que clica, quem tem alguém montando o culto ao lado quer a ordem do
 * culto na ponta. A ordem é do operador, não do programa.
 *
 * O chat é uma coluna como as outras. Antes ele só sabia ficar na esquerda ou
 * na direita, escolhido num menu — agora arrasta junto com o resto, no mesmo
 * gesto, e para de ser um caso especial.
 */

export type PainelId = "biblioteca" | "culto" | "preview" | "temas" | "chat";

export const ORDEM_PADRAO: readonly PainelId[] = [
  "biblioteca",
  "culto",
  "preview",
  "temas",
  "chat",
];

/**
 * O id `preview` continua sendo `preview` de propósito: ele está gravado na
 * ordem de painéis que cada igreja salvou. Só o nome à vista mudou — a coluna
 * mostra o que está no ar.
 */
export const NOME_PAINEL: Record<PainelId, string> = {
  biblioteca: "Repertório",
  culto: "Programação",
  preview: "No ar",
  temas: "Temas",
  chat: "Chat",
};

/** Largura de partida e mínima de cada coluna — viajam junto com o painel. */
export const TAMANHO_PAINEL: Record<PainelId, { padrao: string; minimo: string }> = {
  biblioteca: { padrao: "19%", minimo: "15%" },
  culto: { padrao: "22%", minimo: "16%" },
  preview: { padrao: "43%", minimo: "26%" },
  temas: { padrao: "16%", minimo: "12%" },
  chat: { padrao: "17%", minimo: "12%" },
};

/**
 * Conserta a ordem guardada.
 *
 * O que está no disco foi gravado por alguma versão do app, e não
 * necessariamente por esta. Painel repetido apareceria duas vezes; painel
 * desconhecido quebraria a renderização; painel faltando sumiria da cabine no
 * meio do culto, sem nenhum caminho para trazê-lo de volta. Os três casos
 * viram a mesma coisa: uma ordem completa, sem repetição, na sequência que
 * der para respeitar.
 */
export function ordemValida(bruta: unknown): PainelId[] {
  const lista = Array.isArray(bruta) ? bruta : [];
  const vistos = new Set<PainelId>();
  const saida: PainelId[] = [];
  for (const item of lista) {
    if (typeof item !== "string") continue;
    const id = item as PainelId;
    if (!ORDEM_PADRAO.includes(id) || vistos.has(id)) continue;
    vistos.add(id);
    saida.push(id);
  }
  for (const id of ORDEM_PADRAO) if (!vistos.has(id)) saida.push(id);
  return saida;
}

/** Troca dois painéis de lugar. Fora da lista, nada muda. */
export function trocar(ordem: readonly PainelId[], a: PainelId, b: PainelId): PainelId[] {
  const i = ordem.indexOf(a);
  const j = ordem.indexOf(b);
  if (i < 0 || j < 0 || i === j) return [...ordem];
  const nova = [...ordem];
  nova[i] = b;
  nova[j] = a;
  return nova;
}
