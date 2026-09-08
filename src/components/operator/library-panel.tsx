import {
  BookOpen,
  FolderCog,
  FolderOpen,
  Globe,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type Ref } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Hint } from "@/components/ui/tooltip";
import { BOOKS } from "@/lib/bible-books";
import {
  chapterCount,
  hydrateExtraVersions,
  loadBuiltinBible,
  searchVerses,
} from "@/lib/bible";
import { cn } from "@/lib/cn";
import { fold, nid } from "@/lib/fold";
import { fetchAndImportWebSong } from "@/lib/import-web-song";
import { suggestSongs } from "@/lib/lyrics-suggestions";
import type { LyricsHit } from "@/lib/lyrics-web";
import { isWall, optimizeRawText } from "@/lib/slide-optimize";
import {
  MEDIA_KINDS,
  chooseMediaFolder,
  hasMediaFolders,
  humanSize,
  listMedia,
  mediaKindLabel,
  openMediaFolder,
  type MediaKind,
  type MediaListing,
} from "@/lib/media-library";
import { searchSongs, useLumenStore } from "@/store/lumen-store";
import type { LibraryTab } from "@/lib/types";

const TABS = [
  { value: "songs", label: "Letras" },
  { value: "texts", label: "Avisos" },
  { value: "media", label: "Mídia" },
  { value: "bible", label: "Bíblia" },
] as const satisfies readonly { value: LibraryTab; label: string }[];

/** Item de lista da biblioteca: mesma altura, mesma marca de seleção, em toda aba. */
function LibraryRow({
  selected,
  onClick,
  onDoubleClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-on={selected}
      className={cn(
        "relative flex w-full items-start gap-2 px-3 py-1.5 text-left",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "hover:bg-elevated/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        selected && "bg-elevated",
      )}
    >
      {selected && (
        <span aria-hidden className="animate-swap-in absolute inset-y-0 left-0 w-0.5 bg-fg" />
      )}
      {children}
    </button>
  );
}

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
    <div className="flex h-full min-h-0 flex-col bg-surface" data-tour="biblioteca">
      <div className="panel-head justify-between">
        <h2>Repertório</h2>
        <div className="flex items-center gap-0.5">
          <Hint label="Buscar letra na internet" keys="Ctrl+Shift+F">
            <Button size="iconSm" variant="ghost" aria-label="Buscar letra na internet" onClick={onWebLyrics}>
              <Globe />
            </Button>
          </Hint>
          <Hint label="Nova letra">
            <Button size="iconSm" variant="ghost" aria-label="Nova letra" onClick={onNewSong}>
              <Plus />
            </Button>
          </Hint>
        </div>
      </div>

      <div className="space-y-2 border-b border-border p-2">
        <Segmented
          label="Tipo de conteúdo"
          full
          items={TABS}
          value={tab}
          onChange={(v) => setTab(v)}
        />
        {tab !== "bible" && (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle"
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar no repertório"
              className="pl-8"
              aria-label="Buscar no repertório"
            />
          </div>
        )}
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === "songs" && <SongsList onNewSong={onNewSong} onWebLyrics={onWebLyrics} />}
        {tab === "bible" && <BibleList bibleRef={bibleRef} onOpenBible={onOpenBible} />}
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

  const [sugestoes, setSugestoes] = useState(0);

  const list = useMemo(() => searchSongs(songs, search, groupId), [songs, search, groupId]);
  const lastPlayed = (id: string) => logs.find((l) => l.refId === id)?.playedAt;

  return (
    <div className="animate-swap-in">
      <div className="flex flex-wrap gap-1 px-2 py-2">
        <FilterChip active={groupId === "all"} onClick={() => setGroup("all")}>
          Todas
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g.id} active={groupId === g.id} onClick={() => setGroup(g.id)}>
            {g.name}
          </FilterChip>
        ))}
      </div>

      <WebSuggestions onCount={setSugestoes} />

      {list.length === 0 ? (
        <Empty
          title={search ? `Nada encontrado para “${search}”.` : "O repertório está vazio."}
          hint={
            sugestoes > 0
              ? "O que está em ouro acima veio da internet e ainda não é seu."
              : "Busque a letra na internet ou escreva uma nova."
          }
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={onWebLyrics}>
                <Globe /> Buscar na internet
              </Button>
              <Button size="sm" variant="ghost" onClick={onNewSong}>
                <Plus /> Nova letra
              </Button>
            </div>
          }
        />
      ) : (
        <ul>
          {list.map((song) => {
            const last = lastPlayed(song.id);
            const meta = [
              song.artist,
              song.key || null,
              last ? new Date(last).toLocaleDateString("pt-BR") : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={song.id}>
                <LibraryRow
                  selected={selected === song.id}
                  onClick={() => selectSong(song.id)}
                  onDoubleClick={() => {
                    addToPlaylist({
                      type: "song",
                      refId: song.id,
                      notes: "",
                      title: song.title,
                      subtitle: song.artist,
                    });
                    toast("Adicionada ao culto");
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-fg">{song.title}</p>
                    {meta && <p className="truncate text-secondary text-muted">{meta}</p>}
                  </div>
                  {/* O grupo só informa quando a lista não está filtrada por ele. */}
                  {groupId === "all" && (
                    <Badge>{groups.find((g) => g.id === song.groupId)?.name}</Badge>
                  )}
                </LibraryRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A mesma música, escrita de dois jeitos, é a mesma música. */
function jaTem(songs: { title: string; artist: string }[], hit: LyricsHit) {
  const t = fold(hit.title || "");
  const a = fold(hit.artist || "");
  return songs.some((s) => {
    if (fold(s.title) !== t) return false;
    const sa = fold(s.artist);
    return !sa || !a || sa === a;
  });
}

/**
 * Sugestões da internet dentro da busca do repertório.
 *
 * O operador digita o nome do louvor sem saber se ele já está no repertório;
 * quando não está, o Letras e o Vagalume respondem aqui mesmo, em ouro velho,
 * acima do que já é seu — a cor separa o que você tem do que é oferta.
 *
 * Some sozinho: assim que a música entra no repertório ela deixa de ser
 * sugestão e passa a ser um item da lista de baixo, no lugar de sempre.
 */
function WebSuggestions({ onCount }: { onCount: (n: number) => void }) {
  const search = useLumenStore((s) => s.search);
  const songs = useLumenStore((s) => s.songs);
  const selectSong = useLumenStore((s) => s.selectSong);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const [hits, setHits] = useState<LyricsHit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [dispensadas, setDispensadas] = useState<string[]>([]);

  const termo = search.trim();

  // Menos de três letras é ruído: quase tudo casa e a lista pisca a cada
  // tecla. A pausa de meio segundo é a diferença entre digitar e procurar.
  useEffect(() => {
    if (termo.length < 3) {
      setHits([]);
      setBuscando(false);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const timer = window.setTimeout(async () => {
      try {
        const r = await suggestSongs(termo, "");
        if (vivo) setHits(r.ok ? r.hits : []);
      } catch {
        if (vivo) setHits([]);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 500);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [termo]);

  const novas = useMemo(
    () =>
      hits
        .filter((h) => !dispensadas.includes(h.sourceUrl))
        .filter((h) => !jaTem(songs, h))
        .slice(0, 4),
    [hits, songs, dispensadas],
  );

  useEffect(() => onCount(novas.length), [novas.length, onCount]);

  const adicionar = async (hit: LyricsHit, paraOCulto: boolean) => {
    setOcupado(`${hit.sourceUrl}|${paraOCulto}`);
    const r = await fetchAndImportWebSong(hit);
    setOcupado(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setDispensadas((v) => [...v, hit.sourceUrl]);
    selectSong(r.id);
    if (paraOCulto) {
      addToPlaylist({
        type: "song",
        refId: r.id,
        notes: "",
        title: hit.title,
        subtitle: hit.artist,
      });
      toast(`“${hit.title}” entrou no culto — confira os slides no preview`);
    } else {
      toast(`“${hit.title}” entrou no repertório — confira os slides no preview`);
    }
  };

  if (termo.length < 3 || (!buscando && novas.length === 0)) return null;

  return (
    <div className="animate-swap-in border-y border-web/25 bg-web/[0.06]">
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
        <Globe className="size-3 shrink-0 text-web" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-caption font-medium text-web">
          Da internet · Letras e Vagalume
        </p>
        {buscando && <Loader2 className="size-3 shrink-0 animate-spin text-web" aria-hidden />}
      </div>

      {novas.length === 0 ? (
        <p className="px-3 pb-2 text-secondary text-subtle">Procurando…</p>
      ) : (
        <ul className="pb-1.5">
          {novas.map((hit) => (
            <li key={hit.sourceUrl || hit.title} className="px-3 py-1">
              <p className="truncate text-body font-medium text-web">{hit.title}</p>
              <p className="truncate text-secondary text-subtle">
                {[hit.artist, hit.sourceName].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Hint label="Guarda a letra no seu repertório">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!ocupado}
                    loading={ocupado === `${hit.sourceUrl}|false`}
                    onClick={() => void adicionar(hit, false)}
                  >
                    <Plus /> Repertório
                  </Button>
                </Hint>
                <Hint label="Guarda e já põe na ordem do culto de hoje">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!ocupado}
                    loading={ocupado === `${hit.sourceUrl}|true`}
                    onClick={() => void adicionar(hit, true)}
                  >
                    <ListPlus /> Culto
                  </Button>
                </Hint>
              </div>
            </li>
          ))}
        </ul>
      )}
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
      aria-pressed={active}
      className={cn(
        "rounded-md px-2 py-1 text-caption font-medium",
        "transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        active ? "bg-raised text-fg" : "text-muted hover:bg-elevated hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function BibleList({
  bibleRef,
  onOpenBible,
}: {
  bibleRef?: Ref<HTMLInputElement>;
  onOpenBible: () => void;
}) {
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
  const [badRef, setBadRef] = useState(false);

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
    <div className="animate-swap-in flex flex-col gap-2 p-2">
      <Input
        ref={bibleRef}
        placeholder="jo 3 16 — ou um trecho"
        value={query}
        invalid={badRef}
        onChange={(e) => {
          setQuery(e.target.value);
          if (badRef) setBadRef(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const ok = jumpRef(query, true);
          if (ok) return;
          const hit = hits[0];
          if (hit) {
            go(hit.bookId, hit.chapter, hit.verse, true);
            return;
          }
          setBadRef(true);
        }}
        aria-label="Referência bíblica"
      />
      {badRef && (
        <p className="animate-swap-in text-caption text-danger">
          Não achei essa referência. Tente “jo 3 16” ou um trecho do versículo.
        </p>
      )}

      <Button size="sm" variant="secondary" onClick={onOpenBible}>
        <BookOpen /> Abrir mosaico da Bíblia
      </Button>

      {!ready && !err && (
        <div className="space-y-2 py-2" aria-live="polite">
          <div className="sweep-bar h-0.5 w-full rounded-sm" />
          <p className="text-secondary text-muted">Carregando Almeida 1819…</p>
        </div>
      )}
      {err && <p className="py-2 text-secondary text-danger">{err}</p>}

      {ready && (
        <>
          <select
            className="field w-full"
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

          <div className="flex gap-2">
            <select
              className="field min-w-0 flex-1"
              value={cursor.bookId}
              onChange={(e) => go(Number(e.target.value), 1, 1)}
              aria-label="Livro"
            >
              {BOOKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="field tnum w-20"
              value={cursor.chapter}
              onChange={(e) => go(cursor.bookId, Number(e.target.value), 1)}
              aria-label="Capítulo"
            >
              {Array.from({ length: chapters }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={present}>
              Projetar capítulo
            </Button>
            <Hint label="Guardar este versículo nos favoritos">
              <Button
                size="iconSm"
                variant="ghost"
                aria-label="Favoritar versículo"
                onClick={() => {
                  const meta = BOOKS.find((b) => b.id === cursor.bookId);
                  if (meta) toggleFavorite(`${meta.name} ${cursor.chapter}:${cursor.verse}`);
                }}
              >
                <Star />
              </Button>
            </Hint>
          </div>

          {favorites.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {favorites.map((f) => (
                <FilterChip key={f} active={false} onClick={() => jumpRef(f, true)}>
                  {f}
                </FilterChip>
              ))}
            </div>
          )}

          {hits.length > 0 && (
            <ul className="animate-swap-in overflow-hidden rounded-md shadow-[var(--shadow-border)]">
              {hits.map((h) => (
                <li key={h.ref + h.text.slice(0, 12)} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    className={cn(
                      "w-full px-2 py-1.5 text-left",
                      "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                      "hover:bg-elevated focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    )}
                    onClick={() => go(h.bookId, h.chapter, h.verse, true)}
                  >
                    <p className="text-caption font-medium text-fg">{h.ref}</p>
                    <p className="line-clamp-2 text-secondary text-muted">{h.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Mídia da igreja.
 *
 * Cada tipo tem a sua pasta no disco: o operador larga os arquivos ali pelo
 * Explorer e atualiza. Antes só dava para importar por sessão — fechou o app,
 * perdeu tudo. A estrela guarda o que se usa todo domingo no topo da lista.
 */
function MediaList() {
  const selectMedia = useLumenStore((s) => s.selectMedia);
  const addMedia = useLumenStore((s) => s.addMedia);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const preview = useLumenStore((s) => s.preview);
  const sessionMedia = useLumenStore((s) => s.media);
  const favoriteMedia = useLumenStore((s) => s.favoriteMedia);
  const toggleFavoriteMedia = useLumenStore((s) => s.toggleFavoriteMedia);
  const search = useLumenStore((s) => s.search);

  const [kind, setKind] = useState<MediaKind>("video");
  const [listing, setListing] = useState<MediaListing>({ ok: true, items: [] });
  const [busy, setBusy] = useState(false);
  const naPasta = hasMediaFolders();

  const atualizar = useCallback(
    async (alvo: MediaKind) => {
      if (!naPasta) return;
      setBusy(true);
      setListing(await listMedia(alvo));
      setBusy(false);
    },
    [naPasta],
  );

  useEffect(() => {
    void atualizar(kind);
  }, [kind, atualizar]);

  const doDisco = listing.items ?? [];
  const idsDoDisco = new Set(doDisco.map((f) => f.id));
  // Tudo que está na store e não veio da pasta: material que já vinha no app,
  // importado por sessão ou herdado de versões anteriores.
  const daStore = sessionMedia.filter((m) => m.type === kind && !idsDoDisco.has(m.id));
  const q = search.trim().toLowerCase();

  // Favoritas primeiro: é o material que volta toda semana.
  const lista = [
    ...doDisco.map((f) => ({
      id: f.id,
      title: f.title,
      path: f.url,
      detalhe: humanSize(f.size),
      sessao: false,
    })),
    ...daStore.map((m) => ({
      id: m.id,
      title: m.title,
      path: m.path,
      detalhe: m.sessionOnly ? "só nesta sessão" : "",
      sessao: Boolean(m.sessionOnly),
    })),
  ]
    .filter((m) => !q || m.title.toLowerCase().includes(q))
    .sort((a, b) => {
      const fa = favoriteMedia.includes(a.id) ? 0 : 1;
      const fb = favoriteMedia.includes(b.id) ? 0 : 1;
      return fa - fb || a.title.localeCompare(b.title, "pt-BR");
    });

  const importar = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      addMedia({
        id: nid(),
        type: kind,
        title: file.name.replace(/\.[^.]+$/, ""),
        path: URL.createObjectURL(file),
        sessionOnly: true,
      });
    });
    toast("Mídia disponível nesta sessão");
  };

  return (
    <div className="animate-swap-in">
      <div className="space-y-2 px-2 py-2">
        <Segmented
          label="Tipo de mídia"
          full
          value={kind}
          onChange={(v) => setKind(v)}
          items={MEDIA_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />

        <div className="flex items-center gap-0.5">
          <Hint label={`Abrir a pasta de ${mediaKindLabel(kind).toLowerCase()} no Explorer`}>
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Abrir pasta no Explorer"
              disabled={!naPasta}
              onClick={async () => {
                const dir = await openMediaFolder(kind);
                if (!dir) toast.error("Não consegui abrir a pasta.");
              }}
            >
              <FolderOpen />
            </Button>
          </Hint>
          <Hint label="Reler a pasta">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Atualizar lista"
              disabled={!naPasta}
              loading={busy}
              onClick={() => void atualizar(kind)}
            >
              {!busy && <RefreshCw />}
            </Button>
          </Hint>
          <Hint label="Usar outra pasta para este tipo">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Escolher outra pasta"
              disabled={!naPasta}
              onClick={async () => {
                const dir = await chooseMediaFolder(kind);
                if (dir) {
                  toast(`Pasta de ${mediaKindLabel(kind).toLowerCase()}: ${dir}`);
                  void atualizar(kind);
                }
              }}
            >
              <FolderCog />
            </Button>
          </Hint>

          <label
            className={cn(
              "ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5",
              "text-caption font-medium text-muted",
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "hover:bg-elevated hover:text-fg focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
            )}
          >
            <Upload className="size-3.5" aria-hidden />
            Importar
            <input
              type="file"
              accept={
                kind === "video"
                  ? "video/mp4,video/webm"
                  : kind === "audio"
                    ? "audio/*"
                    : "image/jpeg,image/png,image/webp"
              }
              className="sr-only"
              multiple
              onChange={(e) => importar(e.target.files)}
            />
          </label>
        </div>

        {listing.dir && (
          <p className="truncate text-caption text-subtle" title={listing.dir}>
            {listing.dir}
          </p>
        )}
      </div>

      {listing.error && (
        <p className="px-3 pb-2 text-secondary text-danger" role="alert">
          {listing.error}
        </p>
      )}

      {lista.length === 0 ? (
        <Empty
          title={
            q
              ? `Nenhuma mídia com “${search}”.`
              : `Nenhum arquivo de ${mediaKindLabel(kind).toLowerCase()} na pasta.`
          }
          hint={
            naPasta
              ? "Copie os arquivos para a pasta pelo Explorer e toque em atualizar."
              : "No navegador a mídia vale só até fechar o Lúmen."
          }
          action={
            naPasta ? (
              <Button size="sm" variant="secondary" onClick={() => void openMediaFolder(kind)}>
                <FolderOpen /> Abrir a pasta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul>
          {lista.map((m) => {
            const favorita = favoriteMedia.includes(m.id);
            return (
              <li key={m.id} className="group/midia relative">
                <LibraryRow
                  selected={preview?.refId === m.id}
                  onClick={() => {
                    // O item de disco precisa existir na store para o preview
                    // encontrá-lo pelo id.
                    if (!sessionMedia.some((x) => x.id === m.id)) {
                      addMedia({ id: m.id, type: kind, title: m.title, path: m.path });
                    }
                    selectMedia(m.id);
                  }}
                  onDoubleClick={() =>
                    addToPlaylist({
                      type: "media",
                      refId: m.id,
                      notes: "",
                      title: m.title,
                      subtitle: mediaKindLabel(kind),
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-fg">{m.title}</span>
                    {m.detalhe && (
                      <span className="block truncate text-caption text-subtle">{m.detalhe}</span>
                    )}
                  </span>
                  <span className="w-7 shrink-0" aria-hidden />
                </LibraryRow>
                <button
                  type="button"
                  aria-label={favorita ? `Tirar ${m.title} dos favoritos` : `Favoritar ${m.title}`}
                  aria-pressed={favorita}
                  onClick={() => toggleFavoriteMedia(m.id)}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1",
                    "transition-[color,opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                    "active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    favorita
                      ? "text-live opacity-100"
                      : "text-subtle opacity-0 hover:text-fg group-hover/midia:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Star className={cn("size-3.5", favorita && "fill-current")} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
    <div className="animate-swap-in">
      <div className="px-2 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle("");
            setBody("");
            setOpen(true);
          }}
        >
          <Plus /> Novo aviso
        </Button>
      </div>

      {open && (
        <form
          className="animate-swap-in space-y-2 border-y border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = nid();
            saveText({ id, title: title || "Aviso", body, updatedAt: Date.now() });
            setOpen(false);
            selectText(id);
          }}
        >
          <Input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do aviso"
            aria-label="Título do aviso"
          />
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
            placeholder="Linha em branco começa um slide novo"
            aria-label="Texto do aviso"
            className="field min-h-24 w-full resize-y py-2"
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Salvar aviso
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {list.length === 0 && !open ? (
        <Empty
          title={search ? "Nenhum aviso com esse texto." : "Ainda não há avisos."}
          hint="Avisos são textos curtos para projetar entre um louvor e outro."
        />
      ) : (
        <ul>
          {list.map((t) => (
            <li key={t.id}>
              <LibraryRow
                selected={preview?.refId === t.id}
                onClick={() => selectText(t.id)}
                onDoubleClick={() =>
                  addToPlaylist({ type: "text", refId: t.id, notes: "", title: t.title })
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-fg">{t.title}</span>
                  <span className="line-clamp-2 block text-secondary text-muted">{t.body}</span>
                </span>
              </LibraryRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
