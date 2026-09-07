import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { PERFIS, type AutoSlideConfig, type Motivo, type Perfil } from "@/lib/auto-slide/engine";

/**
 * Ajustes e estado do Auto-Slide.
 *
 * Os ajustes ficam guardados — quem regulou a mesa de som no sábado não quer
 * regular de novo no domingo. O estado vivo, não: nível de áudio, último
 * trecho ouvido e nota do momento morrem com a sessão, e gravá-los só
 * encheria o disco de lixo a dez vezes por segundo.
 */

export type EstadoAuto =
  | "desligado"
  | "sem-modelo"
  | "escutando"
  | "processando"
  | "casou"
  | "confianca-baixa"
  | "sem-audio"
  | "pausado"
  | "erro-audio";

export interface AutoSlideAjustes {
  modo: "sugerir" | "automatico";
  ligado: boolean;
  deviceId: string;
  perfil: Perfil;
  /** Sobrescreve o perfil quando o operador mexe num controle específico. */
  config: AutoSlideConfig;
}

interface AutoSlideStore extends AutoSlideAjustes {
  setModo: (modo: AutoSlideAjustes["modo"]) => void;
  estado: EstadoAuto;
  nivel: number;
  ouvido: string;
  candidato: number | null;
  score: number;
  motivo: Motivo | null;
  erro: string | null;
  /** Quantas trocas o motor fez nesta música — mostra se está trabalhando. */
  trocas: number;

  setLigado: (v: boolean) => void;
  setDevice: (v: string) => void;
  setPerfil: (v: Perfil) => void;
  ajustar: (patch: Partial<AutoSlideConfig>) => void;
  setEstado: (v: EstadoAuto, erro?: string | null) => void;
  setNivel: (v: number) => void;
  relatar: (p: { ouvido: string; candidato: number | null; score: number; motivo: Motivo }) => void;
  contarTroca: () => void;
  zerar: () => void;
}

export const useAutoSlideStore = create<AutoSlideStore>()(
  persist(
    (set, get) => ({
      modo: "sugerir",
      setModo: (modo) => set({ modo, candidato: null }),
      ligado: false,
      deviceId: "",
      perfil: "equilibrado",
      config: { ...PERFIS.equilibrado },

      estado: "desligado",
      nivel: 0,
      ouvido: "",
      candidato: null,
      score: 0,
      motivo: null,
      erro: null,
      trocas: 0,

      setLigado: (ligado) =>
        set({
          ligado,
          estado: ligado ? "escutando" : "desligado",
          erro: null,
          ...(ligado ? {} : { nivel: 0, ouvido: "", candidato: null, score: 0, motivo: null }),
        }),
      setDevice: (deviceId) => set({ deviceId }),
      setPerfil: (perfil) => set({ perfil, config: { ...PERFIS[perfil] } }),
      ajustar: (patch) => set({ config: { ...get().config, ...patch } }),
      setEstado: (estado, erro = null) => set({ estado, erro }),
      setNivel: (nivel) => set({ nivel }),
      relatar: ({ ouvido, candidato, score, motivo }) => set({ ouvido, candidato, score, motivo }),
      contarTroca: () => set((s) => ({ trocas: s.trocas + 1 })),
      zerar: () => set({ ouvido: "", candidato: null, score: 0, motivo: null, trocas: 0 }),
    }),
    {
      name: "lumen-auto-slide-v1",
      skipHydration: true,
      storage: durableStorage,
      partialize: (s) => ({ modo: s.modo, deviceId: s.deviceId, perfil: s.perfil, config: s.config }),
    },
  ),
);
