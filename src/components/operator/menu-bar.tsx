import {
  Download,
  HelpCircle,
  Monitor,
  Play,
  Radio,
  Search,
  Settings2,
  Square,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { LumenMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { openOutputWindow } from "@/lib/live-channel";
import { openProjectorWindow } from "@/lib/windows-desktop";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

export function MenuBar({
  onNewSong,
  onWebLyrics,
  onEditSong,
  onCountdown,
  onHelp,
  onSettings,
  onBible,
  onDisplay,
  onOptimize,
}: {
  onNewSong: () => void;
  onWebLyrics: () => void;
  onEditSong: () => void;
  onCountdown: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onBible: () => void;
  onDisplay: () => void;
  onOptimize: () => void;
}) {
  const church = useLumenStore((s) => s.settings.churchName);
  const status = useLumenStore((s) => s.status);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const stop = useLumenStore((s) => s.stop);
  const setFillMode = useLumenStore((s) => s.setFillMode);
  const goBlack = useLumenStore((s) => s.goBlack);
  const goLogo = useLumenStore((s) => s.goLogo);
  const goClear = useLumenStore((s) => s.goClear);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const saveText = useLumenStore((s) => s.saveText);
  const savePlaylist = useLumenStore((s) => s.savePlaylist);
  const exportLibrary = useLumenStore((s) => s.exportLibrary);
  const importLibrary = useLumenStore((s) => s.importLibrary);
  const live = status !== "idle";
  const setLiveMode = useOpsStore((s) => s.setLiveMode);
  const setCommandOpen = useOpsStore((s) => s.setCommandOpen);
  const setCheckupOpen = useOpsStore((s) => s.setCheckupOpen);
  const setEmergencyOpen = useOpsStore((s) => s.setEmergencyOpen);
  const setHistoryOpen = useOpsStore((s) => s.setHistoryOpen);
  const setStatsOpen = useOpsStore((s) => s.setStatsOpen);
  const setTemplatesOpen = useOpsStore((s) => s.setTemplatesOpen);
  const setTrainingOpen = useOpsStore((s) => s.setTrainingOpen);
  const setWindows = useOpsStore((s) => s.setWindows);
  const setWindowsSetupOpen = useOpsStore((s) => s.setWindowsSetupOpen);
  const secondMonitor = useLumenStore((s) => s.settings.secondMonitor);
  const startFullscreen = useLumenStore((s) => s.settings.startFullscreen);
  const pending = useOpsStore((s) => s.inbox.filter((r) => r.status === "pending").length);

  const openProjector = () => {
    void openProjectorWindow({ secondMonitor, fullscreen: startFullscreen }).then((w) => {
      if (w) setWindows({ projectorOpen: true });
      if (!w) {
        setFillMode("audience");
        toast("Popup bloqueado — telão nesta janela");
      }
    });
  };

  const openStage = () => {
    const w = openOutputWindow("/palco");
    if (w) setWindows({ palcoOpen: true });
    if (!w) setFillMode("stage");
  };

  const cycleTheme = () => {
    const ids = themes.map((t) => t.id);
    const next = ids[(ids.indexOf(songThemeId) + 1) % ids.length];
    if (next) applyThemeLive(next);
  };

  return (
    <header className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-surface px-2">
      <LumenMark className="size-5" />
      <span className="ml-1.5 mr-2 font-display text-sm font-semibold tracking-tight">Lúmen</span>

      <Menu label="Arquivo">
        <MenuItem
          onSelect={() => {
            const blob = new Blob([exportLibrary()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "lumen-biblioteca.json";
            a.click();
          }}
        >
          Exportar repertório
        </MenuItem>
        <MenuItem
          onSelect={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              importLibrary(await file.text());
              toast("Repertório importado");
            };
            input.click();
          }}
        >
          Importar repertório
        </MenuItem>
        <MenuItem onSelect={() => setWindowsSetupOpen(true)}>Instalar no Windows</MenuItem>
        <MenuItem onSelect={onSettings}>Configurações</MenuItem>
      </Menu>
      <Menu label="Novo">
        <MenuItem onSelect={onNewSong}>Nova letra</MenuItem>
        <MenuItem
          onSelect={() => {
            saveText({
              id: `txt-${Date.now()}`,
              title: "Novo aviso",
              body: "",
              updatedAt: Date.now(),
            });
            toast("Aviso criado na aba Texto");
          }}
        >
          Novo aviso
        </MenuItem>
        <MenuItem
          onSelect={() => {
            const name = window.prompt("Nome da playlist", "Novo culto");
            if (name) savePlaylist(name);
          }}
        >
          Nova playlist
        </MenuItem>
      </Menu>
      <Menu label="Editar">
        <MenuItem onSelect={onEditSong}>Editar música selecionada</MenuItem>
        <MenuItem onSelect={onOptimize}>Otimizar apresentação</MenuItem>
        <MenuItem onSelect={onSettings}>Tema e tipografia</MenuItem>
      </Menu>
      <Menu label="Música">
        <MenuItem onSelect={onNewSong}>Nova letra</MenuItem>
        <MenuItem onSelect={onWebLyrics}>Buscar na internet</MenuItem>
        <MenuItem onSelect={onEditSong}>Editar selecionada</MenuItem>
      </Menu>
      <Menu label="Tema">
        <MenuItem onSelect={cycleTheme}>Próximo tema</MenuItem>
        <MenuItem onSelect={onSettings}>Ajustar tema ativo</MenuItem>
      </Menu>
      <Menu label="Culto">
        <MenuItem onSelect={() => setLiveMode(true)}>Modo operador</MenuItem>
        <MenuItem onSelect={() => setCheckupOpen(true)}>Check-up pré-culto</MenuItem>
        <MenuItem onSelect={() => setCommandOpen(true)}>Busca universal</MenuItem>
        <MenuItem onSelect={() => setEmergencyOpen(true)}>Emergência</MenuItem>
        <MenuItem onSelect={() => setTemplatesOpen(true)}>Templates</MenuItem>
        <MenuItem onSelect={() => setHistoryOpen(true)}>Histórico / desfazer</MenuItem>
        <MenuItem onSelect={() => setTrainingOpen(true)}>Simulador</MenuItem>
        <MenuItem onSelect={() => setStatsOpen(true)}>Estatísticas</MenuItem>
        <MenuItem
          onSelect={() => {
            const w = openOutputWindow("/pedido");
            if (!w) toast("Popup bloqueado — abra Pedido do pastor pelo menu do navegador");
          }}
        >
          Pedido do pastor
        </MenuItem>
      </Menu>
      <Menu label="Anúncios">
        <MenuItem onSelect={onCountdown}>Contagem regressiva</MenuItem>
      </Menu>
      <Menu label="Tela">
        <MenuItem onSelect={openProjector}>Abrir projetor</MenuItem>
        <MenuItem onSelect={openStage}>Abrir palco</MenuItem>
        <MenuItem onSelect={() => setFillMode("audience")}>Telão nesta janela</MenuItem>
        <MenuItem onSelect={() => setWindowsSetupOpen(true)}>Instalar no Windows</MenuItem>
        <MenuItem onSelect={onDisplay}>Configurações de exibição</MenuItem>
        <MenuItem onSelect={goBlack}>Tela preta</MenuItem>
        <MenuItem onSelect={goLogo}>Logo</MenuItem>
        <MenuItem onSelect={goClear}>Ocultar texto</MenuItem>
      </Menu>
      <Menu label="Janelas">
        <MenuItem onSelect={onBible}>Bíblia</MenuItem>
        <MenuItem onSelect={onSettings}>Configurações</MenuItem>
        <MenuItem onSelect={onHelp}>Atalhos</MenuItem>
      </Menu>
      <Menu label="Ajuda">
        <MenuItem onSelect={onHelp}>Atalhos da cabine</MenuItem>
        <MenuItem onSelect={() => setWindowsSetupOpen(true)}>Instalar no Windows</MenuItem>
      </Menu>

      <p className="mx-auto hidden truncate text-xs text-muted md:block">{church}</p>
      <div className="ml-auto flex items-center gap-0.5">
        {pending > 0 && (
          <span className="mr-1 rounded-full bg-live px-2 py-0.5 text-xs text-accent-fg">{pending}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={() => setWindowsSetupOpen(true)}
        >
          <Download className="size-3.5" />
          Instalar
        </Button>
        <Button size="sm" variant="live" onClick={() => setLiveMode(true)}>
          <Radio className="size-3.5" />
          <span className="hidden sm:inline">Modo operador</span>
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Busca universal" onClick={() => setCommandOpen(true)}>
          <Search className="size-3.5" />
        </Button>
        <Button
          size="iconSm"
          variant={live ? "live" : "ghost"}
          aria-label="Apresentar"
          onClick={presentPreview}
        >
          <Play className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Parar" onClick={stop}>
          <Square className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Countdown" onClick={onCountdown}>
          <Timer className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Atalhos" onClick={onHelp}>
          <HelpCircle className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Configurações" onClick={onSettings}>
          <Settings2 className="size-3.5" />
        </Button>
        <Button size="iconSm" variant="ghost" aria-label="Projetor" onClick={openProjector}>
          <Monitor className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-md px-2 py-1 text-sm text-muted transition-colors duration-[var(--motion-quick)] hover:bg-elevated hover:text-fg",
          open && "bg-elevated text-fg",
        )}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1 min-w-48 origin-top-left rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)]"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onSelect, children }: { onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-left text-sm text-fg hover:bg-primary/10"
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
