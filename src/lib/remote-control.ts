import type { Deck, OutputStatus } from "@/lib/types";

/**
 * Controle remoto pelo celular — tipos e o mapeamento de comandos.
 *
 * O servidor mora em desktop/remote-control.cjs, que é CommonJS e não lê
 * tipos daqui. A lista de ações abaixo é repetida lá de propósito: são dois
 * lados que precisam concordar sem poder importar um do outro, e os testes
 * dos dois lados travam o mesmo conjunto de sete strings.
 */
export type AcaoRemota =
  | "proximo"
  | "anterior"
  | "preto"
  | "logo"
  | "ocultar-letra"
  | "parar"
  | "proximo-item"
  // Transporte do vídeo local que está no telão.
  | "tocar"
  | "pausar"
  | "parar-midia";

/**
 * O que cada aparelho pode fazer.
 *
 * Em ordem: quem pode editar também conversa, quem controla também edita. O
 * PIN prova que a pessoa está na sala; a permissão é o que a cabine concede
 * depois de ver o nome do aparelho na lista.
 */
export type PermissaoRemota = "chat" | "editor" | "controle";

export interface DispositivoRemoto {
  id: string;
  nome: string;
  permissao: PermissaoRemota;
  criadoEm: number;
  ultimoVisto: number;
  online: boolean;
}

export interface MensagemChat {
  id: string;
  de: string;
  texto: string;
  em: number;
  daCabine: boolean;
  /**
   * Recado falado, como endereço `data:` de áudio.
   *
   * Vive só na memória da sessão — o chat não é persistido, e um culto de
   * recados gravados não deve engordar a biblioteca da igreja no disco.
   */
  audio?: string;
  /** Duração em segundos, para o player mostrar antes de tocar. */
  segundos?: number;
}

/** O que chega do celular pelo processo principal, fora o transporte. */
export type EventoRemoto =
  | { tipo: "dispositivos"; novo?: string }
  | { tipo: "chat"; mensagem: MensagemChat }
  | {
      tipo: "musica";
      de: string;
      musica: { id: string | null; titulo: string; artista: string; letra: string };
    }
  // Mandar para o telão pelo celular: o item vai pelo nome, não por um botão
  // fixo, e por isso não cabe na lista de ações.
  // `slide` vem da grade de slides do celular: projetar a quarta estrofe é
  // um toque, não quatro. Ausente quando o pedido é o item inteiro.
  | {
      tipo: "projetar";
      kind: "song" | "text" | "media";
      refId: string;
      de: string;
      slide?: number;
    }
  // Buscar letra na internet é a cabine quem faz: o celular pode estar sem
  // rede, e dois provedores diferentes dariam dois resultados para a mesma
  // busca. `pedido` é o número que casa a resposta com quem perguntou.
  | { tipo: "buscar-musica"; pedido: number; termo: string }
  | { tipo: "letra-musica"; pedido: number; fonte: string }
  // Volume do que toca no telão, pedido pelo celular. Não cabe na lista de
  // ações porque carrega um número, não é um botão fixo.
  | { tipo: "volume"; valor: number; de: string }
  // Aviso escrito na página do dirigente. Vira texto na biblioteca da
  // cabine, não recado no chat: é para ser projetado, não lido pela equipe.
  | { tipo: "aviso"; titulo: string; texto: string; de: string }
  // Arquivo que chegou pela página do dirigente. `projetavel` é falso para
  // apresentação e PDF: eles ficam guardados, porque o Lúmen ainda não sabe
  // desenhá-los no telão — e dizer que sabe seria pior.
  | {
      tipo: "arquivo";
      nome: string;
      /** Quem mandou, como escreveu na página. Vazio quando não escreveu. */
      de?: string;
      kind: "video" | "audio" | "image" | null;
      id: string | null;
      projetavel: boolean;
    };

/** Um slide como o celular precisa vê-lo: rótulo e texto, nada mais. */
export interface SlideRemoto {
  rotulo: string;
  texto: string;
}

/**
 * A cara de um tema, no tanto que uma miniatura de celular consegue usar.
 *
 * O celular não tem a folha de estilo da cabine nem alcança o disco do PC, e
 * uma miniatura que ignorasse o tema mostraria um slide que ninguém vai ver
 * no telão. Então o fundo vem mastigado: cor e degradê viajam como CSS, que
 * o aparelho desenha igual; imagem e vídeo viram um JPEG pequeno feito aqui.
 */
export interface TemaRemoto {
  id: string;
  /** Cor ou degradê em CSS. Vazio quando o fundo é imagem ou vídeo. */
  fundo: string;
  /** Miniatura JPEG do fundo, como endereço `data:`. Vazia quando não deu. */
  imagem: string;
  /** Cor da letra, para a miniatura não ficar ilegível sobre o fundo. */
  cor: string;
  maiusculas: boolean;
}

/** Um achado da internet, do jeito que o celular precisa ver. */
export interface AchadoRemoto {
  titulo: string;
  artista: string;
  fonte: string;
}

/** O que a cabine espelha da pasta de mídia para o celular. */
export interface MidiaRemota {
  id: string;
  tipo: "video" | "audio" | "image";
  titulo: string;
  detalhe?: string;
  /** Miniatura pequena em JPEG, gerada pela cabine. Vazia quando não deu. */
  capa?: string;
  /** Duração em segundos; 0 para imagem ou quando não se sabe. */
  segundos?: number;
}

export const ROTULO_PERMISSAO: Record<PermissaoRemota, string> = {
  controle: "Controle completo",
  editor: "Editor",
  chat: "Só chat",
};

export const AJUDA_PERMISSAO: Record<PermissaoRemota, string> = {
  controle: "Muda slides e comanda a projeção",
  editor: "Cria e edita músicas",
  chat: "Só envia mensagens",
};

export interface RemoteStatus {
  ligado: boolean;
  porta: number | null;
  enderecos: string[];
  /** "lumen.local" quando o nome está de pé na rede; null quando não subiu. */
  nomeLocal?: string | null;
  /** Por que o nome não subiu — a cabine explica em vez de esconder. */
  avisoNome?: string | null;
  /** Se a página de envio de arquivos já tem senha — e portanto abre. */
  temSenhaDirigente?: boolean;
  sessoesAtivas: number;
  dispositivos?: DispositivoRemoto[];
  permissaoPadrao?: PermissaoRemota;
}

/** O que a cabine publica a cada troca de slide, para o aparelho mostrar. */
export interface RemoteStatePayload {
  titulo: string | null;
  /**
   * Qual item está no ar, para a grade de slides do celular acender a
   * estrofe certa. Pelo id, não pelo título: duas músicas com o mesmo nome
   * no repertório acenderiam a estrofe da outra.
   */
  refId: string | null;
  slideAtual: number;
  slideTotal: number;
  noAr: boolean;
  preto: boolean;
  /**
   * Se o vídeo ou áudio no telão está tocando — null quando não há mídia no
   * ar. É o que permite ao celular ter um botão só, que vira Pausar enquanto
   * toca e Tocar quando está parado.
   *
   * Vem do que a cabine mandou fazer, não do que o telão relatou: com o
   * projetor fechado não chega relato nenhum, e um botão que depende de
   * relato passaria o culto inteiro mentindo.
   */
  midiaTocando: boolean | null;
  /** De 0 a 100, ou null sem mídia no ar. Inteiro, porque é um controle de
   *  dedo num celular, não um botão de mesa de som. */
  midiaVolume: number | null;
}

/**
 * Monta o retrato que vai para o celular.
 *
 * Descreve o que está no telão, não o que está no preview: o "Próximo" do
 * aparelho avança o slide ao vivo, então é isso que ele precisa ver — inclusive
 * quando nada foi apresentado ainda e os botões, tocados, não fazem nada.
 */
export function estadoRemoto(
  status: OutputStatus,
  live: Deck | null,
  liveIndex: number,
): RemoteStatePayload {
  return {
    titulo: live?.title ?? null,
    refId: live?.refId ?? null,
    slideAtual: live ? liveIndex + 1 : 0,
    slideTotal: live?.slides.length ?? 0,
    noAr: status === "presenting",
    preto: status === "black",
    midiaTocando: tocandoMidia(live),
    midiaVolume: volumeDaMidia(live),
  };
}

/** De 0 a 100 para o celular mostrar; null quando não há som para mexer. */
export function volumeDaMidia(live: Deck | null): number | null {
  if (!live || (live.mediaType !== "video" && live.mediaType !== "audio")) return null;
  if (live.mediaMudo) return 0;
  return porcentoDeVolume(live.mediaVolume);
}

/** Aceita o que vier e devolve 0..100 — o valor chega de um aparelho. */
export function porcentoDeVolume(bruto: number | undefined): number {
  const n = Number(bruto);
  if (!Number.isFinite(n)) return 100;
  return Math.round(Math.min(1, Math.max(0, n)) * 100);
}

/** O caminho de volta: 0..100 do celular vira 0..1 do elemento que toca. */
export function volumeDePorcento(bruto: unknown): number {
  const n = Number(bruto);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n / 100));
}

/** Só vídeo e áudio tocam; imagem no telão não tem play nem pause. */
function tocandoMidia(live: Deck | null): boolean | null {
  if (!live || (live.mediaType !== "video" && live.mediaType !== "audio")) return null;
  return live.mediaAcao === "tocar";
}

/** Endereços prontos para colar no navegador do celular. */
export function enderecosDeAcesso(status: RemoteStatus): string[] {
  if (!status.ligado || !status.porta) return [];
  return status.enderecos.map((ip) => `http://${ip}:${status.porta}`);
}

/**
 * O endereço que vale guardar: o que não muda quando o roteador troca o IP.
 *
 * É separado do endereço por IP de propósito. O IP funciona agora, em
 * qualquer aparelho — é o que vai no QR. O nome funciona na semana que vem,
 * mas depende de o celular saber resolver ".local" e de o Firewall deixar o
 * UDP 5353 passar. Oferecer os dois, dizendo qual é qual, é mais honesto do
 * que escolher um e torcer.
 */
export function enderecoFixo(status: RemoteStatus): string | null {
  if (!status.ligado || !status.porta || !status.nomeLocal) return null;
  return `http://${status.nomeLocal}:${status.porta}`;
}
