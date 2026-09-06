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
        "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3 transition-opacity duration-[var(--motion-fast)]",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="pointer-events-auto flex max-w-3xl flex-wrap justify-center gap-1.5 rounded-xl bg-surface/95 p-2 shadow-[var(--shadow-border)]">
        {ACTIONS.map((a) => (
          <Button key={a.kind} size="sm" variant="secondary" onClick={() => send(a.kind, a.label)}>
            {a.label}
          </Button>
        ))}
        {sent && <span className="self-center px-2 text-xs text-ok">Enviado: {sent}</span>}
      </div>
    </div>
  );
}
