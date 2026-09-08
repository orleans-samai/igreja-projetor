import { useState } from "react";
import { Empty } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { themeSwatch } from "@/lib/theme-swatch";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Coluna da direita: só temas.
 *
 * Já foi "Anotações", com quatro coisas sem relação dentro. Depois virou a
 * letra em cima e uma tira de temas espremida embaixo, em 52px de altura —
 * trinta e sete fundos disputando duas fileiras. A letra agora mora na grade
 * da faixa de baixo, inteira e do tamanho que o operador quiser, então a
 * coluna faz uma coisa só e faz por completo: os temas ocupam a altura toda.
 */
export function ThemeRail() {
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const preview = useLumenStore((s) => s.preview);
  const [scope, setScope] = useState<"todos" | "tipo">("todos");

  const kind = preview?.kind === "bible" ? "bible" : "songs";
  const shown =
    scope === "tipo"
      ? themes.filter((t) => t.applyTo === "both" || t.applyTo === kind)
      : themes;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <div className="panel-head">
        <h2>
          Temas <span className="tnum text-subtle">{shown.length}</span>
        </h2>
      </div>

      <div className="border-b border-border p-2">
        <Segmented
          label="Filtrar temas"
          full
          value={scope}
          onChange={setScope}
          items={[
            { value: "todos", label: "Todos" },
            { value: "tipo", label: kind === "bible" ? "Bíblia" : "Louvor" },
          ]}
        />
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {shown.length === 0 ? (
          <Empty
            title="Nenhum tema para este tipo."
            hint="Volte para Todos, ou crie um tema em Tela → Temas."
          />
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {shown.map((theme) => (
              <ThemeThumb
                key={theme.id}
                theme={theme}
                active={theme.id === songThemeId || theme.id === bibleThemeId}
                onClick={() => applyThemeLive(theme.id)}
              />
            ))}
          </div>
        )}
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
