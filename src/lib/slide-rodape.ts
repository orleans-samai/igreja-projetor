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
