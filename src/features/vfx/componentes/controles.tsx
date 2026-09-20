import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Os controles do editor de VFX.
 *
 * Tudo é um controle deslizante com o número ao lado, porque quem opera a
 * cabine não vai digitar 0.42 em lugar nenhum — ele arrasta, olha a
 * pré-visualização e para quando ficou bom.
 */

export function Faixa({
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 100,
  passo = 1,
  sufixo = "%",
  dica,
  pesado = false,
  travado = false,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  sufixo?: string;
  dica?: string;
  /** Marca o controle que custa caro, para o olho achar o culpado. */
  pesado?: boolean;
  /** O modo de qualidade não deixa este passar do teto. */
  travado?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-caption font-medium text-muted">
          {rotulo}
          {pesado && (
            <span className="ml-1 text-subtle" title="Custa mais processamento">
              ·
            </span>
          )}
        </label>
        <span className={cn("tnum text-caption", travado ? "text-danger" : "text-subtle")}>
          {Math.round(valor)}
          {sufixo}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
      {dica && <p className="text-caption text-subtle">{dica}</p>}
    </div>
  );
}

export function Cor({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {rotulo}
      </label>
      <input
        id={id}
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-12 cursor-pointer rounded-md bg-elevated p-0.5"
      />
    </div>
  );
}

export function Escolha<T extends string>({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: T;
  onChange: (v: T) => void;
  opcoes: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md bg-elevated px-2 py-1 text-caption text-fg shadow-[var(--shadow-border)]"
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Liga({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {rotulo}
      </label>
      <input
        id={id}
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-accent)]"
      />
    </div>
  );
}

export function Gaveta({
  titulo,
  dica,
  children,
}: {
  titulo: string;
  dica: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2 rounded-lg p-3 shadow-[var(--shadow-border)]">
      <header>
        <h4 className="text-secondary font-semibold text-fg">{titulo}</h4>
        <p className="text-caption text-subtle">{dica}</p>
      </header>
      <div className="grid gap-2.5">{children}</div>
    </section>
  );
}
