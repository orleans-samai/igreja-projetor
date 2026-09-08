import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { nid } from "@/lib/fold";

/**
 * A fila de vídeos do YouTube.
 *
 * Só o que é da cabine mora aqui: a lista que o operador montou e o que ele
 * está preparando. O que está de fato no telão vive no lumen-store, junto com
 * todo o resto da projeção — dois donos para o mesmo telão seria a receita de
 * um culto com duas verdades.
 */

export interface VideoNaFila {
  id: string;
  videoId: string;
  titulo: string;
  autor: string;
}

export type EstadoPlayer = "parado" | "carregando" | "tocando" | "pausado" | "fim";

interface YoutubeStore {
  /** A seção YouTube está à mostra na cabine. */
  aberto: boolean;
  fila: VideoNaFila[];
  /** Item da fila que está no controle da cabine. */
  atual: string | null;
  autoProximo: boolean;

  // Vindos do projetor, que é quem tem o player. Não vão para o disco.
  tempo: number;
  duracao: number;
  estado: EstadoPlayer;
  erro: string | null;

  setAberto: (v: boolean) => void;
  adicionar: (video: Omit<VideoNaFila, "id">) => string;
  remover: (id: string) => void;
  mover: (de: number, para: number) => void;
  escolher: (id: string | null) => void;
  setAutoProximo: (v: boolean) => void;
  relatar: (p: { tempo: number; duracao: number; estado: EstadoPlayer; erro?: string }) => void;
  limparErro: () => void;
}

export const useYoutubeStore = create<YoutubeStore>()(
  persist(
    (set, get) => ({
      aberto: false,
      fila: [],
      atual: null,
      autoProximo: false,
      tempo: 0,
      duracao: 0,
      estado: "parado",
      erro: null,

      setAberto: (aberto) => set({ aberto }),

      adicionar: (video) => {
        // O mesmo vídeo colado duas vezes é o mesmo item: o operador quis
        // achá-lo de novo, não tê-lo duas vezes na fila.
        const existente = get().fila.find((v) => v.videoId === video.videoId);
        if (existente) {
          set({ atual: existente.id });
          return existente.id;
        }
        const id = nid();
        set((s) => ({ fila: [...s.fila, { ...video, id }], atual: id }));
        return id;
      },

      remover: (id) =>
        set((s) => ({
          fila: s.fila.filter((v) => v.id !== id),
          atual: s.atual === id ? null : s.atual,
        })),

      mover: (de, para) =>
        set((s) => {
          if (de === para || de < 0 || para < 0 || de >= s.fila.length || para >= s.fila.length) {
            return s;
          }
          const fila = [...s.fila];
          const [item] = fila.splice(de, 1);
          fila.splice(para, 0, item!);
          return { fila };
        }),

      escolher: (atual) => set({ atual, erro: null }),
      setAutoProximo: (autoProximo) => set({ autoProximo }),
      relatar: ({ tempo, duracao, estado, erro }) =>
        set({ tempo, duracao, estado, erro: erro ?? null }),
      limparErro: () => set({ erro: null }),
    }),
    {
      name: "lumen-youtube-v1",
      skipHydration: true,
      storage: durableStorage,
      partialize: (s) => ({ aberto: s.aberto, fila: s.fila, autoProximo: s.autoProximo }),
    },
  ),
);
