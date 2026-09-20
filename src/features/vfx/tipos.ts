/**
 * VFX: efeitos visuais e vídeos dinâmicos.
 *
 * Uma composição é um punhado de números, não um vídeo. Isso é o ponto
 * inteiro da área: o projeto editável pesa alguns kilobytes e pode ser
 * reaberto e ajustado no ano que vem, enquanto o resultado — o arquivo que
 * o culto realmente usa — é renderizado uma vez e vira vídeo comum.
 *
 * Efeito em tempo real custa CPU a cada quadro, no mesmo computador que
 * está projetando. Vídeo pronto custa o que qualquer vídeo custa. Por isso
 * a área existe com um botão grande no fim: editar aqui, projetar de lá.
 */

/** Como o app trata os efeitos pesados. */
export type VfxModo = "ligado" | "desligado" | "auto";

/** Teto de custo que a composição pode gastar por quadro. */
export type VfxQualidade = "leve" | "equilibrado" | "alta";

/** Ritmo da animação. "manual" usa o número que o operador escolheu. */
export type VfxRitmo = "lenta" | "normal" | "rapida" | "manual";

/** Como um texto entra e sai da tela. */
export type VfxEntrada = "nenhuma" | "surgir" | "subir" | "escala";

/** As gavetas do editor, na ordem em que aparecem. */
export type VfxCategoria =
  | "luz"
  | "particulas"
  | "movimento"
  | "cor"
  | "distorcoes"
  | "texto"
  | "transicoes";

export const CATEGORIAS: { id: VfxCategoria; rotulo: string; dica: string }[] = [
  { id: "luz", rotulo: "Luz e brilho", dica: "Quanta luz a composição emite." },
  { id: "particulas", rotulo: "Partículas", dica: "Pontinhos que flutuam no fundo." },
  { id: "movimento", rotulo: "Movimento", dica: "O que se mexe, e em que ritmo." },
  { id: "cor", rotulo: "Cor e atmosfera", dica: "As duas cores e o ar da cena." },
  { id: "distorcoes", rotulo: "Distorções", dica: "O que deforma a imagem. Pesa mais." },
  { id: "texto", rotulo: "Texto animado", dica: "Uma frase entrando e saindo." },
  { id: "transicoes", rotulo: "Transições", dica: "Tempo, repetição e entrada da cena." },
];

/**
 * Uma composição visual.
 *
 * Todos os números vão de 0 a 100 quando são "quanto", em porcentagem
 * quando são opacidade ou brilho, e em segundos quando são tempo. É uma
 * escolha de quem usa, não de quem programa: o operador da igreja mexe num
 * controle deslizante que vai de nada até tudo, e não precisa saber o que
 * é um desvio-padrão de gaussiana.
 */
export interface VfxComposicao {
  // ── Luz e brilho ──────────────────────────────────────────────────
  /** 0 a 200%. 100 é o natural da cena. */
  brilho: number;
  /** 0 a 100. Halo em volta do que é claro. */
  glow: number;

  // ── Partículas ────────────────────────────────────────────────────
  /** 0 a 100. Zero não desenha nenhuma, e nem entra no laço. */
  particulas: number;
  /** 0 a 100. O tamanho de cada pontinho. */
  particulaTamanho: number;

  // ── Movimento ─────────────────────────────────────────────────────
  ritmo: VfxRitmo;
  /** Multiplicador do tempo quando o ritmo é manual. 0.1 a 3. */
  velocidade: number;
  /** 0 a 100. A cena respira junto com a batida. */
  pulsacao: number;
  /** 0 a 100. Aproximação lenta, sem corte. */
  zoom: number;
  /** 0 a 100. O fundo desliza devagar. */
  movimentoFundo: number;

  // ── Cor e atmosfera ───────────────────────────────────────────────
  corPrimaria: string;
  corSecundaria: string;
  /** 0 a 100. Escurece as bordas e junta o olho no meio. */
  vinheta: number;
  /** 0 a 100. Grão de filme; disfarça faixa de cor em degradê. */
  granulacao: number;

  // ── Distorções ────────────────────────────────────────────────────
  /** 0 a 100. Onda que corre pela imagem. */
  ondulacao: number;
  /** 0 a 100. Falha de sinal, em lampejos. */
  glitch: number;
  /** 0 a 100. Vermelho e azul saem de registro. */
  separacaoRgb: number;
  /** 0 a 100. Desfoque geral. */
  desfoque: number;

  // ── Texto animado ─────────────────────────────────────────────────
  /** Vazio não desenha texto nenhum. */
  texto: string;
  textoEntrada: VfxEntrada;
  textoSaida: VfxEntrada;

  // ── Transições e tempo ────────────────────────────────────────────
  /** 0 a 100. A composição inteira por cima do preto. */
  opacidade: number;
  /** 0 a 100. Multiplica a força de todo efeito de uma vez. */
  intensidade: number;
  /** Segundos de um ciclo. */
  duracao: number;
  /** Se o ciclo recomeça sozinho. */
  repetir: boolean;
  /** Segundos de fade no começo e no fim do ciclo. */
  entrada: number;
  saida: number;
}

/** Um vídeo que saiu desta composição e já está na pasta da igreja. */
export interface VfxVideoGerado {
  /** O mesmo id da biblioteca de mídia: `midia:video:<arquivo>`. */
  id: string;
  nome: string;
  emMs: number;
}

/** Um projeto salvo da área Vídeos dinâmicos. */
export interface VfxProjeto {
  id: string;
  nome: string;
  comp: VfxComposicao;
  /** De qual modelo nasceu, para o editor poder dizer. Vazio se do zero. */
  modelo: string;
  criadoEm: number;
  atualizadoEm: number;
  /** O que já foi renderizado a partir dele. O projeto continua editável. */
  gerados: VfxVideoGerado[];
}

/** O que a confirmação de "Salvar como vídeo" coleta. */
export interface VfxPedidoDeVideo {
  nome: string;
  largura: number;
  altura: number;
  /** Segundos. */
  duracao: number;
  qualidade: VfxQualidade;
}
