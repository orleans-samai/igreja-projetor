import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Monitor,
  Music2,
  Pause,
  Pencil,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { SlideStage } from "@/components/slide/slide-renderer";
import { OptimizeBanner, OptimizeButton } from "@/components/operator/optimize-bar";
import { ThemeThumb } from "@/components/operator/theme-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { LiveFrame, Slide } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

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
  const setPreviewIndex = useLumenStore((s) => s.setPreviewIndex);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const live = useLumenStore((s) => s.live);
  const status = useLumenStore((s) => s.status);
  const updatePreviewSlide = useLumenStore((s) => s.updatePreviewSlide);
  const duplicatePreviewLabel = useLumenStore((s) => s.duplicatePreviewLabel);
  const reorderPreview = useLumenStore((s) => s.reorderPreview);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const themes = useLumenStore((s) => s.themes);
  const songs = useLumenStore((s) => s.songs);
  const pinSongTheme = useLumenStore((s) => s.pinSongTheme);
  const [editId, setEditId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [themePick, setThemePick] = useState(false);

  const isLive = status !== "idle" && live?.refId === preview?.refId;
  const currentSong = preview?.kind === "song" ? songs.find((s) => s.id === preview.refId) : null;
  const themePinned = Boolean(currentSong?.themeId);
  const activeTheme = themes.find((t) => t.id === songThemeId) ?? themes[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{preview?.title ?? "Nada selecionado"}</p>
          <p className="truncate text-xs text-muted">
            {preview?.subtitle}
            {preview?.key ? ` · tom ${preview.key}` : ""}
            {preview ? ` · ${preview.slides.length} slides` : ""}
          </p>
        </div>
        {isLive && <Badge tone="live">no telão</Badge>}
        {preview?.kind === "song" && (
          <Button size="sm" variant="ghost" onClick={onEditSong}>
            <Pencil className="size-3.5" /> Letra
          </Button>
        )}
        <OptimizeButton />
        <Button size="sm" onClick={presentPreview}>
          <Play className="size-3.5" /> F5
        </Button>
      </div>

      <PlayerStrip />
      <OptimizeBanner />

      <div className="preview-well min-h-0 flex-1 p-3">
        <button
          type="button"
          className="relative block size-full overflow-hidden rounded-lg bg-stage shadow-[var(--shadow-border)]"
          onClick={presentPreview}
          onContextMenu={(e) => {
            e.preventDefault();
            const slide = preview?.slides[previewIndex];
            if (slide) setEditId(slide.id);
          }}
        >
          <SlideStage
            frame={previewFrame}
            variant="preview"
            statusOverride="presenting"
            className="size-full"
          />
          <span className="absolute left-2 top-2 rounded-md bg-stage/70 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] text-stage-fg/80">
            Preview
          </span>
          {status !== "idle" && (
            <span className="absolute right-2 top-2 overflow-hidden rounded-md bg-stage/80">
              <span className="block h-14 w-24">
                <SlideStage frame={outputFrame} variant="preview" className="size-full" />
              </span>
              <span className="block bg-live px-1 py-0.5 text-center text-xs font-medium uppercase tracking-wide text-accent-fg">
                Programa
              </span>
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <button
            type="button"
            role="switch"
            aria-checked={themePinned}
            data-on={themePinned}
            disabled={!currentSong}
            className="lumen-switch"
            aria-label="Salvar tema para música"
            onClick={() => {
              if (!currentSong) return;
              const next = !themePinned;
              pinSongTheme(currentSong.id, next ? songThemeId : null);
              toast(next ? "Tema preso a esta música" : "Tema liberado");
            }}
          />
          Salvar tema para música
        </label>
        <div className="relative">
          <button
            type="button"
            aria-label="Tema da música"
            className="relative h-10 w-16 overflow-hidden rounded-md shadow-[var(--shadow-border)]"
            onClick={() => setThemePick((v) => !v)}
            style={
              activeTheme?.backgroundType === "color"
                ? { background: activeTheme.backgroundValue }
                : {
                    backgroundImage: `url(${activeTheme?.backgroundValue})`,
                    backgroundSize: "cover",
                  }
            }
          >
            <ChevronDown className="absolute bottom-0.5 right-0.5 size-3 rounded-sm bg-stage/70 text-stage-fg" />
          </button>
          {themePick && (
            <ul className="absolute bottom-full left-0 z-30 mb-1 grid w-56 grid-cols-2 gap-1 rounded-lg bg-elevated p-2 shadow-[var(--shadow-border)]">
              {themes.map((theme) => (
                <li key={theme.id}>
                  <ThemeThumb
                    theme={theme}
                    active={theme.id === songThemeId}
                    onClick={() => {
                      applyThemeLive(theme.id);
                      if (themePinned && currentSong) pinSongTheme(currentSong.id, theme.id);
                      setThemePick(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onSettings}>
          <Monitor className="size-3.5" /> Configurações de exibição
        </Button>
      </div>

      <div className="min-h-0 max-h-44 overflow-y-auto border-t border-border lumen-scroll">
        {preview?.slides.map((slide, i) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            index={i}
            active={i === previewIndex}
            editing={editId === slide.id}
            onSelect={() => setPreviewIndex(i)}
            onEdit={() => setEditId(slide.id)}
            onSave={(patch) => {
              updatePreviewSlide(slide.id, patch);
              setEditId(null);
            }}
            onCancel={() => setEditId(null)}
            onDuplicate={() => duplicatePreviewLabel(slide.label.split(" ")[0] ?? slide.label)}
            onDragStart={() => setDragFrom(i)}
            onDrop={() => {
              if (dragFrom !== null && dragFrom !== i) reorderPreview(dragFrom, i);
              setDragFrom(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerStrip() {
  const preview = useLumenStore((s) => s.preview);
  const media = useLumenStore((s) => s.media);
  const item = preview?.kind === "media" ? media.find((m) => m.id === preview.refId) : null;
  const playable = item && (item.type === "audio" || item.type === "video");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.85);

  const stamp = useMemo(() => {
    const fmt = (n: number) => {
      const s = Math.max(0, Math.floor(n));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };
    return fmt(time);
  }, [time]);

  const seek = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(dur || el.duration || 0, el.currentTime + delta));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-elevated px-3 py-2">
      <Music2 className="size-4 text-subtle" />
      <p className="hidden text-xs font-medium text-muted sm:block">Player</p>
      {playable ? (
        <>
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
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button size="iconSm" variant="ghost" aria-label="Parar" onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            el.pause();
            el.currentTime = 0;
          }}>
            <Square className="size-3.5" />
          </Button>
          <Button size="iconSm" variant="ghost" aria-label="Voltar 10s" onClick={() => seek(-10)}>
            <SkipBack className="size-3.5" />
          </Button>
          <span className="w-20 font-mono text-xs tabular-nums text-muted">{stamp}</span>
          <button type="button" className="font-mono text-xs text-subtle hover:text-fg" onClick={() => seek(-30)}>
            −30
          </button>
          <button type="button" className="font-mono text-xs text-subtle hover:text-fg" onClick={() => seek(-10)}>
            −10
          </button>
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
            className="h-1 min-w-16 flex-1 accent-primary"
            aria-label="Posição"
          />
          <button type="button" className="font-mono text-xs text-subtle hover:text-fg" onClick={() => seek(10)}>
            +10
          </button>
          <button type="button" className="font-mono text-xs text-subtle hover:text-fg" onClick={() => seek(30)}>
            +30
          </button>
          <Button size="iconSm" variant="ghost" aria-label="Avançar 10s" onClick={() => seek(10)}>
            <SkipForward className="size-3.5" />
          </Button>
          <Volume2 className="size-3.5 text-subtle" />
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
            className="h-1 w-16 accent-primary"
            aria-label="Volume"
          />
        </>
      ) : (
        <>
          <span className="font-mono text-xs tabular-nums text-subtle">00:00:00</span>
          <span className="font-mono text-xs text-subtle">−30</span>
          <span className="font-mono text-xs text-subtle">−10</span>
          <div className="h-1 min-w-16 flex-1 rounded-full bg-border" />
          <span className="font-mono text-xs text-subtle">+10</span>
          <span className="font-mono text-xs text-subtle">+30</span>
          <Volume2 className="size-3.5 text-subtle" />
          <div className="h-1 w-16 rounded-full bg-border" />
        </>
      )}
    </div>
  );
}

function SlideRow({
  slide,
  index,
  active,
  editing,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  onDuplicate,
  onDragStart,
  onDrop,
}: {
  slide: Slide;
  index: number;
  active: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onSave: (patch: Partial<Slide>) => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [text, setText] = useState(slide.text);
  const [comment, setComment] = useState(slide.comment ?? "");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn("border-b border-border/60 px-3 py-2", active && "bg-primary/10")}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-2 text-left">
        <span className="w-5 pt-0.5 text-xs tabular-nums text-subtle">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="text-xs font-medium text-primary">{slide.label}</span>
          {!editing && (
            <span className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-xs text-muted">
              {slide.text}
            </span>
          )}
        </span>
      </button>
      {editing ? (
        <div className="mt-2 space-y-2 pl-7">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-20 w-full rounded-md bg-bg p-2 text-sm"
          />
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentário interno (só palco)"
            className="field h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSave({ text, comment })}>
              Aplicar no telão
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex gap-2 pl-7">
          <button type="button" className="text-xs text-muted hover:text-fg" onClick={onEdit}>
            Editar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            onClick={onDuplicate}
          >
            <Copy className="size-3" /> Duplicar seção
          </button>
        </div>
      )}
    </div>
  );
}
