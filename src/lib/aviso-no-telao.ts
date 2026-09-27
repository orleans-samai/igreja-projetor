/**
 * De que tamanho o aviso de rodapé aparece no telão, e se pisca.
 *
 * O aviso nasceu uma faixinha de 30 px no pé da tela — "vamos orar" do
 * tamanho de uma legenda, que ninguém no fundo da igreja via. Aviso existe
 * para interromper: por padrão ele é grande e pisca, e o operador escolhe
 * um tamanho menor antes de mandar quando o recado é discreto.
 *
 * O tamanho é em pixels do telão de 1920×1080 que o Lúmen desenha e depois
 * encaixa na tela de verdade: o mesmo "grande" no projetor de 1024 e na TV
 * de 4K, e igual na prévia da cabine.
 */

export type TamanhoDoAviso = "pequeno" | "medio" | "grande" | "enorme";

export const TAMANHOS_DO_AVISO: readonly TamanhoDoAviso[] = ["pequeno", "medio", "grande", "enorme"];

export const NOME_DO_TAMANHO_DO_AVISO: Record<TamanhoDoAviso, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
  enorme: "Enorme",
};

/** Corpo da letra, em pixels do telão de 1920×1080. */
const CORPO: Record<TamanhoDoAviso, number> = {
  pequeno: 44,
  medio: 64,
  grande: 96,
  enorme: 136,
};

export const TAMANHO_PADRAO_DO_AVISO: TamanhoDoAviso = "grande";

export function tamanhoDoAvisoValido(bruto: unknown): TamanhoDoAviso {
  return TAMANHOS_DO_AVISO.includes(bruto as TamanhoDoAviso) ? (bruto as TamanhoDoAviso) : TAMANHO_PADRAO_DO_AVISO;
}

export function corpoDoAviso(tamanho: unknown): number {
  return CORPO[tamanhoDoAvisoValido(tamanho)];
}

/** Pisca, a não ser que alguém tenha desligado: chamar a atenção é o padrão. */
export function avisoPisca(piscar: unknown): boolean {
  return piscar !== false;
}
