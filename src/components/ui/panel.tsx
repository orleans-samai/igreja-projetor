import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Coluna do console: cabeçalho fixo, corpo que rola, filete separando.
 *
 * Não é card. A cabine é uma superfície contínua dividida por filetes de
 * 1px — empilhar caixas com sombra dentro de caixas com sombra rouba altura
 * útil e não acrescenta informação nenhuma.
 */
export function Panel({
  title,
  actions,
  toolbar,
  children,
  className,
}: {
  title?: string;
  /** Controles do painel, alinhados à direita do título. */
  actions?: ReactNode;
  /** Segunda linha: busca, filtros, abas. */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col bg-surface", className)}>
      {(title || actions) && (
        <div className="panel-head justify-between">
          {title && <h2 className="truncate">{title}</h2>}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="border-b border-border px-2 py-2">{toolbar}</div>}
      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

/**
 * Tela vazia é convite para agir: diz o que cabe ali e oferece a ação.
 * Sem ilustração e sem ícone decorativo.
 */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-swap-in px-3 py-6">
      <p className="text-body text-muted">{title}</p>
      {hint && <p className="mt-1 text-secondary text-subtle">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Indicador de saída. Um ponto e um rótulo, sempre no mesmo canto.
 * É a única coisa do console que pode chamar atenção sozinha.
 */
export function Tally({
  state,
  label,
  className,
}: {
  state: "off" | "ready" | "live" | "blank";
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="tally" data-state={state} aria-hidden />
      <span
        className={cn(
          "text-caption font-medium transition-colors duration-[var(--motion-base)]",
          state === "live" ? "text-live" : state === "ready" ? "text-accent" : "text-muted",
        )}
      >
        {label}
      </span>
    </span>
  );
}
