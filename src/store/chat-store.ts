import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { chatVisivel } from "@/lib/chat-visivel";
import type { MensagemChat, ParaChat, PessoaNoChat } from "@/lib/remote-control";

/**
 * O chat entre a cabine e quem está com o celular.
 *
 * Existe porque o recado do culto hoje é gritado, gesticulado ou mandado num
 * grupo que ninguém olha durante a pregação. "Repete o refrão" precisa
 * chegar em quem está no teclado, sem tirar essa pessoa do teclado.
 *
 * Por isso o painel é discreto por natureza: como coluna ele fica onde o
 * operador arrastar, no mesmo gesto das outras colunas, e nunca cobre nada.
 * Flutuante é o único que sobrepõe, e por isso é o único que se fecha.
 */

export type PosicaoChat = "coluna" | "flutuante" | "oculto";

/** As três posições, na ordem em que aparecem nos ajustes. */
export const POSICOES_CHAT: { value: PosicaoChat; label: string }[] = [
  { value: "coluna", label: "Coluna" },
  { value: "flutuante", label: "Flutuante" },
  { value: "oculto", label: "Oculto" },
];

interface ChatState {
  mensagens: MensagemChat[];
  aberto: boolean;
  posicao: PosicaoChat;
  naoLidas: number;
  /** Última mensagem recebida com o painel fechado, para o aviso discreto. */
  aviso: MensagemChat | null;
  /** Quem está com o chat aberto agora (a cabine incluída). */
  pessoas: PessoaNoChat[];
  /** Quem está digitando, até quando (ms). */
  digitando: { id: string; nome: string; ate: number }[];
  /** Para quem a cabine está escrevendo. */
  para: ParaChat;

  receber: (m: MensagemChat) => void;
  /** A cabine apagou o recado: o lugar fica, o conteúdo sai. */
  apagar: (id: string) => void;
  setPessoas: (pessoas: PessoaNoChat[]) => void;
  marcarDigitando: (id: string, nome: string) => void;
  setPara: (para: ParaChat) => void;
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
      posicao: "coluna",
      naoLidas: 0,
      aviso: null,
      pessoas: [],
      digitando: [],
      para: { tipo: "todos" },

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

      apagar: (id) =>
        set((s) => ({
          ...s,
          mensagens: s.mensagens.map((m) =>
            m.id === id
              ? { ...m, texto: "", audio: undefined, foto: undefined, mencoes: [], apagada: true }
              : m,
          ),
          aviso: s.aviso?.id === id ? null : s.aviso,
        })),
      setPessoas: (pessoas) =>
        set((s) => {
          // Quem escrevia para uma pessoa que saiu volta a escrever para todos:
          // mandar para quem não está mais aí seria recado perdido.
          const para =
            s.para.tipo === "pessoa" && !pessoas.some((p) => p.id === (s.para as { id: string }).id)
              ? ({ tipo: "todos" } as ParaChat)
              : s.para;
          return { ...s, pessoas, para };
        }),
      marcarDigitando: (id, nome) =>
        set((s) => ({
          ...s,
          digitando: [
            ...s.digitando.filter((d) => d.id !== id && d.ate > Date.now()),
            { id, nome, ate: Date.now() + 4000 },
          ],
        })),
      setPara: (para) => set((s) => ({ ...s, para })),

      abrir: (v) => set((s) => ({ ...s, aberto: v, naoLidas: v ? 0 : s.naoLidas, aviso: null })),
      setPosicao: (posicao) =>
        set((s) => ({
          ...s,
          posicao,
          // Sair do oculto para uma lateral já traz o painel de volta à vista.
          aberto: posicao === "oculto" ? s.aberto : true,
          naoLidas: posicao === "oculto" ? s.naoLidas : 0,
        })),
      limparAviso: () => set((s) => ({ ...s, aviso: null })),
      limparTudo: () => set((s) => ({ ...s, mensagens: [], naoLidas: 0, aviso: null })),
    }),
    {
      name: "lumen-chat-v1",
      storage: durableStorage,
      // Mensagem é do culto; o que merece sobreviver ao reinício é a
      // preferência de onde o painel fica.
      partialize: (s) => ({ posicao: s.posicao, aberto: s.aberto }),
      // Quem já usava o Lúmen tinha "fechado" gravado de uma época em que o
      // painel nascia assim. Não faz mais sentido na lateral, e manter o
      // valor antigo deixaria essas pessoas sem chat sem nunca terem pedido.
      version: 3,
      // "esquerda" e "direita" eram escolhas de menu; agora o lugar do chat é
      // a posição dele na fileira de colunas, arrastada como qualquer outra.
      migrate: (guardado) => {
        const g = (guardado ?? {}) as { posicao?: string };
        const antigo = g.posicao;
        return {
          ...g,
          aberto: true,
          posicao: antigo === "flutuante" || antigo === "oculto" ? antigo : "coluna",
        };
      },
    },
  ),
);
