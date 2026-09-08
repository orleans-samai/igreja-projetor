import { useEffect, useState } from "react";
import { SlideStage } from "@/components/slide/slide-renderer";
import { subscribeLiveFrame } from "@/lib/live-channel";
import type { LiveFrame } from "@/lib/types";

const FALLBACK: LiveFrame = {
  v: 1,
  status: "logo",
  theme: {
    id: "tmp",
    name: "",
    backgroundType: "color",
    backgroundValue: "#0b0c0f",
    overlayOpacity: 0,
    fontFamily: "Fraunces",
    fontSize: 64,
    fontWeight: 600,
    uppercase: false,
    textColor: "#eceef2",
    outlineColor: "#000",
    outlineWidth: 2,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.2,
    margin: 8,
    showTitle: false,
    showCopyright: false,
    showReference: true,
    applyTo: "both",
  },
  stageTheme: {
    id: "tmp2",
    name: "",
    backgroundType: "color",
    backgroundValue: "#0b0c0f",
    overlayOpacity: 0,
    fontFamily: "Fraunces",
    fontSize: 56,
    fontWeight: 600,
    uppercase: true,
    textColor: "#eceef2",
    outlineColor: "#000",
    outlineWidth: 2,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.15,
    margin: 8,
    showTitle: true,
    showCopyright: false,
    showReference: true,
    applyTo: "both",
  },
  deck: {
    kind: "text",
    refId: "hello",
    title: "Lúmen",
    subtitle: "",
    slides: [
      { id: "hello", label: "Abertura", text: "Olá, igreja", sortOrder: 0 },
    ],
  },
  index: 0,
  alert: null,
  countdown: null,
  churchName: "Igreja Local",
  logoUrl: "",
  settings: {
    transition: "fade",
    fadeMs: 220,
    chordsOnStage: true,
    chordsOnAudience: false,
    fitMode: "contain",
    margins: { t: 8, r: 8, b: 8, l: 8 },
    showWallpaper: true,
    showClock: false,
    baseFill: "dark",
    clockPosition: "top-right",
  },
  updatedAt: 0,
};

export function ProjectionApp({ variant }: { variant: "audience" | "stage" }) {
  const [frame, setFrame] = useState<LiveFrame>(FALLBACK);

  useEffect(() => subscribeLiveFrame(setFrame), []);

  useEffect(() => {
    if (variant !== "audience") return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "none";
    const onMove = () => {
      document.body.style.cursor = "none";
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      document.body.style.cursor = prev;
      window.removeEventListener("mousemove", onMove);
    };
  }, [variant]);

  useEffect(() => {
    const wantFs =
      variant === "audience" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tela") === "1";

    const goFs = () => {
      if (document.fullscreenElement) return;
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    };

    if (wantFs) {
      const t = window.setTimeout(goFs, 400);
      const onClick = () => goFs();
      window.addEventListener("click", onClick, { once: true });
      window.addEventListener("dblclick", goFs);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("click", onClick);
        window.removeEventListener("dblclick", goFs);
      };
    }

    const onDbl = () => goFs();
    window.addEventListener("dblclick", onDbl);
    return () => window.removeEventListener("dblclick", onDbl);
  }, [variant]);

  return (
    <SlideStage
      frame={frame}
      variant={variant}
      className={variant === "audience" ? "h-dvh w-dvw cursor-none" : "h-dvh w-dvw"}
    />
  );
}
