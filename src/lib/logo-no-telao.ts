/**
 * De que tamanho a logo da igreja aparece no telão.
 *
 * Ela ocupava a altura inteira da tela: `max-h-full` numa imagem que o
 * operador subiu com 900px de altura vira um brasão de parede a parede no
 * minuto em que o app abre. A logo é assinatura, não cartaz — ela diz "é
 * aqui", e o resto da tela respira em volta.
 *
 * O tamanho é uma fração da menor dimensão da tela, e não pixels: o mesmo
 * "pequeno" funciona num projetor de 1024 e numa TV de 4K.
 */

export type TamanhoDaLogo = "pequeno" | "medio" | "grande";

export const TAMANHOS_DA_LOGO: readonly TamanhoDaLogo[] = ["pequeno", "medio", "grande"];

export const NOME_DO_TAMANHO: Record<TamanhoDaLogo, string> = {
  pequeno: "Pequena",
  medio: "Média",
  grande: "Grande",
};

/** Fração da menor dimensão da tela que a logo ocupa. */
const FRACAO: Record<TamanhoDaLogo, number> = {
  pequeno: 0.22,
  medio: 0.34,
  grande: 0.5,
};

/** Pequena quando ninguém escolheu — era a queixa, e é o padrão agora. */
export const TAMANHO_PADRAO: TamanhoDaLogo = "pequeno";

export function tamanhoValido(bruto: unknown): TamanhoDaLogo {
  return TAMANHOS_DA_LOGO.includes(bruto as TamanhoDaLogo) ? (bruto as TamanhoDaLogo) : TAMANHO_PADRAO;
}

/**
 * Contra o que a logo é medida.
 *
 * No telão, a tela (`vmin`). Na prévia do diálogo, a caixinha que imita o
 * telão (`cqmin`, a unidade de contêiner): medir a prévia pela janela da
 * cabine daria uma logo do tamanho errado, e a prévia existe justamente
 * para não mentir sobre o tamanho.
 */
export type UnidadeDaLogo = "vmin" | "cqmin";

/** A altura máxima da logo, em unidade CSS que acompanha a tela. */
export function alturaDaLogo(tamanho: unknown, unidade: UnidadeDaLogo = "vmin"): string {
  return `${Math.round(FRACAO[tamanhoValido(tamanho)] * 100)}${unidade}`;
}

/**
 * O corpo do nome debaixo da logo, proporcional a ela.
 *
 * Nome grande debaixo de logo pequena desequilibra: a legenda vira o
 * título. Um quinto da altura da logo mantém a ordem.
 */
export function corpoDoNome(tamanho: unknown, unidade: UnidadeDaLogo = "vmin"): string {
  return `${(FRACAO[tamanhoValido(tamanho)] * 100 * 0.2).toFixed(1)}${unidade}`;
}
