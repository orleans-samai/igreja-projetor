import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { chatVisivel } from "@/lib/chat-visivel";
import type { MensagemChat } from "@/lib/remote-control";

/**
 * O chat entre a cabine e quem está com o celular.
 *
 * Existe porque o recado do culto hoje é gritado, gesticulado ou mandado num
 * grupo que ninguém olha durante a pregação. "Repete o refrão" precisa
 * chegar em quem está no teclado, sem tirar essa pessoa do teclado.
 *
 * Por isso o painel é discreto por natureza: fica onde o operador escolher,
 * some quando ele quiser, e nada aqui nunca cobre os controles do telão. O
 * aviso de mensagem nova é um número no botão, não uma janela na frente.
 */

export type PosicaoChat = "direita" | "esquerda" | "flutuante" | "oculto";

/** As quatro posições, na ordem em que aparecem nos ajustes. */
export const POSICOES_CHAT: { value: PosicaoChat; label: string }[] = [
  { value: "direita", label: "Direita" },
  { value: "esquerda", label: "Esquerda" },
  { value: "flutuante", label: "Flutuante" },
  { value: "oculto", label: "Oculto" },
];

interface ChatState {
  mensagens: MensagemChat[];
  aberto: boolean;
  posicao: PosicaoChat;
  /** Para onde o botão Chat devolve o painel depois de escondido. */
  ultimaLateral: PosicaoChat;
  naoLidas: number;
  /** Última mensagem recebida com o painel fechado, para o aviso discreto. */
  aviso: MensagemChat | null;

  receber: (m: MensagemChat) => void;
  abrir: (v: boolean) => void;
  setPosicao: (p: PosicaoChat) => void;
  limparAviso: () => void;
  limparTudo: () => void;
}

/** O histórico não precisa ser eterno: o culto é a janela que interessa. */
const LIMITE = 200;

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      mensagens: [],
      // Nasce à vista: na lateral o chat não cobre nada, e recado de culto
      // que chega num painel fechado é recado perdido.
      aberto: true,
      posicao: "direita",
      ultimaLateral: "direita",
      naoLidas: 0,
      aviso: null,

      receber: (m) =>
        set((s) => {
          // A mesma mensagem pode chegar duas vezes quando o celular
          // reconecta e recebe o histórico junto: id repetido não entra.
          if (s.mensagens.some((x) => x.id === m.id)) return s;
          const mensagens = [...s.mensagens, m].slice(-LIMITE);
          // O que a própria cabine escreveu nunca conta como não lida — nem o
          // que chega com o painel à vista, porque já foi lido.
          if (m.daCabine || chatVisivel(s.posicao, s.aberto)) return { ...s, mensagens };
          return { ...s, mensagens, naoLidas: s.naoLidas + 1, aviso: m };
        }),

      abrir: (v) => set((s) => ({ ...s, aberto: v, naoLidas: v ? 0 : s.naoLidas, aviso: null })),
      setPosicao: (posicao) =>
        set((s) => ({
          ...s,
          posicao,
          // Sair do oculto para uma lateral já traz o painel de volta à vista.
          aberto: posicao === "oculto" ? s.aberto : true,
          naoLidas: posicao === "oculto" ? s.naoLidas : 0,
          ultimaLateral:
            posicao === "direita" || posicao === "esquerda" ? posicao : s.ultimaLateral,
        })),
      limparAviso: () => set((s) => ({ ...s, aviso: null })),
      limparTudo: () => set((s) => ({ ...s, mensagens: [], naoLidas: 0, aviso: null })),
    }),
    {
      name: "lumen-chat-v1",
      storage: durableStorage,
      // Mensagem é do culto; o que merece sobreviver ao reinício é a
      // preferência de onde o painel fica.
      partialize: (s) => ({
        posicao: s.posicao,
        aberto: s.aberto,
        ultimaLateral: s.ultimaLateral,
      }),
      // Quem já usava o Lúmen tinha "fechado" gravado de uma época em que o
      // painel nascia assim. Não faz mais sentido na lateral, e manter o
      // valor antigo deixaria essas pessoas sem chat sem nunca terem pedido.
      version: 2,
      migrate: (guardado) => ({ ...(guardado as object), aberto: true }),
    },
  ),
);
