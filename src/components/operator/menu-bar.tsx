import { GraduationCap, Menu as MenuIcon, Play, Radio, Search, Square } from "lucide-react";
import { type ReactNode } from "react";
import { toast } from "sonner";
import { LumenMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tally } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { fold, nid } from "@/lib/fold";
import { escreverMuf, lerMuf } from "@/lib/muf";
import { openOutputWindow } from "@/lib/live-channel";
import { openProjectorWindow } from "@/lib/windows-desktop";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";
import { useYoutubeStore } from "@/store/youtube-store";
import { exportService, importService } from "@/lib/service-package";

interface Action {
  label: string;
  onSelect: () => void;
  shortcut?: string;
  tone?: "default" | "danger";
}

interface Section {
  label: string;
  items: Action[];
}

export function MenuBar({
  onNewSong,
  onWebLyrics,
  onEditSong,
  onCountdown,
  onHelp,
  onSettings,
  onBible,
  onDisplay,
  onAutoSlide,
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
  onAutoSlide: () => void;
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
  const setLiveMode = useOpsStore((s) => s.setLiveMode);
  const setTourOpen = useOpsStore((s) => s.setTourOpen);
  const reorganizando = useOpsStore((s) => s.reorganizando);
  const youtubeAberto = useYoutubeStore((s) => s.aberto);
  const setYoutubeAberto = useYoutubeStore((s) => s.setAberto);
  const setReorganizando = useOpsStore((s) => s.setReorganizando);
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

  /**
   * Exporta o repertório inteiro num pacote .muf.
   *
   * Só letra, sem mídia: é o que se leva para outra igreja, para o
   * computador novo da cabine, ou para um backup que caiba num e-mail.
   */
  const exportarMuf = async () => {
    const st = useLumenStore.getState();
    if (st.songs.length === 0) {
      toast("O repertório está vazio.");
      return;
    }
    const bytes = await escreverMuf(
      st.songs.map((s) => ({
        titulo: s.title,
        artista: s.artist,
        tom: s.key,
        copyright: s.copyright,
        letra: s.lyricsRaw,
      })),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/gzip" }));
    a.download = `repertorio-lumen-${new Date().toISOString().slice(0, 10)}.muf`;
    a.click();
    toast(`${st.songs.length} músicas exportadas`);
  };

  /**
   * Importa um pacote em lote.
   *
   * Música que já existe com o mesmo título e artista é atualizada, não
   * duplicada: quem importa um hinário duas vezes quer o hinário, não duas
   * cópias dele.
   */
  const importarMuf = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".muf,.mufl,application/gzip,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const lido = await lerMuf(new Uint8Array(await file.arrayBuffer()));
      if (!lido.ok) {
        toast.error(lido.erro);
        return;
      }
      const st = useLumenStore.getState();
      let novas = 0;
      let atualizadas = 0;
      for (const m of lido.musicas) {
        const igual = useLumenStore
          .getState()
          .songs.find(
            (s) => fold(s.title) === fold(m.titulo) && fold(s.artist) === fold(m.artista),
          );
        if (igual) atualizadas += 1;
        else novas += 1;
        st.saveSong({
          id: igual?.id ?? nid(),
          title: m.titulo,
          artist: m.artista,
          groupId: igual?.groupId ?? "g-louvor",
          key: m.tom || (igual?.key ?? ""),
          copyright: m.copyright || (igual?.copyright ?? ""),
          lyricsRaw: m.letra,
          slides: [],
          createdAt: igual?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        });
      }
      toast(
        atualizadas > 0
          ? `${novas} músicas novas, ${atualizadas} atualizadas`
          : `${novas} músicas importadas`,
      );
    };
    input.click();
  };

  const exportRepertoire = () => {
    const blob = new Blob([exportLibrary()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lumen-biblioteca.json";
    a.click();
    toast("Repertório exportado");
  };

  const importRepertoire = () => {
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
  };

  /**
   * Eram dez menus, vários com um item só e muita repetição — "Configurações"
   * aparecia em três lugares. Agora são cinco, agrupados pelo que o operador
   * está tentando fazer. Nenhuma ação foi retirada.
   */
  const sections: Section[] = [
    {
      label: "Arquivo",
      items: [
        { label: "Exportar culto com mídias…", onSelect: () => void exportService() },
        { label: "Importar culto com mídias…", onSelect: () => void importService() },
        { label: "Exportar repertório", onSelect: exportRepertoire },
        { label: "Importar repertório", onSelect: importRepertoire },
        { label: "Exportar repertório em lote (.muf)", onSelect: () => void exportarMuf() },
        { label: "Importar repertório em lote (.muf)", onSelect: importarMuf },
        { label: "Instalar no Windows", onSelect: () => setWindowsSetupOpen(true) },
        { label: "Configurações", onSelect: onSettings },
      ],
    },
    {
      label: "Repertório",
      items: [
        { label: "Nova letra", onSelect: onNewSong },
        {
          label: "Novo aviso",
          onSelect: () => {
            saveText({
              id: `txt-${Date.now()}`,
              title: "Novo aviso",
              body: "",
              updatedAt: Date.now(),
            });
            toast("Aviso criado na aba Texto");
          },
        },
        {
          label: "Nova playlist",
          onSelect: () => {
            const name = window.prompt("Nome da playlist", "Novo culto");
            if (name) savePlaylist(name);
          },
        },
        { label: "Buscar letra na internet", onSelect: onWebLyrics, shortcut: "Ctrl+Shift+F" },
        { label: "Editar selecionada", onSelect: onEditSong },
        { label: "Otimizar apresentação", onSelect: onOptimize, shortcut: "Ctrl+Shift+O" },
        { label: "Abrir Bíblia", onSelect: onBible, shortcut: "Ctrl+B" },
      ],
    },
    {
      label: "Culto",
      items: [
        { label: "Modo operador", onSelect: () => setLiveMode(true), shortcut: "F8" },
        { label: "Check-up pré-culto", onSelect: () => setCheckupOpen(true), shortcut: "Ctrl+Shift+H" },
        { label: "Busca universal", onSelect: () => setCommandOpen(true), shortcut: "Ctrl+K" },
        { label: "Contagem regressiva", onSelect: onCountdown },
        { label: "Templates de culto", onSelect: () => setTemplatesOpen(true) },
        { label: "Histórico e desfazer", onSelect: () => setHistoryOpen(true), shortcut: "Ctrl+Z" },
        { label: "Simulador", onSelect: () => setTrainingOpen(true) },
        { label: "Estatísticas", onSelect: () => setStatsOpen(true) },
        {
          label: "Pedido do pastor",
          onSelect: () => {
            const w = openOutputWindow("/pedido");
            if (!w) toast("Popup bloqueado — abra Pedido do pastor pelo menu do navegador");
          },
        },
        {
          label: "Emergência",
          onSelect: () => setEmergencyOpen(true),
          shortcut: "F9",
          tone: "danger",
        },
      ],
    },
    {
      label: "Tela",
      items: [
        { label: "Abrir projetor", onSelect: openProjector },
        { label: "Abrir palco", onSelect: openStage },
        { label: "Telão nesta janela", onSelect: () => setFillMode("audience") },
        { label: "Configurações de exibição", onSelect: onDisplay },
        { label: "Reconhecimento de canto", onSelect: onAutoSlide },
        { label: "Tema e tipografia", onSelect: onSettings },
        { label: "Próximo tema", onSelect: cycleTheme, shortcut: "Ctrl+T" },
        { label: "Tela preta", onSelect: goBlack, shortcut: "B" },
        { label: "Logo", onSelect: goLogo, shortcut: "L" },
        { label: "Ocultar letra", onSelect: goClear, shortcut: "C" },
      ],
    },
    {
      label: "Ajuda",
      items: [
        { label: "Aprender a usar", onSelect: () => setTourOpen(true) },
        { label: "Atalhos da cabine", onSelect: onHelp, shortcut: "?" },
        { label: "Instalar no Windows", onSelect: () => setWindowsSetupOpen(true) },
      ],
    },
  ];

  const tally =
    status === "presenting"
      ? ("live" as const)
      : status === "black" || status === "clear" || status === "logo"
        ? ("blank" as const)
        : ("off" as const);
  const tallyLabel =
    status === "presenting"
      ? "No ar"
      : status === "black"
        ? "Telão preto"
        : status === "logo"
          ? "Logo"
          : status === "clear"
            ? "Sem letra"
            : "Parado";

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
      <LumenMark className="size-4" />
      <span className="ml-1.5 mr-1 text-body font-semibold tracking-tight">Lúmen</span>

      {/* Desktop: os cinco menus lado a lado. */}
      <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Menu principal">
        {sections.map((section) => (
          <Menu key={section.label}>
            <MenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 text-secondary text-muted",
                  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                  "hover:bg-elevated hover:text-fg",
                  "data-[state=open]:bg-elevated data-[state=open]:text-fg",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                )}
              >
                {section.label}
              </button>
            </MenuTrigger>
            <MenuContent>
              {section.items.map((item) => (
                <MenuItem
                  key={item.label}
                  onSelect={item.onSelect}
                  shortcut={item.shortcut}
                  tone={item.tone}
                >
                  {item.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ))}

        {/* Não é um menu, é um modo — e por isso mostra que está ligado. */}
        <button
          type="button"
          aria-pressed={reorganizando}
          onClick={() => setReorganizando(!reorganizando)}
          className={cn(
            "rounded-md px-2 py-1 text-secondary",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            reorganizando
              ? "bg-accent/20 text-accent"
              : "text-muted hover:bg-elevated hover:text-fg",
          )}
        >
          Reorganizar
        </button>

        <button
          type="button"
          aria-pressed={youtubeAberto}
          onClick={() => setYoutubeAberto(!youtubeAberto)}
          className={cn(
            "rounded-md px-2 py-1 text-secondary",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            youtubeAberto
              ? "bg-danger/20 text-danger"
              : "text-muted hover:bg-elevated hover:text-fg",
          )}
        >
          YouTube
        </button>
      </nav>

      {/* Celular: tudo num menu só. Antes, nada disto existia abaixo de 640px. */}
      <Menu>
        <MenuTrigger asChild>
          <Button size="iconSm" variant="ghost" className="sm:hidden" aria-label="Menu">
            <MenuIcon />
          </Button>
        </MenuTrigger>
        <MenuContent>
          {sections.map((section, i) => (
            <Section key={section.label} first={i === 0} label={section.label}>
              {section.items.map((item) => (
                <MenuItem
                  key={item.label}
                  onSelect={item.onSelect}
                  shortcut={item.shortcut}
                  tone={item.tone}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Section>
          ))}
        </MenuContent>
      </Menu>

      <p className="mx-auto hidden min-w-0 truncate px-2 text-secondary text-subtle md:block">
        {church}
      </p>

      <div className="ml-auto flex items-center gap-1">
        <span data-tour="tally" className="mr-1 hidden md:inline-flex">
          <Tally state={tally} label={tallyLabel} />
        </span>

        {pending > 0 && (
          <span
            className="tnum animate-pop-in rounded-sm bg-accent px-1.5 py-0.5 text-caption font-semibold text-accent-fg"
            title={`${pending} pedido(s) do palco`}
          >
            {pending}
          </span>
        )}

        <Hint label="Busca universal" keys="Ctrl+K">
          <Button size="iconSm" variant="ghost" aria-label="Busca universal" onClick={() => setCommandOpen(true)}>
            <Search />
          </Button>
        </Hint>

        <Hint label="Apresentar o preview" keys="F5">
          <Button
            size="iconSm"
            variant={status === "presenting" ? "live" : "ghost"}
            aria-label="Apresentar"
            onClick={presentPreview}
          >
            <Play />
          </Button>
        </Hint>

        <Hint label="Parar de apresentar" keys="Esc">
          <Button size="iconSm" variant="ghost" aria-label="Parar" onClick={stop}>
            <Square />
          </Button>
        </Hint>

        <Hint label="Tutorial guiado da cabine, para quem está começando">
          <Button size="sm" variant="secondary" onClick={() => setTourOpen(true)}>
            <GraduationCap />
            <span className="hidden sm:inline">Aprender a usar</span>
          </Button>
        </Hint>

        <Button size="sm" variant="secondary" onClick={() => setLiveMode(true)}>
          <Radio />
          <span className="hidden md:inline">Modo operador</span>
        </Button>
      </div>
    </header>
  );
}

function Section({
  label,
  first,
  children,
}: {
  label: string;
  first: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {!first && <MenuSeparator />}
      <MenuLabel>{label}</MenuLabel>
      {children}
    </>
  );
}
