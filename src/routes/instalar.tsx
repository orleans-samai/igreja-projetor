import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Monitor, Power, Tv } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LumenMark } from "@/components/logo";
import {
  isStandalone,
  isWindows,
  recommendedBrowser,
  windowsInstallSteps,
} from "@/lib/windows-desktop";
import { useOpsStore } from "@/store/ops-store";

export const Route = createFileRoute("/instalar")({ component: Instalar });

export function Instalar() {
  const navigate = useNavigate();
  const setOpen = useOpsStore((s) => s.setWindowsSetupOpen);
  const win = isWindows();
  const standalone = isStandalone();
  const steps = windowsInstallSteps(recommendedBrowser());

  return (
    <div className="min-h-dvh bg-bg px-4 py-10 text-fg">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="flex items-center gap-3">
          <LumenMark className="size-10" />
          <div>
            <p className="text-secondary text-subtle">Cabine Windows</p>
            <h1 className="text-display font-semibold tracking-tight">Instalar o Lúmen</h1>
          </div>
        </header>

        <p className="text-muted">
          {standalone
            ? "Este Lúmen já está instalado como aplicativo neste computador."
            : win
              ? "No PC da cabine, rode o Lúmen-Setup.exe. Depois abra pelo Menu Iniciar, como qualquer programa."
              : "No notebook da igreja, rode o instalador Lúmen-Setup.exe (Windows 10 ou 11, 64 bits). Não precisa de administrador."}
        </p>

        <ul className="grid gap-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-body text-fg">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-body text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid gap-3 sm:grid-cols-3">
          <Hint icon={<Download className="size-4" />} title="Menu Iniciar" text="Procure Lúmen depois de instalar. Fixe na barra de tarefas." />
          <Hint icon={<Tv className="size-4" />} title="Windows + P" text="Estender. Cabine no notebook, igreja no projetor." />
          <Hint icon={<Power className="size-4" />} title="Energia" text="Alto desempenho no culto. O Lúmen também impede a tela de dormir." />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setOpen(true);
              void navigate({ to: "/" });
            }}
          >
            Abrir a cabine
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/projetor">
              <Monitor className="size-4" /> Testar telão
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Hint({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-elevated p-4">
      <p className="flex items-center gap-2 text-body font-medium">
        {icon}
        {title}
      </p>
      <p className="mt-1 text-secondary text-muted">{text}</p>
    </div>
  );
}
