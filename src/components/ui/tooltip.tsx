import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={120}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/**
 * Dica de controle. Entra deslocada do lado em que aparece, para o olho saber
 * de onde ela veio, e mostra o atalho de teclado alinhado à direita — é assim
 * que o operador aprende a parar de usar o mouse.
 */
export function Hint({
  label,
  keys,
  side = "top",
  children,
}: {
  label: string;
  keys?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "pop-layer z-50 flex items-center gap-2 rounded-md bg-raised px-2 py-1",
            "text-caption text-fg shadow-[var(--shadow-pop),var(--shadow-border)]",
          )}
        >
          {label}
          {keys && (
            <kbd className="tnum rounded-sm bg-elevated px-1 py-px font-sans text-caption text-muted">
              {keys}
            </kbd>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
