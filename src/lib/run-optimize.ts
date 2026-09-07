/**
 * Otimizar apresentação: quebra o texto do preview em slides que cabem no
 * telão, com um refino opcional pela IA. Fora de um componente para que
 * a barra, o copiloto e o atalho Ctrl+Shift+O chamem a mesma rotina.
 */

import { toast } from "sonner";
import { refineProjectionSlides } from "@/lib/slide-optimize-ai";
import {
  mergeAiSlides,
  optimizeLocal,
  shouldRefineWithAi,
  type OptimizeInput,
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

export async function runOptimize(): Promise<boolean> {
  const input = inputFromStore();
  const store = useLumenStore.getState();
  if (!input) {
    toast.error("Selecione uma letra, aviso ou versículo.");
    return false;
  }
  const local = optimizeLocal(input);
  const unchanged =
    local.issues.length === 0 &&
    local.slides.length === input.slides.length &&
    local.slides.every((sl, i) => sl.text === input.slides[i]?.text);
  if (unchanged) {
    toast("Já está adequado ao telão");
    return false;
  }
  store.applyOptimize(local);
  toast(local.summary[0] ?? "Otimizei a apresentação", {
    description: local.summary.slice(1).join(" · ") || undefined,
    action: {
      label: "Desfazer",
      onClick: () => store.undoOptimize(),
    },
  });

  if (input.kind === "bible" || !shouldRefineWithAi(local.issues, input.raw ?? "")) return true;
  try {
    const ai = await refineProjectionSlides({
      data: { text: input.raw ?? "", kind: input.kind },
    });
    if (!ai.ok || !ai.slides.length) return true;
    const merged = mergeAiSlides(local, ai.slides);
    store.applyOptimize(merged, true);
    toast("Afinei as quebras de frase");
  } catch {
    /* local result already applied */
  }
  return true;
}

