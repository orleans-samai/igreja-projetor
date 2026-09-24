import { nid } from "../lib/fold.ts";
import { parseLyrics } from "../lib/lyrics.ts";
import type {
  AlertState,
  CountdownState,
  Deck,
  FreeText,
  LiveFrame,
  OutputStatus,
  Settings,
  Theme,
  YoutubeFrame,
  Song,
} from "../lib/types.ts";

export const DEFAULT_SETTINGS: Settings = {
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

export function songToDeck(song: Song): Deck {
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

export function textToDeck(text: FreeText): Deck {
  const slides = parseLyrics(text.body, 5).map((slide) => ({
    ...slide,
    label: slide.label === "Verso 1" || slide.label === "Verso" ? "Aviso" : slide.label,
  }));
  return {
    kind: "text",
    refId: text.id,
    title: text.title,
    subtitle: "",
    slides: slides.length ? slides : [{ id: nid(), label: "Aviso", text: text.body, sortOrder: 0 }],
  };
}

export type LiveFrameInput = {
  status: OutputStatus;
  live: Deck | null;
  preview: Deck | null;
  liveIndex: number;
  alert: AlertState | null;
  countdown: CountdownState | null;
  songThemeId: string;
  bibleThemeId: string;
  stageThemeId: string;
  themes: Theme[];
  settings: Settings;
  youtube: YoutubeFrame | null;
};

function themeById(themes: Theme[], id: string): Theme {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

export function buildLiveFrame(state: LiveFrameInput): LiveFrame {
  const kind = state.live?.kind ?? state.preview?.kind ?? "song";
  const themeId = kind === "bible" ? state.bibleThemeId : state.songThemeId;
  return {
    v: 1,
    status: state.status,
    theme: themeById(state.themes, themeId),
    stageTheme: themeById(state.themes, state.stageThemeId),
    youtube: state.youtube,
    deck: state.live,
    index: state.liveIndex,
    alert: state.alert,
    countdown: state.countdown,
    churchName: state.settings.churchName,
    logoUrl: state.settings.logoUrl,
    settings: {
      transition: state.settings.transition,
      fadeMs: state.settings.fadeMs,
      lowPerformance: state.settings.lowPerformance,
      chordsOnStage: state.settings.chordsOnStage,
      chordsOnAudience: state.settings.chordsOnAudience,
      fitMode: state.settings.fitMode,
      margins: state.settings.margins,
      showWallpaper: state.settings.showWallpaper,
      showClock: state.settings.showClock,
      baseFill: state.settings.baseFill,
      clockPosition: state.settings.clockPosition,
    },
    updatedAt: Date.now(),
  };
}

export function migrateLumenState(persisted: unknown): Record<string, unknown> {
  if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) return {};
  const state = persisted as Record<string, unknown>;
  const previousSettings =
    state.settings && typeof state.settings === "object" && !Array.isArray(state.settings)
      ? (state.settings as Partial<Settings>)
      : {};
  return {
    ...state,
    favoriteMedia: Array.isArray(state.favoriteMedia) ? state.favoriteMedia : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...previousSettings,
      margins: {
        ...DEFAULT_SETTINGS.margins,
        ...(previousSettings.margins ?? {}),
      },
    },
  };
}
