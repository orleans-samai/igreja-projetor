import { nid } from "./fold.ts";
import type {
  AlertState,
  CountdownState,
  CultoSnapshot,
  Deck,
  OutputStatus,
} from "./types.ts";

export const SESSION_KEY = "lumen-session";
const CRASH_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface SessionSlice {
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

export function captureSession(s: SessionSlice, dirty: boolean, label?: string): CultoSnapshot {
  const title = s.live?.title ?? s.preview?.title ?? "Culto";
  const slide =
    s.live && s.status !== "idle"
      ? ` · slide ${(s.liveIndex ?? 0) + 1}`
      : "";
  return {
    v: 1,
    id: nid(),
    at: Date.now(),
    label: label ?? `${title}${slide}`,
    dirty,
    status: s.status,
    live: s.live,
    liveIndex: s.liveIndex,
    preview: s.preview,
    previewIndex: s.previewIndex,
    playlistId: s.playlistId,
    songThemeId: s.songThemeId,
    bibleThemeId: s.bibleThemeId,
    bibleCursor: s.bibleCursor,
    countdown: s.countdown,
    alert: s.alert,
  };
}

export function writeSession(snap: CultoSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

export function readSession(): CultoSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as CultoSnapshot;
    if (snap?.v !== 1) return null;
    return snap;
  } catch {
    return null;
  }
}

export function clearSessionFlag(): void {
  const snap = readSession();
  if (!snap) return;
  writeSession({ ...snap, dirty: false });
}

export function crashOffer(): CultoSnapshot | null {
  const snap = readSession();
  if (!snap) return null;
  if (!snap.dirty) return null;
  if (Date.now() - snap.at > CRASH_WINDOW_MS) return null;
  if (snap.status === "idle" && !snap.live) return null;
  return snap;
}

export function snapshotEquals(a: CultoSnapshot, b: CultoSnapshot): boolean {
  return (
    a.status === b.status &&
    a.liveIndex === b.liveIndex &&
    a.previewIndex === b.previewIndex &&
    a.live?.refId === b.live?.refId &&
    a.preview?.refId === b.preview?.refId &&
    a.playlistId === b.playlistId &&
    a.songThemeId === b.songThemeId &&
    a.countdown?.endsAt === b.countdown?.endsAt
  );
}

export function downloadSession(snap: CultoSnapshot, filename?: string): void {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename ?? `lumen-culto-${new Date(snap.at).toISOString().slice(0, 16)}.json`;
  a.click();
}

export function parseSessionFile(json: string): CultoSnapshot | null {
  try {
    const snap = JSON.parse(json) as CultoSnapshot;
    if (snap?.v !== 1) return null;
    return snap;
  } catch {
    return null;
  }
}
