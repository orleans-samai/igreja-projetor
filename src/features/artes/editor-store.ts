import { create } from "zustand";
import { acharCamada, trocarCamada, type Camada, type DocumentoDeArte } from "./documento.ts";

/**
 * A arte aberta no editor: seleção, desfazer e refazer.
 *
 * Fica fora do disco de propósito — muda a cada arrasto. Só vira arte
 * salva quando a pessoa salva (ou fecha e confirma).
 */

const LIMITE = 60;

/**
 * Mudanças seguidas no mesmo campo da mesma camada (digitar um título,
 * arrastar um controle deslizante) viram um passo só de desfazer — senão
 * desfazer uma palavra custaria um clique por letra.
 */
const JUNTAR_EM_MS = 900;
let ultima: { id: string; chaves: string; quando: number } | null = null;

interface EditorState {
  doc: DocumentoDeArte | null;
  selecionada: string | null;
  desfazer: DocumentoDeArte[];
  refazer: DocumentoDeArte[];
  /** Houve mudança desde que abriu ou salvou. */
  alterado: boolean;

  abrir: (doc: DocumentoDeArte) => void;
  fechar: () => void;
  marcarSalvo: (doc: DocumentoDeArte) => void;
  selecionar: (id: string | null) => void;
  /** Muda uma camada; `manual` marca a arte como ajustada à mão. */
  mexer: (id: string, patch: Partial<Camada>) => void;
  trocar: (doc: DocumentoDeArte) => void;
  voltar: () => void;
  avancar: () => void;
  restaurarOriginal: () => void;
  reordenar: (id: string, direcao: "frente" | "tras") => void;
  duplicarCamada: (id: string) => void;
  excluirCamada: (id: string) => void;
}

function empilhar(s: EditorState, novo: DocumentoDeArte): Partial<EditorState> {
  return {
    doc: novo,
    desfazer: s.doc ? [...s.desfazer, s.doc].slice(-LIMITE) : s.desfazer,
    refazer: [],
    alterado: true,
  };
}

export const useEditorDeArte = create<EditorState>()((set, get) => ({
  doc: null,
  selecionada: null,
  desfazer: [],
  refazer: [],
  alterado: false,

  abrir: (doc) => {
    ultima = null;
    set({ doc, selecionada: null, desfazer: [], refazer: [], alterado: false });
  },
  fechar: () => set({ doc: null, selecionada: null, desfazer: [], refazer: [], alterado: false }),
  marcarSalvo: (doc) => set({ doc, alterado: false }),
  selecionar: (id) => set({ selecionada: id }),

  mexer: (id, patch) => {
    const s = get();
    if (!s.doc) return;
    const camadas = trocarCamada(s.doc.camadas, id, (c) => ({ ...c, ...patch }) as Camada);
    const novo = { ...s.doc, camadas, editadoManualmente: true };
    const chaves = Object.keys(patch).sort().join(",");
    const agora = Date.now();
    const junta = !!ultima && ultima.id === id && ultima.chaves === chaves && agora - ultima.quando < JUNTAR_EM_MS && s.desfazer.length > 0;
    ultima = { id, chaves, quando: agora };
    if (junta) set({ doc: novo, refazer: [], alterado: true });
    else set(empilhar(s, novo));
  },

  trocar: (doc) => set((s) => empilhar(s, doc)),

  voltar: () => {
    const s = get();
    const anterior = s.desfazer[s.desfazer.length - 1];
    if (!anterior || !s.doc) return;
    set({ doc: anterior, desfazer: s.desfazer.slice(0, -1), refazer: [...s.refazer, s.doc], alterado: true });
  },

  avancar: () => {
    const s = get();
    const proximo = s.refazer[s.refazer.length - 1];
    if (!proximo || !s.doc) return;
    set({ doc: proximo, refazer: s.refazer.slice(0, -1), desfazer: [...s.desfazer, s.doc], alterado: true });
  },

  restaurarOriginal: () => {
    const s = get();
    if (!s.doc) return;
    set({ ...empilhar(s, { ...s.doc, camadas: structuredClone(s.doc.original), editadoManualmente: false }), selecionada: null });
  },

  reordenar: (id, direcao) => {
    const s = get();
    if (!s.doc) return;
    const lista = [...s.doc.camadas];
    const i = lista.findIndex((c) => c.id === id);
    // O fundo fica no fundo: nada passa para trás dele.
    const j = direcao === "frente" ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= lista.length || lista[j].tipo === "fundo" || lista[i].tipo === "fundo") return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    set(empilhar(s, { ...s.doc, camadas: lista, editadoManualmente: true }));
  },

  duplicarCamada: (id) => {
    const s = get();
    if (!s.doc) return;
    const c = acharCamada(s.doc.camadas, id);
    if (!c || c.tipo === "fundo") return;
    const i = s.doc.camadas.findIndex((x) => x.id === id);
    if (i < 0) return;
    const copia = { ...structuredClone(c), id: `${c.id}-copia-${Date.now().toString(36)}`, nome: `${c.nome} (cópia)`, x: c.x + 24, y: c.y + 24, opcional: true } as Camada;
    const lista = [...s.doc.camadas];
    lista.splice(i + 1, 0, copia);
    set({ ...empilhar(s, { ...s.doc, camadas: lista, editadoManualmente: true }), selecionada: copia.id });
  },

  excluirCamada: (id) => {
    const s = get();
    if (!s.doc) return;
    const c = acharCamada(s.doc.camadas, id);
    // Só o que é opcional sai: título e fundo são a arte; esconder resolve.
    if (!c || !c.opcional) return;
    const camadas = trocarCamada(s.doc.camadas, id, () => null);
    set({ ...empilhar(s, { ...s.doc, camadas, editadoManualmente: true }), selecionada: null });
  },
}));
