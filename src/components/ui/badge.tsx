import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "live" | "ok" | "primary" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        tone === "muted" && "bg-elevated text-muted",
        tone === "live" && "bg-live text-accent-fg",
        tone === "ok" && "bg-ok/20 text-ok",
        tone === "primary" && "bg-primary/20 text-primary",
        className,
      )}
      {...props}
    />
  );
}
