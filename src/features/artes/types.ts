/**
 * O documento de uma arte.
 *
 * Duas decisões governam tudo aqui.
 *
 * A primeira: coordenadas são fração do quadro, de 0 a 1 — nunca pixels. É o
 * que permite a mesma arte virar quadrado, story e cartaz sem esticar nada:
 * o template diz onde as coisas ficam em proporção, e cada formato recalcula.
 * Guardar pixels amarraria a arte ao tamanho em que ela nasceu.
 *
 * A segunda: o mesmo documento desenha a prévia e a exportação. Não há um
 * renderizador para a tela e outro para o arquivo — se houvesse, o que a
 * pessoa aprova e o que ela recebe iam divergir com o tempo, e ela só
 * descobriria depois de imprimir.
 */

export const VERSAO_DOCUMENTO = 1;

/** Os campos que o operador preenche uma vez e a arte inteira reaproveita. */
export interface DadosDoEvento {
  titulo: string;
  subtitulo: string;
  tema: string;
  palavraBase: string;
  referencia: string;
  textoBiblico: string;
  data: string;
  horario: string;
  local: string;
  endereco: string;
  pregador: string;
  ministerio: string;
  chamada: string;
  informacoes: string;
  contato: string;
  redes: string;
  igreja: string;
  logo: string;
  /** Endereço da foto de fundo — referência, nunca os bytes. */
  imagem: string;
}

export function dadosVazios(): DadosDoEvento {
  return {
    titulo: "",
    subtitulo: "",
    tema: "",
    palavraBase: "",
    referencia: "",
    textoBiblico: "",
    data: "",
    horario: "",
    local: "",
    endereco: "",
    pregador: "",
    ministerio: "",
    chamada: "",
    informacoes: "",
    contato: "",
    redes: "",
    igreja: "",
    logo: "",
    imagem: "",
  };
}

export type CampoDeTexto = Exclude<keyof DadosDoEvento, "logo" | "imagem">;

export type Alinhamento = "left" | "center" | "right";

/** Um retângulo em fração do quadro: 0 é a borda, 1 é a borda oposta. */
export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface ElementoTexto {
  tipo: "texto";
  id: string;
  /** De qual campo do formulário este texto vem, quando vem de um. */
  campo?: CampoDeTexto;
  texto: string;
  caixa: Caixa;
  /** Corpo da letra como fração da altura do quadro — escala com o formato. */
  tamanho: number;
  peso: number;
  cor: string;
  alinhamento: Alinhamento;
  entrelinha: number;
  espacamento: number;
  maiuscula: boolean;
  fonte: string;
  /** Sombra suave, para texto sobre foto. */
  sombra: boolean;
  oculto?: boolean;
  travado?: boolean;
}

export interface ElementoImagem {
  tipo: "imagem";
  id: string;
  src: string;
  caixa: Caixa;
  ajuste: "cover" | "contain";
  opacidade: number;
  /** Cantos arredondados, em fração da menor dimensão do elemento. */
  raio: number;
  oculto?: boolean;
  travado?: boolean;
}

export interface ElementoForma {
  tipo: "forma";
  id: string;
  forma: "retangulo" | "circulo" | "faixa";
  caixa: Caixa;
  cor: string;
  opacidade: number;
  raio: number;
  oculto?: boolean;
  travado?: boolean;
}

export interface ElementoFundo {
  tipo: "fundo";
  id: string;
  /** Cor sólida, dois tons em gradiente, ou uma foto por baixo de tudo. */
  estilo: "solido" | "gradiente" | "radial" | "foto";
  cores: string[];
  /** Graus, para o gradiente linear. */
  angulo: number;
  src?: string;
  /** Véu escuro sobre a foto, para o texto ter contraste. */
  veu: number;
}

/**
 * Luz e profundidade por cima do fundo, por baixo do texto.
 *
 * É uma camada própria, e não um campo do fundo, porque ela se liga e se
 * desliga sozinha: a mesma paleta com névoa e sem névoa são duas artes, e
 * o editor precisa poder apagar só a atmosfera.
 */
export interface ElementoAtmosfera {
  tipo: "atmosfera";
  id: string;
  atmosfera: import("./atmosfera.ts").Atmosfera;
  /** A cor que a luz empresta — normalmente o destaque da paleta. */
  cor: string;
  /** O mesmo desenho sai da mesma semente, sempre. */
  semente: number;
  /** Fundo claro inverte a luz: ela escurece em vez de clarear. */
  clara: boolean;
  oculto?: boolean;
  travado?: boolean;
}

/**
 * Os elementos que ocupam um retângulo na arte.
 *
 * Fundo e atmosfera não entram: os dois cobrem o quadro inteiro por
 * definição, e perguntar onde eles estão não faz sentido. Quem verifica
 * margem, arrasta e corrige posição trabalha só com estes.
 */
export type ElementoComCaixa = ElementoImagem | ElementoForma | ElementoTexto;

export function temCaixa(el: Elemento): el is ElementoComCaixa {
  return el.tipo === "imagem" || el.tipo === "forma" || el.tipo === "texto";
}

export type Elemento =
  | ElementoFundo
  | ElementoAtmosfera
  | ElementoImagem
  | ElementoForma
  | ElementoTexto;

export interface Documento {
  v: typeof VERSAO_DOCUMENTO;
  id: string;
  nome: string;
  formatoId: string;
  largura: number;
  altura: number;
  templateId: string;
  semente: number;
  dados: DadosDoEvento;
  elementos: Elemento[];
  criadoEm: number;
  atualizadoEm: number;
}
