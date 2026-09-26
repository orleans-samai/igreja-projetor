import type { FamiliaId } from "../../documento.ts";
import type { Familia, Variante } from "./comum.ts";
import { CAPA, EDITORIAL, MOLDURAS } from "./editoriais.ts";
import { GEOMETRICA, ILUSTRADA, INSTITUCIONAL } from "./graficas.ts";
import { COLAGEM, FOTOGRAFIA, ORGANICA } from "./imagem.ts";
import { CARTAZ, MINIMALISTA, TIPOGRAFICA } from "./tipograficas.ts";

/**
 * O catálogo de composições: doze famílias, três variantes cada.
 *
 * Para acrescentar uma variante: escreva o `compor` no arquivo da família
 * (ou num novo), declare os requisitos com honestidade — o gerador confia
 * neles para nem tentar o que não cabe — e ponha na lista da família. O
 * teste de catálogo exige id único, e o de diversidade vai reclamar se a
 * variante nova for a mesma geometria de outra com outra cor.
 */
export const FAMILIAS: readonly Familia[] = [
  EDITORIAL,
  FOTOGRAFIA,
  TIPOGRAFICA,
  COLAGEM,
  GEOMETRICA,
  MINIMALISTA,
  ILUSTRADA,
  INSTITUCIONAL,
  MOLDURAS,
  ORGANICA,
  CARTAZ,
  CAPA,
];

/** Sobe quando uma família ou variante é acrescentada ou mudada. */
export const VERSAO_CATALOGO = 1;

export function acharFamilia(id: FamiliaId): Familia {
  return FAMILIAS.find((f) => f.id === id)!;
}

export function acharVariante(id: string): Variante | null {
  for (const f of FAMILIAS) for (const v of f.variantes) if (v.id === id) return v;
  return null;
}

export type { Familia, Variante };
