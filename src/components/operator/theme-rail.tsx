import { useState } from "react";
import { Empty } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { PainelDinamicos } from "@/features/vfx/componentes/painel-dinamicos";
import { PainelVideos } from "@/features/vfx/componentes/painel-videos";
import { useVfxStore } from "@/features/vfx/store";
import { themeSwatch } from "@/lib/theme-swatch";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Coluna da direita: temas, vídeos prontos e vídeos dinâmicos.
 *
 * Já foi "Anotações", com quatro coisas sem relação dentro. Depois foi só
 * temas, e a coluna fazia uma coisa bem feita. Agora são três abas, e a
 * razão é que as três respondem à mesma pergunta na hora do culto: o que
 * vai atrás da letra?
 *
 * "Vídeos" e "Vídeos dinâmicos" ficam lado a lado porque são o antes e o
 * depois da mesma coisa — a composição se monta na segunda e se projeta da
 * primeira. "Temas" continua onde estava, com o mesmo filtro de sempre:
 * trinta e sete fundos da casa não iam sumir por causa de uma aba nova.
 */

type Aba = "temas" | "videos" | "dinamicos";

export function ThemeRail() {
  const themes = useLumenStore((s) => s.themes);
  const [aba, setAba] = useState<Aba>("temas");
  const vfxLigado = useVfxStore((s) => s.modo) !== "desligado";
  // Mudar de aba para recarregar a pasta: quando um vídeo acaba de ser
  // renderizado, ele tem que aparecer sem o operador procurar como atualizar.
  const [recarga, setRecarga] = useState(0);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <div className="panel-head">
        <h2>
          {aba === "temas" ? "Temas" : aba === "videos" ? "Vídeos" : "Vídeos dinâmicos"}{" "}
          {aba === "temas" && <span className="tnum text-subtle">{themes.length}</span>}
        </h2>
      </div>

      <div className="border-b border-border p-2">
        <Segmented
          label="O que mostrar na coluna"
          full
          value={aba}
          onChange={(v) => {
            if (v === "dinamicos" && !vfxLigado) return;
            setAba(v);
          }}
          // Sem ícone e com "Dinâmicos" no lugar de "Vídeos dinâmicos": a
          // coluna tem uns duzentos pixels, e com o nome inteiro as duas
          // abas de vídeo apareciam as duas como "Víde…" — indistinguíveis
          // justamente uma da outra. O nome completo vive no cabeçalho do
          // painel e no cursor parado em cima.
          items={[
            { value: "temas", label: "Temas", title: "Temas da casa" },
            { value: "videos", label: "Vídeos", title: "Vídeos prontos para projetar" },
            {
              value: "dinamicos",
              label: "Dinâmicos",
              disabled: !vfxLigado,
              title: vfxLigado
                ? "Vídeos dinâmicos: o editor de VFX"
                : "Os vídeos dinâmicos estão desativados para melhorar o desempenho.",
            },
          ]}
        />
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {aba === "temas" && <Temas />}
        {aba === "videos" && <PainelVideos recarregarEm={recarga} />}
        {aba === "dinamicos" &&
          (vfxLigado ? (
            <PainelDinamicos aoSalvarVideo={() => setRecarga((n) => n + 1)} />
          ) : (
            <Empty
              title="Os vídeos dinâmicos estão desativados para melhorar o desempenho."
              hint="Ative em Mais → VFX."
            />
          ))}
      </div>
    </aside>
  );
}

/** Os temas da casa, com o filtro que sempre existiu. */
function Temas() {
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
    <div className="grid gap-2">
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
