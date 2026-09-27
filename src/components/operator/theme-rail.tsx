import { Plus } from "lucide-react";
import { useState } from "react";
import { CriarTemaDialog } from "@/components/operator/criar-tema";
import { Empty } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { PainelDinamicos } from "@/features/vfx/componentes/painel-dinamicos";
import { PainelVideos } from "@/features/vfx/componentes/painel-videos";
import { useVfxStore } from "@/features/vfx/store";
import { themeSwatch } from "@/lib/theme-swatch";
import { destinoDoTema } from "@/lib/destino-do-tema";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Coluna da direita: os temas — o que vai atrás da letra.
 *
 * Já foi "Anotações", com quatro coisas sem relação dentro. Depois foi
 * temas, vídeos para projetar e vídeos dinâmicos, cada aba fazendo uma
 * coisa diferente com o clique. A igreja pediu a coluna inteira de temas,
 * dividida pelo tipo de fundo: imagens, vídeos e dinâmicos (o VFX). Em
 * qualquer uma das três, um clique põe aquele fundo atrás da letra.
 *
 * "Criar tema" fica ao lado do título, em dourado, porque criar o próprio
 * fundo era a coisa mais escondida do app.
 */

type Aba = "imagens" | "videos" | "dinamicos";

export function ThemeRail() {
  const themes = useLumenStore((s) => s.themes);
  const [aba, setAba] = useState<Aba>("imagens");
  const [criando, setCriando] = useState(false);
  const vfxLigado = useVfxStore((s) => s.modo) !== "desligado";
  // Mudar de aba para recarregar a pasta: quando um vídeo acaba de ser
  // renderizado, ele tem que aparecer sem o operador procurar como atualizar.
  const [recarga, setRecarga] = useState(0);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <div className="panel-head">
        <h2>
          Temas{" "}
          {aba === "imagens" && (
            <span className="tnum text-subtle">{themes.filter((t) => t.backgroundType !== "video").length}</span>
          )}
        </h2>
        {/* Botão simples, não o <Button>: a variante pintaria o fundo por
            cima do dourado. */}
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="ouro ml-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-caption font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <Plus className="size-3" aria-hidden /> Criar tema
        </button>
      </div>
      <CriarTemaDialog open={criando} onOpenChange={setCriando} />

      <div className="border-b border-border p-2">
        <Segmented
          label="Tipo de fundo do tema"
          full
          value={aba}
          onChange={(v) => {
            if (v === "dinamicos" && !vfxLigado) return;
            setAba(v);
          }}
          // Sem ícone e com "Dinâmicos" no lugar de "Vídeos dinâmicos": a
          // coluna tem uns duzentos pixels, e com o nome inteiro as duas
          // abas de vídeo apareciam as duas como "Víde…" — indistinguíveis
          // justamente uma da outra. O nome completo fica no cursor parado.
          items={[
            { value: "imagens", label: "Imagens", title: "Temas com fundo de imagem ou cor" },
            { value: "videos", label: "Vídeos", title: "Vídeos da pasta como fundo da letra" },
            {
              value: "dinamicos",
              label: "Dinâmicos",
              disabled: !vfxLigado,
              title: vfxLigado
                ? "Vídeos dinâmicos (VFX) como fundo da letra"
                : "Os vídeos dinâmicos estão desativados para melhorar o desempenho.",
            },
          ]}
        />
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {aba === "imagens" && <Temas />}
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

/**
 * Os temas de imagem e cor, com o filtro que sempre existiu. Os de vídeo
 * moram na aba Vídeos, junto do arquivo que os originou.
 */
function Temas() {
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const live = useLumenStore((s) => s.live);
  const preview = useLumenStore((s) => s.preview);
  const [scope, setScope] = useState<"todos" | "tipo">("todos");

  // O mesmo critério do clique: o tema aceso é o que está no telão agora.
  const kind = destinoDoTema(live, preview);
  const noTelao = kind === "bible" ? bibleThemeId : songThemeId;
  const deImagem = themes.filter((t) => t.backgroundType !== "video");
  const shown =
    scope === "tipo"
      ? deImagem.filter((t) => t.applyTo === "both" || t.applyTo === kind)
      : deImagem;

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
              active={theme.id === noTelao}
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
      {theme.backgroundType === "video" ? (
        // Um quadro parado do vídeo, sem tocar: vinte temas de vídeo rodando
        // juntos na coluna gastariam o processador da cabine que projeta.
        <video
          className="aspect-video w-full bg-stage object-cover"
          src={`${theme.backgroundValue}#t=0.5`}
          muted
          preload="metadata"
          aria-hidden
        />
      ) : (
        <div className={cn("aspect-video w-full", swatch.className)} style={swatch.style} />
      )}
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
