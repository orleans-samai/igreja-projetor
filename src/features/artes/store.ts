import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { nid } from "@/lib/fold";
import type { Briefing } from "./briefing.ts";
import type { AjusteDeCategoria } from "./catalogo/categorias.ts";
import type { Assinatura, DocumentoDeArte } from "./documento.ts";
import { lerGuardado, registrarNoHistorico, type ArtesGuardadas } from "./persistencia.ts";

/**
 * As artes salvas da igreja — o que vai para o disco.
 *
 * Guarda a composição inteira, não a semente: atualizar o gerador não pode
 * mudar a cara de uma arte do ano passado. O que muda a cada arrasto no
 * editor mora noutro store (`editor-store.ts`), fora do disco — este aqui
 * é reescrito inteiro a cada mudança, e arrastar um texto não pode custar a
 * gravação de cinquenta artes.
 */

export const CHAVE_ARTES = "lumen-artes-v1";

interface ArtesState extends ArtesGuardadas {
  salvarArte: (doc: DocumentoDeArte) => DocumentoDeArte;
  excluir: (id: string) => void;
  duplicar: (id: string) => DocumentoDeArte | null;
  renomear: (id: string, nome: string) => void;
  alternarFavorito: (id: string) => void;
  registrarLote: (chave: string, assinaturas: Assinatura[]) => void;
  ajustarCategoria: (categoria: string, ajuste: AjusteDeCategoria) => void;
  lembrarBriefing: (b: Briefing) => void;
}

export const useArtesStore = create<ArtesState>()(
  persist(
    (set, get) => ({
      projetos: [],
      historico: {},
      ajustes: {},
      ultimoBriefing: null,

      salvarArte: (doc) => {
        const agora = Date.now();
        const salvo: DocumentoDeArte = { ...doc, criadoEm: doc.criadoEm || agora, atualizadoEm: agora };
        set((s) => ({ projetos: [salvo, ...s.projetos.filter((p) => p.id !== doc.id)] }));
        return salvo;
      },

      excluir: (id) => set((s) => ({ projetos: s.projetos.filter((p) => p.id !== id) })),

      duplicar: (id) => {
        const doc = get().projetos.find((p) => p.id === id);
        if (!doc) return null;
        const agora = Date.now();
        const copia: DocumentoDeArte = { ...structuredClone(doc), id: nid(), nome: `${doc.nome} (cópia)`, criadoEm: agora, atualizadoEm: agora };
        set((s) => ({ projetos: [copia, ...s.projetos] }));
        return copia;
      },

      renomear: (id, nome) =>
        set((s) => ({
          projetos: s.projetos.map((p) => (p.id === id ? { ...p, nome: nome.trim() || p.nome, atualizadoEm: Date.now() } : p)),
        })),

      alternarFavorito: (id) =>
        set((s) => ({ projetos: s.projetos.map((p) => (p.id === id ? { ...p, favorito: !p.favorito } : p)) })),

      registrarLote: (chave, assinaturas) => set((s) => ({ historico: registrarNoHistorico(s.historico, chave, assinaturas) })),

      ajustarCategoria: (categoria, ajuste) => set((s) => ({ ajustes: { ...s.ajustes, [categoria]: ajuste } })),

      lembrarBriefing: (b) => set({ ultimoBriefing: b }),
    }),
    {
      name: CHAVE_ARTES,
      storage: durableStorage,
      version: 2,
      partialize: (s) => ({ projetos: s.projetos, historico: s.historico, ajustes: s.ajustes, ultimoBriefing: s.ultimoBriefing }),
      // Da v1 (documento de frações) e de qualquer coisa estranha: a leitura
      // converte o que dá e deixa de fora o que não dá.
      migrate: (guardado) => lerGuardado(guardado) as unknown as ArtesState,
      merge: (guardado, atual) => ({ ...atual, ...lerGuardado(guardado) }),
    },
  ),
);
