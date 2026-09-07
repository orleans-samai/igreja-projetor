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
import { TourBanner } from "@/components/operator/tour";
import { WindowsRuntime } from "@/components/operator/windows-setup";
import { toast } from "sonner";
import { runOptimize } from "@/lib/run-optimize";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Segmented } from "@/components/ui/segmented";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadBuiltinBible } from "@/lib/bible";
import { importWebSong } from "@/lib/import-web-song";
import type { LiveFrame } from "@/lib/types";
import { buildLiveFrame, useLumenStore } from "@/store/lumen-store";
import { useAutoSlideStore } from "@/store/auto-slide-store";
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
    ],
  );

  const previewFrame: LiveFrame = {
    ...outputFrame,
    deck: store.preview,
    index: store.previewIndex,
    status: "presenting",
  };

  useEffect(() => {
    void loadBuiltinBible().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      const ops = useOpsStore.getState();
      const st = useLumenStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ops.setCommandOpen(!ops.commandOpen);
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        ops.setLiveMode(!ops.liveMode);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        ops.setEmergencyOpen(true);
        return;
      }

      if (ops.commandOpen) return;
      // Dialogs own their keyboard: Enter in the microphone test must not advance the telão.
      if (document.querySelector('[role="dialog"]')) return;

      if (e.key === "F5") {
        e.preventDefault();
        st.presentPreview();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ops.emergencyOpen) {
          ops.setEmergencyOpen(false);
          return;
        }
        if (ops.liveMode) {
          ops.setLiveMode(false);
          return;
        }
        if (bibleOpen) {
          setBibleOpen(false);
          return;
        }
        if (st.fillMode !== "console") {
          st.setFillMode("console");
          return;
        }
        st.stop();
        return;
      }
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "r") {
          if (st.status !== "idle") {
            e.preventDefault();
            toast("O culto está no ar. Esc para parar, depois recarregue se precisar.");
          }
          return;
        }
        if (e.key.toLowerCase() === "z" && !e.shiftKey && !typing) {
          e.preventDefault();
          const ok = ops.undoCulto();
          if (!ok) st.undoOptimize();
          return;
        }
        if (e.key.toLowerCase() === "f" && e.shiftKey) {
          e.preventDefault();
          setWebOpen(true);
          return;
        }
        if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          searchRef.current?.focus();
          st.setTab("songs");
          return;
        }
        if (e.key.toLowerCase() === "o" && e.shiftKey) {
          e.preventDefault();
          void runOptimize();
          return;
        }
        if (e.key.toLowerCase() === "h" && e.shiftKey) {
          e.preventDefault();
          ops.setCheckupOpen(true);
          return;
        }
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          setBibleOpen((v) => !v);
          return;
        }
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          playlistRef.current
            ?.querySelector<HTMLButtonElement>("[data-playlist-trigger]")
            ?.focus();
          return;
        }
        if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          const ids = st.themes.map((t) => t.id);
          const cur = st.songThemeId;
          const next = ids[(ids.indexOf(cur) + 1) % ids.length];
          if (next) st.applyThemeLive(next);
          return;
        }
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          st.nextPlaylistItem();
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          st.presentPlaylistItem(Number(e.key) - 1);
          return;
        }
      }
      if (typing || st.editingSlide) return;
      if (bibleOpen) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        st.next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        st.prev();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        st.goBlack();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        st.goLogo();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        st.goClear();
      }
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
        <LiveMode outputFrame={outputFrame} previewFrame={previewFrame} onAutoSlide={() => setAutoSlide(true)} />
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
              <Panel defaultSize="19%" minSize="15%" className="h-full overflow-hidden">
                <LibraryPanel
                  onNewSong={() => setSongEd(true)}
                  onWebLyrics={() => setWebOpen(true)}
                  onOpenBible={() => setBibleOpen(true)}
                  searchRef={searchRef}
                  bibleRef={bibleRef}
                />
              </Panel>
              <Separator className="w-1 bg-border hover:bg-primary" />
              <Panel defaultSize="22%" minSize="16%" className="h-full overflow-hidden">
                <div ref={playlistRef} className="h-full">
                  <PlaylistPanel />
                </div>
              </Panel>
              <Separator className="w-1 bg-border hover:bg-primary" />
              <Panel defaultSize="43%" minSize="26%" className="h-full overflow-hidden">
                <PreviewPanel
                  previewFrame={previewFrame}
                  outputFrame={outputFrame}
                  onEditSong={() => setSongEd(true)}
                  onSettings={() => setDisplay(true)}
                />
              </Panel>
              <Separator className="w-1 bg-border hover:bg-primary" />
              <Panel defaultSize="16%" minSize="12%" className="h-full overflow-hidden">
                <ThemeRail />
              </Panel>
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

        <SlideGrid />
        <ControlBar outputFrame={outputFrame} />
      </div>

      <OpsLayer />
      <SongEditorDialog
        open={songEd}
        onOpenChange={setSongEd}
        songId={store.selectedSongId}
      />
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
