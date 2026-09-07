import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Menu suspenso do console.
 *
 * Radix cuida de teclado, foco e Esc — o menu anterior era feito à mão e não
 * respondia a nenhum dos três. A entrada é de 180ms a partir do canto do
 * gatilho, para o menu parecer sair do botão que o abriu.
 */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  children,
  align = "start",
  className,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        className={cn(
          "pop-layer lumen-scroll z-50 max-h-[min(70dvh,32rem)] min-w-52 overflow-y-auto",
          "rounded-lg bg-elevated p-1 shadow-[var(--shadow-pop),var(--shadow-border)]",
          "origin-(--radix-dropdown-menu-content-transform-origin)",
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  onSelect,
  children,
  shortcut,
  tone = "default",
  disabled,
}: {
  onSelect: () => void;
  children: ReactNode;
  /** Atalho de teclado, alinhado à direita. Ensina o caminho sem mouse. */
  shortcut?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center justify-between gap-6 rounded-md px-2 py-1.5",
        "text-body outline-none",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "data-highlighted:bg-raised",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        tone === "danger" ? "text-danger data-highlighted:text-danger" : "text-fg",
      )}
    >
      <span className="truncate">{children}</span>
      {shortcut && <span className="tnum shrink-0 text-caption text-subtle">{shortcut}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2 pb-1 pt-2 text-caption font-semibold text-subtle">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}
