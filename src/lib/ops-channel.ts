/**
 * Operator comms + failover heartbeat (same-origin tabs).
 * Stand-in for cloud collab / multi-PC: BroadcastChannel + localStorage.
 */

import { nid } from "./fold.ts";
import type { RequestFrom, RequestKind, StageRequest } from "./types.ts";

export const OPS_CHANNEL = "lumen-ops";
export const OPS_INBOX_KEY = "lumen-ops-inbox";
export const OPS_HEART_KEY = "lumen-ops-heart";

export type OpsMessage =
  | { type: "heartbeat"; role: "primary" | "standby"; sessionId: string; at: number; title: string; status: string }
  | { type: "request"; request: StageRequest }
  | { type: "ack"; id: string; status: "done" | "dismissed" }
  | { type: "takeover"; sessionId: string }
  | { type: "chat"; from: RequestFrom; text: string; at: number };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(OPS_CHANNEL);
    } catch {
      channel = null;
    }
  }
  return channel;
}

export function publishOps(msg: OpsMessage): void {
  if (typeof window === "undefined") return;
  if (msg.type === "request") {
    try {
      const prev = readInbox();
      const next = [msg.request, ...prev.filter((r) => r.id !== msg.request.id)].slice(0, 40);
      localStorage.setItem(OPS_INBOX_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }
  if (msg.type === "heartbeat" && msg.role === "primary") {
    try {
      localStorage.setItem(OPS_HEART_KEY, JSON.stringify(msg));
    } catch {
      /* quota */
    }
  }
  getChannel()?.postMessage(msg);
}

export function readInbox(): StageRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPS_INBOX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StageRequest[];
  } catch {
    return [];
  }
}

export function writeInbox(list: StageRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OPS_INBOX_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* quota */
  }
}

export function readHeartbeat(): Extract<OpsMessage, { type: "heartbeat" }> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OPS_HEART_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Extract<OpsMessage, { type: "heartbeat" }>;
  } catch {
    return null;
  }
}

export function subscribeOps(onMsg: (msg: OpsMessage) => void): () => void {
  const ch = getChannel();
  const onMessage = (ev: MessageEvent<OpsMessage>) => {
    if (ev.data && typeof ev.data === "object" && "type" in ev.data) onMsg(ev.data);
  };
  ch?.addEventListener("message", onMessage);

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === OPS_INBOX_KEY && ev.newValue) {
      try {
        const list = JSON.parse(ev.newValue) as StageRequest[];
        const newest = list[0];
        if (newest) onMsg({ type: "request", request: newest });
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

export function makeRequest(
  from: RequestFrom,
  kind: RequestKind,
  text: string,
  verse?: string,
): StageRequest {
  return {
    id: nid(),
    from,
    kind,
    text,
    verse,
    at: Date.now(),
    status: "pending",
  };
}

export const SESSION_ID: string =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess-${Date.now()}`;
