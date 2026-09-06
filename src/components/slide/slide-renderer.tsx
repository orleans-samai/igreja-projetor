/**
 * Single slide renderer used by:
 *  - operator 16:9 preview
 *  - audience projection window
 *  - stage return window
 *
 * Layout is authored at 1920×1080 and scaled with a transform so the operator
 * preview matches the telão (safe area, type size, outline).
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChurchLogo } from "@/components/logo";
import { stripChords } from "@/lib/lyrics";
import type { ClockPosition, FitMode, LiveFrame, OutputStatus, Theme } from "@/lib/types";
import { cn } from "@/lib/cn";

const VW = 1920;
const VH = 1080;

function useScale(fit: "contain" | "cover") {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const [bar, setBar] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = fit === "cover" ? Math.max(w / VW, h / VH) : Math.min(w / VW, h / VH);
      setScale(s);
      setBar({ x: (w - VW * s) / 2, y: (h - VH * s) / 2 });
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [fit]);

  return { ref, scale, bar };
}

function textStyle(theme: Theme): CSSProperties {
  const outline = theme.outlineWidth;
  const shadows = theme.shadow
    ? `0 4px 18px ${theme.outlineColor}cc, 0 0 8px ${theme.outlineColor}aa`
    : "none";
  return {
    fontFamily: `${theme.fontFamily}, var(--font-display)`,
    fontSize: theme.fontSize,
    fontWeight: theme.fontWeight,
    lineHeight: theme.lineHeight,
    color: theme.textColor,
    WebkitTextStroke: outline ? `${outline}px ${theme.outlineColor}` : undefined,
    textShadow: shadows,
    textAlign: theme.alignH,
    textTransform: theme.uppercase ? "uppercase" : "none",
    whiteSpace: "pre-wrap",
  };
}

function Background({
  theme,
  showWallpaper,
  baseFill,
  fitMode,
}: {
  theme: Theme;
  showWallpaper: boolean;
  baseFill: "dark" | "light";
  fitMode: FitMode;
}) {
  const fill = (
    <div className={cn("absolute inset-0", baseFill === "light" ? "bg-paper" : "bg-stage")} />
  );
  if (!showWallpaper) return fill;
  const size = fitMode === "contain" ? "contain" : "cover";
  if (theme.backgroundType === "video") {
    return (
      <>
        {fill}
        <video
          className={cn(
            "absolute inset-0 size-full",
            fitMode === "contain" ? "object-contain" : "object-cover",
          )}
          src={theme.backgroundValue}
          autoPlay
          loop
          muted
          playsInline
        />
      </>
    );
  }
  if (theme.backgroundType === "image") {
    return (
      <>
        {fill}
        <div
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${theme.backgroundValue})`,
            backgroundSize: size,
          }}
        />
      </>
    );
  }
  return <div className="absolute inset-0" style={{ background: theme.backgroundValue }} />;
}

function ClockOverlay({
  show,
  position,
}: {
  show: boolean;
  position: ClockPosition;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!show) return;
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [show]);
  if (!show) return null;
  const corner =
    position === "bottom-right"
      ? "bottom-10 right-10"
      : position === "bottom-left"
        ? "bottom-10 left-10"
        : position === "top-left"
          ? "top-10 left-10"
          : "top-10 right-10";
  return (
    <div className={cn("absolute z-20 font-display text-stage-fg/90", corner)}>
      <p className="slide-clock">
        {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

function AlertBar({ alert }: { alert: LiveFrame["alert"] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  if (!alert || alert.until < now) return null;
  return (
    <div
      className={cn(
        "absolute inset-x-0 z-20 flex justify-center px-16",
        alert.position === "top" ? "top-10" : "bottom-10",
      )}
    >
      <div className="rounded-md bg-accent px-8 py-3 font-display text-3xl font-semibold text-accent-fg">
        {alert.text}
      </div>
    </div>
  );
}

function CountdownView({ frame }: { frame: LiveFrame }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => {
      if (!frame.countdown) return setLeft(0);
      setLeft(Math.max(0, frame.countdown.endsAt - Date.now()));
    };
    tick();
    const t = window.setInterval(tick, 200);
    return () => window.clearInterval(t);
  }, [frame.countdown]);
  const total = Math.ceil(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <p className="font-display text-4xl font-medium tracking-wide text-stage-fg/80">
        {frame.countdown?.label ?? frame.deck?.title}
      </p>
      <p
        className="font-display font-semibold tabular-nums leading-none tracking-tight"
        style={{ fontSize: 180 }}
      >
        {mm}:{ss}
      </p>
    </div>
  );
}

export function SlideCanvas({
  frame,
  variant,
  statusOverride,
}: {
  frame: LiveFrame;
  variant: "audience" | "stage" | "preview";
  statusOverride?: OutputStatus;
}) {
  const status = statusOverride ?? frame.status;
  const theme = variant === "stage" ? frame.stageTheme : frame.theme;
  const slide = frame.deck?.slides[frame.index];
  const next = frame.deck?.slides[frame.index + 1];
  const showChords =
    variant === "audience" ? frame.settings.chordsOnAudience : frame.settings.chordsOnStage;
  const m = frame.settings.margins;
  const isLogo = status === "logo" || status === "idle";
  const hideText = status === "black" || status === "clear" || isLogo;
  const showWallpaper = frame.settings.showWallpaper !== false;
  const baseFill = frame.settings.baseFill ?? "dark";
  const fitMode = frame.settings.fitMode ?? "contain";
  const onPaper = !showWallpaper && baseFill === "light";
  const paint = onPaper
    ? { ...theme, textColor: "var(--color-paper-fg)", outlineWidth: 0, shadow: false }
    : theme;

  let body: string = slide?.text ?? "";
  if (!showChords) body = stripChords(body);
  if (variant === "stage" && theme.uppercase) body = body.toUpperCase();

  return (
    <div
      className={cn(
        "relative size-full overflow-hidden",
        onPaper ? "bg-paper text-paper-fg" : "bg-stage",
      )}
      style={{ padding: `${m.t}% ${m.r}% ${m.b}% ${m.l}%` }}
    >
      <Background
        theme={theme}
        showWallpaper={showWallpaper}
        baseFill={baseFill}
        fitMode={fitMode}
      />
      {showWallpaper && (
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${theme.overlayOpacity})` }}
        />
      )}

      {status === "black" && <div className="absolute inset-0 z-30 bg-stage" />}

      {isLogo && (
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="absolute inset-0 bg-stage/55" />
          <div className="relative">
            <ChurchLogo url={frame.logoUrl} name={frame.churchName} />
          </div>
        </div>
      )}

      {status === "presenting" && frame.deck?.kind === "countdown" && (
        <div className="relative z-10 h-full text-stage-fg" style={textStyle(paint)}>
          <CountdownView frame={frame} />
        </div>
      )}

      {status !== "black" && !isLogo && frame.deck?.kind !== "countdown" && !hideText && slide && (
        <div
          className={cn(
            "relative z-10 flex h-full flex-col",
            theme.alignV === "top" && "justify-start",
            theme.alignV === "center" && "justify-center",
            theme.alignV === "bottom" && "justify-end",
          )}
        >
          {theme.showTitle && frame.deck?.kind === "song" && (
            <p className="mb-6 font-display text-3xl font-medium tracking-wide text-stage-fg/80">
              {frame.deck.title}
            </p>
          )}
          <div
            key={slide.id + String(frame.updatedAt)}
            className="slide-text max-w-full transition-opacity duration-200"
            style={textStyle(paint)}
          >
            {body}
          </div>
          {theme.showReference && slide.reference && (
            <p className="mt-8 font-display text-3xl font-medium text-stage-fg/75">{slide.reference}</p>
          )}
          {theme.showCopyright && frame.deck?.copyright && (
            <p className="mt-6 text-xl text-stage-fg/50">{frame.deck.copyright}</p>
          )}
        </div>
      )}

      {variant === "stage" && status === "presenting" && frame.deck && (
        <div className="absolute bottom-8 left-10 right-10 z-20 flex items-end justify-between gap-8 text-left">
          <div className="max-w-[46%]">
            <p className="text-2xl font-medium text-accent">{frame.deck.title}</p>
            <p className="text-lg text-stage-fg/70">
              {slide?.label}
              {frame.deck.key ? ` · tom ${frame.deck.key}` : ""}
            </p>
            {slide?.comment && <p className="mt-1 text-lg text-primary">{slide.comment}</p>}
          </div>
          {next && (
            <div className="max-w-[46%] text-right">
              <p className="text-sm uppercase tracking-[0.18em] text-stage-fg/50">depois · {next.label}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-2xl text-stage-fg/80">
                {stripChords(next.text)}
              </p>
            </div>
          )}
        </div>
      )}

      <ClockOverlay show={Boolean(frame.settings.showClock)} position={frame.settings.clockPosition ?? "top-right"} />
      <AlertBar alert={frame.alert} />
    </div>
  );
}

export function SlideStage({
  frame,
  variant,
  className,
  statusOverride,
}: {
  frame: LiveFrame;
  variant: "audience" | "stage" | "preview";
  className?: string;
  statusOverride?: OutputStatus;
}) {
  const { ref, scale, bar } = useScale(variant === "preview" ? "contain" : frame.settings.fitMode);
  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-stage", className)}>
      <div
        className="absolute origin-top-left"
        style={{
          width: VW,
          height: VH,
          transform: `translate(${bar.x}px, ${bar.y}px) scale(${scale})`,
        }}
      >
        <SlideCanvas frame={frame} variant={variant} statusOverride={statusOverride} />
      </div>
    </div>
  );
}
