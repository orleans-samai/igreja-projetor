import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Botão do console.
 *
 * Estados: repouso, hover, pressionado, foco, desabilitado, carregando,
 * sucesso e erro. Pressionar encolhe 3% e volta com uma folga mínima — é o
 * retorno tátil que falta quando não existe clique físico.
 *
 * `live` é reservado ao que está no ar. Nada mais no app usa tungstênio.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium select-none",
    "transition-[background-color,color,box-shadow,transform,opacity]",
    "duration-[var(--motion-fast)] ease-[var(--ease-out)]",
    "active:scale-[0.97] active:duration-75",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:bg-primary/85",
        secondary:
          "bg-elevated text-fg shadow-[var(--shadow-border)] hover:bg-raised hover:shadow-[var(--shadow-border-hover)]",
        ghost: "text-muted hover:bg-elevated hover:text-fg",
        outline:
          "text-fg shadow-[var(--shadow-border)] hover:bg-elevated hover:shadow-[var(--shadow-border-hover)]",
        danger: "bg-danger text-danger-fg hover:bg-danger/85",
        live: "bg-live text-live-fg hover:bg-live/85",
      },
      size: {
        default: "h-8 px-3 text-body",
        sm: "h-7 px-2.5 text-secondary",
        lg: "h-10 px-4 text-body",
        icon: "size-8",
        iconSm: "size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mostra o giro no lugar do ícone e bloqueia o clique. */
  loading?: boolean;
  /** Confirmação ou falha momentânea da última ação. */
  feedback?: "ok" | "error" | null;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading = false,
  feedback = null,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    buttonVariants({ variant, size }),
    feedback === "ok" && "is-ok",
    feedback === "error" && "is-error",
    className,
  );

  // Slot exige um único filho, então o giro só entra no botão de verdade.
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
