import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { apagarRecado, guardarRecado, type HistoricoDoChat } from "@/lib/chat-historico";
import type { MensagemChat } from "@/lib/remote-control";
import { useLumenStore } from "@/store/lumen-store";
import { useChatStore } from "@/store/chat-store";

/**
 * O histórico do chat, culto a culto, guardado no disco da cabine.
 *
 * Separado do `chat-store` de propósito: aquele é o painel da sessão (o que
 * está na tela agora, as não lidas, quem está conectado) e não sobrevive ao
 * reinício. Este é o arquivo da igreja — cresce devagar e fica.
 */
interface HistoricoState extends HistoricoDoChat {
  guardar: (m: MensagemChat) => void;
  apagar: (id: string) => void;
  limpar: () => void;
}

export const useChatHistorico = create<HistoricoState>()(
  persist(
    (set) => ({
      cultos: [],
      guardar: (m) =>
        set((s) => {
          // O culto é a programação aberta na cabine quando o recado chega.
          const st = useLumenStore.getState();
          const pl = st.playlists.find((p) => p.id === st.activePlaylistId) ?? st.playlists[0];
          const programacao = { id: pl?.id ?? "sem-programacao", nome: pl?.name ?? "Culto" };
          return { cultos: guardarRecado(s, programacao, m).cultos };
        }),
      apagar: (id) => set((s) => ({ cultos: apagarRecado(s, id).cultos })),
      limpar: () => set({ cultos: [] }),
    }),
    {
      name: "lumen-chat-historico-v1",
      storage: durableStorage,
      partialize: (s) => ({ cultos: s.cultos }),
      version: 1,
    },
  ),
);

/**
 * Um recado chegou (do celular, do dirigente ou da própria cabine): vai
 * para o painel e para o histórico do culto.
 */
export function chegouRecado(m: MensagemChat) {
  useChatStore.getState().receber(m);
  useChatHistorico.getState().guardar(m);
}

/** A cabine apagou um recado: some do painel e do histórico. */
export function recadoApagado(id: string) {
  useChatStore.getState().apagar(id);
  useChatHistorico.getState().apagar(id);
}
