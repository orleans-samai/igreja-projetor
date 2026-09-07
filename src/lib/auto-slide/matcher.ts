import { palavras, parecidas, peso } from "./normalize.ts";

/**
 * Quanto do que foi ouvido cabe dentro de cada slide.
 *
 * A comparação é do ouvido para o slide, nunca o contrário: o trecho ouvido é
 * curto — dois ou três segundos de canto — e o slide tem a estrofe inteira.
 * Perguntar "quanto do slide eu ouvi" daria nota baixa para o acerto certo;
 * a pergunta útil é "o que eu ouvi está neste slide".
 *
 * Duas medidas, porque cada uma erra sozinha:
 *
 * - Cobertura: quantas das palavras ouvidas aparecem no slide, na ordem,
 *   podendo pular. Aguenta o reconhecimento comer palavras, mas premiaria um
 *   slide que só tem as mesmas palavras soltas.
 * - Sequência: a maior sequência contínua em comum. É o que separa a frase
 *   certa de um slide que por acaso repete o vocabulário — e num refrão
 *   repetido é ela que decide.
 */
export interface Pontuacao {
  index: number;
  score: number;
  /** Maior trecho contínuo reconhecido, para explicar a decisão na tela. */
  trecho: string;
}

/** Letra de um slide pronta para comparar, para não repicar a cada janela. */
export interface SlidePreparado {
  index: number;
  palavras: string[];
}

export function prepararSlides(textos: string[]): SlidePreparado[] {
  return textos.map((texto, index) => ({ index, palavras: palavras(texto) }));
}

/** Subsequência comum: aceita buracos, exige ordem. */
function cobertura(ouvido: string[], slide: string[]): number {
  let ganho = 0;
  let j = 0;
  for (const p of ouvido) {
    for (let k = j; k < slide.length; k++) {
      if (parecidas(p, slide[k]!)) {
        ganho += peso(p);
        j = k + 1;
        break;
      }
    }
  }
  return ganho;
}

/** Maior trecho contínuo em comum, e onde ele começa no que foi ouvido. */
function sequencia(ouvido: string[], slide: string[]): { ganho: number; de: number; ate: number } {
  let melhor = { ganho: 0, de: 0, ate: 0 };
  let linha = new Array<number>(slide.length + 1).fill(0);
  for (let i = 1; i <= ouvido.length; i++) {
    const nova = new Array<number>(slide.length + 1).fill(0);
    let ganhoLinha = 0;
    for (let j = 1; j <= slide.length; j++) {
      if (!parecidas(ouvido[i - 1]!, slide[j - 1]!)) continue;
      nova[j] = linha[j - 1]! + 1;
      const tamanho = nova[j]!;
      ganhoLinha = 0;
      for (let k = i - tamanho; k < i; k++) ganhoLinha += peso(ouvido[k]!);
      if (ganhoLinha > melhor.ganho) melhor = { ganho: ganhoLinha, de: i - tamanho, ate: i };
    }
    linha = nova;
  }
  return melhor;
}

/**
 * Nota de 0 a 1 de cada slide contra o trecho ouvido.
 *
 * Trecho curto demais não vale nota: com duas palavras, "e o" casa com o
 * hino inteiro. Abaixo de três palavras a resposta é vazia, e quem chamou
 * decide esperar mais áudio.
 */
export function pontuar(ouvidoTexto: string, slides: SlidePreparado[]): Pontuacao[] {
  const ouvido = palavras(ouvidoTexto);
  if (ouvido.length < 3) return [];
  const total = ouvido.reduce((n, p) => n + peso(p), 0);
  if (total === 0) return [];

  return slides.map(({ index, palavras: alvo }) => {
    if (alvo.length === 0) return { index, score: 0, trecho: "" };
    const seq = sequencia(ouvido, alvo);
    const score = (0.55 * cobertura(ouvido, alvo)) / total + (0.45 * seq.ganho) / total;
    return {
      index,
      score: Math.max(0, Math.min(1, score)),
      trecho: ouvido.slice(seq.de, seq.ate).join(" "),
    };
  });
}

/** O de maior nota, com o segundo colocado junto — a distância entre os dois
 *  é o que diz se a escolha foi clara ou um empate perigoso. */
export function melhorSlide(notas: Pontuacao[]): {
  melhor: Pontuacao | null;
  segundo: Pontuacao | null;
} {
  const ordenadas = [...notas].sort((a, b) => b.score - a.score);
  return { melhor: ordenadas[0] ?? null, segundo: ordenadas[1] ?? null };
}
