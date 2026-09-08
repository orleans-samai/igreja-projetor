import { create } from "zustand";
import { persist } from "zustand/middleware";
import { durableStorage } from "@/lib/durable-storage";
import { nid } from "@/lib/fold";
import { ORDEM_PADRAO, ordemValida, type PainelId } from "@/lib/paineis";
import {
  publishOps,
  readInbox,
  writeInbox,
  SESSION_ID,
} from "@/lib/ops-channel";
import {
  crashOffer,
  snapshotEquals,
  writeSession,
} from "@/lib/session-snap";
import type { CultoSnapshot, HistoryEntry, StageRequest } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

const UNDO_CAP = 40;
/** Quatro tamanhos de cartão na grade de letras: P, M, G, GG. */
export const GRID_ZOOM_MAX = 3;
const HISTORY_CAP = 120;

interface OpsState {
  liveMode: boolean;
  commandOpen: boolean;
  checkupOpen: boolean;
  historyOpen: boolean;
  emergencyOpen: boolean;
  statsOpen: boolean;
  templatesOpen: boolean;
  trainingOpen: boolean;
  tourOpen: boolean;
  /** Guardado para não oferecer o tutorial de novo a quem já o viu. */
  tourSeen: boolean;
  /** Aba que o tutorial precisa ver aberta na cabine estreita. */
  tourTab: "lib" | "preview" | "culto" | null;
  /** Grade de letras: tamanho dos cartões (0 a 3) e se a faixa está aberta. */
  gridZoom: number;
  gridOpen: boolean;
  /** Slide que está sendo editado, venha o comando da grade ou do preview. */
  slideEditId: string | null;
  /** Ordem das colunas da cabine, escolhida pelo operador. */
  ordemPaineis: PainelId[];
  /** Modo de arrastar painel para trocar de lugar. */
  reorganizando: boolean;
  voiceOn: boolean;
  autoRun: boolean;
  timelineStart: string;
  cultoStartedAt: number | null;
  lastManualAt: number;
  actorName: string;
  inbox: StageRequest[];
  history: HistoryEntry[];
  undoStack: CultoSnapshot[];
  crashOffer: CultoSnapshot | null;
  isPrimary: boolean;
  peerAlive: boolean;
  sessionId: string;
  projectorOpen: boolean;
  palcoOpen: boolean;
  hydrated: boolean;
  windowsSetupOpen: boolean;
  windowsSetupSeen: boolean;

  setLiveMode: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  setCheckupOpen: (v: boolean) => void;
  setHistoryOpen: (v: boolean) => void;
  setEmergencyOpen: (v: boolean) => void;
  setStatsOpen: (v: boolean) => void;
  setTemplatesOpen: (v: boolean) => void;
  setTrainingOpen: (v: boolean) => void;
  setTourOpen: (v: boolean) => void;
  markTourSeen: () => void;
  setTourTab: (v: "lib" | "preview" | "culto" | null) => void;
  setGridZoom: (v: number) => void;
  bumpGridZoom: (delta: number) => void;
  setGridOpen: (v: boolean) => void;
  setSlideEditId: (v: string | null) => void;
  setOrdemPaineis: (v: PainelId[]) => void;
  setReorganizando: (v: boolean) => void;
  setVoiceOn: (v: boolean) => void;
  setAutoRun: (v: boolean) => void;
  setTimelineStart: (v: string) => void;
  markCultoStart: () => void;
  markManual: () => void;
  setWindows: (patch: { projectorOpen?: boolean; palcoOpen?: boolean }) => void;
  setPeerAlive: (v: boolean) => void;
  setPrimary: (v: boolean) => void;
  pushInbox: (req: StageRequest) => void;
  resolveInbox: (id: string, status: "done" | "dismissed") => void;
  logAction: (action: string, detail?: string) => void;
  pushUndo: (snap: CultoSnapshot) => void;
  undoCulto: () => boolean;
  setCrashOffer: (snap: CultoSnapshot | null) => void;
  dismissCrash: () => void;
  restoreCrash: () => boolean;
  setHydrated: () => void;
  setWindowsSetupOpen: (v: boolean) => void;
  dismissWindowsSetup: () => void;
}

export const useOpsStore = create<OpsState>()(
  persist(
    (set, get) => ({
      liveMode: false,
      commandOpen: false,
      checkupOpen: false,
      historyOpen: false,
      emergencyOpen: false,
      statsOpen: false,
      templatesOpen: false,
      trainingOpen: false,
      tourOpen: false,
      tourSeen: false,
      tourTab: null,
      gridZoom: 1,
      gridOpen: true,
      slideEditId: null,
      ordemPaineis: [...ORDEM_PADRAO],
      reorganizando: false,
      voiceOn: false,
      autoRun: false,
      timelineStart: "19:00",
      cultoStartedAt: null,
      lastManualAt: 0,
      actorName: "Operador",
      inbox: [],
      history: [],
      undoStack: [],
      crashOffer: null,
      isPrimary: true,
      peerAlive: false,
      sessionId: SESSION_ID,
      projectorOpen: false,
      palcoOpen: false,
      hydrated: false,
      windowsSetupOpen: false,
      windowsSetupSeen: false,

      setLiveMode: (liveMode) => {
        set({ liveMode });
        if (liveMode && !get().cultoStartedAt) set({ cultoStartedAt: Date.now() });
        get().logAction(liveMode ? "Entrou no modo operador" : "Voltou à cabine");
      },
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setCheckupOpen: (checkupOpen) => set({ checkupOpen }),
      setHistoryOpen: (historyOpen) => set({ historyOpen }),
      setEmergencyOpen: (emergencyOpen) => set({ emergencyOpen }),
      setStatsOpen: (statsOpen) => set({ statsOpen }),
      setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
      setTrainingOpen: (trainingOpen) => set({ trainingOpen }),
      setTourOpen: (tourOpen) => set({ tourOpen }),
      markTourSeen: () => set({ tourSeen: true }),
      setTourTab: (tourTab) => set({ tourTab }),
      setGridZoom: (v) => set({ gridZoom: Math.max(0, Math.min(GRID_ZOOM_MAX, v)) }),
      // Dois cliques rápidos no mesmo quadro liam o mesmo valor e valiam por
      // um só; o passo é calculado aqui, sobre o valor vivo.
      bumpGridZoom: (delta) => get().setGridZoom(get().gridZoom + delta),
      setGridOpen: (gridOpen) => set({ gridOpen }),
      setSlideEditId: (slideEditId) => set({ slideEditId }),
      // Sempre pelo saneador: o que entra aqui vai para o disco e volta numa
      // sessão futura, talvez de outra versão do app.
      setOrdemPaineis: (v) => set({ ordemPaineis: ordemValida(v) }),
      setReorganizando: (reorganizando) => set({ reorganizando }),
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      setAutoRun: (autoRun) => {
        set({ autoRun });
        get().logAction(autoRun ? "Culto autônomo ligado" : "Culto autônomo pausado");
      },
      setTimelineStart: (timelineStart) => set({ timelineStart }),
      markCultoStart: () => set({ cultoStartedAt: Date.now() }),
      markManual: () => set({ lastManualAt: Date.now() }),
      setWindows: (patch) => set(patch),
      setPeerAlive: (peerAlive) => set({ peerAlive }),
      setPrimary: (isPrimary) => set({ isPrimary }),

      pushInbox: (req) => {
        set((s) => {
          const inbox = [req, ...s.inbox.filter((r) => r.id !== req.id)].slice(0, 40);
          writeInbox(inbox);
          return { inbox };
        });
      },

      resolveInbox: (id, status) => {
        set((s) => {
          const inbox = s.inbox.map((r) => (r.id === id ? { ...r, status } : r));
          writeInbox(inbox);
          return { inbox };
        });
        publishOps({ type: "ack", id, status });
      },

      logAction: (action, detail) => {
        const entry: HistoryEntry = {
          id: nid(),
          at: Date.now(),
          actor: get().actorName,
          action,
          detail,
        };
        set((s) => ({ history: [entry, ...s.history].slice(0, HISTORY_CAP) }));
      },

      pushUndo: (snap) => {
        const stack = get().undoStack;
        const last = stack[stack.length - 1];
        if (last && snapshotEquals(last, snap)) return;
        set({ undoStack: [...stack, snap].slice(-UNDO_CAP) });
        writeSession(snap);
      },

      undoCulto: () => {
        const stack = get().undoStack;
        if (stack.length < 2) return false;
        const prev = stack[stack.length - 2];
        set({ undoStack: stack.slice(0, -1) });
        useLumenStore.getState().restoreSession(prev);
        get().logAction("Desfez o culto", prev.label);
        return true;
      },

      setCrashOffer: (crashOffer) => set({ crashOffer }),
      dismissCrash: () => {
        const snap = get().crashOffer;
        if (snap) writeSession({ ...snap, dirty: false });
        set({ crashOffer: null });
      },
      restoreCrash: () => {
        const snap = get().crashOffer;
        if (!snap) return false;
        useLumenStore.getState().restoreSession(snap);
        set({ crashOffer: null, liveMode: true });
        get().logAction("Restaurou o culto após falha", snap.label);
        return true;
      },
      setHydrated: () => set({ hydrated: true }),
      setWindowsSetupOpen: (windowsSetupOpen) => set({ windowsSetupOpen }),
      dismissWindowsSetup: () => set({ windowsSetupSeen: true, windowsSetupOpen: false }),
    }),
    {
      name: "lumen-ops-v1",
      skipHydration: true,
      storage: durableStorage,
      partialize: (s) => ({
        timelineStart: s.timelineStart,
        actorName: s.actorName,
        history: s.history.slice(0, 80),
        inbox: s.inbox.filter((r) => r.status === "pending").slice(0, 20),
        autoRun: s.autoRun,
        windowsSetupSeen: s.windowsSetupSeen,
        tourSeen: s.tourSeen,
        gridZoom: s.gridZoom,
        gridOpen: s.gridOpen,
        ordemPaineis: s.ordemPaineis,
      }),
    },
  ),
);

let watchBound = false;

export function bindSessionWatch(): () => void {
  if (watchBound) return () => undefined;
  watchBound = true;

  const offer = crashOffer();
  if (offer) useOpsStore.getState().setCrashOffer(offer);

  try {
    useOpsStore.getState().pushUndo(useLumenStore.getState().captureNow(false));
  } catch {
    /* store still empty */
  }

  const existing = readInbox();
  if (existing.length) {
    const pending = existing.filter((r) => r.status === "pending");
    if (pending.length) {
      useOpsStore.setState({ inbox: pending });
    }
  }

  const unsub = useLumenStore.subscribe((s, prev) => {
    if (
      s.status === prev.status &&
      s.liveIndex === prev.liveIndex &&
      s.previewIndex === prev.previewIndex &&
      s.live === prev.live &&
      s.preview === prev.preview &&
      s.activePlaylistId === prev.activePlaylistId &&
      s.countdown === prev.countdown &&
      s.songThemeId === prev.songThemeId
    ) {
      return;
    }
    const snap = s.captureNow(s.status !== "idle");
    useOpsStore.getState().pushUndo(snap);
  });

  const onUnload = () => {
    const snap = useLumenStore.getState().captureNow(true);
    writeSession(snap);
  };
  window.addEventListener("beforeunload", onUnload);

  return () => {
    unsub();
    window.removeEventListener("beforeunload", onUnload);
    watchBound = false;
  };
}
