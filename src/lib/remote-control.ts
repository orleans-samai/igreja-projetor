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
  | "proximo-item";

export interface RemoteStatus {
  ligado: boolean;
  porta: number | null;
  pin: string | null;
  enderecos: string[];
  sessoesAtivas: number;
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
