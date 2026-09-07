import { Check, ChevronDown, GripVertical, Plus, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Empty, Tally } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
import { ThemeThumb } from "@/components/operator/theme-rail";
import { cn } from "@/lib/cn";
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
  const nextPlaylistItem = useLumenStore((s) => s.nextPlaylistItem);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const pl = playlists.find((p) => p.id === activeId) ?? playlists[0];
  const count = pl?.items.length ?? 0;
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const exportPl = () => {
    if (!pl) return;
    const blob = new Blob([JSON.stringify(pl, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pl.name.replace(/\s+/g, "-")}.json`;
    a.click();
    toast("Culto exportado");
  };

  const importPl = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        importPlaylist(JSON.parse(await file.text()));
        toast("Culto importado");
      } catch {
        toast.error("Arquivo não é um culto do Lúmen");
      }
    };
    input.click();
  };

  const addCurrent = () => {
    if (!preview) {
      toast("Selecione algo na biblioteca primeiro");
      return;
    }
    addToPlaylist({
      type: preview.kind,
      refId: preview.refId,
      notes: "",
      title: preview.title,
      subtitle: preview.subtitle,
    });
    toast(`“${preview.title}” entrou no culto`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="panel-head justify-between">
        <h2>
          Culto <span className="tnum text-subtle">{count}</span>
        </h2>
        <div className="flex items-center gap-0.5">
          <Hint label="Somar o que está no preview ao culto">
            <Button size="iconSm" variant="ghost" aria-label="Adicionar ao culto" onClick={addCurrent}>
              <Plus />
            </Button>
          </Hint>
          <Hint label="Próximo item do culto" keys="Ctrl+N">
            <Button size="iconSm" variant="ghost" aria-label="Próximo item" onClick={nextPlaylistItem}>
              <SkipForward />
            </Button>
          </Hint>
        </div>
      </div>

      {/* O nome do culto e tudo que se faz com o culto ficam no mesmo lugar. */}
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            data-playlist-trigger
            className={cn(
              "group flex h-9 w-full items-center justify-between gap-2 border-b border-border bg-elevated px-3",
              "text-left text-body font-medium text-fg",
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "hover:bg-raised data-[state=open]:bg-raised",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <span className="truncate">{pl?.name ?? "Temporário"}</span>
            <ChevronDown
              className="size-3.5 shrink-0 text-subtle transition-transform duration-[var(--motion-base)] ease-[var(--ease-out)] group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </MenuTrigger>
        <MenuContent className="w-(--radix-dropdown-menu-trigger-width)">
          {playlists.map((p) => (
            <MenuItem key={p.id} onSelect={() => setActive(p.id)}>
              <span className="flex items-center gap-2">
                {p.id === activeId ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <span className="size-3.5 shrink-0" aria-hidden />
                )}
                {p.name}
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            onSelect={() => ensureMonthPlaylist(prevMonth.getFullYear(), prevMonth.getMonth())}
          >
            {monthLabel(prevMonth.getFullYear(), prevMonth.getMonth())}
          </MenuItem>
          <MenuItem
            onSelect={() => ensureMonthPlaylist(nextMonth.getFullYear(), nextMonth.getMonth())}
          >
            {monthLabel(nextMonth.getFullYear(), nextMonth.getMonth())}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              const name = window.prompt("Nome do culto", "Novo culto");
              if (name) savePlaylist(name);
            }}
          >
            Novo culto
          </MenuItem>
          <MenuItem onSelect={duplicate}>Duplicar este culto</MenuItem>
          <MenuItem onSelect={exportPl}>Exportar culto</MenuItem>
          <MenuItem onSelect={importPl}>Importar culto</MenuItem>
        </MenuContent>
      </Menu>

      <ul className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
        {pl?.items.map((item, i) => {
          const onAir = status !== "idle" && live?.refId === item.refId;
          const selected = preview?.refId === item.refId;
          return (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(i);
              }}
              onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              className={cn(
                "group/item relative flex items-center gap-1 border-b border-border/50 px-2 py-1.5",
                "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                selected && "bg-elevated",
                onAir && "bg-live/10",
                dragFrom === i && "opacity-40",
                dragOver === i && dragFrom !== i && "shadow-[inset_0_2px_0_0_var(--color-accent)]",
              )}
            >
              {(selected || onAir) && (
                <span
                  aria-hidden
                  className={cn(
                    "animate-swap-in absolute inset-y-0 left-0 w-0.5",
                    onAir ? "bg-live" : "bg-fg",
                  )}
                />
              )}
              <GripVertical
                className="size-3.5 shrink-0 cursor-grab text-subtle opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/item:opacity-100 active:cursor-grabbing"
                aria-hidden
              />
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => previewItem(i)}
                onDoubleClick={() => presentItem(i)}
                title="Um clique põe no preview; dois cliques mandam para o telão"
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="tnum shrink-0 text-caption text-subtle">{i + 1}</span>
                  <span className="truncate text-body text-fg">{item.title}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {onAir && <Tally state="live" label="No ar" />}
                  <span className="text-caption text-subtle">{labelType(item.type)}</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/item:opacity-100 focus-within:opacity-100">
                <Hint label="Tirar do culto">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={`Tirar ${item.title} do culto`}
                    className="hover:text-danger"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </Hint>
              </div>
            </li>
          );
        })}

        {(!pl || pl.items.length === 0) && (
          <Empty
            title="O culto ainda está vazio."
            hint="Dê dois cliques num item da biblioteca para trazê-lo para cá, ou use o + acima."
          />
        )}
      </ul>

      {showThemes && (
        <div className="border-t border-border p-2">
          <p className="mb-1.5 text-caption font-medium text-subtle">Tema ao vivo</p>
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
