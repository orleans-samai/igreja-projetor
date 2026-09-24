import type { StorageValue } from "zustand/middleware";
import { toast } from "sonner";

// Zustand calls storage.setItem after every store update. Compare the
// partialized object by its top-level references before serializing it: live
// meters, heartbeats, slide navigation and YouTube progress do not change the
// persisted fields, so they should cost neither JSON.stringify nor IPC/fsync.
const snapshots = new Map<string, StorageValue<unknown>>();

function sameState(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return (
    keys.length === Object.keys(rightRecord).length &&
    keys.every((key) => Object.is(leftRecord[key], rightRecord[key]))
  );
}

function sameSnapshot(
  left: StorageValue<unknown> | undefined,
  right: StorageValue<unknown>,
): boolean {
  return !!left && left.version === right.version && sameState(left.state, right.state);
}

// The web build keeps browser storage. Electron uses serialized, atomic writes
// in userData, independent of Chromium origins and localStorage quotas.
export const durableStorage = {
  async getItem<State>(key: string): Promise<StorageValue<State> | null> {
    const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    const raw = desktop?.isDesktop ? await desktop.storageGet(key) : localStorage.getItem(key);
    if (raw === null) {
      snapshots.delete(key);
      return null;
    }
    const value = JSON.parse(raw) as StorageValue<State>;
    snapshots.set(key, value as StorageValue<unknown>);
    return value;
  },
  async setItem<State>(key: string, value: StorageValue<State>): Promise<void> {
    const snapshot = value as StorageValue<unknown>;
    if (sameSnapshot(snapshots.get(key), snapshot)) return;
    snapshots.set(key, snapshot);
    try {
      const raw = JSON.stringify(value);
      const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
      if (desktop?.isDesktop) await desktop.storageSet(key, raw);
      else localStorage.setItem(key, raw);
    } catch {
      if (snapshots.get(key) === snapshot) snapshots.delete(key);
      toast.error(
        "Não foi possível salvar. Exporte o repertório antes de fechar e verifique o espaço em disco.",
        { id: "storage-error", duration: Infinity },
      );
    }
  },
  async removeItem(key: string): Promise<void> {
    const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    if (desktop?.isDesktop) await desktop.storageSet(key, null);
    else localStorage.removeItem(key);
    snapshots.delete(key);
  },
};
