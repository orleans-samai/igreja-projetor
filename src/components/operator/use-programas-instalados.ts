import { useState } from "react";

export type Programas = { powerPoint: boolean; libreOffice: boolean };

/**
 * Pergunta ao computador se há PowerPoint e LibreOffice, quando o menu abre.
 *
 * Na hora de abrir, e não uma vez no começo: quem instala o LibreOffice com
 * o Lúmen aberto vê o menu certo sem reiniciar nada.
 */
export function useProgramasInstalados() {
  const [programas, setProgramas] = useState<Programas | null>(null);
  const perguntar = (aberto: boolean) => {
    if (!aberto) return;
    const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    void d
      ?.apresentacaoProgramas?.()
      .then(setProgramas)
      .catch(() => setProgramas(null));
  };
  return { programas, perguntar };
}
