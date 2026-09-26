/**
 * O documento de uma arte, versão 2: camadas editáveis em pixels.
 *
 * Um documento só serve a quatro donos, e é por isso que ele existe: o
 * gerador escreve, o Konva desenha, o editor modifica e a exportação lê. Se
 * a prévia e o arquivo tivessem estruturas próprias, o que a pessoa aprova
 * e o que ela recebe iam divergir com o tempo.
 *
 * A composição final vai inteira para o disco — não só a semente. O gerador
 * vai mudar (mais famílias, fontes melhores), e uma arte salva no ano
 * passado não pode mudar de cara porque o app foi atualizado. A semente fica
 * para gerar variações, nunca para reconstruir o que foi salvo.
 *
 * Coordenadas em pixels do formato, com origem no canto superior esquerdo.
 * A v1 guardava frações para "trocar de formato sem esticar"; aqui trocar de
 * formato é recompor com as regras da família (ver `adaptar` no gerador),
 * que é o que o formato pede de verdade — um story não é um quadrado alto.
 */

import type { Briefing } from "./briefing.ts";

export const VERSAO_ESQUEMA = 2;

/** Sobe quando as regras de composição mudam; entra na reprodutibilidade. */
export const VERSAO_GERADOR = 1;

export type Alinhamento = "left" | "center" | "right";
export type AlinhamentoVertical = "top" | "middle" | "bottom";

/** Um retângulo em fração da própria caixa (0 a 1). */
export interface CaixaRelativa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Ponto {
  x: number;
  y: number;
}

export type Preenchimento =
  | { tipo: "solido"; cor: string }
  | { tipo: "linear"; cores: string[]; angulo: number }
  | { tipo: "radial"; cores: string[]; centro: Ponto; raio: number };

export interface Sombra {
  cor: string;
  desfoque: number;
  x: number;
  y: number;
  opacidade: number;
}

/**
 * O que a camada é na composição.
 *
 * O papel decide o que o editor pode apagar, o que a validação confere e o
 * que a assinatura estrutural mede. "decoracao" e "suporte" (painel atrás
 * do texto) podem ficar debaixo de texto de propósito; "conteudo" não pode
 * trombar com outro conteúdo.
 */
export type Papel =
  | "fundo"
  | "titulo"
  | "subtitulo"
  | "mensagem"
  | "data"
  | "info"
  | "kicker"
  | "organizacao"
  | "versiculo"
  | "logo"
  | "imagem"
  | "ilustracao"
  | "painel"
  | "decoracao"
  | "textura";

export interface CamadaBase {
  id: string;
  /** Nome para a lista de camadas, em palavras de gente. */
  nome: string;
  papel: Papel;
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Graus, em torno do canto superior esquerdo (como o Konva). */
  rotacao: number;
  opacidade: number;
  oculta?: boolean;
  travada?: boolean;
  /** Pode ser apagada sem desmontar a arte (enfeite, texto secundário). */
  opcional?: boolean;
  /** Ids com quem esta camada pode se sobrepor de propósito. */
  sobrepoe?: string[];
}

export interface CamadaFundo extends CamadaBase {
  tipo: "fundo";
  preenchimento: Preenchimento;
}

/**
 * Máscara da imagem, desenhada na caixa da camada.
 *
 * "caminho" é um path SVG em coordenadas 0–1 da caixa: o mesmo desenho
 * serve a qualquer tamanho, e o editor pode redimensionar sem refazer.
 */
export type Mascara =
  | { tipo: "retangulo"; raio: number }
  | { tipo: "circulo" }
  | { tipo: "arco" }
  | { tipo: "caminho"; d: string };

/**
 * Proteção local do texto que fica por cima da foto.
 *
 * Não é um véu uniforme: escurece (ou clareia) só do lado em que o texto
 * está, na medida que a foto pede. Foto que já tem área limpa não recebe
 * nada.
 */
export interface Protecao {
  cor: string;
  /** De onde a proteção começa forte: o lado do texto. */
  lado: "baixo" | "cima" | "esquerda" | "direita" | "tudo";
  /** Opacidade na borda forte. */
  forca: number;
  /** Até onde vai, em fração da caixa. */
  alcance: number;
  /**
   * Até onde a força fica cheia antes de começar a esmaecer — cobre a
   * área do texto inteira, não só a primeira linha.
   */
  plato?: number;
}

export interface CamadaImagem extends CamadaBase {
  tipo: "imagem";
  src: string;
  /** Recurso do catálogo, ou "usuario:<n>" para foto do briefing. */
  recursoId: string;
  origem: "usuario" | "catalogo";
  larguraOriginal: number;
  alturaOriginal: number;
  /** Recorte em fração da imagem original. */
  recorte: CaixaRelativa;
  /** O que não pode sair do quadro ao recortar. */
  pontoFocal: Ponto;
  mascara: Mascara;
  contorno?: { cor: string; espessura: number };
  sombra?: Sombra;
  protecao?: Protecao;
}

export interface CamadaLogo extends CamadaBase {
  tipo: "logo";
  src: string;
  larguraOriginal: number;
  alturaOriginal: number;
  /** Sempre verdadeiro por padrão: logo esticada é logo estragada. */
  manterProporcao: boolean;
  /** Plaquinha atrás da logo quando ela não contrasta com o fundo. */
  placa?: { cor: string; raio: number; margem: number };
}

export type TipoDeForma = "retangulo" | "circulo" | "elipse" | "linha" | "caminho";

export interface CamadaForma extends CamadaBase {
  tipo: "forma";
  forma: TipoDeForma;
  preenchimento: Preenchimento | null;
  contorno?: { cor: string; espessura: number; tracejado?: number[] };
  /** Retângulo: raio dos cantos em px. */
  raio?: number;
  /** "caminho": path SVG em 0–1 da caixa. "linha": pontos em 0–1. */
  d?: string;
  pontos?: number[];
  sombra?: Sombra;
}

export type TipoDeTextura = "papel" | "pontilhado" | "pautado" | "quadriculado" | "grao" | "hachura" | "ondulado";

export interface CamadaTextura extends CamadaBase {
  tipo: "textura";
  textura: TipoDeTextura;
  cor: string;
  /** Tamanho do ladrilho em px. */
  escala: number;
  /** O ladrilho pronto (SVG em data URL) — fica guardado para não mudar. */
  src: string;
}

export interface CamadaTexto extends CamadaBase {
  tipo: "texto";
  /** O texto como a pessoa escreveu. */
  texto: string;
  /**
   * As quebras que o ajuste tipográfico escolheu, com "\n". Some quando a
   * pessoa edita o texto — aí o editor recalcula.
   */
  quebras?: string;
  /** De qual campo do briefing o texto veio. */
  campo?: string;
  fonte: string;
  peso: number;
  estilo: "normal" | "italic";
  /** Corpo em px. */
  tamanho: number;
  /** Multiplicador do corpo. */
  entrelinha: number;
  /** Espaço entre letras em px. */
  espacamento: number;
  alinhamento: Alinhamento;
  alinhamentoVertical: AlinhamentoVertical;
  cor: string;
  maiusculas: boolean;
  sombra?: Sombra;
}

export interface CamadaGrupo extends CamadaBase {
  tipo: "grupo";
  /** Coordenadas dos filhos são relativas ao grupo. */
  filhos: Camada[];
}

export type Camada =
  | CamadaFundo
  | CamadaImagem
  | CamadaLogo
  | CamadaForma
  | CamadaTextura
  | CamadaTexto
  | CamadaGrupo;

export type TipoDeCamada = Camada["tipo"];

export type FamiliaId =
  | "editorial"
  | "fotografia"
  | "tipografica"
  | "colagem"
  | "geometrica"
  | "minimalista"
  | "ilustrada"
  | "institucional"
  | "molduras"
  | "organica"
  | "cartaz"
  | "capa";

export type Luminosidade = "clara" | "media" | "escura";
export type Densidade = "baixa" | "media" | "alta";

/** Uma célula da grade 3×3 do quadro: 0 é o canto de cima à esquerda. */
export type Celula = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * A assinatura estrutural de uma composição.
 *
 * É o que o gerador compara para dizer se duas opções são a mesma arte com
 * outra roupa. Cor não entra: duas artes com o título no mesmo lugar, a foto
 * no mesmo lugar e o mesmo peso de texto são a mesma arte, em azul ou em
 * verde.
 */
export interface Assinatura {
  familia: FamiliaId;
  variante: string;
  titulo: Celula[];
  info: Celula[];
  logo: Celula[];
  imagens: Celula[];
  alinhamento: Alinhamento;
  centralizada: boolean;
  /** 0 sem imagem, 1 pequena, 2 média, 3 dominante. */
  pesoDaImagem: 0 | 1 | 2 | 3;
  /** Altura do título em fração do quadro, em faixas: 0 a 3. */
  escalaDoTitulo: 0 | 1 | 2 | 3;
  paineis: number;
  densidade: Densidade;
  luminosidade: Luminosidade;
  /** A imagem dominante, quando há. */
  imagemDominante: string | null;
  recursos: string[];
}

/** As decisões de estilo que a opção tomou — para regenerar só uma delas. */
export interface Direcao {
  paletaId: string;
  tipografiaId: string;
  luminosidade: Luminosidade;
  densidade: Densidade;
  /** Imagens escolhidas, na ordem das regiões. */
  imagens: string[];
}

export interface RecursoUsado {
  id: string;
  tipo: "foto" | "ilustracao" | "textura" | "forma" | "logo";
  origem: string;
  licenca: string;
}

export interface Exportacao {
  formato: "png" | "jpeg";
  qualidade: number;
}

export interface DocumentoDeArte {
  v: typeof VERSAO_ESQUEMA;
  id: string;
  nome: string;
  formatoId: string;
  largura: number;
  altura: number;
  briefing: Briefing;
  semente: number;
  versaoGerador: number;
  versaoCatalogo: number;
  familia: FamiliaId;
  variante: string;
  /** "Editorial claro" — o que a galeria mostra. */
  rotulo: string;
  direcao: Direcao;
  recursos: RecursoUsado[];
  camadas: Camada[];
  /** Como o gerador entregou: "Restaurar a composição original". */
  original: Camada[];
  assinatura: Assinatura;
  exportacao: Exportacao;
  /** Foto pequena demais para o tamanho em que aparece, e afins. */
  avisos: string[];
  favorito?: boolean;
  /** Alguém mexeu à mão: regenerar pede confirmação. */
  editadoManualmente?: boolean;
  criadoEm: number;
  atualizadoEm: number;
}

/** Percorre as camadas, entrando nos grupos, com a posição absoluta. */
export function* todasAsCamadas(
  camadas: Camada[],
  dx = 0,
  dy = 0,
): Generator<{ camada: Camada; x: number; y: number }> {
  for (const c of camadas) {
    yield { camada: c, x: c.x + dx, y: c.y + dy };
    if (c.tipo === "grupo") yield* todasAsCamadas(c.filhos, c.x + dx, c.y + dy);
  }
}

/** Acha uma camada pelo id, em qualquer profundidade. */
export function acharCamada(camadas: Camada[], id: string): Camada | null {
  for (const { camada } of todasAsCamadas(camadas)) if (camada.id === id) return camada;
  return null;
}

/** Troca uma camada pelo id, em qualquer profundidade, sem mutar. */
export function trocarCamada(camadas: Camada[], id: string, troca: (c: Camada) => Camada | null): Camada[] {
  const saida: Camada[] = [];
  for (const c of camadas) {
    if (c.id === id) {
      const nova = troca(c);
      if (nova) saida.push(nova);
      continue;
    }
    saida.push(c.tipo === "grupo" ? { ...c, filhos: trocarCamada(c.filhos, id, troca) } : c);
  }
  return saida;
}

/** O texto como vai ser desenhado: caixa alta aplicada, quebras escolhidas. */
export function textoDesenhado(c: CamadaTexto): string {
  const base = c.quebras ?? c.texto;
  return c.maiusculas ? base.toLocaleUpperCase("pt-BR") : base;
}

/**
 * A caixa que a camada ocupa de fato na tela, já girada. Rotação é em
 * torno do canto de cima à esquerda, como no Konva.
 */
export function caixaVisual(c: { x: number; y: number; largura: number; altura: number; rotacao: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (!c.rotacao) return { x: c.x, y: c.y, w: c.largura, h: c.altura };
  const ang = (c.rotacao * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sen = Math.sin(ang);
  const pts = [
    [0, 0],
    [c.largura, 0],
    [0, c.altura],
    [c.largura, c.altura],
  ].map(([x, y]) => [c.x + x * cos - y * sen, c.y + x * sen + y * cos]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
