import { acharFonte, type EstiloDeTexto } from "../catalogo/tipografia.ts";

/**
 * Medir, quebrar e ajustar texto.
 *
 * Três regras que valem para toda arte:
 *
 * - Palavra não se corta. Se a palavra mais longa não cabe na largura nem no
 *   menor tamanho permitido, o bloco não serve — e o layout que pediu esse
 *   bloco sai do lote. Encolher sem fim daria um título que ninguém lê.
 * - A quebra é equilibrada: as linhas saem com larguras parecidas, sem uma
 *   palavra sozinha na última linha e sem "de", "e", "a" pendurados no fim
 *   de uma linha — o português tem muita preposição curta, e é ela que faz
 *   título de cartaz parecer amador.
 * - O texto é o da pessoa. Nada é abreviado nem reescrito; a única mudança
 *   possível é caixa alta, e ela é estilo, não conteúdo.
 */

export interface Medidor {
  /** Largura em px do texto numa linha, com o espaçamento entre letras. */
  largura(texto: string, estilo: EstiloDeTexto, tamanho: number): number;
}

const ESTREITAS = new Set("il.,:;'!|j·".split(""));
const MEIAS = new Set("ftrI1()[]-–".split(""));
const LARGAS = new Set("mwMW@".split(""));

/**
 * Medidor sem canvas, por classe de caractere. Só serve para os testes no
 * Node e para uma primeira estimativa: o app mede com a fonte de verdade.
 * Erra para o lado largo, que é o lado seguro.
 */
export const medidorAproximado: Medidor = {
  largura(texto, estilo, tamanho) {
    const f = acharFonte(estilo.fonte);
    const base = f?.larguraMedia ?? 0.55;
    const maiuscula = (f?.larguraMaiuscula ?? 0.7) / base;
    const peso = 1 + ((estilo.peso - 400) / 100) * 0.025;
    const t = estilo.maiusculas ? texto.toLocaleUpperCase("pt-BR") : texto;
    let soma = 0;
    for (const ch of t) {
      let k = 1;
      if (ch === " ") k = 0.55;
      else if (ESTREITAS.has(ch)) k = 0.48;
      else if (MEIAS.has(ch)) k = 0.68;
      else if (LARGAS.has(ch)) k = ch === ch.toUpperCase() ? 1.4 * maiuscula : 1.5;
      else if (/\d/.test(ch)) k = 1.05;
      else if (ch !== ch.toLowerCase()) k = maiuscula;
      soma += k;
    }
    return soma * base * tamanho * peso * 1.04 + estilo.espacamento * tamanho * [...t].length;
  },
};

/** Palavras que não podem terminar linha: ficariam penduradas. */
const PENDURADAS = new Set([
  "a", "à", "ao", "aos", "as", "às", "o", "os", "e", "é", "de", "da", "das", "do", "dos", "em", "na", "nas",
  "no", "nos", "um", "uma", "com", "por", "para", "pra", "que", "se", "sua", "seu", "meu", "minha",
]);

export interface Quebra {
  linhas: string[];
  /** A linha mais larga, em px. */
  largura: number;
}

/**
 * A melhor quebra de um parágrafo em exatamente `k` linhas.
 *
 * Programação dinâmica sobre as palavras: minimiza a sobra ao quadrado
 * (linhas parecidas) e soma penalidades para viúva e para preposição no
 * fim da linha. Título tem poucas palavras, então a conta é instantânea.
 */
export function quebrarEm(
  palavras: string[],
  k: number,
  larguraMax: number,
  medir: (s: string) => number,
): Quebra | null {
  const n = palavras.length;
  if (k < 1 || k > n) return null;
  const largura = (i: number, j: number) => medir(palavras.slice(i, j).join(" "));
  // custo[i][l] = melhor custo para as palavras i..n em l linhas
  const custo: number[][] = Array.from({ length: n + 1 }, () => Array(k + 1).fill(Infinity));
  const corte: number[][] = Array.from({ length: n + 1 }, () => Array(k + 1).fill(-1));
  custo[n][0] = 0;
  for (let l = 1; l <= k; l++) {
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j <= n - (l - 1); j++) {
        if (custo[j][l - 1] === Infinity) continue;
        const w = largura(i, j);
        if (w > larguraMax) break;
        const sobra = (larguraMax - w) / larguraMax;
        let c = sobra * sobra;
        const ultima = palavras[j - 1].toLocaleLowerCase("pt-BR");
        if (j < n && PENDURADAS.has(ultima)) c += 0.6;
        // Viúva: última linha com uma palavra só, curta, depois de outras.
        if (l === 1 && j === n && j - i === 1 && n > 2 && palavras[i].length <= 5) c += 0.8;
        if (l === 1 && j === n) c *= 0.5; // a última linha pode ser mais curta
        const total = c + custo[j][l - 1];
        if (total < custo[i][l]) {
          custo[i][l] = total;
          corte[i][l] = j;
        }
      }
    }
  }
  if (custo[0][k] === Infinity) return null;
  const linhas: string[] = [];
  let i = 0;
  for (let l = k; l >= 1; l--) {
    const j = corte[i][l];
    linhas.push(palavras.slice(i, j).join(" "));
    i = j;
  }
  return { linhas, largura: Math.max(...linhas.map(medir)) };
}

export interface PedidoDeAjuste {
  texto: string;
  estilo: EstiloDeTexto;
  larguraMax: number;
  alturaMax: number;
  tamanhoMax: number;
  tamanhoMin: number;
  maxLinhas: number;
}

export interface Ajuste {
  tamanho: number;
  linhas: string[];
  largura: number;
  altura: number;
}

/**
 * O maior tamanho em que o texto cabe, com a quebra mais equilibrada.
 *
 * Desce de 4 em 4% a partir do máximo. Em cada tamanho tenta o menor número
 * de linhas que cabe na largura; se a altura também couber, é esse. Quebra
 * de linha escrita pela pessoa (texto bíblico, informações) é respeitada:
 * cada parágrafo quebra sozinho.
 */
export function ajustar(p: PedidoDeAjuste, medidor: Medidor): Ajuste | null {
  const bruto = p.estilo.maiusculas ? p.texto.toLocaleUpperCase("pt-BR") : p.texto;
  // Quebra só em espaço comum: o espaço inseparável (antes do "·") segura
  // as duas pontas juntas.
  const paragrafos = bruto.split("\n").map((l) => l.split(/[ \t]+/).filter(Boolean)).filter((l) => l.length);
  if (paragrafos.length === 0) return null;
  for (let tamanho = p.tamanhoMax; tamanho >= p.tamanhoMin - 0.01; tamanho *= 0.96) {
    const medir = (s: string) => medidor.largura(s, { ...p.estilo, maiusculas: false }, tamanho);
    // Palavra maior que a largura: não adianta tentar quebra nenhuma.
    if (paragrafos.some((ps) => ps.some((w) => medir(w) > p.larguraMax))) continue;
    const linhas: string[] = [];
    let largura = 0;
    let ok = true;
    for (const ps of paragrafos) {
      let achou: Quebra | null = null;
      for (let k = 1; k <= Math.min(ps.length, p.maxLinhas); k++) {
        achou = quebrarEm(ps, k, p.larguraMax, medir);
        if (achou) break;
      }
      if (!achou) {
        ok = false;
        break;
      }
      linhas.push(...achou.linhas);
      largura = Math.max(largura, achou.largura);
    }
    if (!ok || linhas.length > p.maxLinhas) continue;
    const altura = linhas.length * tamanho * p.estilo.entrelinha;
    if (altura <= p.alturaMax) return { tamanho, linhas, largura, altura };
  }
  return null;
}

/**
 * Linhas escalonadas: cada linha do título no tamanho que enche a largura.
 *
 * É o cartaz tipográfico clássico — "ENCONTRO" pequeno, "DE JOVENS" enorme.
 * A divisão em linhas é por palavras, equilibrando caracteres; o tamanho de
 * cada linha sai da medida real, preso entre o mínimo e o máximo.
 */
export function escalonar(
  texto: string,
  estilo: EstiloDeTexto,
  larguraMax: number,
  tamanhoMin: number,
  tamanhoMax: number,
  linhas: number,
  medidor: Medidor,
): { linha: string; tamanho: number; largura: number }[] | null {
  const bruto = estilo.maiusculas ? texto.toLocaleUpperCase("pt-BR") : texto;
  const palavras = bruto.split(/[ \t\n]+/).filter(Boolean);
  if (palavras.length < 2) return null;
  const k = Math.min(linhas, palavras.length);
  // Quebra equilibrando caracteres (medidor de 1px por caractere).
  const q = quebrarEm(palavras, k, Math.max(...palavras.map((w) => w.length)) * 3 + 10, (s) => s.length);
  if (!q) return null;
  const saida: { linha: string; tamanho: number; largura: number }[] = [];
  for (const linha of q.linhas) {
    const w1 = medidor.largura(linha, { ...estilo, maiusculas: false }, 100) / 100;
    // 97% da medida: medir a 100px e escalar não é exato ao pixel, e a
    // linha que enche a medida inteira não pode passar dela.
    const tamanho = Math.max(tamanhoMin, Math.min(tamanhoMax, (larguraMax * 0.97) / w1));
    const largura = w1 * tamanho;
    if (largura > larguraMax * 1.001) return null;
    saida.push({ linha, tamanho, largura });
  }
  return saida;
}
