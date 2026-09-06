import { Copy, Download, GripVertical, Pencil, Play, Plus, SkipForward, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeThumb } from "@/components/operator/theme-rail";
import { cn } from "@/lib/cn";
import type { Playlist } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

export function PlaylistPanel({ showThemes = false }: { showThemes?: boolean }) {
  const playlists = useLumenStore((s) => s.playlists);
  const activeId = useLumenStore((s) => s.activePlaylistId);
  const setActive = useLumenStore((s) => s.setActivePlaylist);
  const presentItem = useLumenStore((s) => s.presentPlaylistItem);
  const previewItem = useLumenStore((s) => s.previewPlaylistItem);
  const remove = useLumenStore((s) => s.removePlaylistItem);
  const move = useLumenStore((s) => s.movePlaylistItem);
  const duplicate = useLumenStore((s) => s.duplicatePlaylist);
  const savePlaylist = useLumenStore((s) => s.savePlaylist);
  const importPlaylist = useLumenStore((s) => s.importPlaylist);
  const ensureMonthPlaylist = useLumenStore((s) => s.ensureMonthPlaylist);
  const live = useLumenStore((s) => s.live);
  const status = useLumenStore((s) => s.status);
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const bibleThemeId = useLumenStore((s) => s.bibleThemeId);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const preview = useLumenStore((s) => s.preview);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const nextPlaylistItem = useLumenStore((s) => s.nextPlaylistItem);

  const pl = playlists.find((p) => p.id === activeId) ?? playlists[0];
  const count = pl?.items.length ?? 0;

  const exportPl = () => {
    if (!pl) return;
    const blob = new Blob([JSON.stringify(pl, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pl.name.replace(/\s+/g, "-")}.json`;
    a.click();
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      importPlaylist(data);
      toast("Playlist importada");
    } catch {
      toast.error("JSON inválido");
    }
  };

  const addCurrent = () => {
    if (!preview) return;
    addToPlaylist({
      type: preview.kind,
      refId: preview.refId,
      notes: "",
      title: preview.title,
      subtitle: preview.subtitle,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <Button size="iconSm" variant="ghost" aria-label="Apresentar" onClick={presentPreview}>
          <Play className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Próximo item" onClick={nextPlaylistItem}>
          <SkipForward className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Adicionar atual" onClick={addCurrent}>
          <Plus className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Duplicar playlist" onClick={duplicate}>
          <Copy className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Exportar" onClick={exportPl}>
          <Download className="size-3.5" />
        </Button>
        <label className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg">
          <Upload className="size-3.5" />
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </label>
        <Button
          size="iconSm"
          variant="ghost"
          aria-label="Nova playlist"
          onClick={() => {
            const name = window.prompt("Nome da playlist", "Novo culto");
            if (name) savePlaylist(name);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
      <PlaylistMenu
        playlists={playlists}
        activeId={activeId}
        onPick={setActive}
        onMonth={ensureMonthPlaylist}
      />
      <p className="border-b border-border px-3 py-1 text-xs text-subtle">
        Histórico <span className="tabular-nums">({count})</span>
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto lumen-scroll">
        {pl?.items.map((item, i) => {
          const onAir = status !== "idle" && live?.refId === item.refId;
          const selected = preview?.refId === item.refId;
          return (
            <li
              key={item.id}
              className={cn(
                "group flex items-center gap-1 border-b border-border/50 px-2 py-2",
                selected && "bg-primary/10",
                onAir && "bg-live/15",
              )}
            >
              <GripVertical className="size-3.5 text-subtle" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => previewItem(i)}
                onDoubleClick={() => presentItem(i)}
              >
                <span className="block truncate text-sm">
                  <span className="mr-1 tabular-nums text-subtle">{i + 1}.</span>
                  {item.title}
                </span>
                <span className="block text-xs uppercase tracking-wide text-subtle">
                  {onAir ? "No ar · " : ""}
                  {labelType(item.type)}
                </span>
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
                onClick={() => remove(item.id)}
                aria-label="Remover"
              >
                <Trash2 className="size-3.5" />
              </button>
              {i > 0 && (
                <button
                  type="button"
                  className="text-xs text-subtle hover:text-fg"
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
              )}
            </li>
          );
        })}
        {(!pl || pl.items.length === 0) && (
          <p className="p-4 text-center text-sm text-muted">
            Duplo clique na biblioteca para montar o culto.
          </p>
        )}
      </ul>

      {showThemes && (
        <div className="border-t border-border p-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-subtle">
            Tema ao vivo
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {themes.map((theme) => (
              <ThemeThumb
                key={theme.id}
                theme={theme}
                active={theme.id === songThemeId || theme.id === bibleThemeId}
                onClick={() => applyThemeLive(theme.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function labelType(t: string) {
  if (t === "song") return "Música";
  if (t === "bible") return "Bíblia";
  if (t === "media") return "Mídia";
  if (t === "text") return "Aviso";
  return t;
}

function monthLabel(year: number, month: number) {
  const raw = new Date(year, month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const pretty = raw.replace(" de ", "/");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function PlaylistMenu({
  playlists,
  activeId,
  onPick,
  onMonth,
}: {
  playlists: Playlist[];
  activeId: string;
  onPick: (id: string) => void;
  onMonth: (year: number, month: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = playlists.find((p) => p.id === activeId);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between bg-elevated px-3 text-left text-sm font-medium"
      >
        <span className="truncate">{current?.name ?? "Temporário"}</span>
        <span className="text-subtle">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 rounded-b-lg bg-elevated py-1 shadow-[var(--shadow-border)]">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-primary/10",
                p.id === activeId && "bg-primary/15 font-medium",
              )}
              onClick={() => {
                onPick(p.id);
                setOpen(false);
              }}
            >
              {p.name}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-primary/10 hover:text-fg"
            onClick={() => {
              onMonth(prev.getFullYear(), prev.getMonth());
              setOpen(false);
            }}
          >
            Ir para: {monthLabel(prev.getFullYear(), prev.getMonth())}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-primary/10 hover:text-fg"
            onClick={() => {
              onMonth(next.getFullYear(), next.getMonth());
              setOpen(false);
            }}
          >
            Ir para: {monthLabel(next.getFullYear(), next.getMonth())}
          </button>
        </div>
      )}
    </div>
  );
}
