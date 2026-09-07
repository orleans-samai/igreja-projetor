import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/operator/command-palette";
import { Tour } from "@/components/operator/tour";
import { runOptimize } from "@/lib/run-optimize";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getBible } from "@/lib/bible";
import { cn } from "@/lib/cn";
import { runCheckup } from "@/lib/health";
import { openOutputWindow } from "@/lib/live-channel";
import { isStandalone, openProjectorWindow } from "@/lib/windows-desktop";
import {
  publishOps,
  readHeartbeat,
  SESSION_ID,
  subscribeOps,
} from "@/lib/ops-channel";
import { downloadSession, parseSessionFile } from "@/lib/session-snap";
import { computeSongStats, cultoDuration } from "@/lib/stats";
import { applyTemplate, SERVICE_TEMPLATES } from "@/lib/templates";
import { DRILLS, gradeDrill, type Drill } from "@/lib/training";
import { useLumenStore } from "@/store/lumen-store";
import { bindSessionWatch, useOpsStore } from "@/store/ops-store";

export function OpsLayer() {
  const crash = useOpsStore((s) => s.crashOffer);
  const restoreCrash = useOpsStore((s) => s.restoreCrash);
  const dismissCrash = useOpsStore((s) => s.dismissCrash);
  const checkupOpen = useOpsStore((s) => s.checkupOpen);
  const setCheckupOpen = useOpsStore((s) => s.setCheckupOpen);
  const emergencyOpen = useOpsStore((s) => s.emergencyOpen);
  const setEmergencyOpen = useOpsStore((s) => s.setEmergencyOpen);
  const historyOpen = useOpsStore((s) => s.historyOpen);
  const setHistoryOpen = useOpsStore((s) => s.setHistoryOpen);
  const statsOpen = useOpsStore((s) => s.statsOpen);
  const setStatsOpen = useOpsStore((s) => s.setStatsOpen);
  const templatesOpen = useOpsStore((s) => s.templatesOpen);
  const setTemplatesOpen = useOpsStore((s) => s.setTemplatesOpen);
  const trainingOpen = useOpsStore((s) => s.trainingOpen);
  const setTrainingOpen = useOpsStore((s) => s.setTrainingOpen);
  const isPrimary = useOpsStore((s) => s.isPrimary);
  const peerAlive = useOpsStore((s) => s.peerAlive);
  const setPrimary = useOpsStore((s) => s.setPrimary);
  const setPeerAlive = useOpsStore((s) => s.setPeerAlive);
  const pushInbox = useOpsStore((s) => s.pushInbox);
  const liveTitle = useLumenStore((s) => s.live?.title ?? s.preview?.title ?? "");
  const status = useLumenStore((s) => s.status);

  useEffect(() => {
    const unsubHydra = useOpsStore.persist.onFinishHydration(() => {
      useOpsStore.getState().setHydrated();
    });
    void useOpsStore.persist.rehydrate();
    const stopWatch = bindSessionWatch();
    return () => {
      unsubHydra();
      stopWatch();
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      publishOps({
        type: "heartbeat",
        role: useOpsStore.getState().isPrimary ? "primary" : "standby",
        sessionId: SESSION_ID,
        at: Date.now(),
        title: liveTitle,
        status,
      });
      const heart = readHeartbeat();
      if (heart && heart.sessionId !== SESSION_ID && Date.now() - heart.at < 7000) {
        setPeerAlive(true);
      } else {
        setPeerAlive(false);
      }
    };
    const id = window.setInterval(tick, 2000);
    tick();
    const unsub = subscribeOps((msg) => {
      if (msg.type === "request") {
        pushInbox(msg.request);
        toast(`${labelFrom(msg.request.from)}: ${msg.request.text}`, {
          action: {
            label: msg.request.kind === "verse" ? "Projetar" : "Fazer",
            onClick: () => {
              const s = useLumenStore.getState();
              if (msg.request.verse) s.jumpRef(msg.request.verse, true);
              else if (msg.request.kind === "repeat-chorus") s.jumpLabel("coro");
              else if (msg.request.kind === "bridge") s.jumpLabel("ponte");
              else if (msg.request.kind === "next-song") s.nextPlaylistItem();
              else if (msg.request.kind === "black") s.goBlack();
              useOpsStore.getState().resolveInbox(msg.request.id, "done");
            },
          },
        });
      }
      if (msg.type === "heartbeat" && msg.sessionId !== SESSION_ID) {
        setPeerAlive(true);
        if (msg.role === "primary" && useOpsStore.getState().isPrimary && msg.at) {
          /* another cabine is live */
        }
      }
      if (msg.type === "takeover" && msg.sessionId !== SESSION_ID) {
        setPrimary(false);
        toast("Outra cabine assumiu o culto");
      }
    });
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [liveTitle, status, pushInbox, setPeerAlive, setPrimary]);

  return (
    <>
      <CommandPalette />
      <Tour />
      {crash && (
        <div
          role="alertdialog"
          aria-label="Restaurar culto"
          className="animate-pop-in fixed inset-x-0 top-12 z-40 mx-auto w-[min(34rem,calc(100%-1.5rem))] rounded-xl bg-surface p-4 shadow-[var(--shadow-pop),var(--shadow-border)]"
        >
          <h2 className="text-title font-semibold tracking-tight">
            O Lúmen fechou no meio do culto
          </h2>
          <p className="mt-0.5 text-secondary text-muted">
            Isto estava no ar quando parou. Dá para voltar exatamente daqui.
          </p>
          <ul className="mt-3 grid gap-1">
            {[
              crash.label,
              crash.status === "presenting" ? "Projetando" : crash.status,
              crash.countdown ? "Cronômetro ativo" : null,
            ]
              .filter(Boolean)
              .map((line) => (
                <li key={String(line)} className="flex items-center gap-2 text-body text-fg">
                  <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
                  {line}
                </li>
              ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dismissCrash()}>
              Começar do zero
            </Button>
            <Button onClick={() => restoreCrash()}>Voltar para este ponto</Button>
          </div>
        </div>
      )}
      {!isPrimary && (
        <div className="animate-pop-in fixed bottom-16 right-3 z-30 rounded-lg bg-surface px-3 py-2 text-secondary text-muted shadow-[var(--shadow-pop),var(--shadow-border)]">
          Cabine em espera
          <Button
            size="sm"
            className="ml-2"
            onClick={() => {
              setPrimary(true);
              publishOps({ type: "takeover", sessionId: SESSION_ID });
              toast("Esta cabine assumiu o culto");
            }}
          >
            Assumir
          </Button>
        </div>
      )}
      {peerAlive && isPrimary && (
        <p className="sr-only">Backup desta sessão ativo em outra janela</p>
      )}
      <CheckupDialog open={checkupOpen} onOpenChange={setCheckupOpen} />
      <EmergencySheet open={emergencyOpen} onOpenChange={setEmergencyOpen} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <TrainingOverlay open={trainingOpen} onOpenChange={setTrainingOpen} />
    </>
  );
}

function labelFrom(from: string) {
  if (from === "pastor") return "Pastor";
  if (from === "louvor") return "Louvor";
  if (from === "som") return "Som";
  return "Mídia";
}

function CheckupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const songs = useLumenStore((s) => s.songs);
  const playlists = useLumenStore((s) => s.playlists);
  const activePlaylistId = useLumenStore((s) => s.activePlaylistId);
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const settings = useLumenStore((s) => s.settings);
  const bibleVersionId = useLumenStore((s) => s.bibleVersionId);
  const projectorOpen = useOpsStore((s) => s.projectorOpen);
  const palcoOpen = useOpsStore((s) => s.palcoOpen);
  const setWindows = useOpsStore((s) => s.setWindows);

  const report = useMemo(
    () =>
      runCheckup({
        songs,
        playlists,
        activePlaylistId,
        themes,
        songThemeId,
        settings,
        projectorOpen,
        palcoOpen,
        bibleReady: !!getBible(bibleVersionId),
        online: typeof navigator === "undefined" ? true : navigator.onLine,
        appInstalled: isStandalone(),
      }),
    [songs, playlists, activePlaylistId, themes, songThemeId, settings, projectorOpen, palcoOpen, bibleVersionId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Check-up pré-culto">
        <div className="mb-3 flex items-end justify-between">
          <p className="text-display tnum font-semibold tracking-tight">{report.score}</p>
          <p className={cn("text-body", report.ready ? "text-ok" : "text-danger")}>
            {report.ready ? "Pode começar" : "Corrija os itens em vermelho"}
          </p>
        </div>
        <ul className="grid max-h-80 gap-2 overflow-auto">
          {report.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-md bg-elevated px-3 py-2">
              <span
                className={cn(
                  "mt-1 size-2.5 shrink-0 rounded-full",
                  item.level === "ok" && "bg-ok",
                  item.level === "warn" && "bg-primary",
                  item.level === "fail" && "bg-danger",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium">{item.label}</p>
                <p className="text-secondary text-muted">{item.detail}</p>
                {item.fix && <p className="text-secondary text-live">{item.fix}</p>}
              </div>
              {item.action === "optimize" && (
                <Button size="sm" variant="ghost" onClick={() => void runOptimize()}>
                  Otimizar
                </Button>
              )}
              {item.action === "projector" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void openProjectorWindow({
                      secondMonitor: settings.secondMonitor,
                      fullscreen: settings.startFullscreen,
                    }).then((w) => {
                      if (w) setWindows({ projectorOpen: true });
                    });
                  }}
                >
                  Abrir
                </Button>
              )}
              {item.action === "windows" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => useOpsStore.getState().setWindowsSetupOpen(true)}
                >
                  Instalar
                </Button>
              )}
              {item.action === "palco" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const w = openOutputWindow("/palco");
                    if (w) setWindows({ palcoOpen: true });
                  }}
                >
                  Abrir
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function EmergencySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const settings = useLumenStore((s) => s.settings);
  const goBlack = useLumenStore((s) => s.goBlack);
  const goLogo = useLumenStore((s) => s.goLogo);
  const jumpRef = useLumenStore((s) => s.jumpRef);
  const selectSong = useLumenStore((s) => s.selectSong);
  const selectText = useLumenStore((s) => s.selectText);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const logAction = useOpsStore((s) => s.logAction);

  const fire = (label: string, fn: () => void) => {
    fn();
    logAction("Emergência", label);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Emergência">
        <p className="mb-3 text-body text-muted">Um toque. O telão muda agora.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" variant="danger" onClick={() => fire("Tela preta", goBlack)}>
            <AlertTriangle /> Tela preta
          </Button>
          <Button size="lg" variant="secondary" onClick={() => fire("Logo", goLogo)}>
            Logo da igreja
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              fire("Versículo reserva", () => {
                jumpRef(settings.emergencyVerse || "João 14:6", true);
              })
            }
          >
            {settings.emergencyVerse || "João 14:6"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              fire("Música reserva", () => {
                selectSong(settings.emergencySongId || "song-castelo");
                presentPreview();
              })
            }
          >
            Música reserva
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              fire("Boas-vindas", () => {
                selectText("txt-bemvindo");
                presentPreview();
              })
            }
          >
            Tela de boas-vindas
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              fire("Aviso Wi-Fi", () => {
                selectText("txt-wifi");
                presentPreview();
              })
            }
          >
            Aviso padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const history = useOpsStore((s) => s.history);
  const undoCulto = useOpsStore((s) => s.undoCulto);
  const undoStack = useOpsStore((s) => s.undoStack);
  const restoreSession = useLumenStore((s) => s.restoreSession);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Histórico do culto">
        <div className="mb-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const ok = undoCulto();
              toast(ok ? "Estado anterior restaurado" : "Nada para desfazer");
            }}
          >
            Desfazer último passo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const snap = useLumenStore.getState().captureNow(true);
              downloadSession(snap);
            }}
          >
            Baixar sessão
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "application/json";
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const snap = parseSessionFile(await file.text());
                if (!snap) {
                  toast.error("Arquivo inválido");
                  return;
                }
                restoreSession(snap);
                toast("Sessão restaurada neste computador");
              };
              input.click();
            }}
          >
            Restaurar backup
          </Button>
        </div>
        <ul className="max-h-80 overflow-auto text-body">
          {history.length === 0 && <li className="text-muted">O culto ainda não registrou ações.</li>}
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3 border-b border-border/60 py-2">
              <span>
                <span className="text-muted">
                  {new Date(h.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>{" "}
                {h.actor} {h.action}
                {h.detail ? ` · ${h.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {undoStack.length > 2 && (
          <button
            type="button"
            className="mt-3 text-secondary text-muted"
            onClick={() => {
              const snap = undoStack[Math.max(0, undoStack.length - 4)];
              restoreSession(snap);
              toast(`Restaurada versão ${snap.label}`);
            }}
          >
            Restaurar estado de alguns passos atrás
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const logs = useLumenStore((s) => s.logs);
  const songs = useLumenStore((s) => s.songs);
  const stats = useMemo(() => computeSongStats(logs, songs), [logs, songs]);
  const duration = useMemo(() => cultoDuration(logs), [logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Estatísticas">
        <p className="text-body text-muted">Últimos {stats.windowDays} dias · {stats.totalPlays} projeções de música</p>
        {duration.startedAt && (
          <p className="mt-2 text-body">
            Culto de agora: {duration.minutes} min
            {duration.byKind.song ? ` · louvor ${duration.byKind.song} min` : ""}
            {duration.byKind.bible ? ` · palavra ${duration.byKind.bible} min` : ""}
          </p>
        )}
        <ul className="mt-3 grid gap-1 text-body">
          {stats.top.map((t) => (
            <li key={t.refId} className="flex justify-between">
              <span>{t.title}</span>
              <span className="text-muted">{t.count}×</span>
            </li>
          ))}
        </ul>
        {stats.consecutiveWarnings.map((w) => (
          <p key={w} className="mt-2 text-secondary text-live">
            {w}
          </p>
        ))}
        {stats.unused.length > 0 && (
          <p className="mt-3 text-secondary text-muted">
            {stats.unused.length} músicas sem uso recente, entre elas {stats.unused[0]?.title}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const songs = useLumenStore((s) => s.songs);
  const texts = useLumenStore((s) => s.texts);
  const importPlaylist = useLumenStore((s) => s.importPlaylist);
  const setTimelineStart = useOpsStore((s) => s.setTimelineStart);
  const logAction = useOpsStore((s) => s.logAction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Templates de culto">
        <ul className="grid gap-2 sm:grid-cols-2">
          {SERVICE_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                className="w-full rounded-lg bg-elevated p-3 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                onClick={() => {
                  const pl = applyTemplate(tpl, songs, texts);
                  importPlaylist(pl);
                  setTimelineStart(tpl.start);
                  logAction("Aplicou template", tpl.name);
                  toast(`${tpl.name} carregado · começa ${tpl.start}`);
                  onOpenChange(false);
                }}
              >
                <p className="font-medium">{tpl.name}</p>
                <p className="text-secondary text-muted">{tpl.blurb}</p>
                <p className="mt-1 font-mono text-secondary text-subtle">{tpl.start}</p>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function TrainingOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [drill, setDrill] = useState<Drill>(DRILLS[0]);
  const [startedAt, setStartedAt] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [prevIndex, setPrevIndex] = useState(0);
  const status = useLumenStore((s) => s.status);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);

  useEffect(() => {
    if (!open || !startedAt || result) return;
    const grade = gradeDrill(
      drill,
      {
        status,
        liveKind: live?.kind,
        liveRef: live?.refId,
        liveTitle: live?.title,
        liveLabel: live?.slides[liveIndex]?.label,
        liveIndex,
        prevIndex,
      },
      Date.now() - startedAt,
    );
    if (grade.ok) setResult(`${grade.message}. ${drill.hint}`);
  }, [open, startedAt, result, drill, status, live, liveIndex, prevIndex]);

  const start = (d: Drill) => {
    setDrill(d);
    setStartedAt(Date.now());
    setResult(null);
    setPrevIndex(useLumenStore.getState().liveIndex);
    toast(d.prompt);
  };

  if (!open) return null;

  return (
    <div className="animate-pop-in fixed bottom-16 left-3 z-30 w-[min(24rem,calc(100%-1.5rem))] rounded-xl bg-surface p-3 shadow-[var(--shadow-pop),var(--shadow-border)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-body font-medium">Simulador</p>
        <button type="button" className="text-secondary text-muted" onClick={() => onOpenChange(false)}>
          Fechar
        </button>
      </div>
      <p className="text-body">{drill.prompt}</p>
      {result ? (
        <p className="mt-2 text-body text-ok">{result}</p>
      ) : (
        <p className="mt-2 text-secondary text-subtle">{drill.hint}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {DRILLS.map((d) => (
          <Button key={d.id} size="sm" variant={d.id === drill.id ? "default" : "ghost"} onClick={() => start(d)}>
            {d.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
