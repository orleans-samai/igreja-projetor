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
import { ThemeRail } from "@/components/operator/theme-rail";
import { BibleWorkspace } from "@/components/operator/bible-workspace";
import { OpsLayer } from "@/components/operator/ops-layer";
import { WindowsRuntime } from "@/components/operator/windows-setup";
import { toast } from "sonner";
import { runOptimize } from "@/components/operator/optimize-bar";
import { SlideStage } from "@/components/slide/slide-renderer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadBuiltinBible } from "@/lib/bible";
import { nid, fold } from "@/lib/fold";
import { formatImportedLyrics } from "@/lib/lyrics";
import { cn } from "@/lib/cn";
import type { LiveFrame } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function OperatorApp() {
  const store = useLumenStore();
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
  const [mobileTab, setMobileTab] = useState<"lib" | "preview" | "culto">("preview");
  const editingSlide = useLumenStore((s) => s.editingSlide);
  const liveMode = useOpsStore((s) => s.liveMode);
  const commandOpen = useOpsStore((s) => s.commandOpen);

  useEffect(() => {
    const unsub = useLumenStore.persist.onFinishHydration(() => {
      useLumenStore.getState().ensureSeed();
      useLumenStore.getState().setHydrated();
    });
    void useLumenStore.persist.rehydrate();
    return unsub;
  }, []);

  const outputFrame = useMemo(() => store.liveFrame(), [
    store.status,
    store.live,
    store.liveIndex,
    store.alert,
    store.countdown,
    store.songThemeId,
    store.bibleThemeId,
    store.stageThemeId,
    store.themes,
    store.settings,
  ]);

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

      if (e.key === "F5") {
        e.preventDefault();
        store.presentPreview();
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
        if (store.fillMode !== "console") {
          store.setFillMode("console");
          return;
        }
        store.stop();
        return;
      }
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "r") {
          if (store.status !== "idle") {
            e.preventDefault();
            toast("O culto está no ar. Esc para parar, depois recarregue se precisar.");
          }
          return;
        }
        if (e.key.toLowerCase() === "z" && !e.shiftKey && !typing) {
          e.preventDefault();
          const ok = ops.undoCulto();
          if (!ok) store.undoOptimize();
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
          store.setTab("songs");
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
          playlistRef.current?.querySelector("select")?.focus();
          return;
        }
        if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          const ids = store.themes.map((t) => t.id);
          const cur = store.songThemeId;
          const next = ids[(ids.indexOf(cur) + 1) % ids.length];
          if (next) store.applyThemeLive(next);
          return;
        }
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          store.nextPlaylistItem();
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          store.presentPlaylistItem(Number(e.key) - 1);
          return;
        }
      }
      if (typing || editingSlide) return;
      if (bibleOpen) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        store.next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        store.prev();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        store.goBlack();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        store.goLogo();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        store.goClear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, editingSlide, bibleOpen, commandOpen]);

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
          className="absolute right-3 top-3 rounded-md bg-elevated/90 px-3 py-1 text-xs text-fg"
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
        <LiveMode outputFrame={outputFrame} previewFrame={previewFrame} />
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
          onOptimize={() => void runOptimize()}
        />
        <WindowsRuntime />

        {!bibleOpen && (
        <div className="flex gap-1 border-b border-border bg-surface px-2 py-1 md:hidden">
          {(
            [
              ["lib", "Biblioteca"],
              ["preview", "Preview"],
              ["culto", "Culto"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={cn(
                "min-h-11 flex-1 rounded-md py-2 text-xs font-medium",
                mobileTab === id ? "bg-elevated text-fg" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        )}

        <div className="min-h-0 flex-1">
          {bibleOpen ? (
            <BibleWorkspace previewFrame={previewFrame} onBack={() => setBibleOpen(false)} />
          ) : (
            <>
          <div className="hidden h-full md:block">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize="16%" minSize="12%" className="h-full overflow-hidden">
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
              <Panel defaultSize="46%" minSize="28%" className="h-full overflow-hidden">
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
          <div className="h-full md:hidden">
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
      <DisplayDialog open={display} onOpenChange={setDisplay} />
      <CountdownDialog open={countdown} onOpenChange={setCountdown} />
      <LyricsSearchDialog
        open={webOpen}
        onOpenChange={setWebOpen}
        prefillQuery={store.search}
        onPick={(hit) => {
          const groupId =
            store.selectedGroupId === "all" ? "g-louvor" : store.selectedGroupId;
          const lyricsRaw = formatImportedLyrics(hit.lyrics);
          const existing = store.songs.find(
            (s) =>
              fold(s.title) === fold(hit.title || "") &&
              fold(s.artist) === fold(hit.artist || ""),
          );
          store.saveSong({
            id: existing?.id ?? nid(),
            title: hit.title || "Música importada",
            artist: hit.artist || existing?.artist || "",
            groupId: existing?.groupId ?? groupId,
            key: existing?.key ?? "",
            copyright: [
              hit.copyright,
              hit.publicDomain ? "domínio público" : "",
              hit.sourceName,
            ]
              .filter(Boolean)
              .join(" · "),
            lyricsRaw,
            slides: [],
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          });
        }}
      />
    </TooltipProvider>
  );
}
