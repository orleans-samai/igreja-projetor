/**
 * O teste de desempenho, e o veredito que ele dá.
 *
 * A pergunta que interessa não é "quantos tokens por segundo" — é "isto vai
 * atrapalhar o culto?". Por isso a medida é o tempo até a primeira resposta,
 * quantos comandos o modelo entendeu, e se ele consegue devolver JSON válido:
 * um modelo que conversa bem mas nunca acerta o formato é um modelo que não
 * serve para comandar a cabine.
 */

export interface Medidas {
  /** Tempo até o modelo estar de pé, em ms. */
  carregarMs: number;
  /** Tempo médio até a resposta chegar, em ms. */
  respostaMs: number;
  /** Quantos dos comandos de teste viraram pedido válido. */
  acertos: number;
  /** Quantos comandos foram tentados. */
  tentativas: number;
  /** Memória livre que sobrou, em GB. */
  livreGB: number;
  /** Memória estimada do modelo, em GB. */
  modeloGB: number;
}

export type Veredito = "otimo" | "adequado" | "pode-travar" | "nao-recomendado";

export const ROTULO: Record<Veredito, string> = {
  otimo: "Ótimo",
  adequado: "Adequado",
  "pode-travar": "Pode causar lentidão",
  "nao-recomendado": "Não recomendado",
};

/**
 * O veredito.
 *
 * Reprova por três motivos independentes, e basta um: demora que o operador
 * sente no meio do culto, erro de comando que faria a IA fazer a coisa
 * errada, e memória sem folga — que é o que trava a projeção, não a IA.
 */
export function avaliar(m: Medidas): { veredito: Veredito; porque: string } {
  const folgaGB = m.livreGB - m.modeloGB;
  const taxa = m.tentativas > 0 ? m.acertos / m.tentativas : 0;

  if (folgaGB < 0.4) {
    return {
      veredito: "nao-recomendado",
      porque: "Quase não sobra memória para a projeção com este modelo carregado.",
    };
  }
  if (taxa < 0.5) {
    return {
      veredito: "nao-recomendado",
      porque: "Este modelo errou a maior parte dos comandos de teste.",
    };
  }
  if (m.respostaMs > 12000 || m.carregarMs > 60000) {
    return {
      veredito: "pode-travar",
      porque: "Demora o bastante para o operador sentir no meio do culto.",
    };
  }
  if (m.respostaMs > 5000 || folgaGB < 1.5 || taxa < 0.8) {
    return {
      veredito: "adequado",
      porque: "Dá para usar, de preferência no modo sob demanda.",
    };
  }
  return { veredito: "otimo", porque: "Rápido e certeiro nesta máquina." };
}

/** Se o resultado pede para não deixar o modelo carregado o tempo todo. */
export function recomendaSobDemanda(v: Veredito): boolean {
  return v === "adequado" || v === "pode-travar";
}
