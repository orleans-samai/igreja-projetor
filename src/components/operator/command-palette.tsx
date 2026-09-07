import { BookOpen, Mic, Music, Search, Sparkles, Type } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { interpretCopilot } from "@/lib/copilot-ai";
import { describeIntent, intentIsImmediate, parseCommand, type CopilotIntent } from "@/lib/copilot";
import { executeIntent } from "@/lib/copilot-exec";
import { universalSearch } from "@/lib/universal-search";
import { runOptimize } from "@/lib/run-optimize";
import { cn } from "@/lib/cn";
import type { SearchHit } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

function iconFor(kind: SearchHit["kind"]) {
  if (kind === "bible") return BookOpen;
  if (kind === "song") return Music;
  if (kind === "text") return Type;
  return Search;
}

function runHit(hit: SearchHit) {
  const s = useLumenStore.getState();
  if (hit.kind === "bible") {
    const [b, c, v] = hit.refId.split(":").map(Number);
    s.loadBibleChapter(b, c, v || 1, true);
    useOpsStore.getState().logAction("Projetou versículo", hit.title);
    return;
  }
  if (hit.kind === "song") {
    s.selectSong(hit.refId);
    s.presentPreview();
    useOpsStore.getState().logAction("Projetou música", hit.title);
    return;
  }
  if (hit.kind === "text") {
    s.selectText(hit.refId);
    s.presentPreview();
    return;
  }
  if (hit.kind === "media") {
    s.selectMedia(hit.refId);
    s.presentPreview();
    return;
  }
  if (hit.kind === "playlist") {
    s.setActivePlaylist(hit.refId);
    toast(`Playlist ${hit.title}`);
  }
}

function applyIntent(intent: CopilotIntent): boolean {
  if (intent.type === "optimize") {
    void runOptimize();
    useOpsStore.getState().setCommandOpen(false);
    return true;
  }
  if (intent.type === "search" || intent.type === "unknown") return false;
  const result = executeIntent(intent);
  toast(result.message);
  if (result.ok) useOpsStore.getState().setCommandOpen(false);
  return result.ok;
}

export function CommandPalette() {
  const open = useOpsStore((s) => s.commandOpen);
  const setOpen = useOpsStore((s) => s.setCommandOpen);
  const songs = useLumenStore((s) => s.songs);
  const texts = useLumenStore((s) => s.texts);
  const media = useLumenStore((s) => s.media);
  const playlists = useLumenStore((s) => s.playlists);
  const logs = useLumenStore((s) => s.logs);
  const bibleVersionId = useLumenStore((s) => s.bibleVersionId);

  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const intent = useMemo(() => (q.trim() ? parseCommand(q) : null), [q]);
  const hits = useMemo(
    () =>
      q.trim().length < 2
        ? []
        : universalSearch({
            query: q,
            songs,
            texts,
            media,
            playlists,
            logs,
            bibleVersionId,
            limit: 12,
          }),
    [q, songs, texts, media, playlists, logs, bibleVersionId],
  );

  const rows: { key: string; label: string; hint: string; run: () => void }[] = [];
  if (intent && intentIsImmediate(intent)) {
    rows.push({
      key: "intent",
      label: describeIntent(intent),
      hint: "Executar",
      run: () => applyIntent(intent),
    });
  }
  if (intent?.type === "song") {
    rows.push({
      key: "song-intent",
      label: describeIntent(intent),
      hint: "Música",
      run: () => applyIntent(intent),
    });
  }
  for (const hit of hits) {
    rows.push({
      key: hit.id,
      label: hit.title,
      hint: hit.subtitle,
      run: () => {
        runHit(hit);
        setOpen(false);
      },
    });
  }

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => setCursor(0), [q]);

  const askAi = async () => {
    if (!q.trim()) return;
    setAiBusy(true);
    try {
      const catalog = songs
        .slice(0, 24)
        .map((s) => `${s.title} — ${s.artist}`)
        .join("\n");
      const res = await interpretCopilot({ data: { query: q.trim(), catalog } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!applyIntent(res.intent)) {
        toast(describeIntent(res.intent));
      }
    } finally {
      setAiBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 animate-[veil-in_var(--motion-base)_var(--ease-out)] bg-stage/70"
        aria-label="Fechar busca"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-label="Busca universal"
        className="animate-pop-in relative z-10 w-full max-w-xl overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-pop),var(--shadow-border)]"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="João 3:16 · refrão · tela preta · música que fala graça"
            className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-subtle"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(rows.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (e.metaKey || e.ctrlKey) {
                  void askAi();
                  return;
                }
                const row = rows[cursor] ?? rows[0];
                row?.run();
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void askAi()}
            disabled={!q.trim()}
            loading={aiBusy}
          >
            {!aiBusy && <Sparkles />}
            Copiloto
          </Button>
        </div>
        <ul role="listbox" aria-label="Resultados" className="lumen-scroll max-h-80 overflow-auto py-1">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-body text-muted">
              {q.trim()
                ? "Nada encontrado. Peça ao copiloto (Ctrl+Enter) ou tente um versículo."
                : "Comandos, Bíblia, músicas, avisos e o histórico do culto."}
            </li>
          )}
          {rows.map((row, i) => {
            const HitIcon = iconFor(
              (hits.find((h) => h.id === row.key)?.kind ?? "command") as SearchHit["kind"],
            );
            const Glyph = row.key === "intent" || row.key === "song-intent" ? Sparkles : HitIcon;
            return (
              <li key={row.key} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setCursor(i)}
                  onClick={row.run}
                  className={cn(
                    "relative flex w-full items-center gap-3 px-4 py-2 text-left text-body",
                    "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                    i === cursor ? "bg-elevated text-fg" : "text-muted",
                  )}
                >
                  {i === cursor && (
                    <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-fg" />
                  )}
                  <Glyph className="size-3.5 shrink-0 text-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="shrink-0 text-caption text-subtle">{row.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-caption text-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Key>Enter</Key> executa
            <Key>Ctrl+Enter</Key> pergunta ao copiloto
          </span>
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3" aria-hidden /> voz no modo operador
          </span>
        </p>
      </div>
    </div>
  );
}

/** Tecla do teclado, para o rodapé ensinar o atalho em vez de descrevê-lo. */
function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded-sm bg-elevated px-1 py-px font-sans text-caption text-muted">
      {children}
    </kbd>
  );
}
