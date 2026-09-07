import { toast } from "sonner";
import * as Popover from "@radix-ui/react-popover";
import { Monitor, Pause, Pencil, Play, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { SlideStage } from "@/components/slide/slide-renderer";
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
          <div className="flex min-w-0 items-center gap-2">
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

      <PlayerStrip />
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
          <SlideStage
            frame={previewFrame}
            variant="preview"
            statusOverride="presenting"
            className="size-full"
          />
          <span className="absolute left-2 top-2 rounded-sm bg-stage/85 px-1.5 py-0.5 text-caption font-medium text-stage-fg">
            Preview
          </span>
          {/* O que a igreja está vendo agora, para comparar sem trocar de tela. */}
          {status !== "idle" && (
            <span className="animate-pop-in absolute right-2 top-2 block w-24 overflow-hidden rounded-sm shadow-[var(--shadow-border-hover)]">
              <span className="block h-14">
                <SlideStage frame={outputFrame} variant="preview" className="size-full" />
              </span>
              <span className="flex items-center justify-center gap-1 bg-stage/90 py-0.5">
                <Tally state="live" label="No ar" />
              </span>
            </span>
          )}
        </button>
      </div>

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

        <Button size="sm" variant="ghost" className="ml-auto" onClick={onSettings}>
          <Monitor /> Exibição
        </Button>
      </div>

    </div>
  );
}

/**
 * Player de mídia.
 *
 * Só existe quando há áudio ou vídeo selecionado. Antes ficava sempre na
 * tela, com cronômetro zerado e controles que não faziam nada — uma faixa
 * inteira do console ocupada por nada.
 */
function PlayerStrip() {
  const preview = useLumenStore((s) => s.preview);
  const media = useLumenStore((s) => s.media);
  const item = preview?.kind === "media" ? media.find((m) => m.id === preview.refId) : null;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.85);

  const stamp = useMemo(() => {
    const fmt = (n: number) => {
      const s = Math.max(0, Math.floor(n));
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      return `${mm}:${ss}`;
    };
    return `${fmt(time)} / ${fmt(dur)}`;
  }, [time, dur]);

  // Só áudio: o vídeo agora toca no telão, com som. Se a cabine também
  // tocasse, o mesmo trecho sairia duas vezes na caixa.
  if (!item || item.type !== "audio") return null;

  const seek = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(dur || el.duration || 0, el.currentTime + delta));
  };

  return (
    <div className="animate-swap-in flex items-center gap-2 border-b border-border bg-elevated px-3 py-1.5">
      <audio
        ref={audioRef}
        src={item.path}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <Button
        size="iconSm"
        variant="ghost"
        aria-label={playing ? "Pausar" : "Tocar"}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button
        size="iconSm"
        variant="ghost"
        aria-label="Parar"
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          el.pause();
          el.currentTime = 0;
        }}
      >
        <Square />
      </Button>
      <Hint label="Voltar 10 segundos">
        <Button size="iconSm" variant="ghost" aria-label="Voltar 10 segundos" onClick={() => seek(-10)}>
          <SkipBack />
        </Button>
      </Hint>
      <Hint label="Avançar 10 segundos">
        <Button size="iconSm" variant="ghost" aria-label="Avançar 10 segundos" onClick={() => seek(10)}>
          <SkipForward />
        </Button>
      </Hint>
      <span className="tnum shrink-0 font-mono text-caption text-muted">{stamp}</span>
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={0.1}
        value={time}
        onChange={(e) => {
          const el = audioRef.current;
          const v = Number(e.target.value);
          if (el) el.currentTime = v;
          setTime(v);
        }}
        className="h-1 min-w-16 flex-1 accent-accent"
        aria-label="Posição"
      />
      <Volume2 className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={vol}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVol(v);
          if (audioRef.current) audioRef.current.volume = v;
        }}
        className="h-1 w-16 accent-accent"
        aria-label="Volume"
      />
    </div>
  );
}
