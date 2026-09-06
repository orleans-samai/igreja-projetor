import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refineProjectionSlides } from "@/lib/slide-optimize-ai";
import {
  diagnose,
  mergeAiSlides,
  optimizeLocal,
  optimizeRawText,
  shouldRefineWithAi,
  type OptimizeInput,
} from "@/lib/slide-optimize";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";

function inputFromStore(): OptimizeInput | null {
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

export function OptimizeButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const preview = useLumenStore((s) => s.preview);
  if (!preview || preview.kind === "media" || preview.kind === "countdown") return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      className={className}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void runOptimize().finally(() => setBusy(false));
      }}
    >
      <Sparkles className="size-3.5" />
      {busy ? "Otimizando…" : "Otimizar"}
    </Button>
  );
}

export function OptimizeBanner() {
  const preview = useLumenStore((s) => s.preview);
  const previewIndex = useLumenStore((s) => s.previewIndex);
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const settings = useLumenStore((s) => s.settings);
  const songs = useLumenStore((s) => s.songs);
  const texts = useLumenStore((s) => s.texts);
  const [busy, setBusy] = useState(false);

  const issues = useMemo(() => {
    const input = inputFromStore();
    if (!input) return [];
    return diagnose(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, previewIndex, themes, songThemeId, bibleThemeId, settings, songs, texts]);

  if (!issues.length) return null;
  const unique = issues.filter(
    (iss, i, arr) => arr.findIndex((x) => x.kind === iss.kind) === i,
  );

  return (
    <div className="flex items-start gap-2 border-b border-border bg-elevated px-3 py-2">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">Este texto vai ficar ruim no telão</p>
        <p className="text-xs text-muted">
          {unique
            .slice(0, 3)
            .map((i) => i.label)
            .join(" · ")}
        </p>
      </div>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void runOptimize().finally(() => setBusy(false));
        }}
      >
        {busy ? "Otimizando…" : "Otimizar apresentação"}
      </Button>
    </div>
  );
}

export function OptimizeHint({
  text,
  onApply,
}: {
  text: string;
  onApply: (raw: string) => void;
}) {
  const result = useMemo(
    () => (text.trim().length > 50 ? optimizeRawText(text) : null),
    [text],
  );
  if (!result?.issues.length) return null;
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md bg-elevated px-2.5 py-2 text-left text-xs text-muted hover:text-fg",
      )}
      onClick={() => {
        onApply(result.raw);
        toast("Parti o texto em frases de duas linhas");
      }}
    >
      <Sparkles className="size-3.5 text-accent" />
      Bloco ilegível no telão — otimizar apresentação
    </button>
  );
}
