import { Check, Download, Monitor, Power, Tv, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  applyWakeLock,
  canPromptInstall,
  captureInstallPrompt,
  isStandalone,
  isWindows,
  listScreens,
  openOnScreen,
  openProjectorWindow,
  pickExternalScreen,
  promptInstall,
  recommendedBrowser,
  windowsInstallSteps,
  type OutputScreen,
} from "@/lib/windows-desktop";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

export function WindowsRuntime() {
  const status = useLumenStore((s) => s.status);
  const wakeLock = useLumenStore((s) => s.settings.wakeLock);

  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (!wakeLock) {
      void applyWakeLock(false);
      return;
    }
    if (status === "idle") {
      void applyWakeLock(false);
      return;
    }
    void applyWakeLock(true);
    const onVis = () => {
      if (document.visibilityState === "visible" && useLumenStore.getState().status !== "idle") {
        void applyWakeLock(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void applyWakeLock(false);
    };
  }, [status, wakeLock]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (useLumenStore.getState().status === "idle") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  return (
    <>
      <WindowsBanner />
      <WindowsSetupDialog />
    </>
  );
}

function WindowsBanner() {
  const seen = useOpsStore((s) => s.windowsSetupSeen);
  const open = useOpsStore((s) => s.windowsSetupOpen);
  const setOpen = useOpsStore((s) => s.setWindowsSetupOpen);
  const dismiss = useOpsStore((s) => s.dismissWindowsSetup);
  const liveMode = useOpsStore((s) => s.liveMode);
  if (seen || open || isStandalone() || liveMode) return null;
  return (
    // Faixa fina, não anúncio: uma linha, um verbo e um X. Antes ocupava uma
    // fileira inteira do console com dois botões, um deles em destaque cheio.
    <div className="flex items-center gap-2 border-b border-border bg-elevated px-3 py-1">
      <Download className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-secondary text-muted">
        No PC da cabine o Lúmen abre pelo Menu Iniciar, acha o segundo monitor e impede a
        hibernação.
      </p>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Instalar no Windows
      </Button>
      <Button size="iconSm" variant="ghost" aria-label="Dispensar" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}

export function WindowsSetupDialog() {
  const open = useOpsStore((s) => s.windowsSetupOpen);
  const setOpen = useOpsStore((s) => s.setWindowsSetupOpen);
  const dismiss = useOpsStore((s) => s.dismissWindowsSetup);
  const settings = useLumenStore((s) => s.settings);
  const update = useLumenStore((s) => s.updateSettings);
  const setWindows = useOpsStore((s) => s.setWindows);
  const [screens, setScreens] = useState<OutputScreen[]>([]);
  const [busy, setBusy] = useState(false);
  const standalone = isStandalone();
  const win = isWindows();
  const browser = recommendedBrowser();
  const steps = windowsInstallSteps(browser);
  const extra = pickExternalScreen(screens);

  useEffect(() => {
    if (!open) return;
    void listScreens().then(setScreens);
  }, [open]);

  const install = async () => {
    setBusy(true);
    const result = await promptInstall();
    setBusy(false);
    if (result === "accepted") {
      toast("Lúmen instalado neste Windows");
      dismiss();
      return;
    }
    if (result === "unavailable") {
      toast("Use o menu do Edge ou Chrome: Instalar este site como um aplicativo");
    }
  };

  const sendProjector = async () => {
    const w = await openProjectorWindow({
      secondMonitor: settings.secondMonitor,
      fullscreen: settings.startFullscreen,
    });
    if (w) {
      setWindows({ projectorOpen: true });
      toast(extra ? "Telão no segundo monitor" : "Telão aberto — arraste para o projetor");
    } else {
      toast.error("O Windows bloqueou a janela. Permita pop-ups para este site.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Instalar no Windows" className="max-h-[min(40rem,90dvh)] overflow-y-auto">
        <p className="mb-4 text-body text-muted">
          {win
            ? "Este PC é Windows. Rode o Lúmen-Setup.exe — atalho na área de trabalho e no Menu Iniciar, telão no segundo monitor."
            : "No PC da igreja, rode o instalador Lúmen-Setup.exe. Ele cria o atalho, abre a cabine e manda o telão para o segundo monitor."}
        </p>

        <ol className="grid gap-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-secondary text-fg">
                {i + 1}
              </span>
              <div>
                <p className="text-body font-medium text-fg">{step.title}</p>
                <p className="text-secondary text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-2 rounded-lg bg-elevated p-3">
          <p className="text-secondary font-medium text-subtle">Este computador</p>
          <Row ok={standalone} label={standalone ? "Já está instalado como aplicativo" : "Ainda no navegador"}>
            <Download className="size-4" />
          </Row>
          <Row ok={screens.length > 1} label={extra ? `Segundo monitor: ${extra.label}` : "Um monitor detectado — conecte o projetor e use Windows + P → Estender"}>
            <Tv className="size-4" />
          </Row>
          <Row ok={settings.wakeLock} label="Impedir que a tela durma durante o culto">
            <Power className="size-4" />
          </Row>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={settings.secondMonitor !== false}
              onChange={(e) => update({ secondMonitor: e.target.checked })}
            />
            Abrir o projetor no segundo monitor
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={settings.startFullscreen !== false}
              onChange={(e) => update({ startFullscreen: e.target.checked })}
            />
            Telão em tela cheia (duplo clique também ativa)
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={settings.wakeLock !== false}
              onChange={(e) => update({ wakeLock: e.target.checked })}
            />
            Manter o PC acordado enquanto o culto está no ar
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void install()} disabled={busy || standalone}>
            {standalone ? "Já instalado" : canPromptInstall() ? "Instalar Lúmen" : "Como instalar"}
          </Button>
          <Button variant="secondary" onClick={() => void sendProjector()}>
            <Monitor className="size-4" /> Abrir projetor
          </Button>
          <Button variant="ghost" onClick={() => openOnScreen("/palco")}>
            Palco
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  ok,
  label,
  children,
}: {
  ok: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-body">
      <span className={cn("mt-0.5", ok ? "text-ok" : "text-muted")}>{ok ? <Check className="size-4" /> : children}</span>
      <span className={ok ? "text-fg" : "text-muted"}>{label}</span>
    </div>
  );
}
