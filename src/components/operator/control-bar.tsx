import {
  ChevronLeft,
  ChevronRight,
  Circle,
  MonitorPlay,
  Square,
  Image as ImageIcon,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import type { LiveFrame } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";

export function ControlBar({ outputFrame }: { outputFrame: LiveFrame }) {
  const status = useLumenStore((s) => s.status);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const next = useLumenStore((s) => s.next);
  const prev = useLumenStore((s) => s.prev);
  const goBlack = useLumenStore((s) => s.goBlack);
  const goLogo = useLumenStore((s) => s.goLogo);
  const goClear = useLumenStore((s) => s.goClear);
  const stop = useLumenStore((s) => s.stop);
  const setAlert = useLumenStore((s) => s.setAlert);
  const goLiveIndex = useLumenStore((s) => s.goLiveIndex);
  const nextPlaylistItem = useLumenStore((s) => s.nextPlaylistItem);
  const [alertText, setAlertText] = useState("");

  const slides = live?.slides ?? [];
  const neighbors = [-1, 0, 1].map((d) => liveIndex + d);

  const statusLabel =
    status === "presenting"
      ? "Apresentando"
      : status === "black"
        ? "Tela preta"
        : status === "logo"
          ? "Logo"
          : status === "clear"
            ? "Fundo sem texto"
            : "Parado";

  return (
    <footer className="flex min-h-12 shrink-0 flex-col gap-2 border-t border-border bg-surface px-2 py-1.5 md:flex-row md:items-center">
      <div className="flex items-center gap-1">
        <Hint label="Anterior">
          <Button size="iconSm" variant="secondary" onClick={prev} aria-label="Anterior">
            <ChevronLeft />
          </Button>
        </Hint>
        {neighbors.map((i) => {
          const slide = slides[i];
          if (!slide) {
            return <div key={i} className="hidden h-12 w-20 rounded-md bg-elevated/40 md:block" />;
          }
          const mini: LiveFrame = { ...outputFrame, index: i, status: "presenting", deck: live };
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goLiveIndex(i)}
              className={cn(
                "hidden h-12 w-20 overflow-hidden rounded-md md:block",
                i === liveIndex ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              <SlideStage
                frame={mini}
                variant="preview"
                statusOverride="presenting"
                className="size-full"
              />
            </button>
          );
        })}
        <Hint label="Próximo">
          <Button size="iconSm" variant="secondary" onClick={next} aria-label="Próximo">
            <ChevronRight />
          </Button>
        </Hint>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1">
        <Hint label="Tela preta (B)">
          <Button size="sm" variant={status === "black" ? "live" : "secondary"} onClick={goBlack}>
            <Square className="size-3.5" /> Preto
          </Button>
        </Hint>
        <Hint label="Logo (L)">
          <Button size="sm" variant={status === "logo" ? "live" : "secondary"} onClick={goLogo}>
            <ImageIcon className="size-3.5" /> Logo
          </Button>
        </Hint>
        <Hint label="Ocultar texto, manter fundo">
          <Button size="sm" variant={status === "clear" ? "live" : "ghost"} onClick={goClear}>
            <EyeOff className="size-3.5" /> Fundo
          </Button>
        </Hint>
        <Hint label="Parar (Esc)">
          <Button size="sm" variant="ghost" onClick={stop}>
            Parar
          </Button>
        </Hint>
        <Hint label="Próxima da playlist">
          <Button size="sm" variant="ghost" onClick={nextPlaylistItem}>
            Próx. item
          </Button>
        </Hint>
      </div>

      <form
        className="flex min-w-0 flex-1 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!alertText.trim()) return;
          setAlert(alertText.trim(), 10, "bottom");
          setAlertText("");
        }}
      >
        <Input
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          placeholder="Alerta de rodapé — Enter"
          className="h-8"
        />
        <Button size="sm" variant="secondary" type="submit">
          10s
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <Badge tone={status === "presenting" ? "live" : status === "idle" ? "muted" : "primary"}>
          <Circle className="mr-1 size-2 fill-current" />
          {statusLabel}
        </Badge>
        <span className="hidden items-center gap-1 text-[11px] text-muted md:inline-flex">
          <MonitorPlay className="size-3.5" />
          cabine · projetor · palco
        </span>
      </div>
    </footer>
  );
}
