import {
  ArrowLeft,
  BookOpen,
  Check,
  Heart,
  History,
  Play,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SlideStage } from "@/components/slide/slide-renderer";
import { OptimizeButton } from "@/components/operator/optimize-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  chapterCount,
  chapterVerseCount,
  chapterVerses,
  hydrateExtraVersions,
  loadBuiltinBible,
  searchVerses,
} from "@/lib/bible";
import {
  BOOKS,
  bookById,
  bookSection,
  bookShort,
  bookTinyName,
  findBookByTyped,
} from "@/lib/bible-books";
import { cn } from "@/lib/cn";
import type { LiveFrame } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function BibleWorkspace({
  previewFrame,
  onBack,
}: {
  previewFrame: LiveFrame;
  onBack: () => void;
}) {
  const cursor = useLumenStore((s) => s.bibleCursor);
  const versionId = useLumenStore((s) => s.bibleVersionId);
  const extra = useLumenStore((s) => s.extraVersionIds);
  const query = useLumenStore((s) => s.bibleQuery);
  const setQuery = useLumenStore((s) => s.setBibleQuery);
  const load = useLumenStore((s) => s.loadBibleChapter);
  const changeVersion = useLumenStore((s) => s.changeVersion);
  const jumpRef = useLumenStore((s) => s.jumpRef);
  const present = useLumenStore((s) => s.presentPreview);
  const favorites = useLumenStore((s) => s.favorites);
  const toggleFavorite = useLumenStore((s) => s.toggleFavorite);
  const logs = useLumenStore((s) => s.logs);
  const searchRef = useRef<HTMLInputElement>(null);
  const verseListRef = useRef<HTMLUListElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [projected, setProjected] = useState<Set<string>>(() => new Set());
  const typeBuf = useRef("");
  const typeTimer = useRef(0);

  useEffect(() => {
    let alive = true;
    Promise.all([loadBuiltinBible(), hydrateExtraVersions()])
      .then(() => {
        if (!alive) return;
        setReady(true);
        load(cursor.bookId, cursor.chapter, cursor.verse, false);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = bookById(cursor.bookId);
  const chapters = ready ? chapterCount(versionId, cursor.bookId) : 0;
  const verseTotal = ready ? chapterVerseCount(versionId, cursor.bookId, cursor.chapter) : 0;
  const verses = ready ? chapterVerses(versionId, cursor.bookId, cursor.chapter) : [];
  const hits = ready && query.length > 2 ? searchVerses(versionId, query) : [];
  const section = bookSection(cursor.bookId);
  const currentRef = meta ? `${meta.name} ${cursor.chapter}:${cursor.verse}` : "";
  const loved = favorites.includes(currentRef);
  const recentBible = useMemo(
    () => logs.filter((l) => l.kind === "bible").slice(0, 12),
    [logs],
  );

  const go = (bookId: number, chapter: number, verse = 1, fire = false) => {
    load(bookId, chapter, verse, fire);
    if (fire) {
      setProjected((prev) => new Set(prev).add(`${bookId}:${chapter}:${verse}`));
    }
  };

  const fireCurrent = () => {
    present();
    setProjected((prev) => new Set(prev).add(`${cursor.bookId}:${cursor.chapter}:${cursor.verse}`));
  };

  const submitQuery = () => {
    const ok = jumpRef(query, true);
    if (ok) {
      setProjected((prev) => new Set(prev).add(`${cursor.bookId}:${cursor.chapter}:${cursor.verse}`));
      return;
    }
    if (query.length > 2) {
      const hit = hits[0];
      if (hit) go(hit.bookId, hit.chapter, hit.verse, true);
      else toast.error("Referência não reconhecida");
    }
  };

  useEffect(() => {
    const el = verseListRef.current?.querySelector(`[data-verse="${cursor.verse}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor.verse, cursor.chapter, cursor.bookId]);

  const latest = useRef({ cursor, chapters, verseTotal, go, fireCurrent });
  latest.current = { cursor, chapters, verseTotal, go, fireCurrent };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const state = latest.current;
      if (e.key === "Enter") {
        e.preventDefault();
        state.fireCurrent();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(state.verseTotal, state.cursor.verse + 1);
        if (next !== state.cursor.verse) state.go(state.cursor.bookId, state.cursor.chapter, next);
        else if (state.cursor.chapter < state.chapters) {
          state.go(state.cursor.bookId, state.cursor.chapter + 1, 1);
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(1, state.cursor.verse - 1);
        if (prev !== state.cursor.verse) state.go(state.cursor.bookId, state.cursor.chapter, prev);
        else if (state.cursor.chapter > 1) {
          state.go(state.cursor.bookId, state.cursor.chapter - 1, 1);
        }
        return;
      }
      if (e.key === "Backspace") {
        typeBuf.current = typeBuf.current.slice(0, -1);
        setHint(typeBuf.current);
        return;
      }
      if (e.key.length !== 1 || e.key === " ") return;
      if (!/^[0-9a-zA-ZáéíóúãõâêôçÁÉÍÓÚ]$/.test(e.key)) return;
      e.preventDefault();
      typeBuf.current += e.key;
      const buf = typeBuf.current;
      setHint(buf);
      window.clearTimeout(typeTimer.current);
      typeTimer.current = window.setTimeout(() => {
        typeBuf.current = "";
        setHint("");
      }, 900);
      if (/^\d+$/.test(buf)) {
        const n = Number(buf);
        if (n >= 1 && n <= state.verseTotal) {
          state.go(state.cursor.bookId, state.cursor.chapter, n);
        } else if (n >= 1 && n <= state.chapters) {
          state.go(state.cursor.bookId, n, 1);
        }
        return;
      }
      if (buf.length >= 1) {
        const book = findBookByTyped(buf);
        if (book) state.go(book.id, 1, 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(typeTimer.current);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Button size="sm" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> Cabine
        </Button>
        <p className="text-title font-semibold tracking-tight">
          {meta?.name}: {cursor.chapter}
        </p>
        <select
          className="field w-40"
          value={versionId}
          onChange={(e) => changeVersion(e.target.value)}
          aria-label="Versão da Bíblia"
        >
          <option value="almeida-1819">Almeida 1819</option>
          {extra.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitQuery();
              }
            }}
            placeholder='jo 3 16 — ou um trecho'
            className="pl-8"
            aria-label="Buscar referência ou texto"
          />
          {hits.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {hits.slice(0, 8).map((h) => (
                <li key={h.ref + h.text.slice(0, 8)}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left hover:bg-raised"
                    onClick={() => {
                      go(h.bookId, h.chapter, h.verse, true);
                      setQuery("");
                    }}
                  >
                    <p className="text-secondary font-medium text-fg">{h.ref}</p>
                    <p className="line-clamp-1 text-secondary text-muted">{h.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <Button
            size="sm"
            variant={loved ? "default" : "ghost"}
            onClick={() => {
              if (currentRef) toggleFavorite(currentRef);
              if (favorites.length > 0) setFavOpen((v) => !v);
            }}
          >
            <Heart className="size-3.5" /> Favoritos
          </Button>
          {favOpen && (
            <ul className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {favorites.length === 0 && (
                <li className="px-3 py-2 text-body text-muted">Nenhum favorito ainda.</li>
              )}
              {favorites.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-body hover:bg-raised"
                    onClick={() => {
                      jumpRef(f, true);
                      setFavOpen(false);
                    }}
                  >
                    <Star className="mr-1 inline size-3" />
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((v) => !v)}>
            <History className="size-3.5" /> Histórico
          </Button>
          {historyOpen && (
            <ul className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {recentBible.length === 0 && (
                <li className="px-3 py-2 text-body text-muted">Ainda sem projeções.</li>
              )}
              {recentBible.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-body hover:bg-raised"
                    onClick={() => {
                      jumpRef(l.title, true);
                      setHistoryOpen(false);
                    }}
                  >
                    {l.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <OptimizeButton />
        <Button size="sm" onClick={fireCurrent}>
          <Play className="size-3.5" /> Projetar
        </Button>
      </div>

      {!ready && !err && (
        <p className="px-4 py-10 text-body text-muted">Carregando Almeida 1819…</p>
      )}
      {err && <p className="px-4 py-10 text-body text-danger">{err}</p>}

      {ready && (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(17rem,22%)_1fr]">
          <section className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-secondary font-medium text-subtle">
                {meta?.name} {cursor.chapter}
              </p>
              <span className="text-secondary tnum text-muted">{verses.length} versículos</span>
            </div>
            <ul ref={verseListRef} className="min-h-0 flex-1 overflow-y-auto lumen-scroll">
              {verses.map((v) => {
                const key = `${cursor.bookId}:${cursor.chapter}:${v.n}`;
                const done = projected.has(key);
                return (
                  <li key={v.n}>
                    <button
                      type="button"
                      data-verse={v.n}
                      onClick={() => go(cursor.bookId, cursor.chapter, v.n, false)}
                      onDoubleClick={() => go(cursor.bookId, cursor.chapter, v.n, true)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-elevated",
                        v.n === cursor.verse && "bg-elevated",
                      )}
                    >
                      <span className="w-6 shrink-0 text-secondary tnum text-subtle">{v.n}</span>
                      <span className="min-w-0 flex-1 text-body leading-snug">{v.text}</span>
                      {done && <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border p-2">
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-md bg-stage shadow-[var(--shadow-border)]"
                onClick={fireCurrent}
                aria-label="Projetar versículo"
              >
                <div className="aspect-video">
                  <SlideStage
                    frame={previewFrame}
                    variant="preview"
                    statusOverride="presenting"
                    className="size-full"
                  />
                </div>
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-live px-2 py-0.5 text-caption font-semibold text-live-fg">
                  <Play className="size-3" /> Projetar
                </span>
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-bg p-1">
            <div className="bible-mosaic">
              {BOOKS.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  title={book.name}
                  aria-label={book.name}
                  aria-pressed={book.id === cursor.bookId}
                  data-on={book.id === cursor.bookId}
                  onClick={() => go(book.id, 1, 1)}
                  className={cn("bible-tile", `bible-tile-${bookSection(book.id)}`)}
                >
                  <span className="bible-tile-abbr">{bookShort(book)}</span>
                  <span className="bible-tile-name">{bookTinyName(book)}</span>
                </button>
              ))}
            </div>

            <div className="mt-1 grid min-h-0 flex-1 grid-cols-1 gap-1 md:grid-cols-2">
              <div className="flex min-h-0 flex-col overflow-y-auto lumen-scroll">
                <div className="bible-nums bible-nums-ch">
                  {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-on={n === cursor.chapter}
                      aria-label={`Capítulo ${n}`}
                      onClick={() => go(cursor.bookId, n, 1)}
                      className={cn("bible-tile", `bible-tile-${section}`)}
                    >
                      <span className="bible-tile-num">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex min-h-0 flex-col overflow-y-auto lumen-scroll">
                <div className="bible-nums bible-nums-vs">
                  {Array.from({ length: verseTotal }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-on={n === cursor.verse}
                      aria-label={`Versículo ${n}`}
                      onClick={() => go(cursor.bookId, cursor.chapter, n, false)}
                      onDoubleClick={() => go(cursor.bookId, cursor.chapter, n, true)}
                      className={cn("bible-tile", `bible-tile-${section}`)}
                    >
                      <span className="bible-tile-num">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <p className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-secondary text-subtle">
        <BookOpen className="size-3" />
        <span className="min-w-0 flex-1 truncate">
          Digite uma tecla para localizar o versículo ou o livro · duplo clique projeta · Enter
          envia ao telão · Esc volta à cabine
        </span>
        {hint && (
          <kbd className="rounded bg-elevated px-2 py-0.5 font-mono text-secondary text-fg">{hint}</kbd>
        )}
      </p>
    </div>
  );
}
