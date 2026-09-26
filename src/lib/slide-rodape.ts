/**
 * O texto fixo do telão — título da música, referência do versículo — tem um
 * endereço só: o rodapé.
 *
 * Isto já foi diferente. O título era desenhado no alto, à esquerda, e a
 * igreja lia "Efésios 6" pendurado num canto enquanto a letra corria no meio
 * da tela. Duas informações fixas em dois cantos diferentes é o que faz o
 * olho procurar; uma só, sempre no mesmo lugar, é o que faz o olho ignorar.
 *
 * Por isso a regra mora aqui, num módulo próprio e com teste: quem mexer no
 * desenho do slide esbarra nela antes de espalhar texto pela tela de novo.
 */
export function legendaDoRodape(titulo?: string, referencia?: string): string {
  return [titulo, referencia]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * As margens do telão, com a letra sempre no meio.
 *
 * A igreja pediu: letra nenhuma lá embaixo ou lá em cima, sempre centrada.
 * Margem de cima diferente da de baixo — de um pacote importado, de um
 * ajuste antigo — empurrava o versículo para um lado. Em cima e embaixo
 * valem a média das duas: o espaço para o texto é o mesmo, e o centro é o
 * centro da tela. Os lados ficam como estão.
 */
export function margensCentradas(m: { t: number; r: number; b: number; l: number }): {
  t: number;
  r: number;
  b: number;
  l: number;
} {
  const v = (m.t + m.b) / 2;
  return { t: v, r: m.r, b: v, l: m.l };
}
