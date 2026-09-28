import {
  File as FileIcon,
  FileJson,
  FolderCog,
  FolderOpen,
  FolderSearch,
  Globe,
  ListPlus,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
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
import { cn } from "@/lib/cn";
import { trechoQueBate } from "@/lib/busca-trecho";
import { fold, nid } from "@/lib/fold";
import { importarMusicasJsonDoDisco } from "@/lib/import-songs-json";
import { fetchAndImportWebSong } from "@/lib/import-web-song";
import { suggestSongs } from "@/lib/lyrics-suggestions";
import type { LyricsHit } from "@/lib/lyrics-web";
import { isWall, optimizeRawText } from "@/lib/slide-optimize";
import { MediaFolderDialog } from "@/components/operator/media-folder-dialog";
import {
  comecarArraste,
  contarTrazidos,
  temArquivos,
  trazerArquivos,
  type ItemArrastado,
} from "@/components/operator/soltar-midia";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import {
  MEDIA_KINDS,
  applyMediaFolder,
  avisarMidiaMudou,
  chooseMediaFolder,
  hasMediaFolders,
  humanSize,
  listMedia,
  mandarParaALixeira,
  mediaKindLabel,
  openMediaFolder,
  useMidiaMudou,
  type EscolhaDePasta,
  type MediaKind,
  type MediaListing,
} from "@/lib/media-library";
import { searchSongs, useLumenStore } from "@/store/lumen-store";
import type { LibraryTab } from "@/lib/types";
import type { ArquivoGuardado } from "@/lib/windows-desktop";

const TABS = [
  { value: "songs", label: "Letras" },
  { value: "texts", label: "Avisos" },
  { value: "media", label: "Mídia" },
] as const satisfies readonly { value: LibraryTab; label: string }[];

type AbaDoRepertorio = (typeof TABS)[number]["value"];

/**
 * A aba que o repertório mostra.
 *
 * A Bíblia deixou de ser aba: o botão dourado abre a tela dela direto. Quem
 * saiu do app com a aba "bible" escolhida (ou a "history", que nunca teve
 * lista aqui) volta para as letras, e não para um painel vazio.
 */
function abaVisivel(tab: LibraryTab): AbaDoRepertorio {
  return tab === "texts" || tab === "media" ? tab : "songs";
}

/**
 * O + que põe o item no culto, sem tirar a mão do mouse.
 *
 * Dois cliques passaram a projetar — é o que o operador faz mais vezes e o
 * que precisa ser mais rápido. Planejar continua a um clique, só que num
 * alvo explícito em vez de um gesto escondido.
 */
function PorNoCulto({
  label,
  grupo,
  direita = "right-2",
  onClick,
}: {
  label: string;
  grupo: string;
  direita?: string;
  onClick: () => void;
}) {
  return (
    <Hint label="Pôr no culto">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle opacity-0",
          "transition-[color,opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "hover:text-fg active:scale-90 focus-visible:opacity-100",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          direita,
          grupo,
        )}
      >
        <Plus className="size-3.5" />
      </button>
    </Hint>
  );
}

/**
 * Item de lista da biblioteca: mesma altura, mesma marca de seleção, em toda aba.
 *
 * Com `arrastar`, a linha pode ser levada até a Programação do culto — o
 * mesmo que o +, para quem pensa arrastando.
 */
function LibraryRow({
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  arrastar,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  arrastar?: ItemArrastado;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable={Boolean(arrastar)}
      onDragStart={arrastar ? (e) => comecarArraste(e, arrastar) : undefined}
      title={title}
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
}: {
  onNewSong: () => void;
  onWebLyrics: () => void;
  onOpenBible: () => void;
  searchRef?: Ref<HTMLInputElement>;
}) {
  const tab = abaVisivel(useLumenStore((s) => s.libraryTab));
  const setTab = useLumenStore((s) => s.setTab);
  const search = useLumenStore((s) => s.search);
  const setSearch = useLumenStore((s) => s.setSearch);
  const [soltando, setSoltando] = useState(false);

  // Vídeo, música ou foto arrastados do Explorer para cá entram na pasta de
  // mídia, e a aba Mídia se abre no tipo do arquivo, para o operador ver onde
  // foi parar.
  const receberArquivos = async (files: File[]) => {
    setSoltando(false);
    if (files.length === 0) return;
    const r = await trazerArquivos(files, { mostrar: true });
    if (r.itens.length > 0) setTab("media");
    contarTrazidos(r, "biblioteca");
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-surface"
      data-tour="biblioteca"
      data-soltar-biblioteca
      onDragOver={(e) => {
        if (!temArquivos(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setSoltando(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setSoltando(false);
      }}
      onDrop={(e) => {
        if (!temArquivos(e.dataTransfer)) return;
        e.preventDefault();
        void receberArquivos(Array.from(e.dataTransfer.files));
      }}
    >
      {soltando && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-1 z-20 flex items-center justify-center rounded-lg bg-surface/85 shadow-[inset_0_0_0_2px_var(--color-accent)]"
        >
          <p className="flex items-center gap-2 text-body font-medium text-fg">
            <Upload className="size-4 text-accent" /> Solte para guardar na mídia
          </p>
        </div>
      )}
      <div className="panel-head justify-between">
        <h2>Repertório</h2>
        <div className="flex items-center gap-0.5">
          <Hint label="Buscar letra na internet" keys="Ctrl+Shift+F">
            <Button size="iconSm" variant="ghost" aria-label="Buscar letra na internet" onClick={onWebLyrics}>
              <Globe />
            </Button>
          </Hint>
          <Hint label="Importar músicas de um arquivo .json">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Importar músicas"
              onClick={importarMusicasJsonDoDisco}
            >
              <FileJson />
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
        <div className="flex items-center gap-0.5">
          <Segmented
            label="Tipo de conteúdo"
            full
            className="min-w-0 flex-1"
            items={TABS}
            value={tab}
            onChange={(v) => setTab(v)}
          />
          {/* A Bíblia não é aba: é o que o operador procura no meio do
              culto, quando o pregador pede um versículo na hora. Dourada
              para ser achada sem procurar, e vai direto à tela da Bíblia —
              que já tem busca, versão, livros, favoritos e o Projetar.
              Só a palavra, sem ícone: na coluna estreita o ícone empurrava
              "Letras" e "Avisos" para reticências, e o dourado já basta
              para achar. */}
          <Hint label="Abrir a Bíblia" keys="Ctrl+B">
            <button
              type="button"
              onClick={onOpenBible}
              data-abrir-biblia
              className={cn(
                "ouro inline-flex h-8 shrink-0 items-center rounded-md px-2",
                "text-secondary font-semibold whitespace-nowrap",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              )}
            >
              Bíblia
            </button>
          </Hint>
        </div>
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
      </div>

      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === "songs" && <SongsList onNewSong={onNewSong} onWebLyrics={onWebLyrics} />}
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
  const projetarDaBiblioteca = useLumenStore((s) => s.projetarDaBiblioteca);

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
            // Só vale mostrar o verso quando foi ele que trouxe a música
            // para a lista; se o nome já bate, o verso é ruído.
            const achouPeloNome =
              !search ||
              fold(song.title).includes(fold(search)) ||
              fold(song.artist).includes(fold(search));
            const trecho = achouPeloNome ? null : trechoQueBate(song.lyricsRaw, search);
            return (
              <li key={song.id} className="group/song relative">
                <LibraryRow
                  selected={selected === song.id}
                  onClick={() => selectSong(song.id)}
                  onDoubleClick={() => projetarDaBiblioteca("song", song.id)}
                  arrastar={{
                    item: {
                      type: "song",
                      refId: song.id,
                      notes: "",
                      title: song.title,
                      subtitle: song.artist,
                    },
                  }}
                  title="Um clique seleciona; dois cliques mandam para o telão"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-fg">{song.title}</p>
                    {/* Quando o que casou foi a letra, o motivo aparece: sem
                        isto a música surge na busca e o operador não sabe por
                        quê — o nome não bate, o autor não bate, e a razão está
                        escondida no meio do verso. */}
                    {trecho ? (
                      <p className="truncate text-secondary text-muted">
                        <span className="text-subtle">letra · </span>
                        {trecho}
                      </p>
                    ) : (
                      meta && <p className="truncate text-secondary text-muted">{meta}</p>
                    )}
                  </div>
                  {/* O grupo só informa quando a lista não está filtrada por ele. */}
                  {groupId === "all" && (
                    <Badge>{groups.find((g) => g.id === song.groupId)?.name}</Badge>
                  )}
                  <span className="w-7 shrink-0" aria-hidden />
                </LibraryRow>
                <PorNoCulto
                  label={`Pôr ${song.title} no culto`}
                  grupo="group-hover/song:opacity-100"
                  onClick={() => {
                    addToPlaylist({
                      type: "song",
                      refId: song.id,
                      notes: "",
                      title: song.title,
                      subtitle: song.artist,
                    });
                    toast("Adicionada ao culto");
                  }}
                />
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
      toast(`“${hit.title}” entrou no culto — confira os slides antes de projetar`);
    } else {
      toast(`“${hit.title}” entrou no repertório — confira os slides antes de projetar`);
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

/**
 * Mídia da igreja.
 *
 * Cada tipo tem a sua pasta no disco: o operador larga os arquivos ali pelo
 * Explorer e atualiza. Antes só dava para importar por sessão — fechou o app,
 * perdeu tudo. A estrela guarda o que se usa todo domingo no topo da lista.
 */
/**
 * O último "mostrar" já atendido. Módulo, não estado: a lista de mídia
 * desmonta ao trocar de aba, e um arrastar de uma hora atrás não pode
 * trocar o tipo quando ela volta a aparecer.
 */
let mostradoAte = 0;

/** A linha da lista de mídia, venha da pasta ou da sessão. */
interface LinhaDeMidia {
  id: string;
  title: string;
  path: string;
  detalhe: string;
  sessao: boolean;
  /** Nome do arquivo na pasta; sem ele, a mídia não mora no disco. */
  nome?: string;
}

function MediaList() {
  const selectMedia = useLumenStore((s) => s.selectMedia);
  const addMedia = useLumenStore((s) => s.addMedia);
  const removeMedia = useLumenStore((s) => s.removeMedia);
  const playlists = useLumenStore((s) => s.playlists);
  const activePlaylistId = useLumenStore((s) => s.activePlaylistId);
  const aviso = useMidiaMudou();
  const [menuDe, setMenuDe] = useState<(LinhaDeMidia & { x: number; y: number }) | null>(null);
  const addToPlaylist = useLumenStore((s) => s.addToPlaylist);
  const projetarDaBiblioteca = useLumenStore((s) => s.projetarDaBiblioteca);
  const preview = useLumenStore((s) => s.preview);
  const sessionMedia = useLumenStore((s) => s.media);
  const favoriteMedia = useLumenStore((s) => s.favoriteMedia);
  const toggleFavoriteMedia = useLumenStore((s) => s.toggleFavoriteMedia);
  const search = useLumenStore((s) => s.search);

  const [kind, setKind] = useState<MediaKind>("video");
  // "Arquivos" fica fora de `kind`: o que é de vídeo, áudio e imagem (pasta
  // por tipo, projetar, pôr no culto) continua igual, e esta aba é outra lista.
  const [verArquivos, setVerArquivos] = useState(false);
  const [listing, setListing] = useState<MediaListing>({ ok: true, items: [] });
  const [busy, setBusy] = useState(false);
  const [trocaPasta, setTrocaPasta] = useState<EscolhaDePasta | null>(null);
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

  // A pasta mudou (importar, arrastar, celular, Explorer): relê. Se foi a
  // cabine que trouxe o arquivo, mostra o tipo dele.
  useEffect(() => {
    if (aviso.versao === 0) return;
    if (aviso.mostrar && aviso.versao > mostradoAte) {
      mostradoAte = aviso.versao;
      if (aviso.mostrar === "arquivos") {
        setVerArquivos(true);
        return;
      }
      setVerArquivos(false);
      if (aviso.mostrar !== kind) {
        setKind(aviso.mostrar);
        return;
      }
    }
    void atualizar(kind);
    // `kind` fica de fora de propósito: trocar de tipo já relê pelo efeito
    // de cima; aqui só interessa o aviso novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso.versao]);

  const doDisco = listing.items ?? [];
  const idsDoDisco = new Set(doDisco.map((f) => f.id));
  // Tudo que está na store e não veio da pasta: material que já vinha no app,
  // importado por sessão ou herdado de versões anteriores.
  const daStore = sessionMedia.filter((m) => m.type === kind && !idsDoDisco.has(m.id));
  const q = search.trim().toLowerCase();

  // Favoritas primeiro: é o material que volta toda semana.
  const lista: LinhaDeMidia[] = [
    ...doDisco.map((f) => ({
      id: f.id,
      title: f.title,
      path: f.url,
      detalhe: humanSize(f.size),
      sessao: false,
      nome: f.name,
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

  // No app do Windows, "Importar" copia para a pasta: antes criava um
  // endereço de sessão, que sumia ao fechar o app e o celular não via.
  const importar = async (files: File[]) => {
    if (files.length === 0) return;
    contarTrazidos(await trazerArquivos(files, { mostrar: true }), "biblioteca");
  };

  const porNoCulto = (m: LinhaDeMidia) => {
    garantirNaStoreDaLista(m);
    addToPlaylist({
      type: "media",
      refId: m.id,
      notes: "",
      title: m.title,
      subtitle: mediaKindLabel(kind),
    });
  };

  // Mídia de disco só existe na store depois de tocada uma vez; sem isto,
  // selecionar ou projetar acharia um id que não existe.
  const garantirNaStoreDaLista = (m: LinhaDeMidia) => {
    if (!sessionMedia.some((x) => x.id === m.id)) {
      addMedia({ id: m.id, type: kind, title: m.title, path: m.path });
    }
  };

  /**
   * Excluir pelo botão direito.
   *
   * Arquivo da pasta vai para a Lixeira do Windows — de lá volta, se foi
   * engano. Mídia só da sessão sai da lista. Se estiver no culto de hoje, o
   * aviso diz: a programação não muda sozinha, mas o operador precisa saber
   * que aquele item ficou sem arquivo.
   */
  const excluir = async (m: LinhaDeMidia) => {
    const noCulto = (playlists.find((p) => p.id === activePlaylistId)?.items ?? []).some(
      (it) => it.refId === m.id,
    );
    if (m.nome) {
      const r = await mandarParaALixeira(kind, m.nome);
      if (!r.ok) {
        toast.error(r.error || "Não consegui excluir.");
        return;
      }
    } else if (m.path.startsWith("blob:")) {
      URL.revokeObjectURL(m.path);
    }
    removeMedia(m.id);
    avisarMidiaMudou();
    void atualizar(kind);
    const onde = m.nome ? "foi para a Lixeira" : "saiu da lista";
    toast(
      noCulto
        ? `“${m.title}” ${onde}. Ainda está na programação do culto — tire de lá se não for usar.`
        : `“${m.title}” ${onde}.`,
      { duration: noCulto ? 9000 : 4000 },
    );
  };

  return (
    <div className="animate-swap-in">
      <MediaFolderDialog
        kind={kind}
        escolha={trocaPasta}
        onClose={() => setTrocaPasta(null)}
        onDone={() => void atualizar(kind)}
      />
      <div className="space-y-2 px-2 py-2">
        <Segmented
          label="Tipo de mídia"
          full
          value={verArquivos ? "arquivos" : kind}
          onChange={(v) => {
            if (v === "arquivos") {
              setVerArquivos(true);
              return;
            }
            setVerArquivos(false);
            setKind(v);
          }}
          items={[
            ...MEDIA_KINDS.map((k) => ({ value: k.value as MediaKind | "arquivos", label: k.label })),
            { value: "arquivos" as const, label: "Arquivos" },
          ]}
        />

        {!verArquivos && (
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
                  const escolha = await chooseMediaFolder(kind);
                  if (escolha.canceled || escolha.mesmaPasta) return;
                  if (!escolha.ok || !escolha.dir) {
                    toast.error(escolha.error || "Não consegui usar essa pasta.");
                    return;
                  }
                  // Sem nada na pasta antiga não há o que perguntar: troca direto.
                  if (!escolha.pendentes) {
                    const r = await applyMediaFolder(kind, escolha.dir, false);
                    if (!r.ok) {
                      toast.error(r.error || "Não consegui trocar a pasta.");
                      return;
                    }
                    if (r.aviso) toast.error(r.aviso, { duration: 10000 });
                    else toast(`Pasta de ${mediaKindLabel(kind).toLowerCase()}: ${r.dir}`);
                    void atualizar(kind);
                    return;
                  }
                  setTrocaPasta(escolha);
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
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  // Limpa para escolher o mesmo arquivo de novo disparar outra vez.
                  e.target.value = "";
                  void importar(files);
                }}
              />
            </label>
          </div>

        )}

        {!verArquivos && listing.dir && (
          <p className="truncate text-caption text-subtle" title={listing.dir}>
            {listing.dir}
          </p>
        )}
      </div>

      {verArquivos ? (
        <ArquivosGuardados versao={aviso.versao} />
      ) : (
        <>
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
                        garantirNaStoreDaLista(m);
                        selectMedia(m.id);
                      }}
                      onDoubleClick={() => {
                        garantirNaStoreDaLista(m);
                        projetarDaBiblioteca("media", m.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenuDe({ ...m, x: e.clientX, y: e.clientY });
                      }}
                      arrastar={{
                        item: {
                          type: "media",
                          refId: m.id,
                          notes: "",
                          title: m.title,
                          subtitle: mediaKindLabel(kind),
                        },
                        midia: { id: m.id, kind, title: m.title, path: m.path },
                      }}
                      title="Um clique seleciona; dois cliques mandam para o telão; botão direito para mais"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-fg">{m.title}</span>
                        {m.detalhe && (
                          <span className="block truncate text-caption text-subtle">{m.detalhe}</span>
                        )}
                      </span>
                      <span className="w-14 shrink-0" aria-hidden />
                    </LibraryRow>
                    <PorNoCulto
                      label={`Pôr ${m.title} no culto`}
                      grupo="group-hover/midia:opacity-100"
                      direita="right-9"
                      onClick={() => porNoCulto(m)}
                    />
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
        </>
      )}

      {/* Botão direito numa mídia: o mesmo menu das letras, no ponto do clique. */}
      <Menu open={Boolean(menuDe)} onOpenChange={(v) => !v && setMenuDe(null)}>
        <MenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed size-0"
            style={{ left: menuDe?.x ?? 0, top: menuDe?.y ?? 0 }}
          />
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            onSelect={() => {
              if (menuDe) {
                garantirNaStoreDaLista(menuDe);
                projetarDaBiblioteca("media", menuDe.id);
              }
              setMenuDe(null);
            }}
          >
            <span className="flex items-center gap-2">
              <Play className="size-3.5 shrink-0" aria-hidden /> Projetar
            </span>
          </MenuItem>
          <MenuItem
            onSelect={() => {
              if (menuDe) {
                porNoCulto(menuDe);
                toast(`“${menuDe.title}” entrou no culto`);
              }
              setMenuDe(null);
            }}
          >
            <span className="flex items-center gap-2">
              <ListPlus className="size-3.5 shrink-0" aria-hidden /> Pôr no culto
            </span>
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            tone="danger"
            onSelect={() => {
              const alvo = menuDe;
              setMenuDe(null);
              if (alvo) void excluir(alvo);
            }}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              {menuDe?.nome ? "Excluir (vai para a Lixeira)" : "Tirar da lista"}
            </span>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/**
 * Mídia › Arquivos: o que a igreja trouxe e o Lúmen não projeta — uma
 * planilha, um documento, o que for. A igreja pediu para aceitar qualquer
 * arquivo, mesmo que não rode: ele fica guardado, e daqui dá para achá-lo no
 * Explorer ou mandá-lo para a Lixeira. O Lúmen nunca o abre nem o executa —
 * arquivo qualquer aberto pelo app poderia ser um programa.
 */
function ArquivosGuardados({ versao }: { versao: number }) {
  const search = useLumenStore((s) => s.search);
  const [lista, setLista] = useState<{ ok: boolean; dir?: string; itens: ArquivoGuardado[]; error?: string }>({
    ok: true,
    itens: [],
  });
  const [busy, setBusy] = useState(false);
  const temPasta = typeof window !== "undefined" && Boolean(window.lumenDesktop?.arquivosListar);

  const atualizar = useCallback(async () => {
    const listar = window.lumenDesktop?.arquivosListar;
    if (!listar) return;
    setBusy(true);
    setLista(await listar());
    setBusy(false);
  }, []);

  useEffect(() => {
    void atualizar();
  }, [atualizar, versao]);

  const q = search.trim().toLowerCase();
  const itens = lista.itens.filter((i) => !q || i.nome.toLowerCase().includes(q));

  const importar = async (files: File[]) => {
    if (files.length === 0) return;
    contarTrazidos(await trazerArquivos(files, { mostrar: true }), "biblioteca");
  };

  const mostrar = async (nome: string) => {
    const r = await window.lumenDesktop?.arquivosMostrar?.(nome);
    if (r && !r.ok) toast.error(r.error || "Não consegui mostrar o arquivo.");
  };

  const excluir = async (nome: string) => {
    const r = await window.lumenDesktop?.arquivosExcluir?.(nome);
    if (!r?.ok) {
      toast.error(r?.error || "Não consegui excluir.");
      return;
    }
    toast(`“${nome}” foi para a Lixeira.`);
    void atualizar();
  };

  return (
    <div data-arquivos-guardados>
      <div className="flex items-center gap-0.5 px-2 pb-2">
        <Hint label="Abrir a pasta de arquivos no Explorer">
          <Button
            size="iconSm"
            variant="ghost"
            aria-label="Abrir a pasta de arquivos no Explorer"
            disabled={!temPasta}
            onClick={async () => {
              const r = await window.lumenDesktop?.arquivosAbrirPasta?.();
              if (r && !r.ok) toast.error(r.error || "Não consegui abrir a pasta.");
            }}
          >
            <FolderOpen />
          </Button>
        </Hint>
        <Hint label="Reler a pasta">
          <Button
            size="iconSm"
            variant="ghost"
            aria-label="Atualizar lista de arquivos"
            disabled={!temPasta}
            loading={busy}
            onClick={() => void atualizar()}
          >
            {!busy && <RefreshCw />}
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
            aria-label="Importar qualquer arquivo"
            className="sr-only"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void importar(files);
            }}
          />
        </label>
      </div>

      {lista.dir && (
        <p className="truncate px-2 pb-2 text-caption text-subtle" title={lista.dir}>
          {lista.dir}
        </p>
      )}
      {lista.error && (
        <p className="px-3 pb-2 text-secondary text-danger" role="alert">
          {lista.error}
        </p>
      )}

      {!temPasta ? (
        <Empty title="Guardar arquivos é do app do Windows." hint="No navegador não há pasta onde guardar." />
      ) : itens.length === 0 ? (
        <Empty
          title={q ? `Nenhum arquivo com “${search}”.` : "Nenhum arquivo guardado."}
          hint="Solte aqui qualquer arquivo — planilha, documento, o que for. O Lúmen guarda; projeta só vídeo, áudio, imagem e apresentação."
        />
      ) : (
        <ul>
          {itens.map((a) => (
            <li key={a.nome} data-arquivo-guardado className="flex items-center gap-2 px-3 py-1.5">
              <FileIcon className="size-4 shrink-0 text-subtle" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-fg">{a.nome}</span>
                <span className="block truncate text-caption text-subtle">
                  {humanSize(a.bytes)} · guardado, não projeta
                </span>
              </span>
              <Hint label="Mostrar no Explorer">
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`Mostrar ${a.nome} no Explorer`}
                  onClick={() => void mostrar(a.nome)}
                >
                  <FolderSearch />
                </Button>
              </Hint>
              <Hint label="Excluir (vai para a Lixeira)">
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`Excluir ${a.nome}`}
                  onClick={() => void excluir(a.nome)}
                >
                  <Trash2 />
                </Button>
              </Hint>
            </li>
          ))}
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
  const projetarDaBiblioteca = useLumenStore((s) => s.projetarDaBiblioteca);
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
            <li key={t.id} className="group/aviso relative">
              <LibraryRow
                selected={preview?.refId === t.id}
                onClick={() => selectText(t.id)}
                onDoubleClick={() => projetarDaBiblioteca("text", t.id)}
                arrastar={{ item: { type: "text", refId: t.id, notes: "", title: t.title } }}
                title="Um clique seleciona; dois cliques mandam para o telão"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-fg">{t.title}</span>
                  <span className="line-clamp-2 block text-secondary text-muted">{t.body}</span>
                </span>
                <span className="w-7 shrink-0" aria-hidden />
              </LibraryRow>
              <PorNoCulto
                label={`Pôr ${t.title} no culto`}
                grupo="group-hover/aviso:opacity-100"
                onClick={() =>
                  addToPlaylist({ type: "text", refId: t.id, notes: "", title: t.title })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
