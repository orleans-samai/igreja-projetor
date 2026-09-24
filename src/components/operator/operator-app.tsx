import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useMemo, useRef, useState } from "react";
import { ControlBar } from "@/components/operator/control-bar";
import {
  CountdownDialog,
  DisplayDialog,
  HelpDialog,
  SettingsDialog,
  SongEditorDialog,
} from "@/components/operator/dialogs";
import { LyricsSearchDialog } from "@/components/operator/lyrics-search-dialog";
import { LibraryPanel } from "@/components/operator/library-panel";
import { LiveMode } from "@/components/operator/live-mode";
import { MenuBar } from "@/components/operator/menu-bar";
import { PlaylistPanel } from "@/components/operator/playlist-panel";
import { PreviewPanel } from "@/components/operator/preview-panel";
import { SlideGrid } from "@/components/operator/slide-grid";
import { ThemeRail } from "@/components/operator/theme-rail";
import { BibleWorkspace } from "@/components/operator/bible-workspace";
import { OpsLayer } from "@/components/operator/ops-layer";
import { AutoSlideDialog, AutoSlidePanel } from "@/components/operator/auto-slide";
import { useAutoSlide } from "@/components/operator/use-auto-slide";
import { PainelArrastavel, ReorganizeBar } from "@/components/operator/reorganize";
import { TourBanner } from "@/components/operator/tour";
import { YoutubePanel } from "@/components/operator/youtube-panel";
import { WindowsRuntime } from "@/components/operator/windows-setup";
import { toast } from "sonner";
import { runOptimize } from "@/lib/run-optimize";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Segmented } from "@/components/ui/segmented";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadBuiltinBible } from "@/lib/bible";
import { importWebSong } from "@/lib/import-web-song";
import { resolveOperatorShortcut } from "@/lib/operator-shortcuts";
import { TAMANHO_PAINEL, type PainelId } from "@/lib/paineis";
import type { LiveFrame } from "@/lib/types";
import { buildLiveFrame, useLumenStore } from "@/store/lumen-store";
import { useAutoSlideStore } from "@/store/auto-slide-store";
import { useYoutubeStore } from "@/store/youtube-store";
import { useOpsStore } from "@/store/ops-store";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function OperatorApp() {
  const store = useLumenStore();
  useEffect(() => {
    document.documentElement.dataset.lowPerformance = String(!!store.settings.lowPerformance);
  }, [store.settings.lowPerformance]);
  const bibleRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const playlistRef = useRef<HTMLDivElement>(null);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [songEd, setSongEd] = useState(false);
  const [countdown, setCountdown] = useState(false);
  const [webOpen, setWebOpen] = useState(false);
  const [display, setDisplay] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [autoSlide, setAutoSlide] = useState(false);
  const [mobileTab, setMobileTab] = useState<"lib" | "preview" | "culto">("preview");
  const liveMode = useOpsStore((s) => s.liveMode);

  // O Auto-Slide escuta e pede o slide; quem projeta continua sendo a
  // apresentação de sempre.
  useAutoSlide();

  // O tutorial aponta para painéis que, em tela estreita, moram em abas.
  const ordemPaineis = useOpsStore((s) => s.ordemPaineis);
  const tourTab = useOpsStore((s) => s.tourTab);
  useEffect(() => {
    if (tourTab) setMobileTab(tourTab);
  }, [tourTab]);

  useEffect(() => {
    const unsub = useLumenStore.persist.onFinishHydration(() => {
      useLumenStore.getState().ensureSeed();
      useLumenStore.getState().setHydrated();
    });
    void useLumenStore.persist.rehydrate();
    void useAutoSlideStore.persist.rehydrate();
    void useYoutubeStore.persist.rehydrate();
    return unsub;
  }, []);

  const {
    status,
    live,
    preview,
    liveIndex,
    alert,
    countdown: outputCountdown,
    songThemeId,
    bibleThemeId,
    stageThemeId,
    themes,
    settings: outputSettings,
    youtube,
  } = store;
  const outputFrame = useMemo(
    () =>
      buildLiveFrame({
        status,
        live,
        preview,
        liveIndex,
        alert,
        countdown: outputCountdown,
        songThemeId,
        bibleThemeId,
        stageThemeId,
        themes,
        settings: outputSettings,
        youtube,
      }),
    [
      status,
      live,
      preview,
      liveIndex,
      alert,
      outputCountdown,
      songThemeId,
      bibleThemeId,
      stageThemeId,
      themes,
      outputSettings,
      youtube,
    ],
  );

  const previewFrame: LiveFrame = {
    ...outputFrame,
    deck: store.preview,
    index: store.previewIndex,
    status: "presenting",
  };

  // As colunas, por nome. A ordem em que elas aparecem é do operador, e mora
  // no ops-store; aqui só se diz o que cada uma é.
  const paineis: Record<PainelId, React.ReactNode> = {
    biblioteca: (
      <LibraryPanel
        onNewSong={() => setSongEd(true)}
        onWebLyrics={() => setWebOpen(true)}
        onOpenBible={() => setBibleOpen(true)}
        searchRef={searchRef}
        bibleRef={bibleRef}
      />
    ),
    culto: (
      <div ref={playlistRef} className="h-full">
        <PlaylistPanel />
      </div>
    ),
    preview: (
      <PreviewPanel
        previewFrame={previewFrame}
        outputFrame={outputFrame}
        onEditSong={() => setSongEd(true)}
        onSettings={() => setDisplay(true)}
      />
    ),
    temas: <ThemeRail />,
  };

  useEffect(() => {
    void loadBuiltinBible().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ops = useOpsStore.getState();
      const st = useLumenStore.getState();
      const action = resolveOperatorShortcut({
        key: e.key,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        typing: isTypingTarget(e.target),
        editingSlide: st.editingSlide,
        bibleOpen,
        commandOpen: ops.commandOpen,
        dialogOpen: !!document.querySelector('[role="dialog"]'),
        live: st.status !== "idle",
      });
      if (!action) return;
      e.preventDefault();

      if (typeof action === "object") {
        st.presentPlaylistItem(action.index);
      } else if (action === "command") ops.setCommandOpen(!ops.commandOpen);
      else if (action === "live-mode") ops.setLiveMode(!ops.liveMode);
      else if (action === "emergency") ops.setEmergencyOpen(true);
      else if (action === "present") st.presentPreview();
      else if (action === "escape") {
        if (ops.emergencyOpen) {
          ops.setEmergencyOpen(false);
        } else if (ops.liveMode) {
          ops.setLiveMode(false);
        } else if (bibleOpen) {
          setBibleOpen(false);
        } else if (st.fillMode !== "console") {
          st.setFillMode("console");
        } else {
          st.stop();
        }
      } else if (action === "help") setHelp(true);
      else if (action === "reload-blocked")
        toast("O culto está no ar. Esc para parar, depois recarregue se precisar.");
      else if (action === "undo") {
        if (!ops.undoCulto()) st.undoOptimize();
      } else if (action === "web-lyrics") setWebOpen(true);
      else if (action === "search") {
        searchRef.current?.focus();
        st.setTab("songs");
      } else if (action === "optimize") void runOptimize();
      else if (action === "checkup") ops.setCheckupOpen(true);
      else if (action === "bible") setBibleOpen((value) => !value);
      else if (action === "playlist-focus")
        playlistRef.current?.querySelector<HTMLButtonElement>("[data-playlist-trigger]")?.focus();
      else if (action === "theme-next") {
        const ids = st.themes.map((theme) => theme.id);
        const next = ids[(ids.indexOf(st.songThemeId) + 1) % ids.length];
        if (next) st.applyThemeLive(next);
      } else if (action === "playlist-next") st.nextPlaylistItem();
      else if (action === "next") st.next();
      else if (action === "previous") st.prev();
      else if (action === "black") st.goBlack();
      else if (action === "logo") st.goLogo();
      else if (action === "clear") st.goClear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bibleOpen]);

  if (store.fillMode === "audience" || store.fillMode === "stage") {
    return (
      <div className="relative h-dvh w-dvw bg-stage text-stage-fg">
        <SlideStage
          frame={outputFrame}
          variant={store.fillMode === "stage" ? "stage" : "audience"}
          className="size-full"
        />
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md bg-elevated/90 px-3 py-1 text-secondary text-fg"
          onClick={() => store.setFillMode("console")}
        >
          Voltar à cabine · Esc
        </button>
      </div>
    );
  }

  if (liveMode) {
    return (
      <TooltipProvider>
        <LiveMode
          outputFrame={outputFrame}
          previewFrame={previewFrame}
          onAutoSlide={() => setAutoSlide(true)}
        />
        <AutoSlideDialog open={autoSlide} onOpenChange={setAutoSlide} />
        <OpsLayer />
        <HelpDialog open={help} onOpenChange={setHelp} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-bg text-fg">
        <MenuBar
          onNewSong={() => setSongEd(true)}
          onWebLyrics={() => setWebOpen(true)}
          onEditSong={() => setSongEd(true)}
          onCountdown={() => setCountdown(true)}
          onHelp={() => setHelp(true)}
          onSettings={() => setSettings(true)}
          onBible={() => setBibleOpen(true)}
          onDisplay={() => setDisplay(true)}
          onAutoSlide={() => setAutoSlide(true)}
          onOptimize={() => void runOptimize()}
        />
        <WindowsRuntime />
        <AutoSlidePanel onConfig={() => setAutoSlide(true)} />
        {/* A Bíblia é espaço de trabalho de tela cheia. O que pertence ao fluxo
            de músicas — vídeo e grade de letras — sai de cena enquanto ela está
            aberta, senão ela fica com uma fresta e o rodapé vaza por cima. */}
        {!bibleOpen && <YoutubePanel />}
        <ReorganizeBar />
        <TourBanner />

        {!bibleOpen && (
          <div className="border-b border-border bg-surface px-2 py-1.5 xl:hidden">
            <Segmented
              label="Área da cabine"
              full
              value={mobileTab}
              onChange={setMobileTab}
              items={[
                { value: "lib", label: "Biblioteca" },
                { value: "preview", label: "Preview" },
                { value: "culto", label: "Culto" },
              ]}
            />
          </div>
        )}

        <div className="min-h-0 flex-1">
          {bibleOpen ? (
            <BibleWorkspace previewFrame={previewFrame} onBack={() => setBibleOpen(false)} />
          ) : (
            <>
              <div className="hidden h-full xl:block">
                <Group orientation="horizontal" className="h-full">
                  {ordemPaineis.flatMap((id, i) => {
                    const coluna = (
                      <Panel
                        key={id}
                        defaultSize={TAMANHO_PAINEL[id].padrao}
                        minSize={TAMANHO_PAINEL[id].minimo}
                        className="relative h-full overflow-hidden"
                      >
                        {paineis[id]}
                        <PainelArrastavel id={id} />
                      </Panel>
                    );
                    // Separadores entram entre as colunas, nunca antes da primeira,
                    // e a lista fica plana: o Group precisa deles como filhos diretos.
                    return i === 0
                      ? [coluna]
                      : [
                          <Separator
                            key={`sep-${id}`}
                            className="w-1 bg-border hover:bg-primary"
                          />,
                          coluna,
                        ];
                  })}
                </Group>
              </div>
              <div className="h-full xl:hidden">
                {mobileTab === "lib" && (
                  <LibraryPanel
                    onNewSong={() => setSongEd(true)}
                    onWebLyrics={() => setWebOpen(true)}
                    onOpenBible={() => setBibleOpen(true)}
                    searchRef={searchRef}
                    bibleRef={bibleRef}
                  />
                )}
                {mobileTab === "preview" && (
                  <PreviewPanel
                    previewFrame={previewFrame}
                    outputFrame={outputFrame}
                    onEditSong={() => setSongEd(true)}
                    onSettings={() => setDisplay(true)}
                  />
                )}
                {mobileTab === "culto" && <PlaylistPanel showThemes />}
              </div>
            </>
          )}
        </div>

        {!bibleOpen && <SlideGrid />}
        <ControlBar outputFrame={outputFrame} />
      </div>

      <OpsLayer />
      <SongEditorDialog open={songEd} onOpenChange={setSongEd} songId={store.selectedSongId} />
      <HelpDialog open={help} onOpenChange={setHelp} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <AutoSlideDialog open={autoSlide} onOpenChange={setAutoSlide} />
      <DisplayDialog open={display} onOpenChange={setDisplay} />
      <CountdownDialog open={countdown} onOpenChange={setCountdown} />
      <LyricsSearchDialog
        open={webOpen}
        onOpenChange={setWebOpen}
        prefillQuery={store.search}
        onPick={(hit) => void importWebSong(hit)}
      />
    </TooltipProvider>
  );
}
