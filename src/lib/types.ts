export type SlideKind = "song" | "bible" | "media" | "text" | "countdown";

export type OutputStatus = "idle" | "presenting" | "black" | "logo" | "clear";

/**
 * "animated" desenha o fundo em CSS:  guarda o nome da
 * classe (ver styles.css). Escolhido em vez de arquivo de vídeo porque o app
 * roda offline num PC modesto — o vídeo somaria centenas de MB ao instalador
 * e comeria CPU no culto inteiro.
 */
export type BackgroundType = "color" | "image" | "video" | "animated";

export type AlignH = "left" | "center" | "right";
export type AlignV = "top" | "center" | "bottom";
export type TransitionKind = "cut" | "fade";
export type LibraryTab = "songs" | "bible" | "media" | "texts" | "history";
export type FitMode = "contain" | "cover";
export type ClockPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Slide {
  id: string;
  label: string;
  text: string;
  comment?: string;
  sortOrder: number;
  themeOverrideId?: string;
  reference?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  groupId: string;
  key: string;
  copyright: string;
  themeId?: string;
  lyricsRaw: string;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export interface SongGroup {
  id: string;
  name: string;
}

export interface Theme {
  id: string;
  name: string;
  backgroundType: BackgroundType;
  backgroundValue: string;
  overlayOpacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  uppercase: boolean;
  textColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  alignH: AlignH;
  alignV: AlignV;
  lineHeight: number;
  margin: number;
  showTitle: boolean;
  showCopyright: boolean;
  showReference: boolean;
  applyTo: "songs" | "bible" | "both";
}

export interface PlaylistItem {
  id: string;
  type: SlideKind;
  refId: string;
  notes: string;
  title: string;
  subtitle?: string;
}

export interface Playlist {
  id: string;
  name: string;
  serviceId?: string;
  items: PlaylistItem[];
  updatedAt: number;
}

export interface Service {
  id: string;
  name: string;
  recurrence: string;
  datetime?: string;
}

export interface MediaItem {
  id: string;
  type: "image" | "video" | "audio" | "announcement";
  title: string;
  path: string;
  body?: string;
  sessionOnly?: boolean;
}

export interface FreeText {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface ProjectionLog {
  id: string;
  kind: SlideKind;
  refId: string;
  title: string;
  playedAt: number;
}

export interface Settings {
  lowPerformance?: boolean;
  churchName: string;
  logoUrl: string;
  maxLines: number;
  transition: TransitionKind;
  fadeMs: number;
  chordsOnStage: boolean;
  chordsOnAudience: boolean;
  fitMode: FitMode;
  margins: { t: number; r: number; b: number; l: number };
  openStageWindow: boolean;
  showWallpaper: boolean;
  showClock: boolean;
  baseFill: "dark" | "light";
  clockPosition: ClockPosition;
  emergencyVerse: string;
  emergencySongId: string;
  operatorName: string;
  secondMonitor: boolean;
  wakeLock: boolean;
  startFullscreen: boolean;
}

export interface BibleCursor {
  versionId: string;
  bookId: number;
  chapter: number;
  verse: number;
}

export interface AlertState {
  text: string;
  position: "top" | "bottom";
  until: number;
}

export interface CountdownState {
  label: string;
  endsAt: number;
}

export interface Deck {
  kind: SlideKind;
  refId: string;
  title: string;
  subtitle: string;
  key?: string;
  copyright?: string;
  slides: Slide[];
  /** Endereço do arquivo quando o baralho é mídia — é isto que faz a imagem
   *  ou o vídeo chegarem ao telão, em vez de só o nome do arquivo. */
  mediaSrc?: string;
  mediaType?: "image" | "video" | "audio";
}

/** Snapshot sent from the operator to projection/stage windows. */
export interface LiveFrame {
  v: 1;
  status: OutputStatus;
  theme: Theme;
  stageTheme: Theme;
  deck: Deck | null;
  index: number;
  alert: AlertState | null;
  countdown: CountdownState | null;
  churchName: string;
  logoUrl: string;
  settings: Pick<
    Settings,
    | "lowPerformance"
    | "transition"
    | "fadeMs"
    | "chordsOnStage"
    | "chordsOnAudience"
    | "fitMode"
    | "margins"
    | "showWallpaper"
    | "showClock"
    | "baseFill"
    | "clockPosition"
  >;
  updatedAt: number;
}

export interface CompactBook {
  i: number;
  o: string;
  c: string[][];
}

export interface CompactBible {
  id: string;
  name: string;
  license: string;
  books: CompactBook[];
}

export type RequestFrom = "pastor" | "louvor" | "som" | "midia";

export type RequestKind =
  | "verse"
  | "repeat-chorus"
  | "bridge"
  | "next-song"
  | "hold"
  | "end"
  | "repeat-verse"
  | "chat"
  | "black"
  | "prepare";

export interface StageRequest {
  id: string;
  from: RequestFrom;
  kind: RequestKind;
  text: string;
  verse?: string;
  at: number;
  status: "pending" | "done" | "dismissed";
}

export interface HistoryEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  detail?: string;
}

export interface CultoSnapshot {
  v: 1;
  id: string;
  at: number;
  label: string;
  dirty: boolean;
  status: OutputStatus;
  live: Deck | null;
  liveIndex: number;
  preview: Deck | null;
  previewIndex: number;
  playlistId: string;
  songThemeId: string;
  bibleThemeId: string;
  bibleCursor: { bookId: number; chapter: number; verse: number };
  countdown: CountdownState | null;
  alert: AlertState | null;
}

export type HealthLevel = "ok" | "warn" | "fail";

export interface HealthItem {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
  fix?: string;
  action?: "optimize" | "bible" | "playlist" | "display" | "projector" | "palco" | "windows";
}

export interface SearchHit {
  id: string;
  kind: "song" | "bible" | "text" | "media" | "playlist" | "command" | "history";
  title: string;
  subtitle: string;
  refId: string;
}

export interface TimelineSlot {
  id: string;
  itemIndex: number;
  title: string;
  kind: SlideKind;
  plannedStart: string;
  plannedMinutes: number;
  done: boolean;
}
