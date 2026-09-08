/**
 * Normalização de letra para comparação.
 *
 * O reconhecimento nunca devolve o que está cadastrado. Ele ouve "minha alma"
 * onde a letra diz "minh'alma", escreve "ti" sem maiúscula, come a vírgula e
 * às vezes troca uma consoante. Comparar texto cru seria comparar duas
 * grafias diferentes da mesma frase e concluir que não batem.
 *
 * Então tudo desce para o mesmo denominador antes de qualquer conta: sem
 * acento, sem pontuação, sem caixa, sem espaço sobrando. O apóstrofo vira
 * espaço em vez de sumir — "minh'alma" precisa virar duas palavras para
 * encontrar "minha alma", e não "minhalma", que não encontraria nada.
 */

/** Marcações de seção que o operador escreve na letra e ninguém canta. */
const MARCACOES = /^\s*[[(](coro|refr[aã]o|verso|ponte|final|intro|solo)[^\])]*[\])]\s*$/i;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras de uma frase, já normalizadas e sem as marcações de seção. */
export function palavras(texto: string): string[] {
  return texto
    .split("\n")
    .filter((linha) => !MARCACOES.test(linha))
    .map(normalizar)
    .join(" ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Peso de uma palavra na comparação.
 *
 * "e", "o", "de" aparecem em todo slide e não distinguem nada; acertar
 * "aleluia" diz muito mais. O peso cresce com o tamanho e satura em seis
 * letras, que é onde a palavra já é rara o bastante.
 */
export function peso(palavra: string): number {
  return Math.min(palavra.length, 6);
}

/** Distância de edição, com corte: acima do limite não interessa quanto é. */
export function distancia(a: string, b: string, limite: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(atual[j - 1]! + 1, anterior[j]! + 1, anterior[j - 1]! + custo);
      atual.push(v);
      if (v < menor) menor = v;
    }
    if (menor > limite) return limite + 1;
    anterior = atual;
  }
  return anterior[b.length]!;
}

/**
 * Duas palavras são a mesma para efeito de canto.
 *
 * Tolera o erro de uma letra em palavras curtas e de duas em palavras longas,
 * e aceita prefixo — o reconhecimento corta o fim da palavra com frequência,
 * e "cantar" contra "cantando" é a mesma ideia sendo cantada.
 */
export function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const curta = a.length <= b.length ? a : b;
  const longa = a.length <= b.length ? b : a;
  if (curta.length >= 4 && longa.startsWith(curta)) return true;
  if (curta.length < 4) return false;
  const limite = longa.length >= 7 ? 2 : 1;
  return distancia(a, b, limite) <= limite;
}
