import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Mic,
  MicOff,
  Search,
  SkipForward,
  Square,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Button } from "@/components/ui/button";
import { executeIntent, labelsOf } from "@/lib/copilot-exec";
import { parseCommand } from "@/lib/copilot";
import { addMinutesToTime, plannedMinutesFor } from "@/lib/templates";
import { startVoice, voiceSupported } from "@/lib/voice";
import { cn } from "@/lib/cn";
import type { LiveFrame, PlaylistItem } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

function playlistCursor() {
  const s = useLumenStore.getState();
  const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
  const currentId = s.live?.refId ?? s.preview?.refId;
  const idx = pl?.items.findIndex((i) => i.refId === currentId) ?? -1;
  return {
    pl,
    idx,
    current: idx >= 0 ? pl?.items[idx] : undefined,
    next: idx >= 0 ? pl?.items[idx + 1] : pl?.items[0],
  };
}

function InboxStrip() {
  const inbox = useOpsStore((s) => s.inbox);
  const resolve = useOpsStore((s) => s.resolveInbox);
  const top = inbox.find((r) => r.status === "pending");
  if (!top) return null;
  const from =
    top.from === "pastor" ? "Pastor" : top.from === "louvor" ? "Louvor" : top.from === "som" ? "Som" : "Mídia";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-live/15 px-3 py-2 text-sm text-fg">
      <span className="font-medium text-live">
        {from}
      </span>
      <span className="min-w-0 flex-1 truncate">{top.text}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (top.verse) {
            useLumenStore.getState().jumpRef(top.verse, false);
          } else if (top.kind === "repeat-chorus") {
            useLumenStore.getState().jumpLabel("coro");
          } else if (top.kind === "bridge") {
            useLumenStore.getState().jumpLabel("ponte");
          } else if (top.kind === "next-song") {
            useLumenStore.getState().nextPlaylistItem();
          } else if (top.kind === "black") {
            useLumenStore.getState().goBlack();
          }
          resolve(top.id, "done");
        }}
      >
        {top.kind === "verse" ? "Preparar" : "Fazer"}
      </Button>
      {top.kind === "verse" && top.verse && (
        <Button
          size="sm"
          variant="live"
          onClick={() => {
            useLumenStore.getState().jumpRef(top.verse!, true);
            resolve(top.id, "done");
          }}
        >
          Projetar
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => resolve(top.id, "dismissed")}>
        Depois
      </Button>
    </div>
  );
}

function TimelineBar({ items, idx, start }: { items: PlaylistItem[]; idx: number; start: string }) {
  let acc = 0;
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1">
      {items.map((item, i) => {
        const mins = plannedMinutesFor(item.type, item.subtitle ?? item.notes);
        const when = addMinutesToTime(start, acc);
        acc += mins;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => useLumenStore.getState().presentPlaylistItem(i)}
              className={cn(
                "min-w-28 rounded-md px-2 py-1.5 text-left",
                i === idx ? "bg-live text-accent-fg" : i < idx ? "bg-elevated text-muted" : "bg-elevated/70 text-fg",
              )}
            >
              <p className="font-mono text-xs opacity-80">{when}</p>
              <p className="truncate text-xs font-medium">{item.title}</p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveMode({ outputFrame, previewFrame }: { outputFrame: LiveFrame; previewFrame: LiveFrame }) {
  const status = useLumenStore((s) => s.status);
  const live = useLumenStore((s) => s.live);
  const preview = useLumenStore((s) => s.preview);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const playlists = useLumenStore((s) => s.playlists);
  const activePlaylistId = useLumenStore((s) => s.activePlaylistId);
  const next = useLumenStore((s) => s.next);
  const prev = useLumenStore((s) => s.prev);
  const goBlack = useLumenStore((s) => s.goBlack);
  const presentPreview = useLumenStore((s) => s.presentPreview);
  const presentPlaylistItem = useLumenStore((s) => s.presentPlaylistItem);
  const previewPlaylistItem = useLumenStore((s) => s.previewPlaylistItem);
  const jumpLabel = useLumenStore((s) => s.jumpLabel);

  const setLiveMode = useOpsStore((s) => s.setLiveMode);
  const setCommandOpen = useOpsStore((s) => s.setCommandOpen);
  const setEmergencyOpen = useOpsStore((s) => s.setEmergencyOpen);
  const voiceOn = useOpsStore((s) => s.voiceOn);
  const setVoiceOn = useOpsStore((s) => s.setVoiceOn);
  const autoRun = useOpsStore((s) => s.autoRun);
  const setAutoRun = useOpsStore((s) => s.setAutoRun);
  const timelineStart = useOpsStore((s) => s.timelineStart);
  const lastManualAt = useOpsStore((s) => s.lastManualAt);
  const markManual = useOpsStore((s) => s.markManual);
  const cultoStartedAt = useOpsStore((s) => s.cultoStartedAt);

  const pl = playlists.find((p) => p.id === activePlaylistId);
  const items = pl?.items ?? [];
  const nowDeck = status !== "idle" && live ? live : preview;
  const frame = status !== "idle" && live ? outputFrame : previewFrame;
  const labels = useMemo(() => labelsOf(nowDeck), [nowDeck]);
  const cursor = items.findIndex((i) => i.refId === nowDeck?.refId);
  const nextItem = items[cursor >= 0 ? cursor + 1 : 0];
  const currentLabel = nowDeck?.slides[status !== "idle" ? liveIndex : 0]?.label ?? "";

  useEffect(() => {
    if (!voiceOn) return;
    const stop = startVoice((text) => {
      const intent = parseCommand(text);
      const result = executeIntent(intent);
      toast(`${text} → ${result.message}`);
    });
    return stop;
  }, [voiceOn]);

  useEffect(() => {
    if (!autoRun || !cultoStartedAt) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastManualAt < 8000) return;
      const { idx, next: nxt } = playlistCursor();
      if (!nxt) return;
      let acc = 0;
      const itemsNow = playlistCursor().pl?.items ?? [];
      for (let i = 0; i <= idx; i++) {
        acc += plannedMinutesFor(itemsNow[i]?.type ?? "text", itemsNow[i]?.subtitle);
      }
      const elapsedMin = (Date.now() - cultoStartedAt) / 60000;
      if (elapsedMin > acc) {
        useLumenStore.getState().presentPlaylistItem(idx + 1);
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [autoRun, cultoStartedAt, lastManualAt]);

  const statusLabel =
    status === "presenting" ? "AO VIVO" : status === "black" ? "PRETO" : status === "idle" ? "PREPARADO" : status.toUpperCase();

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className="font-display text-lg tracking-tight">Agora</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            status === "presenting" ? "bg-live text-accent-fg" : "bg-elevated text-muted",
          )}
        >
          <Circle className="mr-1 inline size-2 fill-current" />
          {statusLabel}
        </span>
        <p className="ml-auto font-mono text-sm text-muted">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setLiveMode(false)}>
          Cabine
        </Button>
      </header>

      <div className="px-3 pt-2">
        <InboxStrip />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <section className="flex min-h-0 flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-subtle">Agora</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              {nowDeck?.title ?? "Nada no preview"}
            </h1>
            <p className="mt-1 text-muted">
              {currentLabel}
              {nowDeck ? ` · ${((status !== "idle" ? liveIndex : 0) + 1)}/${nowDeck.slides.length}` : ""}
            </p>
          </div>
          {labels.length > 0 && (
            <div className="flex max-h-16 flex-wrap gap-2 overflow-auto">
              {labels.map((label) => (
                <Button
                  key={label}
                  size="lg"
                  variant={foldMatch(currentLabel, label) ? "live" : "secondary"}
                  onClick={() => {
                    markManual();
                    jumpLabel(label);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          <div className="preview-well min-h-0 flex-1 overflow-hidden rounded-xl bg-stage">
            <SlideStage frame={frame} variant="preview" className="size-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="secondary" onClick={() => { markManual(); prev(); }} aria-label="Anterior">
              <ChevronLeft /> Anterior
            </Button>
            <Button size="lg" variant="default" onClick={() => { markManual(); next(); }} aria-label="Próximo">
              Próximo <ChevronRight />
            </Button>
            {status === "idle" && (
              <Button size="lg" variant="live" onClick={() => { markManual(); presentPreview(); }}>
                Projetar
              </Button>
            )}
            <Button size="lg" variant={status === "black" ? "live" : "secondary"} onClick={() => { markManual(); goBlack(); }}>
              <Square className="size-4" /> Preto
            </Button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3">
          <div className="rounded-xl bg-elevated p-4">
            <p className="text-xs uppercase tracking-widest text-subtle">Próximo</p>
            <h2 className="mt-1 font-display text-2xl">{nextItem?.title ?? "Fim da programação"}</h2>
            <p className="text-sm text-muted">{nextItem?.notes || nextItem?.subtitle || "—"}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!nextItem}
                onClick={() => nextItem && previewPlaylistItem(cursor >= 0 ? cursor + 1 : 0)}
              >
                Preparar
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!nextItem}
                onClick={() => {
                  markManual();
                  if (nextItem) presentPlaylistItem(cursor >= 0 ? cursor + 1 : 0);
                }}
              >
                <SkipForward className="size-4" /> Ir
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-subtle">Timeline</p>
              <button
                type="button"
                onClick={() => setAutoRun(!autoRun)}
                className={cn("text-xs", autoRun ? "text-ok" : "text-muted")}
              >
                {autoRun ? "Autônomo ligado" : "Autônomo pausado"}
              </button>
            </div>
            <TimelineBar items={items} idx={cursor} start={timelineStart} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="danger" onClick={() => setEmergencyOpen(true)}>
              <AlertTriangle /> Emergência
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setCommandOpen(true)}>
              <Search /> Busca
            </Button>
            <Button
              size="lg"
              variant={voiceOn ? "live" : "secondary"}
              className="col-span-2"
              onClick={() => {
                if (!voiceSupported()) {
                  toast("Voz não disponível neste navegador");
                  return;
                }
                setVoiceOn(!voiceOn);
              }}
            >
              {voiceOn ? <Mic /> : <MicOff />}
              {voiceOn ? "Ouvindo o headset" : "Controle por voz"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function foldMatch(a: string, b: string) {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return n(a).includes(n(b)) || n(b).includes(n(a));
}
