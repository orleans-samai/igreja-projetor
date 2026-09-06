/**
 * Live transport (web stand-in for Electron IPC)
 * ----------------------------------------------
 * Operator window publishes a LiveFrame whenever the projector state changes.
 * `/projetor` (audience) and `/palco` (stage) subscribe.
 *
 * Channel: BroadcastChannel("lumen-live")
 * Late joiners read the last snapshot from localStorage ("lumen-live-frame").
 *
 * When wrapping in Electron/Tauri, replace publish/subscribe with ipcMain
 * / BrowserWindow.webContents.send targeting the display that holds each role.
 */

import type { LiveFrame } from "./types";

export const LIVE_CHANNEL = "lumen-live";
export const LIVE_STORAGE_KEY = "lumen-live-frame";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(LIVE_CHANNEL);
    } catch {
      channel = null;
    }
  }
  return channel;
}

export function publishLiveFrame(frame: LiveFrame): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(frame));
  } catch {
    /* quota */
  }
  getChannel()?.postMessage(frame);
}

export function readLiveFrame(): LiveFrame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LiveFrame;
  } catch {
    return null;
  }
}

export function subscribeLiveFrame(onFrame: (frame: LiveFrame) => void): () => void {
  const initial = readLiveFrame();
  if (initial) onFrame(initial);

  const ch = getChannel();
  const onMessage = (ev: MessageEvent<LiveFrame>) => {
    if (ev.data && ev.data.v === 1) onFrame(ev.data);
  };
  ch?.addEventListener("message", onMessage);

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === LIVE_STORAGE_KEY && ev.newValue) {
      try {
        onFrame(JSON.parse(ev.newValue) as LiveFrame);
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    ch?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}

export function openOutputWindow(path: "/projetor" | "/palco" | "/pedido"): Window | null {
  const features = "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no";
  const target = path === "/projetor" ? "/projetor?tela=1" : path;
  return window.open(target, `lumen${path}`, features);
}
