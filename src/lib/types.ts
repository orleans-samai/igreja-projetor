export type SlideKind = "song" | "bible" | "media" | "text" | "countdown" | "apresentacao";

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
  /**
   * A imagem do slide, quando ele vem de uma apresentação importada.
   *
   * É endereço, nunca os bytes: o estado do app é reescrito inteiro a cada
   * mudança, e quarenta slides de 800 KB dentro dele seriam 32 MB copiados
   * a cada avanço de verso.
   */
  imagem?: string;
}

/**
 * Uma apresentação importada — PowerPoint ou PDF.
 *
 * PowerPoint vira texto e imagem por slide, lidos sem Office. PDF vira uma
 * imagem por página, desenhada pelo pdf.js: é o caminho de fidelidade
 * total, e o que se recomenda a quem precisa do slide idêntico.
 */
export interface Apresentacao {
  id: string;
  titulo: string;
  origem: "pptx" | "pdf";
  slides: { texto: string; imagem: string }[];
  /** Quem mandou, quando veio pela página do dirigente. */
  de?: string;
  criadoEm: number;
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
  /** Quem mandou de fora da cabine: o dirigente pela página dele, ou a equipe pelo celular. */
  enviadoPor?: string;
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
  /** Cor de destaque da cabine — ver accent-presets.ts. Ausente = "aco". */
  accentPreset?: import("./accent-presets").AccentId;
  /**
   * Multiplica o corpo de letra de todo tema no telão, sem reescrever tema
   * nenhum: é o A+ / A− da cabine. Ausente = FONT_SCALE_PADRAO, que já é
   * maior do que o tema pede — projetor é lido de longe.
   */
  fontScale?: number;
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
  /** Logo por cima do telão antes de apresentar algo. Ausente = ligado —
   *  quem já usa o app hoje não vê nada mudar. */
  showIdleLogo?: boolean;
  /** Tamanho da logo no telão. Ausente = pequena. */
  logoTamanho?: import("./logo-no-telao").TamanhoDaLogo;
  /** Nome da igreja debaixo da logo, no telão. Ausente = desligado. */
  logoComNome?: boolean;
  /** Vídeo ou imagem da pasta de mídia atrás da logo. Ausente = o fundo do tema. */
  logoFundo?: import("./logo-no-telao").FundoDaLogo | null;
  /** Tamanho do aviso de rodapé, o último que o operador escolheu. Ausente = grande. */
  avisoTamanho?: import("./aviso-no-telao").TamanhoDoAviso;
  /** O aviso pisca para chamar a atenção. Ausente = pisca. */
  avisoPiscar?: boolean;
  /** Quem abre as apresentações (menu Slides). Ausente = automático. */
  abrirSlidesCom?: import("./abrir-slides").QuemAbreSlides;
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
  /** Ausente = grande: o aviso antigo, de 30 px, ninguém via do fundo da igreja. */
  tamanho?: import("./aviso-no-telao").TamanhoDoAviso;
  /** Ausente = pisca. */
  piscar?: boolean;
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
  /** Vídeo toca no telão, com som — a cabine só descreve o que quer, e
   *  quem toca de verdade é o telão. */
  mediaAcao?: "tocar" | "pausar" | "parar";
  mediaLoop?: boolean;
  /** Para onde ir, em segundos. Só vale quando `mediaBusca` muda. */
  mediaTempo?: number;
  /** Contador de buscas: sem ele, pedir o mesmo segundo duas vezes seria um
   *  quadro idêntico, e o telão não saberia que houve um segundo pedido. */
  mediaBusca?: number;
  /** 1, 1.25, 1.5 ou 2 — vira playbackRate no elemento que toca. */
  mediaVelocidade?: number;
  /**
   * De 0 a 1. Ausente é 1, que é como o vídeo sempre tocou — nenhuma igreja
   * que já usa o app ouve diferença ao atualizar.
   *
   * Quem manda no som é o telão, não a cabine: se as duas tocassem, a igreja
   * ouviria o louvor duas vezes, com meio segundo de atraso entre elas.
   */
  mediaVolume?: number;
  mediaMudo?: boolean;
  /** Sobe a cada comando: sem isto, pedir "tocar" de novo depois do vídeo
   *  terminar sozinho seria um quadro idêntico ao anterior, e o telão não
   *  teria como distinguir do primeiro pedido. */
  mediaSeq?: number;
}

/** O estado de reprodução de uma mídia: o que o baralho e a trilha têm em comum. */
export type CamposDeMidia = Pick<
  Deck,
  | "mediaSrc"
  | "mediaType"
  | "mediaAcao"
  | "mediaLoop"
  | "mediaTempo"
  | "mediaBusca"
  | "mediaVelocidade"
  | "mediaVolume"
  | "mediaMudo"
  | "mediaSeq"
>;

/**
 * O som de um vídeo tocando sem a imagem ("Tirar vídeo"). Sobrevive à troca
 * do que está no ar — ver `src/lib/trilha.ts`.
 */
export interface TrilhaDeAudio extends CamposDeMidia {
  refId: string;
  title: string;
}

/** Snapshot sent from the operator to projection/stage windows. */
export interface LiveFrame {
  v: 1;
  status: OutputStatus;
  theme: Theme;
  stageTheme: Theme;
  deck: Deck | null;
  index: number;
  /** O áudio de um vídeo que saiu da tela e continua tocando. */
  trilha?: TrilhaDeAudio | null;
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
    | "showIdleLogo"
    | "logoTamanho"
    | "logoComNome"
    | "logoFundo"
    | "fontScale"
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
