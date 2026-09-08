import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Campos do console.
 *
 * O foco troca o fundo e o filete em vez de desenhar um anel grosso: numa
 * sala escura o realce forte cega, e o operador só precisa saber onde o
 * cursor está. `invalid` marca o campo e é lido por leitor de tela.
 */

const base = [
  "w-full rounded-md bg-elevated text-body text-fg",
  "shadow-[var(--shadow-border)] placeholder:text-subtle outline-none",
  "transition-[background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "hover:not-disabled:shadow-[var(--shadow-border-hover)]",
  "focus-visible:bg-raised focus-visible:shadow-[0_0_0_1px_var(--color-ring)]",
  "disabled:cursor-not-allowed disabled:opacity-45",
].join(" ");

const invalidRing = "shadow-[0_0_0_1px_var(--color-danger)] focus-visible:shadow-[0_0_0_1px_var(--color-danger)]";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(base, "h-8 px-2.5", invalid && invalidRing, className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(base, "min-h-28 px-2.5 py-2 leading-relaxed", invalid && invalidRing, className)}
      {...props}
    />
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-caption font-medium text-muted", className)} {...props} />;
}

/**
 * Rótulo, campo e a mensagem de erro logo abaixo — na ordem em que se lê.
 * A mensagem diz o que houve, não pede desculpa.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; invalid: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const help = error ?? hint;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        invalid: Boolean(error),
        "aria-describedby": help ? helpId : undefined,
      })}
      {help && (
        <p
          id={helpId}
          className={cn(
            "animate-swap-in text-caption",
            error ? "text-danger" : "text-subtle",
          )}
        >
          {help}
        </p>
      )}
    </div>
  );
}
