import { create } from "zustand";
import { estadoInicial, passoAutomatico, type EstadoAuto } from "./desempenho.ts";
import type { VfxQualidade } from "./tipos.ts";

/**
 * O julgamento do modo automático — e só ele.
 *
 * Loja separada, sem persistência, por um motivo concreto: isto muda uma
 * vez por segundo enquanto houver uma pré-visualização na tela, e a loja
 * do VFX escreve no disco a cada mudança. Uma gravação por segundo no
 * computador que está projetando o culto seria o oposto do que esta área
 * inteira existe para fazer.
 *
 * Também não faria sentido guardar: é medida de agora. Começar a sessão
 * com o veredito da semana passada é adivinhar, não medir.
 */
interface AutoState extends EstadoAuto {
  /** Um segundo de medição, com o teto que o operador escolheu. */
  medir: (fps: number, aoVivo: boolean, teto: VfxQualidade) => void;
  /** Recomeça do teto — quando o operador mexe no modo ou na qualidade. */
  reiniciar: (teto: VfxQualidade) => void;
}

export const useVfxAuto = create<AutoState>()((set, get) => ({
  ...estadoInicial("equilibrado"),

  medir: (fps, aoVivo, teto) => {
    const { qualidade, seguidas } = get();
    const proximo = passoAutomatico({ qualidade, seguidas }, fps, aoVivo, teto);
    // Só escreve quando muda de verdade: o caminho comum é não mudar nada,
    // e um `set` por segundo acorda toda tela que lê esta loja.
    if (proximo.qualidade === qualidade && proximo.seguidas === seguidas) return;
    set(proximo);
  },

  reiniciar: (teto) => set(estadoInicial(teto)),
}));
