import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Diálogo do console.
 *
 * Entra em 180ms com uma redução mínima de escala e sai em 120ms — abrir
 * merece mais atenção que fechar. O rodapé é opcional e é onde as ações
 * ficam, sempre à direita, sempre na mesma ordem.
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  footer,
  scrollBody = true,
}: {
  className?: string;
  children: ReactNode;
  title: string;
  description?: string;
  footer?: ReactNode;
  /**
   * Desligue quando o conteúdo tiver a própria área de rolagem. Evita a
   * barra dentro da barra, que rola a coisa errada sob o cursor.
   */
  scrollBody?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="veil fixed inset-0 z-50 bg-stage/70" />
      <DialogPrimitive.Content
        className={cn(
          "pop-layer fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[min(680px,calc(100%-1.5rem))]",
          "-translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-surface outline-none",
          "shadow-[var(--shadow-pop),var(--shadow-border)]",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-3.5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-title font-semibold tracking-tight text-fg">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-secondary text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className={cn(
              "-mr-1 -mt-0.5 rounded-md p-1.5 text-muted",
              "transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "hover:bg-elevated hover:text-fg active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </header>

        <div
          className={cn(
            "min-h-0 flex-1 px-4 pb-4",
            scrollBody ? "lumen-scroll overflow-y-auto" : "overflow-hidden",
          )}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
