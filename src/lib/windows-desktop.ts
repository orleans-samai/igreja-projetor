/**
 * Windows cabine helpers
 * ----------------------
 * Preferência: Lúmen-Setup.exe (atalho no Menu Iniciar + 2º monitor).
 * No navegador: Edge/Chrome → Instalar como aplicativo, projetor na
 * tela externa, wake lock para o Windows não dormir.
 */

export interface OutputScreen {
  id: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  primary: boolean;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstall: BeforeInstallPromptEvent | null = null;
let wakeSentinel: { release: () => Promise<void> } | null = null;
let listeningInstall = false;

export function isWindows(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /windows nt|win32|win64|wow64/i.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.lumenDesktop?.isDesktop) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

export function recommendedBrowser(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): "edge" | "chrome" | "other" {
  if (/edg\//i.test(ua)) return "edge";
  if (/chrome|chromium/i.test(ua) && !/edg\//i.test(ua)) return "chrome";
  return "other";
}

export function captureInstallPrompt(): () => void {
  if (typeof window === "undefined" || listeningInstall) return () => undefined;
  listeningInstall = true;
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    listeningInstall = false;
  };
}

export function canPromptInstall(): boolean {
  return deferredInstall !== null;
}

export async function promptInstall(): Promise<InstallOutcome> {
  if (!deferredInstall) return "unavailable";
  const event = deferredInstall;
  deferredInstall = null;
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}

export function pickExternalScreen(screens: OutputScreen[]): OutputScreen | null {
  if (screens.length < 2) return null;
  return screens.find((s) => !s.primary) ?? screens[1] ?? null;
}

export async function listScreens(): Promise<OutputScreen[]> {
  if (typeof window === "undefined") return [];
  const w = window as Window & {
    getScreenDetails?: () => Promise<{
      screens: Array<{
        left: number;
        top: number;
        width: number;
        height: number;
        isPrimary: boolean;
        label?: string;
      }>;
    }>;
  };
  if (typeof w.getScreenDetails === "function") {
    try {
      const details = await w.getScreenDetails();
      return details.screens.map((screen, id) => ({
        id,
        label: screen.label || (screen.isPrimary ? "Monitor principal" : `Monitor ${id + 1}`),
        left: screen.left,
        top: screen.top,
        width: screen.width,
        height: screen.height,
        primary: screen.isPrimary,
      }));
    } catch {
      /* permission denied */
    }
  }
  return [
    {
      id: 0,
      label: "Monitor principal",
      left: 0,
      top: 0,
      width: window.screen.width,
      height: window.screen.height,
      primary: true,
    },
  ];
}

export function openOnScreen(
  path: "/projetor" | "/palco" | "/pedido",
  screen?: OutputScreen | null,
  fullscreen = false,
): Window | null {
  if (typeof window === "undefined") return null;
  const target = fullscreen && path === "/projetor" ? `${path}?tela=1` : path;
  const features = screen
    ? `popup=yes,left=${Math.round(screen.left)},top=${Math.round(screen.top)},width=${Math.round(screen.width)},height=${Math.round(screen.height)},menubar=no,toolbar=no,location=no,status=no`
    : "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no";
  return window.open(target, `lumen${path}`, features);
}

export async function openProjectorWindow(opts: {
  secondMonitor: boolean;
  fullscreen: boolean;
}): Promise<Window | null> {
  const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (desktop?.isDesktop) {
    await desktop.openProjector();
    return window;
  }
  let screen: OutputScreen | null = null;
  if (opts.secondMonitor) {
    const screens = await listScreens();
    screen = pickExternalScreen(screens);
  }
  return openOnScreen("/projetor", screen, opts.fullscreen);
}

/** Os três tipos de mídia, cada um com a sua pasta no disco. */
export type MediaKind = "video" | "audio" | "image";

export interface MediaFile {
  id: string;
  kind: MediaKind;
  name: string;
  title: string;
  /** Endereço servido pelo protocolo do app, preso à pasta do tipo. */
  url: string;
  size: number;
  at: number;
}

export interface MediaListing {
  ok: boolean;
  dir?: string;
  items?: MediaFile[];
  error?: string;
}

declare global {
  interface Window {
    lumenDesktop?: {
      isDesktop: boolean;
      autoSlideStatus: () => Promise<{ pronto: boolean; nome?: string; motivo?: string }>;
      autoSlideInstall: () => Promise<{ ok: boolean; erro?: string }>;
      autoSlideTranscrever: (wav: Uint8Array) => Promise<{ ok: boolean; texto?: string; erro?: string }>;
      autoSlideCancel: () => Promise<void>;
      preflight: (urls: string[]) => Promise<PreflightReport>;
      selectDisplay: (id: number) => Promise<void>;
      testDisplay: (on: boolean) => Promise<void>;
      exportService: (data: unknown) => Promise<{ canceled?: boolean; files?: number; path?: string }>;
      importService: () => Promise<unknown>;
      suggestLyrics: (input: { query: string; artist?: string }) => Promise<import("./lyrics-web").LyricsSearchResult>;
      loadLyrics: (url: string) => Promise<{ ok: boolean; lyrics?: string; error?: string }>;
      storageGet: (key: string) => Promise<string | null>;
      storageSet: (key: string, value: string | null) => Promise<void>;
      openProjector: () => Promise<boolean>;
      openStage: () => Promise<boolean>;
      openPedido: () => Promise<boolean>;
      mediaList: (kind: MediaKind) => Promise<MediaListing>;
      mediaFolders: () => Promise<Record<MediaKind, string>>;
      mediaOpenFolder: (kind: MediaKind) => Promise<{ ok: boolean; dir?: string; error?: string }>;
      mediaChooseFolder: (
        kind: MediaKind,
      ) => Promise<{ ok: boolean; dir?: string; canceled?: boolean }>;
      mediaResetFolder: (kind: MediaKind) => Promise<{ ok: boolean; dir: string }>;
    };
  }
}

export interface PreflightReport {
  displays: { id: number; label: string; width: number; height: number; scaleFactor: number; primary: boolean }[];
  selectedId: number | null;
  projectorReady: boolean;
  missing: string[];
  external: string[];
}

export async function applyWakeLock(on: boolean): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
  };
  if (!nav.wakeLock) return false;
  try {
    if (!on) {
      await wakeSentinel?.release();
      wakeSentinel = null;
      return true;
    }
    wakeSentinel = await nav.wakeLock.request("screen");
    return true;
  } catch {
    wakeSentinel = null;
    return false;
  }
}

export function windowsInstallSteps(browser: "edge" | "chrome" | "other"): { title: string; detail: string }[] {
  const appMenu =
    browser === "edge"
      ? "Sem o instalador: Menu ⋯ → Aplicativos → Instalar este site como um aplicativo"
      : browser === "chrome"
        ? "Sem o instalador: ícone de instalar na barra de endereço, ou menu ⋮ → Instalar página como aplicativo"
        : "Sem o instalador, abra no Microsoft Edge ou no Google Chrome";
  return [
    {
      title: "Baixe o Lúmen-Setup.exe",
      detail: "Instalador Windows (64 bits). Não precisa de senha de administrador.",
    },
    {
      title: "Execute e avance",
      detail: "Aceite a pasta sugerida. O atalho aparece na área de trabalho e no Menu Iniciar. " + appMenu + ".",
    },
    {
      title: "Abra pelo Menu Iniciar",
      detail: "Procure Lúmen. Fixe na barra de tarefas do PC da cabine.",
    },
    {
      title: "Estenda o projetor",
      detail: "Windows + P → Estender. Não use Duplicar: a cabine e o telão precisam ser monitores diferentes.",
    },
    {
      title: "Mande o telão para o 2º monitor",
      detail: "Tela → Abrir projetor. O Lúmen coloca a igreja em tela cheia na tela externa.",
    },
  ];
}
