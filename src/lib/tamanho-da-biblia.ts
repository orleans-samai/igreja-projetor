/**
 * O tamanho dos quadrados do navegador da Bíblia.
 *
 * A igreja pediu os livros, capítulos e versículos maiores — e um − e um +
 * para cada operador acertar o tamanho na tela e na vista dele. A escala
 * multiplica tudo (quadrado, letra e espaço), então crescer não deforma.
 *
 * Depois pediu que tudo coubesse na tela, sem barra de rolagem e sem cortar:
 * o − e o + marcam o tamanho máximo, e a tela usa o maior tamanho até ele
 * em que livros, capítulos e versículos cabem inteiros. Salmos, com 150
 * capítulos, encolhe sozinho; Rute, com 4, fica do tamanho máximo.
 */

export const ESCALAS_DA_BIBLIA = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

/** "Deixe até o máximo": sem escolha, os quadrados crescem até o maior que couber. */
export const ESCALA_PADRAO_DA_BIBLIA = 2;

/**
 * Até onde o ajuste encolhe para caber. Abaixo disto o número fica pequeno
 * demais para acertar com pressa; aí é melhor rolar do que cortar.
 */
export const ESCALA_MINIMA_DO_AJUSTE = 0.45;

/**
 * A maior escala, até `maximo`, em que `cabe` diz que tudo cabe.
 *
 * Busca binária: nove medições acertam a escala em menos de 0,3% — e cada
 * medição é um layout de centenas de botões, então medir de 1% em 1%
 * travaria a troca de capítulo. Se nem o mínimo cabe, devolve o mínimo.
 */
export function maiorEscalaQueCabe(maximo: number, cabe: (escala: number) => boolean, medicoes = 9): number {
  const teto = Math.max(ESCALA_MINIMA_DO_AJUSTE, maximo);
  if (cabe(teto)) return teto;
  let baixo = ESCALA_MINIMA_DO_AJUSTE;
  let alto = teto;
  for (let i = 0; i < medicoes; i += 1) {
    const meio = (baixo + alto) / 2;
    if (cabe(meio)) baixo = meio;
    else alto = meio;
  }
  return baixo;
}

/** Só uma das escalas da lista vale; valor estranho (arquivo antigo, editado) volta ao padrão. */
export function escalaDaBiblia(valor: unknown): number {
  return typeof valor === "number" && (ESCALAS_DA_BIBLIA as readonly number[]).includes(valor)
    ? valor
    : ESCALA_PADRAO_DA_BIBLIA;
}

/** Um degrau acima ou abaixo, parando nas pontas. */
export function proximaEscala(atual: number, direcao: 1 | -1): number {
  const lista = ESCALAS_DA_BIBLIA as readonly number[];
  const i = lista.indexOf(escalaDaBiblia(atual));
  return lista[Math.max(0, Math.min(lista.length - 1, i + direcao))];
}

export function escalaMinima(escala: number): boolean {
  return escalaDaBiblia(escala) <= ESCALAS_DA_BIBLIA[0];
}

export function escalaMaxima(escala: number): boolean {
  return escalaDaBiblia(escala) >= ESCALAS_DA_BIBLIA[ESCALAS_DA_BIBLIA.length - 1];
}

/**
 * O novo máximo quando o operador aperta o −: o degrau logo abaixo do que
 * ele está vendo. Se o ajuste à tela já encolheu os quadrados, baixar o
 * máximo um degrau não mudaria nada na tela — e o − pareceria quebrado.
 * Null quando já não há degrau menor que o tamanho da tela.
 */
export function degrauAbaixo(naTela: number): number | null {
  const menores = ESCALAS_DA_BIBLIA.filter((e) => e < naTela - 0.001);
  return menores.length ? menores[menores.length - 1] : null;
}

/** "115%": o que o operador lê entre o − e o +. */
export function rotuloDaEscala(escala: number): string {
  return `${Math.round(escalaDaBiblia(escala) * 100)}%`;
}
