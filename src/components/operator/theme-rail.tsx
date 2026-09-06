import { Clapperboard, StickyNote, Type } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

export function ThemeRail() {
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const preview = useLumenStore((s) => s.preview);
  const previewIndex = useLumenStore((s) => s.previewIndex);
  const setPreviewIndex = useLumenStore((s) => s.setPreviewIndex);
  const [tab, setTab] = useState<"letras" | "midia">("letras");
  const [kindOnly, setKindOnly] = useState(false);
  const alert = useLumenStore((s) => s.alert);
  const setAlert = useLumenStore((s) => s.setAlert);
  const [note, setNote] = useState("");

  const film = kindOnly
    ? themes.filter(
        (t) =>
          t.applyTo === "both" || t.applyTo === (preview?.kind === "bible" ? "bible" : "songs"),
      )
    : themes;

  return (
    <aside className="flex h-full min-h-0 bg-surface">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
          <StickyNote className="size-3.5 text-muted" />
          <p className="text-xs font-medium uppercase tracking-wide">Anotações</p>
        </div>
        <div className="grid grid-cols-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("letras")}
            className={cn(
              "inline-flex items-center justify-center gap-1 px-1 py-2 text-xs font-medium",
              tab === "letras" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Type className="size-3" /> Letras
          </button>
          <button
            type="button"
            onClick={() => setTab("midia")}
            className={cn(
              "inline-flex items-center justify-center gap-1 px-1 py-2 text-xs font-medium",
              tab === "midia" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Clapperboard className="size-3" /> Mídia
          </button>
        </div>
        {tab === "letras" && (
          <ul className="min-h-0 flex-1 overflow-y-auto lumen-scroll">
            {!preview && <li className="p-3 text-sm text-muted">Nada selecionado.</li>}
            {preview?.slides.map((slide, i) => (
              <li key={slide.id}>
                <button
                  type="button"
                  onClick={() => setPreviewIndex(i)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-elevated",
                    i === previewIndex && "bg-primary/10",
                  )}
                >
                  <p className="text-xs font-medium text-primary">{slide.label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{slide.text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === "midia" && (
          <form
            className="flex min-h-0 flex-1 flex-col gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              setAlert(note.trim(), 10, "bottom");
              setNote("");
            }}
          >
            <p className="text-xs text-muted">Aviso rápido no rodapé do telão.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-28 w-full flex-1 rounded-md bg-elevated p-2 text-sm shadow-[var(--shadow-border)]"
              placeholder="Aviso, ofertas, wi-fi…"
            />
            <button
              type="submit"
              className="h-9 rounded-md bg-primary text-sm font-medium text-primary-fg"
            >
              Mostrar 10s
            </button>
            {alert && <p className="text-xs text-accent">No ar: {alert.text}</p>}
          </form>
        )}
        <div className="grid grid-cols-2 border-t border-border">
          <button
            type="button"
            onClick={() => setKindOnly(false)}
            className={cn("py-2 text-xs", !kindOnly ? "bg-elevated text-fg" : "text-muted")}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setKindOnly(true)}
            className={cn("py-2 text-xs", kindOnly ? "bg-elevated text-fg" : "text-muted")}
          >
            Selecionadas
          </button>
        </div>
      </div>
      <ul className="w-20 shrink-0 space-y-1 overflow-y-auto border-l border-border p-1 lumen-scroll">
        {film.map((theme) => (
          <li key={theme.id}>
            <ThemeThumb
              theme={theme}
              compact
              active={theme.id === songThemeId || theme.id === bibleThemeId}
              onClick={() => applyThemeLive(theme.id)}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ThemeThumb({
  theme,
  active,
  onClick,
  compact = false,
}: {
  theme: Theme;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const bg =
    theme.backgroundType === "color"
      ? { background: theme.backgroundValue }
      : { backgroundImage: `url(${theme.backgroundValue})`, backgroundSize: "cover" as const };
  return (
    <button
      type="button"
      onClick={onClick}
      title={theme.name}
      className={cn(
        "w-full overflow-hidden rounded-md text-left shadow-[var(--shadow-border)]",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="aspect-video w-full" style={bg} />
      {!compact && <p className="truncate bg-elevated px-1.5 py-1 text-xs text-muted">{theme.name}</p>}
    </button>
  );
}
