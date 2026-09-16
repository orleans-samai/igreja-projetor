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
}

/** O que chega do celular pelo processo principal, fora o transporte. */
export type EventoRemoto =
  | { tipo: "dispositivos"; novo?: string }
  | { tipo: "chat"; mensagem: MensagemChat }
  | {
      tipo: "musica";
      de: string;
      musica: { id: string | null; titulo: string; artista: string; letra: string };
    };

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
  pin: string | null;
  enderecos: string[];
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
  };
}

/** Endereços prontos para colar no navegador do celular. */
export function enderecosDeAcesso(status: RemoteStatus): string[] {
  if (!status.ligado || !status.porta) return [];
  return status.enderecos.map((ip) => `http://${ip}:${status.porta}`);
}
