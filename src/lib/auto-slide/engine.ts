import { melhorSlide, pontuar, prepararSlides, type Pontuacao, type SlidePreparado } from "./matcher.ts";

/**
 * O motor do Auto-Slide.
 *
 * Ele não troca slide nenhum: decide qual slide *deveria* estar no ar e
 * devolve a decisão. Quem projeta continua sendo o mecanismo de apresentação
 * de sempre. Essa separação é o que permite testar a decisão inteira sem
 * áudio, sem relógio e sem tela — o tempo entra por parâmetro.
 *
 * A regra de ouro é a do culto, não a da precisão: errar para menos é ficar
 * no slide certo por mais dois segundos; errar para mais é a igreja lendo o
 * verso errado. Então toda dúvida se resolve ficando parado.
 */

export type Perfil = "conservador" | "equilibrado" | "rapido";

export interface AutoSlideConfig {
  /** Nota mínima, de 0 a 1, para um slide ser considerado. */
  confianca: number;
  /** Tempo mínimo entre duas trocas automáticas. */
  cooldownMs: number;
  /** Quantas janelas seguidas precisam apontar o mesmo slide. */
  confirmacoes: number;
  /** Deixar o motor voltar para um slide já cantado (refrão que retorna). */
  permitirVoltar: boolean;
  /** Trocar já na primeira janela quando a nota for altíssima. */
  antecipar: boolean;
  /** Quantos slides à frente contam como "o próximo trecho". */
  alcance: number;
}

export const PERFIS: Record<Perfil, AutoSlideConfig> = {
  conservador: {
    confianca: 0.9,
    cooldownMs: 2500,
    confirmacoes: 2,
    permitirVoltar: false,
    antecipar: false,
    alcance: 2,
  },
  equilibrado: {
    confianca: 0.85,
    cooldownMs: 1500,
    confirmacoes: 2,
    permitirVoltar: true,
    antecipar: true,
    alcance: 3,
  },
  rapido: {
    confianca: 0.78,
    cooldownMs: 900,
    confirmacoes: 1,
    permitirVoltar: true,
    antecipar: true,
    alcance: 4,
  },
};

/** Nota altíssima que dispensa a confirmação, quando antecipar está ligado. */
const CERTEZA = 0.95;
/** O segundo colocado precisa ficar esta distância atrás para a escolha valer. */
const MARGEM = 0.08;

export type Motivo =
  | "trocado"
  | "ja-esta-nele"
  | "confianca-baixa"
  | "empate"
  | "aguardando-confirmacao"
  | "cooldown"
  | "volta-bloqueada"
  | "audio-curto";

export interface Decisao {
  trocar: boolean;
  /** Slide que o motor pede. Igual ao atual quando não há troca. */
  index: number;
  score: number;
  motivo: Motivo;
  /** O que o motor entendeu do trecho, para mostrar ao operador. */
  trecho: string;
  /** Notas de todos os slides, na ordem dos slides. */
  notas: Pontuacao[];
}

export class AutoSlideEngine {
  private config: AutoSlideConfig;
  private slides: SlidePreparado[] = [];
  private candidato: number | null = null;
  private repeticoes = 0;
  private ultimaTrocaEm = 0;

  constructor(config: AutoSlideConfig = PERFIS.equilibrado) {
    this.config = config;
  }

  ajustar(config: Partial<AutoSlideConfig>) {
    this.config = { ...this.config, ...config };
  }

  /** Troca de música: a letra é outra e o contexto anterior não vale mais. */
  carregar(textos: string[]) {
    this.slides = prepararSlides(textos);
    this.candidato = null;
    this.repeticoes = 0;
  }

  /**
   * O operador mexeu.
   *
   * Ele manda. O motor esquece o que estava perseguindo e respeita um
   * cooldown a partir daqui, para não puxar o slide de volta no segundo
   * seguinte e brigar com quem está na cabine.
   */
  marcarManual(agora: number) {
    this.candidato = null;
    this.repeticoes = 0;
    this.ultimaTrocaEm = agora;
  }

  /**
   * Peso de cada slide conforme a distância do que está no ar.
   *
   * O canto anda para a frente. O slide seguinte é o palpite natural, o
   * distante precisa de muito mais evidência, e voltar precisa de mais ainda
   * — refrão que retorna existe, engano que joga a igreja três estrofes atrás
   * também.
   */
  private vies(index: number, atual: number): number {
    const d = index - atual;
    if (d === 0) return 1;
    if (d > 0 && d <= this.config.alcance) return 1;
    if (d > 0) return 0.8;
    if (!this.config.permitirVoltar) return 0;
    return d >= -this.config.alcance ? 0.88 : 0.7;
  }

  decidir(texto: string, atual: number, agora: number): Decisao {
    const notas = pontuar(texto, this.slides);
    const vazio = (motivo: Motivo): Decisao => ({
      trocar: false,
      index: atual,
      score: 0,
      motivo,
      trecho: "",
      notas,
    });
    if (notas.length === 0) return vazio("audio-curto");

    // A evidência é do trecho anterior e voltar está desligado. Isso precisa
    // ser dito com esse nome: pesada pelo contexto, a nota cairia a zero e a
    // decisão sairia rotulada "confiança baixa", escondendo do operador o
    // único ajuste que resolveria — ligar o retorno.
    const cru = melhorSlide(notas).melhor;
    if (
      !this.config.permitirVoltar &&
      cru &&
      cru.index < atual &&
      cru.score >= this.config.confianca
    ) {
      this.candidato = null;
      this.repeticoes = 0;
      return {
        trocar: false,
        index: atual,
        score: cru.score,
        motivo: "volta-bloqueada",
        trecho: cru.trecho,
        notas,
      };
    }

    const comVies = notas.map((n) => ({ ...n, score: n.score * this.vies(n.index, atual) }));
    const { melhor, segundo } = melhorSlide(comVies);
    if (!melhor) return vazio("confianca-baixa");

    const resposta = (trocar: boolean, motivo: Motivo): Decisao => ({
      trocar,
      index: trocar ? melhor.index : atual,
      score: melhor.score,
      motivo,
      trecho: melhor.trecho,
      notas,
    });

    if (melhor.score < this.config.confianca) {
      this.candidato = null;
      this.repeticoes = 0;
      return resposta(false, "confianca-baixa");
    }

    if (melhor.index === atual) {
      // Já estamos no slide certo: o contexto se confirma, nada a fazer.
      this.candidato = null;
      this.repeticoes = 0;
      return resposta(false, "ja-esta-nele");
    }

    // Dois slides igualmente prováveis costumam ser o mesmo refrão repetido.
    // Trocar no cara ou coroa é o pior dos mundos: espera-se mais áudio.
    if (segundo && segundo.index !== melhor.index && melhor.score - segundo.score < MARGEM) {
      return resposta(false, "empate");
    }

    if (this.candidato === melhor.index) this.repeticoes += 1;
    else {
      this.candidato = melhor.index;
      this.repeticoes = 1;
    }

    const certo = this.config.antecipar && melhor.score >= CERTEZA;
    if (!certo && this.repeticoes < this.config.confirmacoes) {
      return resposta(false, "aguardando-confirmacao");
    }

    if (agora - this.ultimaTrocaEm < this.config.cooldownMs) {
      return resposta(false, "cooldown");
    }

    this.ultimaTrocaEm = agora;
    this.candidato = null;
    this.repeticoes = 0;
    return resposta(true, "trocado");
  }
}
