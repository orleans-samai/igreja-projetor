import { Check, Gauge, Sparkles, Zap, ZapOff } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { AJUDA_QUALIDADE, ROTULO_QUALIDADE } from "../qualidade.ts";
import type { VfxModo, VfxQualidade } from "../tipos.ts";
import { useVfxAuto } from "../auto-store.ts";
import { useVfxStore } from "../store.ts";

/**
 * Mais → VFX.
 *
 * Três modos e um teto de qualidade, cada um com a frase que diz o que
 * muda no culto — não o que muda no código. Quem opera a cabine escolhe
 * entre "o telão pode engasgar" e "o telão fica simples", e é assim que a
 * tela fala.
 */

const MODOS: { id: VfxModo; rotulo: string; icone: ReactNode; frase: string }[] = [
  {
    id: "ligado",
    rotulo: "Ativado",
    icone: <Zap className="size-4" aria-hidden />,
    frase: "Habilita efeitos visuais e vídeos dinâmicos, no teto de qualidade escolhido abaixo.",
  },
  {
    id: "desligado",
    rotulo: "Desativado",
    icone: <ZapOff className="size-4" aria-hidden />,
    frase: "Desliga efeitos pesados e usa apenas recursos leves. Vídeos já salvos continuam tocando.",
  },
  {
    id: "auto",
    rotulo: "Automático",
    icone: <Gauge className="size-4" aria-hidden />,
    frase:
      "O Lúmen mede os quadros por segundo e reduz ou desliga os efeitos pesados quando " +
      "detecta baixo desempenho, priorizando a estabilidade da projeção.",
  },
];

const QUALIDADES: VfxQualidade[] = ["leve", "equilibrado", "alta"];

function Cartao({
  ligado,
  titulo,
  icone,
  frase,
  onClick,
}: {
  ligado: boolean;
  titulo: string;
  icone?: ReactNode;
  frase: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ligado}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-3 text-left",
        "transition-[box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        ligado
          ? "bg-elevated shadow-[0_0_0_1px_var(--color-accent)]"
          : "shadow-[var(--shadow-border)] hover:bg-elevated",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", ligado ? "text-accent" : "text-muted")}>
        {icone ?? <Sparkles className="size-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-body font-semibold text-fg">{titulo}</span>
          {ligado && <Check className="size-3.5 shrink-0 text-accent" aria-hidden />}
        </span>
        <span className="mt-0.5 block text-secondary text-muted">{frase}</span>
      </span>
    </button>
  );
}

export function VfxDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const modo = useVfxStore((s) => s.modo);
  const qualidade = useVfxStore((s) => s.qualidade);
  const definirModo = useVfxStore((s) => s.definirModo);
  const definirQualidade = useVfxStore((s) => s.definirQualidade);
  const reiniciarMedicao = useVfxAuto((s) => s.reiniciar);

  // Mexer no modo ou no teto recomeça a medição: o que derrubou a
  // qualidade pode ter sido o vídeo que já parou de tocar, e herdar esse
  // julgamento seria punir o operador por um engasgo que passou.
  const escolherModo = (m: VfxModo) => {
    definirModo(m);
    reiniciarMedicao(qualidade);
  };
  const escolherQualidade = (q: VfxQualidade) => {
    definirQualidade(q);
    reiniciarMedicao(q);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="VFX"
        description="Efeitos visuais e vídeos dinâmicos, no ritmo que este computador aguenta."
        className="w-[min(560px,calc(100%-1.5rem))]"
      >
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            {MODOS.map((m) => (
              <Cartao
                key={m.id}
                ligado={modo === m.id}
                titulo={m.rotulo}
                icone={m.icone}
                frase={m.frase}
                onClick={() => escolherModo(m.id)}
              />
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-secondary font-semibold text-muted">
              Qualidade {modo === "auto" && <span className="font-normal">(teto do automático)</span>}
            </h3>
            {QUALIDADES.map((q) => (
              <Cartao
                key={q}
                ligado={qualidade === q}
                titulo={ROTULO_QUALIDADE[q]}
                frase={AJUDA_QUALIDADE[q]}
                onClick={() => escolherQualidade(q)}
              />
            ))}
          </section>

          <p className="rounded-lg bg-elevated p-3 text-secondary text-muted">
            {modo === "desligado"
              ? "Com o VFX desativado, a aba Vídeos dinâmicos fica indisponível. Os vídeos já salvos continuam na aba Vídeos e tocam normalmente — eles não dependem do VFX."
              : "Efeito desenhado ao vivo custa processamento a cada quadro, no mesmo computador que está projetando. Vídeo já renderizado custa o que qualquer vídeo custa. Quando a composição estiver pronta, use Salvar como vídeo."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
