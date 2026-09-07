import { useState } from "react";
import { Empty } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { themeSwatch } from "@/lib/theme-swatch";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Coluna da direita: a letra inteira em cima, os temas embaixo.
 *
 * Antes chamava-se "Anotações" e guardava quatro coisas sem relação — uma
 * lista de slides, um compositor de aviso rotulado "Mídia", um filtro solto
 * e uma tira de temas. O aviso de rodapé já existe na barra inferior, então
 * ficou só lá; aqui sobrou o que a coluna realmente faz.
 */
export function ThemeRail() {
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const preview = useLumenStore((s) => s.preview);
  const previewIndex = useLumenStore((s) => s.previewIndex);
  const setPreviewIndex = useLumenStore((s) => s.setPreviewIndex);
  const [scope, setScope] = useState<"todos" | "tipo">("todos");

  const kind = preview?.kind === "bible" ? "bible" : "songs";
  const shown =
    scope === "tipo"
      ? themes.filter((t) => t.applyTo === "both" || t.applyTo === kind)
      : themes;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <div className="panel-head">
        <h2 className="truncate">{preview ? "Letra" : "Letra"}</h2>
        {preview && (
          <span className="tnum ml-auto shrink-0 text-caption text-subtle">
            {previewIndex + 1}/{preview.slides.length}
          </span>
        )}
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
        {!preview ? (
          <Empty title="Nada selecionado." hint="Escolha um item na biblioteca ou no culto." />
        ) : (
          <ul>
            {preview.slides.map((slide, i) => {
              const on = i === previewIndex;
              return (
                <li key={slide.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(i)}
                    className={cn(
                      "relative w-full px-3 py-1.5 text-left",
                      "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                      "hover:bg-elevated/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      on && "bg-elevated",
                    )}
                  >
                    {on && (
                      <span
                        aria-hidden
                        className="animate-swap-in absolute inset-y-0 left-0 w-0.5 bg-fg"
                      />
                    )}
                    <p className="text-caption font-medium text-fg">{slide.label}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-secondary text-muted">
                      {slide.text}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <div className="panel-head justify-between border-b-0">
          <h2>Temas</h2>
          <Segmented
            label="Filtrar temas"
            value={scope}
            onChange={setScope}
            items={[
              { value: "todos", label: "Todos" },
              { value: "tipo", label: kind === "bible" ? "Bíblia" : "Louvor" },
            ]}
          />
        </div>
        <div className="lumen-scroll grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto p-2">
          {shown.map((theme) => (
            <ThemeThumb
              key={theme.id}
              theme={theme}
              active={theme.id === songThemeId || theme.id === bibleThemeId}
              onClick={() => applyThemeLive(theme.id)}
            />
          ))}
        </div>
      </div>
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
  const swatch = themeSwatch(theme);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={theme.name}
      className={cn(
        "group/thumb w-full overflow-hidden rounded-md text-left",
        "transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "shadow-[0_0_0_1px_var(--color-fg)]"
          : "shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
      )}
    >
      <div className={cn("aspect-video w-full", swatch.className)} style={swatch.style} />
      {!compact && (
        <p
          className={cn(
            "truncate px-1.5 py-1 text-caption",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            active ? "bg-raised text-fg" : "bg-elevated text-muted group-hover/thumb:text-fg",
          )}
        >
          {theme.name}
        </p>
      )}
    </button>
  );
}
