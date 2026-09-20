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
  | { tipo: "projetar"; kind: "song" | "text" | "media"; refId: string; de: string }
  // Buscar letra na internet é a cabine quem faz: o celular pode estar sem
  // rede, e dois provedores diferentes dariam dois resultados para a mesma
  // busca. `pedido` é o número que casa a resposta com quem perguntou.
  | { tipo: "buscar-musica"; pedido: number; termo: string }
  | { tipo: "letra-musica"; pedido: number; fonte: string }
  // Volume do que toca no telão, pedido pelo celular. Não cabe na lista de
  // ações porque carrega um número, não é um botão fixo.
  | { tipo: "volume"; valor: number; de: string };

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
  sessoesAtivas: number;
  dispositivos?: DispositivoRemoto[];
  permissaoPadrao?: PermissaoRemota;
}

/** O que a cabine publica a cada troca de slide, para o aparelho mostrar. */
export interface RemoteStatePayload {
  titulo: string | null;
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
