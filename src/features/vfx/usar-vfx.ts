import { useCallback, useMemo, useRef } from "react";
import { useLumenStore } from "@/store/lumen-store";
import { useVfxAuto } from "./auto-store.ts";
import { DEGRAUS, MedidorDeFps } from "./desempenho.ts";
import { limitarPorQualidade } from "./qualidade.ts";
import { useVfxStore } from "./store.ts";
import type { VfxComposicao, VfxQualidade } from "./tipos.ts";

/**
 * A qualidade que vale agora.
 *
 * No modo ligado é a que o operador escolheu. No automático é a que a
 * medição permitiu, sempre dentro do teto dele. Desligado não é qualidade
 * nenhuma — é a área inteira fora do ar, e quem pergunta isso usa
 * `useVfxDisponivel`.
 */
export function useQualidadeEfetiva(): {
  qualidade: VfxQualidade;
  auto: boolean;
  caiu: boolean;
  registrarQuadro: (agora: number) => void;
} {
  const modo = useVfxStore((s) => s.modo);
  const teto = useVfxStore((s) => s.qualidade);
  const medida = useVfxAuto((s) => s.qualidade);
  const medir = useVfxAuto((s) => s.medir);
  const status = useLumenStore((s) => s.status);
  const aoVivo = status === "presenting";

  // Um medidor por superfície que desenha; a decisão é uma só, na store.
  const medidor = useRef<MedidorDeFps | null>(null);
  if (!medidor.current) medidor.current = new MedidorDeFps();

  const registrarQuadro = useCallback(
    (agora: number) => {
      if (modo !== "auto") return;
      const fps = medidor.current?.quadro(agora);
      if (fps != null) medir(fps, aoVivo, teto);
    },
    [medir, aoVivo, modo, teto],
  );

  // Nunca acima do teto, mesmo que ele tenha baixado agora mesmo: a
  // escolha do operador vale no quadro seguinte, não no próximo segundo.
  const qualidade =
    modo === "auto"
      ? DEGRAUS[Math.min(DEGRAUS.indexOf(medida), DEGRAUS.indexOf(teto))]
      : teto;
  return {
    qualidade,
    auto: modo === "auto",
    caiu: modo === "auto" && qualidade !== teto,
    registrarQuadro,
  };
}

/** Se a área de vídeos dinâmicos pode ser usada. */
export function useVfxDisponivel(): boolean {
  return useVfxStore((s) => s.modo) !== "desligado";
}

/** A composição já aparada pelo teto de qualidade que vale agora. */
export function useComposicaoEfetiva(comp: VfxComposicao | null, qualidade: VfxQualidade) {
  return useMemo(() => (comp ? limitarPorQualidade(comp, qualidade) : null), [comp, qualidade]);
}

/** O projeto aberto no editor, ou null. */
export function useProjetoAberto() {
  const abertoId = useVfxStore((s) => s.abertoId);
  const projetos = useVfxStore((s) => s.projetos);
  return useMemo(() => projetos.find((p) => p.id === abertoId) ?? null, [projetos, abertoId]);
}
