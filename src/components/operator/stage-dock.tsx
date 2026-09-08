import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { makeRequest, publishOps } from "@/lib/ops-channel";
import { cn } from "@/lib/cn";

const ACTIONS = [
  { kind: "repeat-chorus" as const, label: "Repetir refrão" },
  { kind: "bridge" as const, label: "Ponte" },
  { kind: "repeat-verse" as const, label: "Repetir verso" },
  { kind: "hold" as const, label: "Prolongar" },
  { kind: "next-song" as const, label: "Próxima música" },
  { kind: "end" as const, label: "Encerrar" },
];

export function StageDock() {
  const [visible, setVisible] = useState(true);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let t: number;
    const bump = () => {
      setVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setVisible(false), 4000);
    };
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("touchstart", bump);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("touchstart", bump);
    };
  }, []);

  const send = (kind: (typeof ACTIONS)[number]["kind"], label: string) => {
    publishOps({ type: "request", request: makeRequest("louvor", kind, label) });
    setSent(label);
    window.setTimeout(() => setSent(null), 1600);
  };

  return (
    <div
      className={cn(
        // Some do palco quando ninguém mexe: o telão de retorno é para ler a
        // letra, não para olhar botão. Volta ao primeiro toque.
        "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3",
        "transition-[opacity,transform] duration-[var(--motion-slow)] ease-[var(--ease-out)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div className="pointer-events-auto flex max-w-3xl flex-wrap justify-center gap-1.5 rounded-xl bg-surface/95 p-2 shadow-[var(--shadow-pop),var(--shadow-border)]">
        {ACTIONS.map((a) => (
          <Button key={a.kind} size="lg" variant="secondary" onClick={() => send(a.kind, a.label)}>
            {a.label}
          </Button>
        ))}
        {sent && (
          <span className="animate-swap-in self-center px-2 text-secondary text-ok">
            Enviado: {sent}
          </span>
        )}
      </div>
    </div>
  );
}
