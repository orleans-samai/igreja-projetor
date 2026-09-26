/**
 * Ler uma Bíblia no formato VPL do eBible.org.
 *
 * VPL é um versículo por linha: `JOH 3:16 Porque Deus amou…`. É o formato
 * mais simples que o eBible oferece, e o mais difícil de errar.
 *
 * Duas armadilhas, as duas reais:
 *
 * - Os códigos de livro são do eBible, não do USFM. João é `JOH`, não
 *   `JHN`; Filipenses é `PHI`; Cantares é `SOL`. Procurar por `JHN` não
 *   acha nada, e foi exatamente o que aconteceu na primeira tentativa.
 * - Versículo vazio é de propósito. Traduções modernas omitem versículos
 *   que os manuscritos mais antigos não trazem (Mateus 17:21, Atos 8:37).
 *   A linha vem sem texto, e ela tem que ocupar a posição dela: pular a
 *   linha deslocaria toda a numeração seguinte do capítulo, e o pregador
 *   pediria o versículo 22 e o telão mostraria o 23.
 *
 * Só entram os 66 livros do cânone protestante. Deuterocanônicos (Tobias,
 * Macabeus, os acréscimos gregos de Ester e Daniel) ficam de fora: o app
 * não tem como mostrá-los, e uma versão com 81 livros confundiria quem
 * procura "Ester" e acha duas.
 */
import { bookById } from "./bible-books.ts";
import type { CompactBible, CompactBook } from "./types.ts";

/** Código do eBible → número do livro no cânone protestante (1 a 66). */
export const CODIGOS_EBIBLE: Readonly<Record<string, number>> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8, "1SA": 9, "2SA": 10,
  "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14, EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19,
  PRO: 20, ECC: 21, SOL: 22, ISA: 23, JER: 24, LAM: 25, EZE: 26, DAN: 27, HOS: 28, JOE: 29,
  AMO: 30, OBA: 31, JON: 32, MIC: 33, NAH: 34, HAB: 35, ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MAR: 41, LUK: 42, JOH: 43, ACT: 44, ROM: 45, "1CO": 46, "2CO": 47, GAL: 48,
  EPH: 49, PHI: 50, COL: 51, "1TH": 52, "2TH": 53, "1TI": 54, "2TI": 55, TIT: 56, PHM: 57,
  HEB: 58, JAM: 59, "1PE": 60, "2PE": 61, "1JO": 62, "2JO": 63, "3JO": 64, JUD: 65, REV: 66,
};

/**
 * Espaço antes de vírgula, ponto e afins.
 *
 * Sobra de nota de rodapé que o eBible tira do texto e deixa o espaço onde
 * ela estava: "Filho unigênito , para que". É só tipografia — nenhuma
 * palavra muda —, e no telão esse espaço solto parece erro de digitação.
 */
export function arrumarEspacos(texto: string): string {
  return texto.replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

export interface OpcoesVpl {
  id: string;
  name: string;
  license: string;
  /** Aplica `arrumarEspacos`. Só onde a licença permite mexer no texto. */
  arrumar?: boolean;
}

/**
 * O texto de um arquivo VPL, como Bíblia do app.
 *
 * Linhas com código desconhecido (deuterocanônicos) são ignoradas; linhas
 * mal formadas também — melhor um versículo a menos do que um arquivo
 * inteiro recusado.
 */
export function lerVpl(texto: string, opcoes: OpcoesVpl): CompactBible {
  const porLivro = new Map<number, string[][]>();
  const LINHA = /^(\S+)\s+(\d+):(\d+)(?:\s(.*))?$/;

  for (const bruta of String(texto).split(/\r?\n/)) {
    const m = LINHA.exec(bruta.trimEnd());
    if (!m) continue;
    const livro = CODIGOS_EBIBLE[m[1]];
    if (!livro) continue;
    const capitulo = Number(m[2]);
    const versiculo = Number(m[3]);
    if (capitulo < 1 || versiculo < 1 || capitulo > 200 || versiculo > 250) continue;

    const capitulos = porLivro.get(livro) ?? [];
    porLivro.set(livro, capitulos);
    const versiculos = (capitulos[capitulo - 1] ??= []);
    // Preenche as posições que ficaram para trás: versículo omitido pela
    // tradução ocupa o lugar dele, vazio, e o seguinte fica no número certo.
    while (versiculos.length < versiculo - 1) versiculos.push("");
    const conteudo = (m[4] ?? "").trim();
    versiculos[versiculo - 1] = opcoes.arrumar ? arrumarEspacos(conteudo) : conteudo;
  }

  const books: CompactBook[] = [...porLivro.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, c]) => ({
      i,
      o: bookById(i)?.osis ?? String(i),
      // Capítulo que o arquivo pulou vira lista vazia, não buraco no array:
      // `c[n]` indefinido quebraria quem percorre os capítulos.
      c: Array.from({ length: c.length }, (_, k) => c[k] ?? []),
    }));

  return { id: opcoes.id, name: opcoes.name, license: opcoes.license, books };
}
