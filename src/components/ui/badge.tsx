import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Etiqueta discreta: grupo da música, tipo da mídia, fonte da letra.
 *
 * Deliberadamente sem preenchimento no tom neutro — a maioria dos usos é
 * metadado, e metadado não deve competir com o título que está ao lado.
 * Só "no ar" ganha fundo cheio, porque é a única informação urgente.
 */
export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "live" | "ok" | "primary" }) {
  return (
    <span
      className={cn(
        "tnum inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5",
        "text-caption font-medium leading-none",
        tone === "muted" && "text-subtle shadow-[var(--shadow-border)]",
        tone === "primary" && "text-muted shadow-[var(--shadow-border-hover)]",
        tone === "ok" && "text-ok shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-ok)_40%,transparent)]",
        tone === "live" && "bg-live text-live-fg",
        className,
      )}
      {...props}
    />
  );
}
