/**
 * Quanto uma letra ocupa, em fração do corpo.
 *
 * Havia um único número, 0,52, nos dois lugares que precisam concordar: o
 * que quebra a linha para desenhar e o que estima quantas linhas vão sair.
 * Enquanto o título era pequeno, o erro cabia na folga. Quando ele passou a
 * ocupar a folha, o erro virou "ÁSCOA" — a palavra saindo pelos dois lados
 * do cartaz.
 *
 * A largura média não é uma constante: depende da fonte, do peso e, acima
 * de tudo, da caixa. Maiúscula é muito mais larga que minúscula, e é
 * justamente em maiúscula que um título de cartaz costuma estar.
 *
 * Os números são medidos por baixo — melhor quebrar uma linha antes do que
 * cortar a palavra. Num cartaz, uma linha a mais é uma escolha; uma letra
 * faltando é um defeito.
 */

/** Por família. Serifada de display é estreita; mono é larga por definição. */
const POR_FAMILIA: Record<string, number> = {
  display: 0.5,
  sans: 0.52,
  mono: 0.6,
};

/** Caixa alta não tem descendentes nem letras estreitas como "i" e "l". */
const FATOR_MAIUSCULA = 1.2;

/** Peso alto engorda a haste, e a haste soma largura. */
function fatorDoPeso(peso: number): number {
  if (peso >= 800) return 1.08;
  if (peso >= 700) return 1.04;
  return 1;
}

/** Entreletra positiva soma direto na largura de cada caractere. */
function fatorDoEspacamento(espacamento: number): number {
  return 1 + Math.max(0, espacamento);
}

export function larguraMediaDoCaractere(
  fonte: string,
  peso: number,
  maiuscula: boolean,
  espacamento = 0,
): number {
  const base = POR_FAMILIA[fonte] ?? POR_FAMILIA.sans;
  return base * (maiuscula ? FATOR_MAIUSCULA : 1) * fatorDoPeso(peso) * fatorDoEspacamento(espacamento);
}

/** O que valia antes, para quem chama sem dizer o estilo. */
export const LARGURA_MEDIA_PADRAO = POR_FAMILIA.sans;
