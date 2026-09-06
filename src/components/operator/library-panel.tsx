import {
  BookOpen,
  Globe,
  Heart,
  Image as ImageIcon,
  Plus,
  Search,
  Star,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState, type Ref } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKS } from "@/lib/bible-books";
import {
  chapterCount,
  hydrateExtraVersions,
  loadBuiltinBible,
  searchVerses,
} from "@/lib/bible";
import { cn } from "@/lib/cn";
import { nid } from "@/lib/fold";
import { isWall, optimizeRawText } from "@/lib/slide-optimize";
import { searchSongs, useLumenStore } from "@/store/lumen-store";

const TABS = [
  { id: "songs", label: "Letras" },
  { id: "texts", label: "Texto" },
  { id: "media", label: "Mídia" },
  { id: "bible", label: "Bíblia" },
] as const;

export function LibraryPanel({
  onNewSong,
  onWebLyrics,
  onOpenBible,
  searchRef,
  bibleRef,
}: {
  onNewSong: () => void;
  onWebLyrics: () => void;
  onOpenBible: () => void;
  searchRef?: Ref<HTMLInputElement>;
  bibleRef?: Ref<HTMLInputElement>;
}) {
  const tab = useLumenStore((s) => s.libraryTab);
  const setTab = useLumenStore((s) => s.setTab);
  const search = useLumenStore((s) => s.search);
  const setSearch = useLumenStore((s) => s.setSearch);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <Button
          size="sm"
          variant={tab === "bible" ? "default" : "secondary"}
          onClick={onOpenBible}
        >
          <BookOpen className="size-3.5" /> Ir para Bíblia
        </Button>
      </div>
      <div className="flex gap-0.5 overflow-x-auto border-b border-border px-2 pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-t-md px-2.5 py-2 text-xs font-medium transition-colors duration-[var(--motion-quick)]",
              tab === t.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab !== "bible" && (
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar... (Ctrl+F)"
              className="pl-8"
              aria-label="Buscar no repertório"
            />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto lumen-scroll">
        {tab === "songs" && <SongsList onNewSong={onNewSong} onWebLyrics={onWebLyrics} />}
        {tab === "bible" && <BibleList bibleRef={bibleRef} />}
        {tab === "media" && <MediaList />}
        {tab === "texts" && <TextsList />}
      </div>
    </div>
  );
}

function SongsList({
  onNewSong,
  onWebLyrics,
}: {
  onNewSong: () => void;
  onWebLyrics: () => void;
}) {
  const songs = useLumenStore((s) => s.songs);
  const groups = useLumenStore((s) => s.groups);
  const search = useLumenStore((s) => s.search);
  const groupId = useLumenStore((s) => s.selectedGroupId);
  const selected = useLumenStore((s) => s.selectedSongId);
  const logs = useLumenStore((s) => s.logs);
  const setGroup = useLumenStore((s) => s.setGroup);
  const selectSong = useLumenStore((s) => s.selectSong);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);

  const list = useMemo(
    () => searchSongs(songs, search, groupId),
    [songs, search, groupId],
  );

  const lastPlayed = (id: string) => logs.find((l) => l.refId === id)?.playedAt;

  return (
    <div>
      <div className="flex flex-wrap gap-1 p-2">
        <FilterChip active={groupId === "all"} onClick={() => setGroup("all")}>
          Todas
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g.id} active={groupId === g.id} onClick={() => setGroup(g.id)}>
            {g.name}
          </FilterChip>
        ))}
        <Button size="sm" variant="secondary" className="ml-auto" onClick={onWebLyrics}>
          <Globe className="size-3.5" /> Internet
        </Button>
        <Button size="sm" variant="ghost" onClick={onNewSong}>
          <Plus className="size-3.5" /> Nova
        </Button>
      </div>
      <ul>
        {list.map((song) => {
          const last = lastPlayed(song.id);
          return (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => selectSong(song.id)}
                onDoubleClick={() => {
                  addToPlaylist({
                    type: "song",
                    refId: song.id,
                    notes: "",
                    title: song.title,
                    subtitle: song.artist,
                  });
                  toast("Adicionada à playlist");
                }}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors duration-[var(--motion-quick)] hover:bg-elevated",
                  selected === song.id && "bg-primary/10",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{song.title}</p>
                  <p className="truncate text-xs text-muted">
                    {song.artist}
                    {song.key ? ` · ${song.key}` : ""}
                    {last ? ` · ${new Date(last).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Badge>{groups.find((g) => g.id === song.groupId)?.name}</Badge>
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-muted">Nenhuma música encontrada no repertório.</p>
            <Button size="sm" className="mt-3" onClick={onWebLyrics}>
              <Globe className="size-3.5" /> Buscar na internet
            </Button>
          </div>
        )}
      </ul>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs",
        active ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function BibleList({ bibleRef }: { bibleRef?: Ref<HTMLInputElement> }) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  useEffect(() => {
    let alive = true;
    Promise.all([loadBuiltinBible(), hydrateExtraVersions()])
      .then(() => {
        if (alive) {
          setReady(true);
          load(cursor.bookId, cursor.chapter, cursor.verse, false);
        }
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chapters = ready ? chapterCount(versionId, cursor.bookId) : 0;
  const hits = ready && query.length > 2 ? searchVerses(versionId, query) : [];

  const go = (bookId: number, chapter: number, verse = 1, fire = false) => {
    load(bookId, chapter, verse, fire);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <Input
        ref={bibleRef}
        placeholder='Referência: "jo 3 16"  ou trecho'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const ok = jumpRef(query, true);
            if (!ok && query.length > 2) {
              const hit = hits[0];
              if (hit) go(hit.bookId, hit.chapter, hit.verse, true);
              else toast.error("Referência não reconhecida");
            }
          }
        }}
        aria-label="Referência bíblica"
      />
      <div className="flex gap-2">
        <select
          className="field flex-1"
          value={versionId}
          onChange={(e) => changeVersion(e.target.value)}
        >
          <option value="almeida-1819">Almeida 1819</option>
          {extra.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      {!ready && !err && <p className="px-1 py-6 text-sm text-muted">Carregando Almeida 1819…</p>}
      {err && <p className="px-1 py-6 text-sm text-danger">{err}</p>}
      {ready && (
        <>
          <div className="flex gap-2">
            <select
              className="field min-w-0 flex-1"
              value={cursor.bookId}
              onChange={(e) => go(Number(e.target.value), 1, 1)}
            >
              {BOOKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="field w-20"
              value={cursor.chapter}
              onChange={(e) => go(cursor.bookId, Number(e.target.value), 1)}
            >
              {Array.from({ length: chapters }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          {favorites.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {favorites.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => jumpRef(f, true)}
                  className="rounded-full bg-elevated px-2 py-1 text-xs text-muted hover:text-fg"
                >
                  <Star className="mr-1 inline size-3" />
                  {f}
                </button>
              ))}
            </div>
          )}
          {hits.length > 0 && (
            <ul className="rounded-md bg-elevated/60">
              {hits.map((h) => (
                <li key={h.ref + h.text.slice(0, 12)}>
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left hover:bg-elevated"
                    onClick={() => go(h.bookId, h.chapter, h.verse, true)}
                  >
                    <p className="text-xs font-medium text-primary">{h.ref}</p>
                    <p className="line-clamp-2 text-xs text-muted">{h.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            onClick={() => {
              present();
            }}
          >
            <BookOpen className="size-3.5" /> Projetar capítulo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const meta = BOOKS.find((b) => b.id === cursor.bookId);
              if (meta) toggleFavorite(`${meta.name} ${cursor.chapter}:${cursor.verse}`);
            }}
          >
            <Heart className="size-3.5" /> Favoritar versículo
          </Button>
        </>
      )}
    </div>
  );
}

function MediaList() {
  const media = useLumenStore((s) => s.media);
  const selectMedia = useLumenStore((s) => s.selectMedia);
  const addMedia = useLumenStore((s) => s.addMedia);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const preview = useLumenStore((s) => s.preview);
  const [kind, setKind] = useState<"all" | "image" | "video" | "audio">("all");

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("audio")
          ? "audio"
          : "image";
      const item = {
        id: nid(),
        type: type as "image" | "video" | "audio",
        title: file.name.replace(/\.[^.]+$/, ""),
        path: url,
        sessionOnly: true,
      };
      addMedia(item);
    });
    toast("Mídia disponível nesta sessão");
  };

  const list = media.filter((m) => kind === "all" || m.type === kind);

  return (
    <div>
      <div className="flex flex-wrap gap-1 p-2">
        {(["all", "image", "video", "audio"] as const).map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k === "all" ? "Todas" : k === "image" ? "Imagem" : k === "video" ? "Vídeo" : "Áudio"}
          </FilterChip>
        ))}
      </div>
      <div className="px-2 pb-2">
        <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-elevated text-xs text-muted hover:text-fg">
          <ImageIcon className="size-3.5" />
          Importar imagem ou vídeo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/*"
            className="hidden"
            multiple
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      <ul>
        {list.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => selectMedia(m.id)}
              onDoubleClick={() =>
                addToPlaylist({
                  type: "media",
                  refId: m.id,
                  notes: "",
                  title: m.title,
                  subtitle: m.type,
                })
              }
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-elevated",
                preview?.refId === m.id && "bg-primary/10",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
              <Badge>{m.type}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextsList() {
  const texts = useLumenStore((s) => s.texts);
  const search = useLumenStore((s) => s.search);
  const selectText = useLumenStore((s) => s.selectText);
  const saveText = useLumenStore((s) => s.saveText);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const preview = useLumenStore((s) => s.preview);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const list = texts.filter(
    (t) =>
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.body.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="p-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle("");
            setBody("");
            setOpen(true);
          }}
        >
          <Plus className="size-3.5" /> Novo aviso
        </Button>
      </div>
      {open && (
        <form
          className="space-y-2 border-b border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = nid();
            saveText({ id, title: title || "Aviso", body, updatedAt: Date.now() });
            setOpen(false);
            selectText(id);
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!pasted || !isWall(pasted)) return;
              if (body.trim() && !isWall(body)) return;
              e.preventDefault();
              const next = optimizeRawText(pasted, "text");
              setBody(next.raw);
              toast("Otimizei o bloco para o telão");
            }}
            placeholder="Texto do aviso (linha em branco = novo slide)"
            className="min-h-24 w-full rounded-md bg-elevated p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Salvar
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <ul>
        {list.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => selectText(t.id)}
              onDoubleClick={() =>
                addToPlaylist({ type: "text", refId: t.id, notes: "", title: t.title })
              }
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-elevated",
                preview?.refId === t.id && "bg-primary/10",
              )}
            >
              <Type className="mt-0.5 size-3.5 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t.title}</span>
                <span className="block line-clamp-2 text-xs text-muted">{t.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
