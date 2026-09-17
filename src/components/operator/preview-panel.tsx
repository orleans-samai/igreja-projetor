import { toast } from "sonner";
import * as Popover from "@radix-ui/react-popover";
import { Monitor, Pause, Pencil, Play, Square, Volume2, VolumeX, Youtube } from "lucide-react";
import { SlideStage } from "@/components/slide/slide-renderer";
import { FontSizeBar } from "@/components/operator/font-size-bar";
import { MediaPlayer } from "@/components/operator/media-player";
import { NoArAgora } from "@/components/operator/no-ar-agora";
import { OptimizeBanner, OptimizeButton } from "@/components/operator/optimize-bar";
import { ThemeThumb } from "@/components/operator/theme-rail";
import { Button } from "@/components/ui/button";
import { Tally } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
import { themeSwatch } from "@/lib/theme-swatch";
import { cn } from "@/lib/cn";
import type { LiveFrame } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";
import { useYoutubeStore } from "@/store/youtube-store";
import { relogio } from "@/lib/youtube";

export function PreviewPanel({
  previewFrame,
  outputFrame,
  onEditSong,
  onSettings,
}: {
  previewFrame: LiveFrame;
  outputFrame: LiveFrame;
  onEditSong: () => void;
  onSettings: () => void;
}) {
  const preview = useLumenStore((s) => s.preview);
  const previewIndex = useLumenStore((s) => s.previewIndex);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const live = useLumenStore((s) => s.live);
  const status = useLumenStore((s) => s.status);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const themes = useLumenStore((s) => s.themes);
  const songs = useLumenStore((s) => s.songs);
  const pinSongTheme = useLumenStore((s) => s.pinSongTheme);
  const setSlideEditId = useOpsStore((s) => s.setSlideEditId);

  const isLive = status !== "idle" && live?.refId === preview?.refId;
  const noAr = status !== "idle" && Boolean(live);
  const currentSong = preview?.kind === "song" ? songs.find((s) => s.id === preview.refId) : null;
  const themePinned = Boolean(currentSong?.themeId);
  const activeTheme = themes.find((t) => t.id === songThemeId) ?? themes[0];

  const meta = [
    preview?.subtitle,
    preview?.key ? `tom ${preview.key}` : null,
    preview ? `${preview.slides.length} slides` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Título → informação → ações, nessa ordem e nessa hierarquia. */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <NoArAgora />
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <h2 className="truncate text-title font-semibold tracking-tight">
              {preview?.title ?? "Nada selecionado"}
            </h2>
            {isLive && <Tally state="live" label="No ar" />}
          </div>
          {meta && <p className="truncate text-secondary text-muted">{meta}</p>}
        </div>
        {preview?.kind === "song" && (
          <Button size="sm" variant="ghost" onClick={onEditSong}>
            <Pencil /> Letra
          </Button>
        )}
        <OptimizeButton />
        <Hint label="Manda o preview para o telão" keys="F5">
          <Button size="sm" onClick={presentPreview} disabled={!preview} data-tour="apresentar">
            <Play /> Apresentar
          </Button>
        </Hint>
      </div>

      <MediaPlayer />
      <OptimizeBanner />

      <div className="preview-well min-h-0 flex-1 p-3" data-tour="preview">
        <button
          type="button"
          className={cn(
            "relative block size-full overflow-hidden rounded-lg bg-stage shadow-[var(--shadow-border)]",
            "transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "hover:shadow-[var(--shadow-border-hover)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
          onClick={presentPreview}
          aria-label="Apresentar este slide"
          onContextMenu={(e) => {
            e.preventDefault();
            const slide = preview?.slides[previewIndex];
            if (slide) setSlideEditId(slide.id);
          }}
        >
          {/*
            Uma caixa só, mostrando o que a igreja está vendo.

            Antes eram duas imagens disputando a mesma tela — a grande com o
            que ainda não foi ao ar e uma miniatura no canto com o que estava
            no ar — e o operador tinha que lembrar qual era qual. Agora, com
            algo no ar, a caixa grande é o telão; sem nada no ar, ela mostra o
            que o "Apresentar" vai mandar.
          */}
          <SlideStage
            frame={noAr ? outputFrame : previewFrame}
            variant="preview"
            statusOverride={noAr ? undefined : "presenting"}
            className="size-full"
          />
          <span
            className={cn(
              "absolute left-2 top-2 flex items-center gap-1 rounded-sm px-1.5 py-0.5",
              "text-caption font-medium",
              noAr ? "bg-live/90 text-live-fg" : "bg-stage/85 text-stage-fg",
            )}
          >
            {noAr ? "No ar" : "Vai ao ar"}
          </span>
        </button>
      </div>

      <YoutubeTransporte />

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2">
        <label className="flex select-none items-center gap-2 text-secondary text-muted">
          <button
            type="button"
            role="switch"
            aria-checked={themePinned}
            data-on={themePinned}
            disabled={!currentSong}
            className="lumen-switch"
            onClick={() => {
              if (!currentSong) return;
              const next = !themePinned;
              pinSongTheme(currentSong.id, next ? songThemeId : null);
              toast(next ? "Tema preso a esta música" : "Tema liberado");
            }}
          />
          Tema fixo nesta música
        </label>

        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`Tema: ${activeTheme?.name ?? "nenhum"}`}
              className={cn(
                "relative h-8 w-14 overflow-hidden rounded-md shadow-[var(--shadow-border)]",
                "transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                "hover:shadow-[var(--shadow-border-hover)] active:scale-[0.97]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
              style={themeSwatch(activeTheme).style}
            >
              <span
                aria-hidden
                className={cn("absolute inset-0", themeSwatch(activeTheme).className)}
              />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="start"
              sideOffset={6}
              className="pop-layer z-40 grid w-60 grid-cols-2 gap-1.5 rounded-lg bg-elevated p-2 shadow-[var(--shadow-pop),var(--shadow-border)]"
            >
              {themes.map((theme) => (
                <ThemeThumb
                  key={theme.id}
                  theme={theme}
                  active={theme.id === songThemeId}
                  onClick={() => {
                    applyThemeLive(theme.id);
                    if (themePinned && currentSong) pinSongTheme(currentSong.id, theme.id);
                  }}
                />
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <FontSizeBar className="ml-auto" />

        <Button size="sm" variant="ghost" onClick={onSettings}>
          <Monitor /> Exibição
        </Button>
      </div>

    </div>
  );
}

/**
 * Transporte do vídeo do YouTube, junto ao preview.
 *
 * O telão fica preto até o vídeo começar, para a capa do YouTube — título,
 * canal, logo — não chegar à igreja. O preço disso é que o operador precisa
 * comandar de algum lugar, e o lugar é aqui: onde ele já está olhando quando
 * o vídeo está no ar.
 *
 * As mesmas ações existem na seção YouTube, com fila e volume. Aqui fica só o
 * que se aperta no meio do culto.
 */
function YoutubeTransporte() {
  const youtube = useLumenStore((s) => s.youtube);
  const comandar = useLumenStore((s) => s.comandarYoutube);
  const tirar = useLumenStore((s) => s.removerYoutube);
  const estado = useYoutubeStore((s) => s.estado);
  const tempo = useYoutubeStore((s) => s.tempo);
  const duracao = useYoutubeStore((s) => s.duracao);
  if (!youtube) return null;
  const tocando = estado === "tocando";

  return (
    <div className="animate-swap-in flex flex-wrap items-center gap-2 border-t border-border bg-elevated px-3 py-1.5">
      <Youtube className="size-3.5 shrink-0 text-danger" aria-hidden />
      <Hint label={tocando ? "Pausar no telão" : "Tocar no telão"}>
        <Button
          size="sm"
          variant={tocando ? "secondary" : "default"}
          onClick={() => comandar({ acao: tocando ? "pausar" : "tocar" })}
        >
          {tocando ? <Pause /> : <Play />}
          {tocando ? "Pausar" : "Tocar"}
        </Button>
      </Hint>
      <Hint label="Parar e voltar ao início">
        <Button size="iconSm" variant="ghost" aria-label="Parar vídeo" onClick={() => comandar({ acao: "parar" })}>
          <Square />
        </Button>
      </Hint>
      <Hint label={youtube.mudo ? "Tirar do mudo" : "Mudo"}>
        <Button
          size="iconSm"
          variant="ghost"
          aria-label={youtube.mudo ? "Tirar do mudo" : "Mudo"}
          onClick={() => comandar({ mudo: !youtube.mudo })}
        >
          {youtube.mudo ? <VolumeX /> : <Volume2 />}
        </Button>
      </Hint>
      <span className="tnum text-caption text-subtle">
        {relogio(tempo)} / {relogio(duracao)}
      </span>
      <span className="ml-auto flex items-center gap-2">
        {!tocando && (
          <span className="text-caption text-subtle">Telão preto até você tocar</span>
        )}
        <Button size="sm" variant="ghost" onClick={tirar}>
          Tirar do telão
        </Button>
      </span>
    </div>
  );
}


