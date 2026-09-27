/**
 * O tamanho dos quadrados do navegador da Bíblia.
 *
 * A igreja pediu os livros, capítulos e versículos maiores — e um − e um +
 * para cada operador acertar o tamanho na tela e na vista dele. A escala
 * multiplica tudo (quadrado, letra e espaço), então crescer não deforma.
 * O 100% já é maior que o tamanho antigo.
 */

export const ESCALAS_DA_BIBLIA = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

export const ESCALA_PADRAO_DA_BIBLIA = 1;

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

/** "115%": o que o operador lê entre o − e o +. */
export function rotuloDaEscala(escala: number): string {
  return `${Math.round(escalaDaBiblia(escala) * 100)}%`;
}
