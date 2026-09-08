import { createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";

// The web build keeps browser storage. Electron uses serialized, atomic writes
// in userData, independent of Chromium origins and localStorage quotas.
export const durableStorage = createJSONStorage(() => ({
  async getItem(key: string) {
    const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    if (desktop?.isDesktop) return desktop.storageGet(key);
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    try {
      const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
      if (desktop?.isDesktop) await desktop.storageSet(key, value);
      else localStorage.setItem(key, value);
    } catch {
      toast.error("Não foi possível salvar. Exporte o repertório antes de fechar e verifique o espaço em disco.", { id: "storage-error", duration: Infinity });
    }
  },
  async removeItem(key: string) {
    const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    if (desktop?.isDesktop) await desktop.storageSet(key, null);
    else localStorage.removeItem(key);
  },
}));
