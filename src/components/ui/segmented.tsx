import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Contagem à direita do rótulo — nunca inventa número, só mostra o que existe. */
  count?: number;
  /**
   * Puxa o olho para esta aba quando ela não está escolhida.
   *
   * Existe para uma aba que o operador procura no meio do culto e não pode
   * caçar — a Bíblia, quando o pregador pede um versículo na hora.
   */
  destaque?: boolean;
  /**
   * Aba que existe mas não abre agora.
   *
   * Continua na fileira, apagada, em vez de sumir: uma aba que some leva
   * junto a explicação de por que ela sumiu.
   */
  disabled?: boolean;
  /** O porquê, para o cursor parado em cima contar. */
  title?: string;
}

/**
 * Grupo de abas com um indicador que desliza de uma para a outra.
 *
 * O deslize é a informação: o operador vê para onde foi, em vez de o realce
 * sumir num lugar e piscar noutro. Na primeira renderização o indicador é
 * posicionado sem animação, para a tela não abrir com algo se mexendo.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  full = false,
  label,
}: {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Ocupa toda a largura, dividindo o espaço igualmente. */
  full?: boolean;
  label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const settled = useRef(false);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-on="true"]');
    if (!active) return;
    setBox({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  useLayoutEffect(measure, [measure, value, items]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const obs = new ResizeObserver(measure);
    obs.observe(list);
    return () => obs.disconnect();
  }, [measure]);

  useEffect(() => {
    if (box) settled.current = true;
  }, [box]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = items.findIndex((it) => it.value === value);
    // Pula as desabilitadas: a seta que para numa aba que não abre deixa o
    // teclado preso ali.
    for (let passo = 1; passo <= items.length; passo += 1) {
      const next = items[(i + dir * passo + items.length * passo) % items.length];
      if (next && !next.disabled) {
        onChange(next.value);
        return;
      }
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-md bg-elevated p-0.5",
        "shadow-[var(--shadow-border)]",
        full && "flex w-full",
        className,
      )}
    >
      {box && (
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded-sm bg-raised",
            settled.current &&
              "transition-[transform,width] duration-[var(--motion-base)] ease-[var(--ease-out)]",
          )}
          style={{ transform: `translateX(${box.left}px)`, width: box.width, left: 0 }}
        />
      )}
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            data-on={on}
            disabled={item.disabled}
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative z-10 inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-sm",
              full ? "px-1" : "px-2.5",
              "text-secondary font-medium whitespace-nowrap",
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              "[&_svg]:size-3.5 [&_svg]:shrink-0",
              on
                ? "text-fg"
                : item.destaque
                  ? "text-accent hover:text-accent"
                  : "text-muted hover:text-fg",
              item.disabled && "cursor-default opacity-45 hover:text-muted",
              full && "flex-1",
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {typeof item.count === "number" && (
              <span className="tnum text-caption text-subtle">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
