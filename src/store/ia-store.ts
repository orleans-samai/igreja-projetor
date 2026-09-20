import { create } from "zustand";
import { nid } from "@/lib/fold";
import { acoesReais } from "@/lib/ia/acoes-reais";
import { montarMensagens, peneirarSegredos, type Fala } from "@/lib/ia/conversa";
import { executarPlano, planejar, type Plano } from "@/lib/ia/ferramentas";
import { lerResposta } from "@/lib/ia/protocolo";
import type { EstadoIA } from "@/lib/ia/tipos";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

/**
 * A conversa com o assistente local.
 *
 * Não é persistida, e isso é a regra, não o esquecimento: o que se pergunta
 * num culto não precisa sobreviver a ele, e conversa guardada é conversa que
 * alguém lê depois. Fechar o Lúmen limpa; "Limpar conversa" limpa na hora.
 *
 * O prompt interno e a resposta crua do modelo também não ficam. O que fica
 * na tela é o que a pessoa escreveu e o que o assistente respondeu.
 */

export interface Recado {
  id: string;
  papel: "usuario" | "assistente" | "sistema";
  texto: string;
  /** Resultado de uma ferramenta, quando houve. */
  feito?: boolean;
}

interface IaState {
  aberto: boolean;
  recados: Recado[];
  pensando: boolean;
  /** Plano esperando um sim do operador. */
  pendente: (Extract<Plano, { ok: true }> & { id: string }) | null;
  estado: EstadoIA | null;

  abrir: (v: boolean) => void;
  limpar: () => void;
  atualizarEstado: (e: EstadoIA | null) => void;
  perguntar: (texto: string) => Promise<void>;
  confirmar: (sim: boolean) => void;
  cancelar: () => void;
  desfazer: () => void;
}

function falasDe(recados: readonly Recado[]): Fala[] {
  return recados
    .filter((r): r is Recado & { papel: "usuario" | "assistente" } => r.papel !== "sistema")
    .map((r) => ({ papel: r.papel, texto: r.texto }));
}

export const useIaStore = create<IaState>()((set, get) => ({
  aberto: false,
  recados: [],
  pensando: false,
  pendente: null,
  estado: null,

  abrir: (v) => set({ aberto: v }),
  limpar: () => set({ recados: [], pendente: null }),
  atualizarEstado: (estado) => set({ estado }),

  cancelar: () => {
    void window.lumenDesktop?.iaCancelar();
    set({ pensando: false });
  },

  confirmar: (sim) => {
    const plano = get().pendente;
    set({ pendente: null });
    if (!plano) return;
    if (!sim) {
      set((s) => ({
        recados: [...s.recados, { id: nid(), papel: "sistema", texto: "Cancelado." }],
      }));
      return;
    }
    // Retrato antes de mexer: é o que faz "Desfazer" ter o que desfazer.
    if (plano.ferramenta.podeDesfazer) {
      useOpsStore.getState().pushUndo(useLumenStore.getState().captureNow(false));
    }
    const r = executarPlano(plano, acoesReais());
    set((s) => ({
      recados: [...s.recados, { id: nid(), papel: "sistema", texto: r.mensagem, feito: r.ok }],
    }));
  },

  desfazer: () => {
    const deu = useOpsStore.getState().undoCulto();
    set((s) => ({
      recados: [
        ...s.recados,
        {
          id: nid(),
          papel: "sistema",
          texto: deu ? "Desfeito." : "Não há nada para desfazer.",
          feito: deu,
        },
      ],
    }));
  },

  perguntar: async (bruto) => {
    const texto = String(bruto ?? "").trim();
    if (!texto || get().pensando) return;
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;

    // Segredo não sai da janela — nem para o modelo, nem para a tela.
    const { texto: limpo, tirouSegredo } = peneirarSegredos(texto);
    const meus: Recado[] = [{ id: nid(), papel: "usuario", texto: limpo }];
    if (tirouSegredo) {
      meus.push({
        id: nid(),
        papel: "sistema",
        texto:
          "Tirei a senha da mensagem — ela não vai para o assistente. Para trocar senha, use as Configurações.",
      });
    }
    set((s) => ({ recados: [...s.recados, ...meus], pensando: true }));

    const resposta = await d.iaPerguntar(montarMensagens(falasDe(get().recados), limpo));
    if (!resposta.ok) {
      set((s) => ({
        pensando: false,
        recados: [
          ...s.recados,
          {
            id: nid(),
            papel: "sistema",
            texto: resposta.cancelado ? "Parei." : (resposta.erro ?? "Não consegui responder."),
          },
        ],
      }));
      return;
    }

    // Aqui entra a fronteira: o texto do modelo é lido, nunca executado.
    const leitura = lerResposta(resposta.texto ?? "");
    if (leitura.tipo !== "pedido") {
      set((s) => ({
        pensando: false,
        recados: [...s.recados, { id: nid(), papel: "assistente", texto: leitura.texto }],
      }));
      return;
    }

    const plano = planejar(leitura.pedido);
    if (!plano.ok) {
      set((s) => ({
        pensando: false,
        recados: [
          ...s.recados,
          ...(leitura.texto
            ? [{ id: nid(), papel: "assistente" as const, texto: leitura.texto }]
            : []),
          { id: nid(), papel: "sistema", texto: plano.erro },
        ],
      }));
      return;
    }

    if (plano.precisaConfirmar) {
      set((s) => ({
        pensando: false,
        pendente: { ...plano, id: nid() },
        recados: [
          ...s.recados,
          { id: nid(), papel: "assistente", texto: leitura.texto || `Quer que eu ${plano.previa}?` },
        ],
      }));
      return;
    }

    // Só depois de acontecer é que se diz que aconteceu.
    const r = executarPlano(plano, acoesReais());
    set((s) => ({
      pensando: false,
      recados: [
        ...s.recados,
        ...(leitura.texto ? [{ id: nid(), papel: "assistente" as const, texto: leitura.texto }] : []),
        { id: nid(), papel: "sistema", texto: r.mensagem, feito: r.ok },
      ],
    }));
  },
}));
