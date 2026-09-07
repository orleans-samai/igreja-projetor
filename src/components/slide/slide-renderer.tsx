/**
 * Single slide renderer used by:
 *  - operator 16:9 preview
 *  - audience projection window
 *  - stage return window
 *
 * Layout is authored at 1920×1080 and scaled with a transform so the operator
 * preview matches the telão (safe area, type size, outline).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChurchLogo } from "@/components/logo";
import { stripChords } from "@/lib/lyrics";
import { fadeDurationMs, slideKey } from "@/lib/transition";
import type { ClockPosition, FitMode, LiveFrame, OutputStatus, Theme } from "@/lib/types";
import { cn } from "@/lib/cn";
import { YoutubeStage } from "@/components/projection/youtube-stage";
import { capaDoVideo } from "@/lib/youtube";

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
    fontFamily: `${theme.fontFamily === "Fraunces" ? "Fraunces Variable" : theme.fontFamily === "Instrument Sans" ? "Instrument Sans Variable" : theme.fontFamily}, var(--font-display)`,
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
  if (theme.backgroundType === "animated") {
    return (
      <>
        {fill}
        <div className={cn("absolute inset-0 lumen-bg", theme.backgroundValue)} aria-hidden />
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
  const [now, setNow] = useState(() => Date.now());
  const until = alert?.until ?? 0;
  // Sem aviso no ar o telão não gasta um timer a cada 250ms o culto inteiro.
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [until]);
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

interface SlideContent {
  body: string;
  title: string;
  reference: string;
  copyright: string;
}

/** Um slide desenhado; duas camadas destas se dissolvem na troca. */
function SlideBody({
  content,
  paint,
  alignV,
}: {
  content: SlideContent;
  paint: Theme;
  alignV: Theme["alignV"];
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col",
        alignV === "top" && "justify-start",
        alignV === "center" && "justify-center",
        alignV === "bottom" && "justify-end",
      )}
    >
      {/* Título, referência e copyright herdam a cor do tema, não uma cor
          clara fixa: em tema de fundo claro — Papel, Areia, Alva — o texto
          fixo sumia contra o fundo. */}
      {content.title && (
        <p
          className="mb-6 font-display text-3xl font-medium tracking-wide"
          style={{ color: paint.textColor, opacity: 0.8 }}
        >
          {content.title}
        </p>
      )}
      <div className="slide-text max-w-full" style={textStyle(paint)}>
        {content.body}
      </div>
      {content.reference && (
        <p
          className="mt-8 font-display text-3xl font-medium"
          style={{ color: paint.textColor, opacity: 0.78 }}
        >
          {content.reference}
        </p>
      )}
      {content.copyright && (
        <p className="mt-6 text-xl" style={{ color: paint.textColor, opacity: 0.5 }}>
          {content.copyright}
        </p>
      )}
    </div>
  );
}

/**
 * Segura o slide anterior montado por `ms` para que um dissolva no outro.
 * Retorna a camada que está saindo — null no corte seco.
 */
function useLeavingSlide(key: string, content: SlideContent, ms: number) {
  const [leaving, setLeaving] = useState<{ id: number; content: SlideContent } | null>(null);
  const shown = useRef({ key, content });
  const seq = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (shown.current.key === key) {
      shown.current.content = content;
      return;
    }
    const old = shown.current.content;
    shown.current = { key, content };
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (ms <= 0) {
      setLeaving(null);
      return;
    }
    seq.current += 1;
    const id = seq.current;
    setLeaving({ id, content: old });
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setLeaving((cur) => (cur && cur.id === id ? null : cur));
    }, ms);
  }, [key, content, ms]);

  return leaving;
}

/**
 * Mídia no telão.
 *
 * O som sai só na janela do público: o preview da cabine e o retorno de palco
 * tocam mudos, senão o mesmo vídeo sairia duas ou três vezes na caixa.
 *
 * Se a fonte não carregar, mostra o porquê em vez de deixar o telão preto —
 * o caso comum é mídia importada por sessão, cujo endereço `blob:` só vale
 * dentro da janela que importou.
 */
function MediaStage({
  src,
  type,
  title,
  fitMode,
  variant,
}: {
  src: string;
  type?: "image" | "video" | "audio";
  title: string;
  fitMode: FitMode;
  variant: "audience" | "stage" | "preview";
}) {
  const [erro, setErro] = useState(false);
  const fit = fitMode === "cover" ? "object-cover" : "object-contain";

  if (erro) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-16 text-center">
        <p className="font-display text-4xl text-stage-fg">{title}</p>
        <p className="max-w-3xl text-2xl text-stage-fg/70">
          O telão não conseguiu abrir este arquivo. Mídia importada por sessão só aparece na
          cabine — ponha o arquivo na pasta de mídia para projetar.
        </p>
      </div>
    );
  }

  // Áudio não tem imagem e quem toca é o player da cabine, que tem play,
  // pausa e volume na mão do operador. Aqui só mostramos o que está tocando,
  // senão o mesmo arquivo sairia duas vezes na caixa de som.
  if (type === "audio") {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center px-16">
        <p className="text-center font-display text-4xl text-stage-fg/85">{title}</p>
      </div>
    );
  }

  if (type === "video") {
    return (
      <video
        key={src}
        src={src}
        autoPlay
        playsInline
        muted={variant !== "audience"}
        onError={() => setErro(true)}
        className={cn("absolute inset-0 z-10 size-full", fit)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={title}
      onError={() => setErro(true)}
      className={cn("absolute inset-0 z-10 size-full", fit)}
    />
  );
}

/**
 * O que a cabine e o palco veem no lugar do vídeo.
 *
 * Capa parada, sem player e sem som. O operador precisa saber o que está no
 * ar; o que ele não pode é ouvir o mesmo áudio uma segunda vez.
 */
function CapaDoYoutube({ frame }: { frame: NonNullable<LiveFrame["youtube"]> }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black">
      <img
        src={capaDoVideo(frame.videoId)}
        alt=""
        className="max-h-[70%] max-w-[80%] object-contain"
      />
      <p className="max-w-[80%] truncate text-[1.6rem] text-white/70">
        {frame.titulo || "Vídeo do YouTube"}
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
  const showWallpaper = frame.settings.showWallpaper !== false && !frame.settings.lowPerformance;
  const baseFill = frame.settings.baseFill ?? "dark";
  const fitMode = frame.settings.fitMode ?? "contain";
  const onPaper = !showWallpaper && baseFill === "light";
  const paint = onPaper
    ? { ...theme, textColor: "var(--color-paper-fg)", outlineWidth: 0, shadow: false }
    : theme;

  let body: string = slide?.text ?? "";
  if (!showChords) body = stripChords(body);
  if (variant === "stage" && theme.uppercase) body = body.toUpperCase();

  const fadeMs = frame.settings.lowPerformance ? 0 : fadeDurationMs(frame.settings);
  const key = slideKey(frame.deck?.refId, slide?.id);
  const content = useMemo<SlideContent>(
    () => ({
      body,
      title: theme.showTitle && frame.deck?.kind === "song" ? frame.deck.title : "",
      reference: theme.showReference ? (slide?.reference ?? "") : "",
      copyright: theme.showCopyright ? (frame.deck?.copyright ?? "") : "",
    }),
    [
      body,
      theme.showTitle,
      theme.showReference,
      theme.showCopyright,
      frame.deck?.kind,
      frame.deck?.title,
      frame.deck?.copyright,
      slide?.reference,
    ],
  );
  const leaving = useLeavingSlide(key, content, fadeMs);

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

      {/* Mídia ocupa o telão inteiro. Antes o baralho de mídia caía no
          desenho de texto e o culto via o nome do arquivo escrito na tela. */}
      {!hideText && frame.deck?.kind === "media" && frame.deck.mediaSrc && (
        <MediaStage
          src={frame.deck.mediaSrc}
          type={frame.deck.mediaType}
          title={frame.deck.title}
          fitMode={fitMode}
          variant={variant}
        />
      )}

      {status === "presenting" && frame.deck?.kind === "countdown" && (
        <div className="relative z-10 h-full text-stage-fg" style={textStyle(paint)}>
          <CountdownView frame={frame} />
        </div>
      )}

      {status !== "black" &&
        !isLogo &&
        frame.deck?.kind !== "countdown" &&
        !(frame.deck?.kind === "media" && frame.deck.mediaSrc) &&
        !hideText &&
        slide && (
        <div className="relative z-10 h-full">
          {leaving && (
            <div
              key={`saindo-${leaving.id}`}
              className="absolute inset-0"
              style={{ animation: `lumen-slide-out ${fadeMs}ms ease forwards` }}
              aria-hidden
            >
              <SlideBody content={leaving.content} paint={paint} alignV={theme.alignV} />
            </div>
          )}
          <div
            key={key}
            className="absolute inset-0"
            style={fadeMs > 0 ? { animation: `lumen-slide-in ${fadeMs}ms ease forwards` } : undefined}
          >
            <SlideBody content={content} paint={paint} alignV={theme.alignV} />
          </div>
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

  // O vídeo do YouTube cobre o telão enquanto estiver projetado, e fica fora
  // do canvas de 1920×1080: dentro dele o iframe seria rasterizado e depois
  // escalado, e o vídeo chegaria à igreja mais mole do que precisa.
  //
  // Só a plateia recebe o player de verdade. O preview da cabine e cada
  // miniatura da grade de letras também passam por aqui, e um player por
  // miniatura significaria o mesmo áudio saindo dez vezes; esses veem a capa.
  if (frame.youtube) {
    return (
      <div className={cn("relative overflow-hidden bg-black", className)}>
        {variant === "audience" ? (
          <YoutubeStage frame={frame.youtube} />
        ) : (
          <CapaDoYoutube frame={frame.youtube} />
        )}
      </div>
    );
  }

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
