/**
 * Otimizar apresentação: quebra o texto do preview em slides que cabem no
 * telão, com um refino opcional pela IA. Fora de um componente para que
 * a barra, o copiloto e o atalho Ctrl+Shift+O chamem a mesma rotina.
 */

import { create } from "zustand";
import { buildLiveFrame } from "@/store/lumen-store";
import type { LiveFrame } from "@/lib/types";
import { toast } from "sonner";
import { refineProjectionSlides } from "@/lib/slide-optimize-ai";
import {
  mergeAiSlides,
  optimizeLocal,
  shouldRefineWithAi,
  type OptimizeInput,
  type OptimizeResult,
} from "@/lib/slide-optimize";
import { useLumenStore } from "@/store/lumen-store";

export function inputFromStore(): OptimizeInput | null {
  const s = useLumenStore.getState();
  const preview = s.preview;
  if (!preview || preview.kind === "countdown" || preview.kind === "media") return null;
  const themeId = preview.kind === "bible" ? s.bibleThemeId : s.songThemeId;
  const theme = s.themes.find((t) => t.id === themeId) ?? s.themes[0];
  if (!theme) return null;
  const song = preview.kind === "song" ? s.songs.find((x) => x.id === preview.refId) : null;
  const text = preview.kind === "text" ? s.texts.find((x) => x.id === preview.refId) : null;
  const raw =
    song?.lyricsRaw ??
    text?.body ??
    (preview.kind === "bible"
      ? (preview.slides[s.previewIndex]?.text ?? preview.slides[0]?.text ?? "")
      : preview.slides.map((sl) => sl.text).join("\n\n"));
  return {
    kind: preview.kind,
    title: preview.title,
    slides: preview.slides,
    raw,
    theme,
    settings: s.settings,
    focusIndex: preview.kind === "bible" ? s.previewIndex : undefined,
  };
}

export interface OptimizationProposal {
  input: OptimizeInput;
  result: OptimizeResult;
  frame: LiveFrame;
  signature: string;
}
export const useOptimizationReview = create<{ proposal: OptimizationProposal | null }>(() => ({ proposal: null }));
function signature() {
  const s = useLumenStore.getState();
  return JSON.stringify({ ref: s.preview?.refId, input: inputFromStore() });
}
export function cancelOptimization() { useOptimizationReview.setState({ proposal: null }); }
export function applyOptimization() {
  const proposal = useOptimizationReview.getState().proposal;
  if (!proposal) return;
  if (signature() !== proposal.signature) {
    toast.error("O conteúdo ou tema mudou. Abra Otimizar novamente para revisar a versão atual.");
    cancelOptimization(); return;
  }
  const store = useLumenStore.getState();
  store.applyOptimize(proposal.result);
  cancelOptimization();
  toast.success("Correções aplicadas", { action: { label: "Desfazer", onClick: () => store.undoOptimize() } });
}
export async function refineOptimization() {
  const proposal = useOptimizationReview.getState().proposal;
  if (!proposal || proposal.input.kind === "bible") return;
  try {
    const ai = await refineProjectionSlides({ data: { text: proposal.input.raw ?? "", kind: proposal.input.kind } });
    if (useOptimizationReview.getState().proposal !== proposal) return;
    if (!ai.ok || !ai.slides.length) { toast("O refino online não está disponível. A sugestão local continua pronta."); return; }
    useOptimizationReview.setState({ proposal: { ...proposal, result: mergeAiSlides(proposal.result, ai.slides) } });
  } catch { toast("Não foi possível refinar agora. A sugestão local continua pronta."); }
}
export async function runOptimize(): Promise<boolean> {
  const input = inputFromStore(), s = useLumenStore.getState();
  if (!input || !s.preview) { toast.error("Selecione uma letra, aviso ou versículo."); return false; }
  const result = optimizeLocal(input);
  const frame = { ...buildLiveFrame(s), deck: s.preview, index: s.previewIndex, status: "presenting" as const };
  useOptimizationReview.setState({ proposal: { input, result, frame, signature: signature() } });
  return true;
}
export function canRefine(proposal: OptimizationProposal) {
  return proposal.input.kind !== "bible" && shouldRefineWithAi(proposal.result.issues, proposal.input.raw ?? "");
}
