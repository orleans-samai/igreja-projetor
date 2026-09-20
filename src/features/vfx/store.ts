import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { nid } from "@/lib/fold";
import { MODELOS, PADRAO, acharModelo } from "./padroes.ts";
import type { VfxComposicao, VfxModo, VfxProjeto, VfxQualidade, VfxVideoGerado } from "./tipos.ts";

/**
 * A área VFX: o modo, o teto de qualidade e os projetos.
 *
 * Chave própria de propósito. O modo do VFX não pode morar junto das
 * configurações do telão: uma migração malfeita ali apagaria tema, e a
 * regra desta área é não encostar em nada que já existe.
 *
 * Guarda projeto, nunca vídeo. O projeto é um punhado de números e pesa
 * alguns kilobytes; o vídeo renderizado vive na pasta de mídia da igreja,
 * como qualquer outro arquivo, e continua lá mesmo se o projeto sumir.
 */

export const CHAVE_VFX = "lumen-vfx-v1";

interface VfxState {
  /** Ligado, desligado ou automático. Nasce automático. */
  modo: VfxModo;
  /**
   * O teto de qualidade que o operador escolheu.
   *
   * No automático o app pode descer dentro dele, nunca subir acima: quem
   * disse "Leve" tem um PC modesto, e medir bem por dez segundos não é
   * motivo para voltar a gastar.
   */
  qualidade: VfxQualidade;
  projetos: VfxProjeto[];
  /** O projeto aberto no editor. */
  abertoId: string | null;
  definirModo: (modo: VfxModo) => void;
  definirQualidade: (q: VfxQualidade) => void;
  criar: (nome: string, modeloId: string) => VfxProjeto;
  abrir: (id: string) => void;
  fechar: () => void;
  mexer: (patch: Partial<VfxComposicao>) => void;
  restaurar: () => void;
  renomear: (id: string, nome: string) => void;
  duplicar: (id: string) => void;
  excluir: (id: string) => void;
  registrarVideo: (id: string, video: VfxVideoGerado) => void;
}

const LIMITE_PROJETOS = 60;

function agora(): number {
  return Date.now();
}

export const useVfxStore = create<VfxState>()(
  persist(
    (set, get) => ({
      // Automático é o padrão porque é o que não surpreende ninguém: numa
      // máquina boa tudo liga, numa fraca os efeitos caem sozinhos antes
      // de o culto sentir.
      modo: "auto",
      qualidade: "equilibrado",
      projetos: [],
      abertoId: null,

      definirModo: (modo) => set({ modo }),
      definirQualidade: (qualidade) => set({ qualidade }),

      criar: (nome, modeloId) => {
        const modelo = acharModelo(modeloId);
        const projeto: VfxProjeto = {
          id: nid(),
          nome: nome.trim() || modelo?.nome || "Nova composição",
          comp: { ...(modelo?.comp ?? PADRAO) },
          modelo: modelo?.id ?? "",
          criadoEm: agora(),
          atualizadoEm: agora(),
          gerados: [],
        };
        set((s) => ({
          projetos: [projeto, ...s.projetos].slice(0, LIMITE_PROJETOS),
          abertoId: projeto.id,
        }));
        return projeto;
      },

      abrir: (id) => set({ abertoId: id }),
      fechar: () => set({ abertoId: null }),

      mexer: (patch) =>
        set((s) => ({
          projetos: s.projetos.map((p) =>
            p.id === s.abertoId ? { ...p, comp: { ...p.comp, ...patch }, atualizadoEm: agora() } : p,
          ),
        })),

      /** Volta ao modelo de onde nasceu, ou ao padrão quando nasceu do zero. */
      restaurar: () =>
        set((s) => ({
          projetos: s.projetos.map((p) =>
            p.id === s.abertoId
              ? { ...p, comp: { ...(acharModelo(p.modelo)?.comp ?? PADRAO) }, atualizadoEm: agora() }
              : p,
          ),
        })),

      renomear: (id, nome) =>
        set((s) => ({
          projetos: s.projetos.map((p) =>
            p.id === id ? { ...p, nome: nome.trim() || p.nome, atualizadoEm: agora() } : p,
          ),
        })),

      duplicar: (id) => {
        const velho = get().projetos.find((p) => p.id === id);
        if (!velho) return;
        const copia: VfxProjeto = {
          ...velho,
          id: nid(),
          nome: `${velho.nome} (cópia)`,
          comp: { ...velho.comp },
          criadoEm: agora(),
          atualizadoEm: agora(),
          // A cópia nasce sem vídeos: os arquivos são do projeto que os
          // gerou, e dizer que esta cópia já rendeu vídeo seria mentira.
          gerados: [],
        };
        set((s) => ({ projetos: [copia, ...s.projetos].slice(0, LIMITE_PROJETOS) }));
      },

      /**
       * Tira o projeto da lista.
       *
       * Os vídeos que ele gerou continuam na pasta da igreja: são arquivos
       * de verdade, podem estar na programação do culto de domingo, e
       * apagá-los junto seria apagar o culto por tabela.
       */
      excluir: (id) =>
        set((s) => ({
          projetos: s.projetos.filter((p) => p.id !== id),
          abertoId: s.abertoId === id ? null : s.abertoId,
        })),

      registrarVideo: (id, video) =>
        set((s) => ({
          projetos: s.projetos.map((p) =>
            p.id === id ? { ...p, gerados: [video, ...p.gerados].slice(0, 30) } : p,
          ),
        })),
    }),
    {
      name: CHAVE_VFX,
      storage: durableStorage,
      version: 1,
      // Abrir o app com o editor de VFX na cara de quem só queria projetar
      // o culto seria uma surpresa desagradável; `abertoId` fica de fora.
      // A medição do automático nem passa por aqui — ver auto-store.ts.
      partialize: (s) => ({ modo: s.modo, qualidade: s.qualidade, projetos: s.projetos }),
    },
  ),
);

/** Um nome que não repete o de nenhum projeto existente. */
export function nomeNovoProjeto(projetos: VfxProjeto[], base = "Composição"): string {
  const usados = new Set(projetos.map((p) => p.nome));
  if (!usados.has(base)) return base;
  for (let n = 2; n < 999; n += 1) {
    const tentativa = `${base} ${n}`;
    if (!usados.has(tentativa)) return tentativa;
  }
  return base;
}

export { MODELOS };
