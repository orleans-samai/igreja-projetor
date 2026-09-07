import { ChevronLeft, ChevronRight, EyeOff, Image as ImageIcon, Send, Square } from "lucide-react";
import { useState } from "react";
import { SlideStage } from "@/components/slide/slide-renderer";
import { Button } from "@/components/ui/button";
import { Tally } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import type { LiveFrame } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Barra mestra da cabine.
 *
 * A ordem nunca muda, porque no escuro o operador acerta por memória, não
 * por leitura. "Preto" fica sempre no mesmo canto e é o que se aperta quando
 * há algo errado no telão — por isso está primeiro e separado do resto.
 */
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
  const [sent, setSent] = useState(false);

  const slides = live?.slides ?? [];
  const neighbors = [-1, 0, 1].map((d) => liveIndex + d);

  const tally =
    status === "presenting"
      ? ("live" as const)
      : status === "idle"
        ? ("off" as const)
        : ("blank" as const);
  const tallyLabel =
    status === "presenting"
      ? `No ar · ${liveIndex + 1}/${slides.length || 1}`
      : status === "black"
        ? "Telão preto"
        : status === "logo"
          ? "Logo"
          : status === "clear"
            ? "Sem letra"
            : "Parado";

  return (
    <footer
      className={cn(
        "flex min-h-11 shrink-0 flex-col gap-2 border-t border-border bg-surface px-2 py-1.5",
        "lg:flex-row lg:items-center lg:gap-3",
      )}
    >
      {/* Transporte: onde está e para onde vai. */}
      <div className="flex items-center gap-1">
        <Hint label="Slide anterior" keys="←">
          <Button size="iconSm" variant="ghost" onClick={prev} aria-label="Slide anterior">
            <ChevronLeft />
          </Button>
        </Hint>
        {neighbors.map((i) => {
          const slide = slides[i];
          if (!slide) {
            return (
              <div
                key={i}
                aria-hidden
                className="hidden h-10 w-16 rounded-sm bg-elevated/40 lg:block"
              />
            );
          }
          const mini: LiveFrame = { ...outputFrame, index: i, status: "presenting", deck: live };
          const current = i === liveIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goLiveIndex(i)}
              aria-label={`Ir para ${slide.label}`}
              aria-current={current}
              className={cn(
                "hidden h-10 w-16 overflow-hidden rounded-sm lg:block",
                "transition-[box-shadow,opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                current
                  ? "shadow-[0_0_0_1px_var(--color-live)]"
                  : "opacity-45 hover:opacity-90 shadow-[var(--shadow-border)]",
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
        <Hint label="Próximo slide" keys="→">
          <Button size="iconSm" variant="ghost" onClick={next} aria-label="Próximo slide">
            <ChevronRight />
          </Button>
        </Hint>
      </div>

      {/* Estado do telão. Preto primeiro, sempre. Quebra em vez de cortar. */}
      <div className="flex flex-wrap items-center gap-1">
        <Hint label="Apaga o telão na hora" keys="B">
          <Button
            size="sm"
            variant={status === "black" ? "live" : "outline"}
            onClick={goBlack}
            aria-pressed={status === "black"}
            className="min-w-16"
          >
            <Square /> Preto
          </Button>
        </Hint>
        <Hint label="Mostra a logo da igreja" keys="L">
          <Button
            size="sm"
            variant={status === "logo" ? "live" : "ghost"}
            onClick={goLogo}
            aria-pressed={status === "logo"}
          >
            <ImageIcon /> Logo
          </Button>
        </Hint>
        <Hint label="Mantém o fundo e tira a letra" keys="C">
          <Button
            size="sm"
            variant={status === "clear" ? "live" : "ghost"}
            onClick={goClear}
            aria-pressed={status === "clear"}
          >
            <EyeOff /> Ocultar letra
          </Button>
        </Hint>
        <span className="mx-1 hidden h-5 w-px bg-border lg:block" aria-hidden />
        <Hint label="Encerra a apresentação" keys="Esc">
          <Button size="sm" variant="ghost" onClick={stop} disabled={status === "idle"}>
            Parar
          </Button>
        </Hint>
        <Hint label="Vai para o próximo item do culto" keys="Ctrl+N">
          <Button size="sm" variant="ghost" onClick={nextPlaylistItem}>
            Próximo item
          </Button>
        </Hint>
      </div>

      {/* Aviso de rodapé — o único lugar do app onde ele se escreve. */}
      <form
        className="flex min-w-0 flex-1 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!alertText.trim()) return;
          setAlert(alertText.trim(), 10, "bottom");
          setAlertText("");
          setSent(true);
          window.setTimeout(() => setSent(false), 700);
        }}
      >
        <Input
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          placeholder="Aviso no rodapé do telão"
          aria-label="Aviso no rodapé do telão"
          className="min-w-0"
        />
        <Hint label="Mostra o aviso por 10 segundos">
          <Button
            size="iconSm"
            variant="secondary"
            type="submit"
            aria-label="Mostrar aviso por 10 segundos"
            disabled={!alertText.trim()}
            feedback={sent ? "ok" : null}
          >
            <Send />
          </Button>
        </Hint>
      </form>

      <div className="flex shrink-0 items-center gap-3">
        <Tally state={tally} label={tallyLabel} />
        <span className="hidden text-caption text-subtle lg:inline">cabine · projetor · palco</span>
      </div>
    </footer>
  );
}
