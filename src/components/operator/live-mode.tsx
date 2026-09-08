import { AutoSlidePanel } from "@/components/operator/auto-slide";
import { AlertTriangle, ChevronLeft, ChevronRight, Mic, MicOff, Search, SkipForward, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Button } from "@/components/ui/button";
import { Tally } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
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

/** Relógio do culto. Antes era um Date criado uma vez e nunca mais atualizado. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function InboxStrip() {
  const inbox = useOpsStore((s) => s.inbox);
  const resolve = useOpsStore((s) => s.resolveInbox);
  const top = inbox.find((r) => r.status === "pending");
  if (!top) return null;
  const from =
    top.from === "pastor"
      ? "Pastor"
      : top.from === "louvor"
        ? "Louvor"
        : top.from === "som"
          ? "Som"
          : "Mídia";
  return (
    <div className="animate-swap-in flex items-center gap-2 rounded-lg bg-accent/12 px-3 py-1.5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_35%,transparent)]">
      <span className="shrink-0 text-caption font-semibold text-accent">{from}</span>
      <span className="min-w-0 flex-1 truncate text-body text-fg">{top.text}</span>
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

/**
 * Programação do culto com o horário previsto de cada item.
 *
 * Vertical porque a coluna é alta e estreita: em pé cabem uns doze itens, e
 * a lista horizontal anterior mostrava quatro e deixava metade da coluna vazia.
 */
function Timeline({ items, idx, start }: { items: PlaylistItem[]; idx: number; start: string }) {
  let acc = 0;
  return (
    <ol className="lumen-scroll h-full space-y-px overflow-y-auto">
      {items.map((item, i) => {
        const mins = plannedMinutesFor(item.type, item.subtitle ?? item.notes);
        const when = addMinutesToTime(start, acc);
        acc += mins;
        const done = i < idx;
        const on = i === idx;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => useLumenStore.getState().presentPlaylistItem(i)}
              aria-current={on}
              className={cn(
                "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left",
                "transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                "active:scale-[0.99] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                on
                  ? "bg-live text-live-fg"
                  : done
                    ? "text-subtle hover:bg-elevated"
                    : "text-fg hover:bg-elevated",
              )}
            >
              <span className={cn("tnum shrink-0 font-mono text-caption", !on && "text-subtle")}>
                {when}
              </span>
              <span className="min-w-0 flex-1 truncate text-secondary font-medium">{item.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveMode({
  outputFrame,
  previewFrame,
  onAutoSlide,
}: {
  outputFrame: LiveFrame;
  previewFrame: LiveFrame;
  onAutoSlide: () => void;
}) {
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
  const clock = useClock();

  const pl = playlists.find((p) => p.id === activePlaylistId);
  const items = pl?.items ?? [];
  const nowDeck = status !== "idle" && live ? live : preview;
  const frame = status !== "idle" && live ? outputFrame : previewFrame;
  const labels = useMemo(() => labelsOf(nowDeck), [nowDeck]);
  const cursor = items.findIndex((i) => i.refId === nowDeck?.refId);
  const nextItem = items[cursor >= 0 ? cursor + 1 : 0];
  const slideNo = (status !== "idle" ? liveIndex : 0) + 1;
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

  const tally =
    status === "presenting" ? "live" : status === "idle" ? "ready" : "blank";
  const tallyLabel =
    status === "presenting"
      ? "No ar"
      : status === "black"
        ? "Telão preto"
        : status === "logo"
          ? "Logo"
          : status === "clear"
            ? "Sem letra"
            : "Preparado";

  return (
    <div className="operator-live flex h-dvh flex-col bg-bg text-fg">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h1 className="text-title font-semibold tracking-tight">Modo operador</h1>
        <Tally state={tally} label={tallyLabel} />
        <p className="tnum ml-auto font-mono text-body text-muted">{clock}</p>
        <Button size="sm" variant="ghost" onClick={() => setLiveMode(false)}>
          Voltar à cabine
        </Button>
      </header>
      <AutoSlidePanel onConfig={onAutoSlide} />

      <div className="empty:hidden px-3 pt-2">
        <InboxStrip />
      </div>

      <div className="operator-live-layout grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.7fr)]">
        <section className="flex min-h-0 flex-col gap-3">
          <div>
            <p className="text-caption text-subtle">No ar agora</p>
            <h2 className="mt-0.5 truncate text-display font-semibold tracking-tight">
              {nowDeck?.title ?? "Nada no preview"}
            </h2>
            {nowDeck && (
              <p className="tnum mt-0.5 text-body text-muted">
                {currentLabel} · {slideNo}/{nowDeck.slides.length}
              </p>
            )}
          </div>

          {labels.length > 0 && (
            <div className="lumen-scroll flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
              {labels.map((label) => {
                const on = foldMatch(currentLabel, label);
                return (
                  <Button
                    key={label}
                    size="default"
                    variant={on && status === "presenting" ? "live" : on ? "outline" : "secondary"}
                    onClick={() => {
                      markManual();
                      jumpLabel(label);
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}

          <div className="preview-well min-h-0 flex-1 overflow-hidden rounded-lg bg-stage shadow-[var(--shadow-border)]">
            <SlideStage frame={frame} variant="preview" className="size-full" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                markManual();
                prev();
              }}
            >
              <ChevronLeft /> Anterior
            </Button>
            <Button
              size="lg"
              onClick={() => {
                markManual();
                next();
              }}
            >
              Próximo <ChevronRight />
            </Button>
            {status === "idle" && (
              <Button
                size="lg"
                variant="live"
                onClick={() => {
                  markManual();
                  presentPreview();
                }}
              >
                Projetar
              </Button>
            )}
            <Button
              size="lg"
              variant={status === "black" ? "live" : "outline"}
              aria-pressed={status === "black"}
              className="ml-auto min-w-24"
              onClick={() => {
                markManual();
                goBlack();
              }}
            >
              <Square /> Preto
            </Button>
          </div>
        </section>

        {/* Sem caixa dentro de caixa: filete e espaço separam as seções. */}
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div>
            <p className="text-caption text-subtle">Depois deste</p>
            <h3 className="mt-0.5 truncate text-display-sm font-semibold tracking-tight">
              {nextItem?.title ?? "Fim da programação"}
            </h3>
            {(nextItem?.notes || nextItem?.subtitle) && (
              <p className="truncate text-secondary text-muted">
                {nextItem?.notes || nextItem?.subtitle}
              </p>
            )}
            <div className="mt-2 flex gap-2">
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
                disabled={!nextItem}
                onClick={() => {
                  markManual();
                  if (nextItem) presentPlaylistItem(cursor >= 0 ? cursor + 1 : 0);
                }}
              >
                <SkipForward /> Ir agora
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-border pt-3">
            <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
              <p className="text-caption text-subtle">Programação</p>
              <button
                type="button"
                onClick={() => setAutoRun(!autoRun)}
                aria-pressed={autoRun}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption",
                  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                  "hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  autoRun ? "text-ok" : "text-muted",
                )}
              >
                <span className="tally" data-state={autoRun ? "ready" : "off"} aria-hidden />
                {autoRun ? "Avanço automático" : "Avanço manual"}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Timeline items={items} idx={cursor} start={timelineStart} />
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border pt-3">
            <Hint label="Versículo e louvor de socorro" keys="F9">
              <Button size="lg" variant="danger" onClick={() => setEmergencyOpen(true)}>
                <AlertTriangle /> Emergência
              </Button>
            </Hint>
            <Hint label="Achar qualquer coisa" keys="Ctrl+K">
              <Button size="lg" variant="secondary" onClick={() => setCommandOpen(true)}>
                <Search /> Busca
              </Button>
            </Hint>
            <Button
              size="lg"
              variant={voiceOn ? "outline" : "secondary"}
              aria-pressed={voiceOn}
              className="col-span-2"
              onClick={() => {
                if (!voiceSupported()) {
                  toast("Este navegador não reconhece voz");
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
