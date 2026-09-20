import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { nid } from "@/lib/fold";
import { acharFormato } from "./formatos.ts";
import { VERSAO_DOCUMENTO, dadosVazios, type DadosDoEvento, type Documento, type Elemento } from "./types.ts";
import { montar, sementesPara } from "./variacoes.ts";

/**
 * As artes salvas da igreja.
 *
 * Guarda documento, não imagem. Um documento é texto — alguns kilobytes — e
 * pode ser reaberto, ajustado e exportado de novo em qualquer formato. Uma
 * imagem guardada seria pesada, imutável e inútil no ano que vem, quando a
 * data mudar.
 *
 * Foto e logo entram como endereço, nunca como bytes: a biblioteca da igreja
 * não pode engordar em megabytes a cada arte feita, e o que vai para o disco
 * é lido a cada abertura do app.
 */

export const CHAVE_ARTES = "lumen-artes-v1";

/** Quantas opções a grade mostra de uma vez. */
export const OPCOES_POR_VEZ = 12;

interface ArtesState {
  /** O que já foi salvo, do mais recente para o mais antigo. */
  projetos: Documento[];
  /** O que está aberto no editor, ainda não necessariamente salvo. */
  aberto: Documento | null;
  elementoSelecionado: string | null;
  /** Histórico curto, para desfazer dentro do editor. */
  pilha: Documento[];

  criar: (dados: DadosDoEvento, formatoId: string, semente: number, nome: string) => Documento | null;
  abrir: (id: string) => void;
  fechar: () => void;
  salvar: () => void;
  duplicar: (id: string) => void;
  renomear: (id: string, nome: string) => void;
  excluir: (id: string) => void;
  selecionar: (elementoId: string | null) => void;
  mexer: (elementoId: string, patch: Partial<Elemento>) => void;
  trocarDocumento: (doc: Documento) => void;
  desfazer: () => void;
  /** A mesma arte noutro formato, recomposta em vez de esticada. */
  adaptar: (formatoId: string) => Documento | null;
}

const LIMITE_PILHA = 30;

export const useArtesStore = create<ArtesState>()(
  persist(
    (set, get) => ({
      projetos: [],
      aberto: null,
      elementoSelecionado: null,
      pilha: [],

      criar: (dados, formatoId, semente, nome) => {
        const f = acharFormato(formatoId);
        if (!f) return null;
        const doc = montar({
          id: nid(),
          nome: nome.trim() || dados.titulo.trim() || "Arte sem nome",
          dados,
          semente,
          formatoId: f.id,
          largura: f.largura,
          altura: f.altura,
        });
        set({ aberto: doc, elementoSelecionado: null, pilha: [] });
        return doc;
      },

      abrir: (id) => {
        const doc = get().projetos.find((p) => p.id === id);
        if (doc) set({ aberto: doc, elementoSelecionado: null, pilha: [] });
      },

      fechar: () => set({ aberto: null, elementoSelecionado: null, pilha: [] }),

      salvar: () => {
        const doc = get().aberto;
        if (!doc) return;
        const atualizado = { ...doc, atualizadoEm: Date.now() };
        set((s) => ({
          aberto: atualizado,
          projetos: [atualizado, ...s.projetos.filter((p) => p.id !== doc.id)],
        }));
      },

      duplicar: (id) => {
        const doc = get().projetos.find((p) => p.id === id);
        if (!doc) return;
        const copia: Documento = {
          ...doc,
          id: nid(),
          nome: `${doc.nome} (cópia)`,
          criadoEm: Date.now(),
          atualizadoEm: Date.now(),
        };
        set((s) => ({ projetos: [copia, ...s.projetos] }));
      },

      renomear: (id, nome) =>
        set((s) => ({
          projetos: s.projetos.map((p) =>
            p.id === id ? { ...p, nome: nome.trim() || p.nome, atualizadoEm: Date.now() } : p,
          ),
          aberto: s.aberto?.id === id ? { ...s.aberto, nome: nome.trim() || s.aberto.nome } : s.aberto,
        })),

      excluir: (id) =>
        set((s) => ({
          projetos: s.projetos.filter((p) => p.id !== id),
          aberto: s.aberto?.id === id ? null : s.aberto,
        })),

      selecionar: (elementoId) => set({ elementoSelecionado: elementoId }),

      mexer: (elementoId, patch) => {
        const doc = get().aberto;
        if (!doc) return;
        const elementos = doc.elementos.map((el) =>
          el.id === elementoId ? ({ ...el, ...patch } as Elemento) : el,
        );
        set((s) => ({
          pilha: [...s.pilha, doc].slice(-LIMITE_PILHA),
          aberto: { ...doc, elementos, atualizadoEm: Date.now() },
        }));
      },

      trocarDocumento: (doc) =>
        set((s) => ({
          pilha: s.aberto ? [...s.pilha, s.aberto].slice(-LIMITE_PILHA) : s.pilha,
          aberto: doc,
        })),

      desfazer: () => {
        const pilha = get().pilha;
        if (pilha.length === 0) return;
        set({ aberto: pilha[pilha.length - 1], pilha: pilha.slice(0, -1) });
      },

      adaptar: (formatoId) => {
        const doc = get().aberto;
        const f = acharFormato(formatoId);
        if (!doc || !f) return null;
        // Recompõe a partir dos dados e da mesma semente: é isso que faz a
        // versão de Stories ser a mesma arte, e não a quadrada esticada.
        const novo = montar({
          id: nid(),
          nome: `${doc.nome} — ${f.nome}`,
          dados: doc.dados,
          semente: doc.semente,
          formatoId: f.id,
          largura: f.largura,
          altura: f.altura,
        });
        set((s) => ({ projetos: [novo, ...s.projetos], aberto: novo, pilha: [] }));
        return novo;
      },
    }),
    {
      name: CHAVE_ARTES,
      storage: durableStorage,
      // O que está aberto no editor é da sessão; o que foi salvo é da igreja.
      partialize: (s) => ({ projetos: s.projetos }),
      version: VERSAO_DOCUMENTO,
      migrate: (guardado) => {
        const g = (guardado ?? {}) as { projetos?: Documento[] };
        // Documento de versão futura ou corrompido não derruba a abertura:
        // fica de fora da lista, e o resto continua.
        const projetos = (Array.isArray(g.projetos) ? g.projetos : []).filter(
          (p) => p && typeof p === "object" && p.v === VERSAO_DOCUMENTO && Array.isArray(p.elementos),
        );
        return { ...g, projetos };
      },
    },
  ),
);

/** As sementes da grade de opções, estáveis para a mesma base. */
export function opcoesDe(base: number): number[] {
  return sementesPara(base, OPCOES_POR_VEZ);
}

export { dadosVazios };
