import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import {
  chapterCount,
  chapterSlides,
  chapterVerseCount,
  parseBibleRef,
} from "@/lib/bible";
import { bookById } from "@/lib/bible-books";
import { fold, nid } from "@/lib/fold";
import { parseLyrics } from "@/lib/lyrics";
import { publishLiveFrame } from "@/lib/live-channel";
import type { OptimizeResult } from "@/lib/slide-optimize";
import {
  SEED_GROUPS,
  SEED_MEDIA,
  SEED_PLAYLISTS,
  SEED_SERVICES,
  SEED_SONGS,
  SEED_TEXTS,
  SEED_THEMES_ALL,
} from "@/lib/seed";
import { captureSession, type SessionSlice } from "@/lib/session-snap";
import { formatRef } from "@/lib/bible-ref";
import type {
  AlertState,
  CountdownState,
  CultoSnapshot,
  Deck,
  FreeText,
  LibraryTab,
  LiveFrame,
  MediaItem,
  OutputStatus,
  Playlist,
  PlaylistItem,
  ProjectionLog,
  Service,
  Settings,
  Slide,
  Song,
  SongGroup,
  Theme,
} from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  churchName: "Igreja Local",
  logoUrl: "",
  maxLines: 5,
  transition: "fade",
  fadeMs: 220,
  chordsOnStage: true,
  chordsOnAudience: false,
  fitMode: "contain",
  margins: { t: 8, r: 8, b: 8, l: 8 },
  openStageWindow: false,
  showWallpaper: true,
  showClock: false,
  baseFill: "dark",
  clockPosition: "top-right",
  emergencyVerse: "João 14:6",
  emergencySongId: "song-castelo",
  operatorName: "Operador",
  secondMonitor: true,
  wakeLock: true,
  startFullscreen: true,
};

function themeById(themes: Theme[], id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}

function songToDeck(song: Song): Deck {
  return {
    kind: "song",
    refId: song.id,
    title: song.title,
    subtitle: song.artist,
    key: song.key,
    copyright: song.copyright,
    slides: song.slides,
  };
}

function textToDeck(text: FreeText): Deck {
  const slides = parseLyrics(text.body, 5).map((sl) => ({
    ...sl,
    label: sl.label === "Verso 1" || sl.label === "Verso" ? "Aviso" : sl.label,
  }));
  return {
    kind: "text",
    refId: text.id,
    title: text.title,
    subtitle: "",
    slides: slides.length
      ? slides
      : [{ id: nid(), label: "Aviso", text: text.body, sortOrder: 0 }],
  };
}

export interface LumenState {
  songs: Song[];
  groups: SongGroup[];
  themes: Theme[];
  playlists: Playlist[];
  services: Service[];
  media: MediaItem[];
  texts: FreeText[];
  logs: ProjectionLog[];
  favorites: string[];
  /** Mídias marcadas com estrela, por id de arquivo. Separado dos favoritos
   *  da Bíblia: um guarda referência, o outro guarda arquivo. */
  favoriteMedia: string[];
  settings: Settings;
  extraVersionIds: { id: string; name: string }[];

  libraryTab: LibraryTab;
  search: string;
  bibleQuery: string;
  selectedSongId: string | null;
  selectedGroupId: string | "all";
  preview: Deck | null;
  previewIndex: number;
  live: Deck | null;
  liveIndex: number;
  status: OutputStatus;
  fillMode: "console" | "audience" | "stage";
  songThemeId: string;
  bibleThemeId: string;
  stageThemeId: string;
  activePlaylistId: string;
  bibleVersionId: string;
  bibleCursor: { bookId: number; chapter: number; verse: number };
  alert: AlertState | null;
  countdown: CountdownState | null;
  hydrated: boolean;
  editingSlide: boolean;

  ensureSeed: () => void;
  setHydrated: () => void;
  setTab: (tab: LibraryTab) => void;
  setSearch: (q: string) => void;
  setBibleQuery: (q: string) => void;
  selectSong: (id: string) => void;
  setGroup: (id: string | "all") => void;
  setPreviewIndex: (i: number) => void;
  presentPreview: () => void;
  stop: () => void;
  goBlack: () => void;
  goLogo: () => void;
  goClear: () => void;
  next: () => void;
  prev: () => void;
  goLiveIndex: (i: number) => void;
  presentPlaylistItem: (index: number) => void;
  previewPlaylistItem: (index: number) => void;
  nextPlaylistItem: () => void;
  setThemeForKind: (kind: "songs" | "bible" | "stage", themeId: string) => void;
  applyThemeLive: (themeId: string) => void;
  updateTheme: (theme: Theme) => void;
  addTheme: (theme: Theme) => void;
  saveSong: (song: Song) => void;
  deleteSong: (id: string) => void;
  updatePreviewSlide: (slideId: string, patch: Partial<Slide>) => void;
  reorderPreview: (from: number, to: number) => void;
  duplicatePreviewLabel: (label: string) => void;
  addToPlaylist: (item: Omit<PlaylistItem, "id">) => void;
  removePlaylistItem: (id: string) => void;
  movePlaylistItem: (from: number, to: number) => void;
  setActivePlaylist: (id: string) => void;
  savePlaylist: (name: string) => void;
  duplicatePlaylist: () => void;
  importPlaylist: (playlist: Playlist) => void;
  ensureMonthPlaylist: (year: number, month: number) => void;
  pinSongTheme: (songId: string, themeId: string | null) => void;
  loadBibleChapter: (bookId: number, chapter: number, verse: number, present: boolean) => void;
  jumpRef: (input: string, present: boolean) => boolean;
  changeVersion: (versionId: string) => void;
  toggleFavorite: (ref: string) => void;
  toggleFavoriteMedia: (id: string) => void;
  saveText: (text: FreeText) => void;
  deleteText: (id: string) => void;
  selectText: (id: string) => void;
  selectMedia: (id: string) => void;
  addMedia: (item: MediaItem) => void;
  setAlert: (text: string, seconds: number, position: "top" | "bottom") => void;
  clearAlert: () => void;
  startCountdown: (label: string, seconds: number) => void;
  clearCountdown: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setFillMode: (mode: LumenState["fillMode"]) => void;
  setEditingSlide: (v: boolean) => void;
  addExtraVersion: (id: string, name: string) => void;
  exportLibrary: () => string;
  importLibrary: (json: string) => void;
  resetDemo: () => void;
  applyOptimize: (result: OptimizeResult, keepBackup?: boolean) => void;
  undoOptimize: () => boolean;
  jumpLabel: (label: string) => boolean;
  bumpOverlay: (delta: number) => void;
  restoreSession: (snap: CultoSnapshot) => void;
  captureNow: (dirty?: boolean) => CultoSnapshot;
}

/** O que o telão precisa saber — o resto do estado da cabine não vai ao ar. */
export type LiveFrameInput = Pick<
  LumenState,
  | "status"
  | "live"
  | "preview"
  | "liveIndex"
  | "alert"
  | "countdown"
  | "songThemeId"
  | "bibleThemeId"
  | "stageThemeId"
  | "themes"
  | "settings"
>;

export function buildLiveFrame(s: LiveFrameInput): LiveFrame {
  const kind = s.live?.kind ?? s.preview?.kind ?? "song";
  const themeId = kind === "bible" ? s.bibleThemeId : s.songThemeId;
  return {
    v: 1,
    status: s.status,
    theme: themeById(s.themes, themeId),
    stageTheme: themeById(s.themes, s.stageThemeId),
    deck: s.live,
    index: s.liveIndex,
    alert: s.alert,
    countdown: s.countdown,
    churchName: s.settings.churchName,
    logoUrl: s.settings.logoUrl,
    settings: {
      transition: s.settings.transition,
      fadeMs: s.settings.fadeMs,
      lowPerformance: s.settings.lowPerformance,
      chordsOnStage: s.settings.chordsOnStage,
      chordsOnAudience: s.settings.chordsOnAudience,
      fitMode: s.settings.fitMode,
      margins: s.settings.margins,
      showWallpaper: s.settings.showWallpaper,
      showClock: s.settings.showClock,
      baseFill: s.settings.baseFill,
      clockPosition: s.settings.clockPosition,
    },
    updatedAt: Date.now(),
  };
}

function broadcast(partial: Partial<LumenState> | ((s: LumenState) => LumenState), set: (fn: (s: LumenState) => LumenState) => void) {
  set((s) => {
    const next = typeof partial === "function" ? partial(s) : { ...s, ...partial };
    queueMicrotask(() => publishLiveFrame(buildLiveFrame(next)));
    return next;
  });
}

type OptimizeBackup = {
  preview: Deck | null;
  previewIndex: number;
  live: Deck | null;
  liveIndex: number;
  themes: Theme[];
  settings: Settings;
  songs: Song[];
  texts: FreeText[];
};

let optimizeBackup: OptimizeBackup | null = null;

function snapshotOptimize(s: LumenState): OptimizeBackup {
  return {
    preview: s.preview,
    previewIndex: s.previewIndex,
    live: s.live,
    liveIndex: s.liveIndex,
    themes: s.themes,
    settings: s.settings,
    songs: s.songs,
    texts: s.texts,
  };
}

function logPlay(s: LumenState, deck: Deck): ProjectionLog[] {
  const entry: ProjectionLog = {
    id: nid(),
    kind: deck.kind,
    refId: deck.refId,
    title: deck.title,
    playedAt: Date.now(),
  };
  return [entry, ...s.logs].slice(0, 400);
}

function loadPlaylistItem(get: () => LumenState, index: number): boolean {
  const s = get();
  const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
  const item = pl?.items[index];
  if (!item) return false;
  if (item.type === "song") get().selectSong(item.refId);
  else if (item.type === "text") get().selectText(item.refId);
  else if (item.type === "media") get().selectMedia(item.refId);
  else if (item.type === "bible") {
    const [b, c, v] = item.refId.split(":").map(Number);
    get().loadBibleChapter(b, c, v || 1, false);
  }
  return true;
}

const empty = (): Omit<
  LumenState,
  | "ensureSeed"
  | "setHydrated"
  | "setTab"
  | "setSearch"
  | "setBibleQuery"
  | "selectSong"
  | "setGroup"
  | "setPreviewIndex"
  | "presentPreview"
  | "stop"
  | "goBlack"
  | "goLogo"
  | "goClear"
  | "next"
  | "prev"
  | "goLiveIndex"
  | "presentPlaylistItem"
  | "previewPlaylistItem"
  | "nextPlaylistItem"
  | "setThemeForKind"
  | "applyThemeLive"
  | "updateTheme"
  | "addTheme"
  | "saveSong"
  | "deleteSong"
  | "updatePreviewSlide"
  | "reorderPreview"
  | "duplicatePreviewLabel"
  | "addToPlaylist"
  | "removePlaylistItem"
  | "movePlaylistItem"
  | "setActivePlaylist"
  | "savePlaylist"
  | "duplicatePlaylist"
  | "importPlaylist"
  | "ensureMonthPlaylist"
  | "pinSongTheme"
  | "loadBibleChapter"
  | "jumpRef"
  | "changeVersion"
  | "toggleFavorite"
  | "toggleFavoriteMedia"
  | "saveText"
  | "deleteText"
  | "selectText"
  | "selectMedia"
  | "addMedia"
  | "setAlert"
  | "clearAlert"
  | "startCountdown"
  | "clearCountdown"
  | "updateSettings"
  | "setFillMode"
  | "setEditingSlide"
  | "addExtraVersion"
  | "exportLibrary"
  | "importLibrary"
  | "resetDemo"
  | "applyOptimize"
  | "undoOptimize"
  | "jumpLabel"
  | "bumpOverlay"
  | "restoreSession"
  | "captureNow"
> => ({
  songs: SEED_SONGS,
  groups: SEED_GROUPS,
  themes: SEED_THEMES_ALL,
  playlists: SEED_PLAYLISTS,
  services: SEED_SERVICES,
  media: SEED_MEDIA,
  texts: SEED_TEXTS,
  logs: [],
  favorites: ["João 3:16", "Salmos 23:1"],
  favoriteMedia: [],
  settings: DEFAULT_SETTINGS,
  extraVersionIds: [],
  libraryTab: "songs",
  search: "",
  bibleQuery: "",
  selectedSongId: null,
  selectedGroupId: "all",
  preview: textToDeck(SEED_TEXTS.find((t) => t.id === "txt-bemvindo") ?? SEED_TEXTS[0]),
  previewIndex: 0,
  live: null,
  liveIndex: 0,
  status: "idle",
  fillMode: "console",
  songThemeId: "theme-louvor",
  bibleThemeId: "theme-biblia",
  stageThemeId: "theme-cut",
  activePlaylistId: "pl-domingo",
  bibleVersionId: "almeida-1819",
  bibleCursor: { bookId: 43, chapter: 3, verse: 16 },
  alert: null,
  countdown: null,
  hydrated: false,
  editingSlide: false,
});

export const useLumenStore = create<LumenState>()(
  persist(
    (set, get) => ({
      ...empty(),

      ensureSeed: () => {
        const s = get();
        const settings = { ...DEFAULT_SETTINGS, ...s.settings };
        // Perfis gravados antes dos favoritos de mídia não trazem o campo, e
        // sem isto a primeira estrela clicada estouraria em undefined.
        if (!Array.isArray(s.favoriteMedia)) set({ favoriteMedia: [] });
        if (
          s.settings.showWallpaper === undefined ||
          s.settings.showClock === undefined ||
          s.settings.emergencyVerse === undefined ||
          s.settings.secondMonitor === undefined ||
          s.settings.wakeLock === undefined ||
          s.settings.startFullscreen === undefined
        ) {
          set({ settings });
        }
        if (s.songs.length === 0) {
          set({
            songs: SEED_SONGS,
            groups: SEED_GROUPS,
            themes: s.themes.length ? s.themes : SEED_THEMES_ALL,
            playlists: SEED_PLAYLISTS,
            services: SEED_SERVICES,
            texts: SEED_TEXTS,
            media: s.media.length ? s.media : SEED_MEDIA,
            selectedSongId: SEED_SONGS[0].id,
            preview: songToDeck(SEED_SONGS[0]),
            settings,
          });
        }
        if (!s.preview && s.songs[0]) {
          set({ preview: songToDeck(s.songs[0]), selectedSongId: s.songs[0].id });
        }
        // Tema novo de versão nova precisa chegar em quem já usa o app. Só
        // acrescenta o que falta: tema editado pela igreja fica como está.
        const missingThemes = SEED_THEMES_ALL.filter(
          (t) => !get().themes.some((x) => x.id === t.id),
        );
        if (missingThemes.length) {
          set({ themes: [...get().themes, ...missingThemes] });
        }
        const missingTexts = SEED_TEXTS.filter((t) => !get().texts.some((x) => x.id === t.id));
        if (missingTexts.length) {
          set({ texts: [...missingTexts, ...get().texts] });
        }
      },

      setHydrated: () => set({ hydrated: true }),
      setTab: (libraryTab) => set({ libraryTab }),
      setSearch: (search) => set({ search }),
      setBibleQuery: (bibleQuery) => set({ bibleQuery }),
      setGroup: (selectedGroupId) => set({ selectedGroupId }),
      setEditingSlide: (editingSlide) => set({ editingSlide }),
      setFillMode: (fillMode) => set({ fillMode }),

      selectSong: (id) => {
        const song = get().songs.find((x) => x.id === id);
        if (!song) return;
        set({
          selectedSongId: id,
          libraryTab: "songs",
          preview: songToDeck(song),
          previewIndex: 0,
          ...(song.themeId ? { songThemeId: song.themeId } : {}),
        });
      },

      setPreviewIndex: (i) => {
        const s = get();
        if (!s.preview) return;
        const max = s.preview.slides.length - 1;
        const previewIndex = Math.max(0, Math.min(max, i));
        const linked =
          s.status !== "idle" && s.live && s.preview.refId === s.live.refId;
        if (linked) {
          broadcast({ previewIndex, liveIndex: previewIndex }, set);
        } else {
          set({ previewIndex });
        }
      },

      presentPreview: () => {
        const s = get();
        if (!s.preview) return;
        broadcast(
          {
            live: s.preview,
            liveIndex: s.previewIndex,
            status: "presenting",
            countdown: null,
            logs: logPlay(s, s.preview),
          },
          set,
        );
      },

      stop: () => broadcast({ status: "idle", fillMode: "console" }, set),
      goBlack: () =>
        broadcast((s) => ({
          ...s,
          status: s.status === "black" ? "presenting" : "black",
        }), set),
      goLogo: () =>
        broadcast((s) => ({
          ...s,
          status: s.status === "logo" ? "presenting" : "logo",
        }), set),
      goClear: () =>
        broadcast((s) => ({
          ...s,
          status: s.status === "clear" ? "presenting" : "clear",
        }), set),

      next: () => {
        const s = get();
        if (s.status !== "idle" && s.live) {
          if (s.liveIndex < s.live.slides.length - 1) {
            const i = s.liveIndex + 1;
            const linked = s.preview?.refId === s.live.refId;
            broadcast(
              { liveIndex: i, previewIndex: linked ? i : s.previewIndex },
              set,
            );
            return;
          }
          if (s.live.kind === "bible") {
            const { bookId, chapter } = s.bibleCursor;
            const chapters = chapterCount(s.bibleVersionId, bookId);
            if (chapter < chapters) {
              get().loadBibleChapter(bookId, chapter + 1, 1, true);
            }
          }
          return;
        }
        if (!s.preview) return;
        if (s.previewIndex < s.preview.slides.length - 1) {
          set({ previewIndex: s.previewIndex + 1 });
        }
      },

      prev: () => {
        const s = get();
        if (s.status !== "idle" && s.live) {
          if (s.liveIndex > 0) {
            const i = s.liveIndex - 1;
            const linked = s.preview?.refId === s.live.refId;
            broadcast(
              { liveIndex: i, previewIndex: linked ? i : s.previewIndex },
              set,
            );
            return;
          }
          if (s.live.kind === "bible") {
            const { bookId, chapter } = s.bibleCursor;
            if (chapter > 1) {
              const prevCount = chapterVerseCount(s.bibleVersionId, bookId, chapter - 1);
              get().loadBibleChapter(bookId, chapter - 1, prevCount || 1, true);
            }
          }
          return;
        }
        if (!s.preview) return;
        if (s.previewIndex > 0) {
          set({ previewIndex: s.previewIndex - 1 });
        }
      },

      goLiveIndex: (i) => {
        const s = get();
        if (s.status !== "idle" && s.live) {
          const linked = s.preview?.refId === s.live.refId;
          const max = s.live.slides.length - 1;
          const liveIndex = Math.max(0, Math.min(max, i));
          broadcast(
            { liveIndex, previewIndex: linked ? liveIndex : s.previewIndex },
            set,
          );
          return;
        }
        get().setPreviewIndex(i);
      },

      presentPlaylistItem: (index) => {
        if (!loadPlaylistItem(get, index)) return;
        queueMicrotask(() => get().presentPreview());
      },

      previewPlaylistItem: (index) => {
        loadPlaylistItem(get, index);
      },

      nextPlaylistItem: () => {
        const s = get();
        const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
        if (!pl) return;
        const currentId = s.live?.refId ?? s.preview?.refId;
        const idx = pl.items.findIndex((i) => i.refId === currentId);
        const next = idx >= 0 ? idx + 1 : 0;
        if (next < pl.items.length) get().presentPlaylistItem(next);
      },

      setThemeForKind: (kind, themeId) => {
        broadcast((s) => ({
          ...s,
          songThemeId: kind === "songs" ? themeId : s.songThemeId,
          bibleThemeId: kind === "bible" ? themeId : s.bibleThemeId,
          stageThemeId: kind === "stage" ? themeId : s.stageThemeId,
        }), set);
      },

      applyThemeLive: (themeId) => {
        const theme = get().themes.find((t) => t.id === themeId);
        if (!theme) return;
        if (theme.applyTo === "bible") get().setThemeForKind("bible", themeId);
        else get().setThemeForKind("songs", themeId);
      },

      updateTheme: (theme) =>
        broadcast((s) => ({
          ...s,
          themes: s.themes.map((t) => (t.id === theme.id ? theme : t)),
        }), set),

      addTheme: (theme) => set((s) => ({ themes: [...s.themes, theme] })),

      saveSong: (song) => {
        const slides = parseLyrics(song.lyricsRaw, get().settings.maxLines);
        const next = { ...song, slides, updatedAt: Date.now() };
        set((s) => {
          const exists = s.songs.some((x) => x.id === next.id);
          const songs = exists ? s.songs.map((x) => (x.id === next.id ? next : x)) : [next, ...s.songs];
          const preview =
            s.preview?.refId === next.id || !exists ? songToDeck(next) : s.preview;
          return { songs, preview, selectedSongId: next.id, libraryTab: "songs" };
        });
      },

      deleteSong: (id) =>
        set((s) => ({
          songs: s.songs.filter((x) => x.id !== id),
          selectedSongId: s.selectedSongId === id ? s.songs.find((x) => x.id !== id)?.id ?? null : s.selectedSongId,
        })),

      updatePreviewSlide: (slideId, patch) => {
        const patchDeck = (deck: Deck | null) =>
          deck
            ? {
                ...deck,
                slides: deck.slides.map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
              }
            : deck;
        broadcast((s) => {
          const preview = patchDeck(s.preview);
          const live =
            s.live && s.preview && s.live.refId === s.preview.refId ? patchDeck(s.live) : s.live;
          let songs = s.songs;
          if (preview?.kind === "song") {
            songs = songs.map((song) =>
              song.id === preview.refId ? { ...song, slides: preview.slides, updatedAt: Date.now() } : song,
            );
          }
          return { ...s, preview, live, songs };
        }, set);
      },

      reorderPreview: (from, to) => {
        set((s) => {
          if (!s.preview) return s;
          const slides = [...s.preview.slides];
          const [moved] = slides.splice(from, 1);
          slides.splice(to, 0, moved);
          const reindexed = slides.map((sl, i) => ({ ...sl, sortOrder: i }));
          const preview = { ...s.preview, slides: reindexed };
          return { preview, previewIndex: to };
        });
      },

      duplicatePreviewLabel: (label) => {
        set((s) => {
          if (!s.preview) return s;
          const extras = s.preview.slides
            .filter((sl) => sl.label.toLowerCase().startsWith(label.toLowerCase()))
            .map((sl, i) => ({ ...sl, id: nid(), sortOrder: s.preview!.slides.length + i }));
          return { preview: { ...s.preview, slides: [...s.preview.slides, ...extras] } };
        });
      },

      addToPlaylist: (item) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === s.activePlaylistId
              ? { ...p, items: [...p.items, { ...item, id: nid() }], updatedAt: Date.now() }
              : p,
          ),
        })),

      removePlaylistItem: (id) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === s.activePlaylistId ? { ...p, items: p.items.filter((i) => i.id !== id) } : p,
          ),
        })),

      movePlaylistItem: (from, to) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== s.activePlaylistId) return p;
            const items = [...p.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
            return { ...p, items };
          }),
        })),

      setActivePlaylist: (id) => set({ activePlaylistId: id }),

      savePlaylist: (name) =>
        set((s) => {
          const current = s.playlists.find((p) => p.id === s.activePlaylistId);
          const copy: Playlist = {
            id: nid(),
            name,
            items: current?.items.map((i) => ({ ...i, id: nid() })) ?? [],
            updatedAt: Date.now(),
          };
          return { playlists: [...s.playlists, copy], activePlaylistId: copy.id };
        }),

      duplicatePlaylist: () => {
        const s = get();
        const current = s.playlists.find((p) => p.id === s.activePlaylistId);
        if (!current) return;
        get().savePlaylist(`${current.name} (cópia)`);
      },

      importPlaylist: (playlist) =>
        set((s) => ({
          playlists: [...s.playlists, { ...playlist, id: playlist.id || nid() }],
          activePlaylistId: playlist.id,
        })),

      ensureMonthPlaylist: (year, month) => {
        const id = `pl-${year}-${String(month + 1).padStart(2, "0")}`;
        const label = new Date(year, month, 1)
          .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          .replace(" de ", "/");
        const name = label.charAt(0).toUpperCase() + label.slice(1);
        const s = get();
        const existing = s.playlists.find((p) => p.id === id);
        if (existing) {
          set({ activePlaylistId: id });
          return;
        }
        set({
          playlists: [
            ...s.playlists,
            { id, name, items: [], updatedAt: Date.now() },
          ],
          activePlaylistId: id,
        });
      },

      pinSongTheme: (songId, themeId) => {
        set((s) => ({
          songs: s.songs.map((song) =>
            song.id === songId ? { ...song, themeId: themeId ?? undefined } : song,
          ),
          songThemeId: themeId ?? s.songThemeId,
        }));
      },

      loadBibleChapter: (bookId, chapter, verse, present) => {
        const s = get();
        const slides = chapterSlides(s.bibleVersionId, bookId, chapter, s.settings.maxLines);
        if (!slides.length) return;
        const meta = bookById(bookId);
        const idx = Math.max(
          0,
          slides.findIndex((sl) => sl.reference === formatRef(meta?.name ?? "", chapter, verse)),
        );
        const deck: Deck = {
          kind: "bible",
          refId: `${bookId}:${chapter}:${verse}`,
          title: formatRef(meta?.name ?? "Livro", chapter, verse),
          subtitle: listVersionName(s.bibleVersionId),
          slides,
        };
        const patch = {
          preview: deck,
          previewIndex: idx < 0 ? 0 : idx,
          bibleCursor: { bookId, chapter, verse },
          libraryTab: "bible" as const,
        };
        if (present) {
          broadcast(
            (st) => ({
              ...st,
              ...patch,
              live: deck,
              liveIndex: patch.previewIndex,
              status: "presenting" as OutputStatus,
              logs: logPlay(st, deck),
            }),
            set,
          );
        } else {
          set(patch);
        }
      },

      jumpRef: (input, present) => {
        const parsed = parseBibleRef(input);
        if (!parsed) return false;
        get().loadBibleChapter(parsed.book.id, parsed.chapter, parsed.verse, present);
        if (parsed.endVerse && parsed.endVerse > parsed.verse) {
          // Range: keep start verse; operator walks with arrows.
        }
        return true;
      },

      changeVersion: (bibleVersionId) => {
        const s = get();
        set({ bibleVersionId });
        const { bookId, chapter, verse } = s.bibleCursor;
        queueMicrotask(() =>
          get().loadBibleChapter(bookId, chapter, verse, s.status !== "idle" && s.live?.kind === "bible"),
        );
      },

      toggleFavorite: (ref) =>
        set((s) => ({
          favorites: s.favorites.includes(ref)
            ? s.favorites.filter((f) => f !== ref)
            : [...s.favorites, ref],
        })),

      toggleFavoriteMedia: (id) =>
        set((s) => ({
          favoriteMedia: s.favoriteMedia.includes(id)
            ? s.favoriteMedia.filter((x) => x !== id)
            : [...s.favoriteMedia, id],
        })),

      saveText: (text) =>
        set((s) => {
          const exists = s.texts.some((t) => t.id === text.id);
          const texts = exists
            ? s.texts.map((t) => (t.id === text.id ? text : t))
            : [text, ...s.texts];
          return { texts };
        }),

      deleteText: (id) => set((s) => ({ texts: s.texts.filter((t) => t.id !== id) })),

      selectText: (id) => {
        const text = get().texts.find((t) => t.id === id);
        if (!text) return;
        const slides: Slide[] = parseLyrics(text.body, get().settings.maxLines).map((sl) => ({
          ...sl,
          label: sl.label === "Verso 1" ? "Aviso" : sl.label,
        }));
        set({
          libraryTab: "texts",
          preview: {
            kind: "text",
            refId: text.id,
            title: text.title,
            subtitle: "Aviso",
            slides: slides.length
              ? slides
              : [{ id: nid(), label: "Aviso", text: text.body, sortOrder: 0 }],
          },
          previewIndex: 0,
        });
      },

      selectMedia: (id) => {
        const item = get().media.find((m) => m.id === id);
        if (!item) return;
        const slides: Slide[] =
          item.type === "announcement" || item.body
            ? parseLyrics(item.body || item.title)
            : [{ id: nid(), label: "Mídia", text: item.title, sortOrder: 0 }];
        set({
          libraryTab: "media",
          preview: {
            kind: "media",
            refId: item.id,
            title: item.title,
            subtitle: item.type,
            slides,
            mediaSrc: item.path,
            mediaType: item.type === "announcement" ? undefined : item.type,
          },
          previewIndex: 0,
        });
      },

      addMedia: (item) => set((s) => ({ media: [item, ...s.media] })),

      setAlert: (text, seconds, position) =>
        broadcast(
          {
            alert: { text, position, until: Date.now() + seconds * 1000 },
          },
          set,
        ),

      clearAlert: () => broadcast({ alert: null }, set),

      startCountdown: (label, seconds) => {
        const deck: Deck = {
          kind: "countdown",
          refId: "countdown",
          title: label,
          subtitle: "Contagem",
          slides: [{ id: "cd", label: "Countdown", text: label, sortOrder: 0 }],
        };
        broadcast(
          {
            countdown: { label, endsAt: Date.now() + seconds * 1000 },
            preview: deck,
            live: deck,
            liveIndex: 0,
            status: "presenting",
          },
          set,
        );
      },

      clearCountdown: () => broadcast({ countdown: null }, set),

      updateSettings: (patch) =>
        broadcast((s) => ({ ...s, settings: { ...s.settings, ...patch } }), set),

      addExtraVersion: (id, name) =>
        set((s) => ({ extraVersionIds: [...s.extraVersionIds.filter((v) => v.id !== id), { id, name }] })),

      exportLibrary: () => {
        const s = get();
        return JSON.stringify(
          {
            songs: s.songs,
            groups: s.groups,
            themes: s.themes,
            playlists: s.playlists,
            texts: s.texts,
            settings: s.settings,
          },
          null,
          2,
        );
      },

      importLibrary: (json) => {
        const data = JSON.parse(json) as Partial<LumenState>;
        set((s) => ({
          songs: data.songs ?? s.songs,
          groups: data.groups ?? s.groups,
          themes: data.themes ?? s.themes,
          playlists: data.playlists ?? s.playlists,
          texts: data.texts ?? s.texts,
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
        }));
      },

      resetDemo: () => {
        const fresh = empty();
        set({
          ...fresh,
          hydrated: true,
        });
        queueMicrotask(() => publishLiveFrame(buildLiveFrame(get())));
      },

      applyOptimize: (result, keepBackup = false) => {
        broadcast((s) => {
          if (!s.preview) return s;
          if (!keepBackup) optimizeBackup = snapshotOptimize(s);
          const preview = { ...s.preview, slides: result.slides };
          const live =
            s.live && s.live.refId === s.preview.refId ? { ...s.live, slides: result.slides } : s.live;
          let songs = s.songs;
          let texts = s.texts;
          if (preview.kind === "song") {
            songs = songs.map((song) =>
              song.id === preview.refId
                ? { ...song, slides: result.slides, lyricsRaw: result.raw, updatedAt: Date.now() }
                : song,
            );
          }
          if (preview.kind === "text") {
            texts = texts.map((t) =>
              t.id === preview.refId ? { ...t, body: result.raw, updatedAt: Date.now() } : t,
            );
          }
          const themeId = preview.kind === "bible" ? s.bibleThemeId : s.songThemeId;
          const themes =
            Object.keys(result.themePatch).length === 0
              ? s.themes
              : s.themes.map((t) => (t.id === themeId ? { ...t, ...result.themePatch } : t));
          const settings =
            Object.keys(result.settingsPatch).length === 0
              ? s.settings
              : {
                  ...s.settings,
                  ...result.settingsPatch,
                  margins: result.settingsPatch.margins
                    ? { ...s.settings.margins, ...result.settingsPatch.margins }
                    : s.settings.margins,
                };
          return {
            ...s,
            preview,
            live,
            songs,
            texts,
            themes,
            settings,
            previewIndex: Math.min(s.previewIndex, Math.max(0, result.slides.length - 1)),
          };
        }, set);
      },

      undoOptimize: () => {
        const snap = optimizeBackup;
        if (!snap) return false;
        optimizeBackup = null;
        broadcast(
          {
            preview: snap.preview,
            previewIndex: snap.previewIndex,
            live: snap.live,
            liveIndex: snap.liveIndex,
            themes: snap.themes,
            settings: snap.settings,
            songs: snap.songs,
            texts: snap.texts,
          },
          set,
        );
        return true;
      },

      jumpLabel: (label) => {
        const s = get();
        const deck = s.status !== "idle" && s.live ? s.live : s.preview;
        if (!deck) return false;
        const f = fold(label);
        const from = s.status !== "idle" && s.live ? s.liveIndex : s.previewIndex;
        let idx = deck.slides.findIndex(
          (sl, i) => i >= from && fold(sl.label).includes(f),
        );
        if (idx < 0) idx = deck.slides.findIndex((sl) => fold(sl.label).includes(f));
        if (idx < 0) return false;
        get().goLiveIndex(idx);
        return true;
      },

      bumpOverlay: (delta) => {
        const s = get();
        const bible = (s.live ?? s.preview)?.kind === "bible";
        const id = bible ? s.bibleThemeId : s.songThemeId;
        const theme = s.themes.find((t) => t.id === id);
        if (!theme) return;
        const overlayOpacity = Math.min(0.85, Math.max(0.08, theme.overlayOpacity + delta));
        get().updateTheme({ ...theme, overlayOpacity });
      },

      restoreSession: (snap) => {
        broadcast(
          {
            status: snap.status,
            live: snap.live,
            liveIndex: snap.liveIndex,
            preview: snap.preview,
            previewIndex: snap.previewIndex,
            countdown: snap.countdown,
            alert: snap.alert,
            songThemeId: snap.songThemeId,
            bibleThemeId: snap.bibleThemeId,
            bibleCursor: snap.bibleCursor,
            activePlaylistId: snap.playlistId || get().activePlaylistId,
          },
          set,
        );
      },

      captureNow: (dirty) => {
        const s = get();
        const slice: SessionSlice = {
          status: s.status,
          live: s.live,
          liveIndex: s.liveIndex,
          preview: s.preview,
          previewIndex: s.previewIndex,
          playlistId: s.activePlaylistId,
          songThemeId: s.songThemeId,
          bibleThemeId: s.bibleThemeId,
          bibleCursor: s.bibleCursor,
          countdown: s.countdown,
          alert: s.alert,
        };
        const isDirty = dirty ?? s.status !== "idle";
        return captureSession(slice, isDirty);
      },
    }),
    {
      name: "lumen-v2",
      skipHydration: true,
      storage: durableStorage,
      partialize: (s) => ({
        songs: s.songs,
        groups: s.groups,
        themes: s.themes,
        playlists: s.playlists,
        services: s.services,
        media: s.media.filter((m) => !m.sessionOnly),
        texts: s.texts,
        logs: s.logs,
        favorites: s.favorites,
        favoriteMedia: s.favoriteMedia,
        settings: s.settings,
        extraVersionIds: s.extraVersionIds,
        songThemeId: s.songThemeId,
        bibleThemeId: s.bibleThemeId,
        stageThemeId: s.stageThemeId,
        activePlaylistId: s.activePlaylistId,
        selectedSongId: s.selectedSongId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) return;
        state?.ensureSeed();
        state?.setHydrated();
        if (state?.selectedSongId) {
          const song = state.songs.find((x) => x.id === state.selectedSongId);
          if (song) state.selectSong(song.id);
        }
      },
    },
  ),
);

function listVersionName(id: string): string {
  if (id === "almeida-1819") return "Almeida 1819";
  const extra = useLumenStore.getState().extraVersionIds.find((v) => v.id === id);
  return extra?.name ?? id;
}

export function searchSongs(songs: Song[], query: string, groupId: string | "all"): Song[] {
  const q = fold(query);
  return songs.filter((song) => {
    if (groupId !== "all" && song.groupId !== groupId) return false;
    if (!q) return true;
    return (
      fold(song.title).includes(q) ||
      fold(song.artist).includes(q) ||
      fold(song.lyricsRaw).includes(q) ||
      fold(song.key).includes(q)
    );
  });
}
