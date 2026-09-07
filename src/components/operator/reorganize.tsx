import { Check, GripHorizontal, LayoutGrid, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { NOME_PAINEL, ORDEM_PADRAO, trocar, type PainelId } from "@/lib/paineis";
import { useOpsStore } from "@/store/ops-store";

/**
 * Modo de reorganizar as colunas.
 *
 * Fora dele, nada muda: a cabine não ganha alça nenhuma, nem borda extra, nem
 * cursor diferente. Arrastar painel é coisa que se faz uma vez, quando a
 * igreja monta a cabine, e não durante o culto — deixar a alça sempre à vista
 * cobraria o preço todo domingo por um ajuste feito uma vez.
 *
 * Enquanto o modo está ligado, cada coluna ganha uma capa que se arrasta.
 * Soltar uma capa em cima de outra troca as duas de lugar.
 */

/** Alça que cobre uma coluna enquanto o operador reorganiza. */
export function PainelArrastavel({ id }: { id: PainelId }) {
  const reorganizando = useOpsStore((s) => s.reorganizando);
  const ordem = useOpsStore((s) => s.ordemPaineis);
  const setOrdem = useOpsStore((s) => s.setOrdemPaineis);
  const [alvo, setAlvo] = useState(false);

  if (!reorganizando) return null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lumen-painel", id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setAlvo(true);
      }}
      onDragLeave={() => setAlvo(false)}
      onDrop={(e) => {
        e.preventDefault();
        setAlvo(false);
        const vindo = e.dataTransfer.getData("text/lumen-painel") as PainelId;
        if (vindo && vindo !== id) setOrdem(trocar(ordem, vindo, id));
      }}
      onDragEnd={() => setAlvo(false)}
      className={cn(
        "animate-pop-in absolute inset-0 z-30 flex cursor-grab flex-col items-center justify-center gap-2",
        "bg-stage/78 backdrop-blur-[1px] active:cursor-grabbing",
        "transition-[box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        alvo
          ? "bg-stage/60 shadow-[inset_0_0_0_2px_var(--color-accent)]"
          : "shadow-[inset_0_0_0_1px_var(--color-border-strong)]",
      )}
    >
      <GripHorizontal className="size-5 text-muted" aria-hidden />
      <p className="px-2 text-center text-title font-semibold text-fg">{NOME_PAINEL[id]}</p>
      <p className="px-3 text-center text-caption text-subtle">
        {alvo ? "Solte para trocar" : "Arraste para outra coluna"}
      </p>
      <p className="tnum text-caption text-subtle">
        {ordem.indexOf(id) + 1}ª de {ordem.length}
      </p>
    </div>
  );
}

/**
 * Faixa do modo, com a saída sempre à vista.
 *
 * Um modo em que se entra sem ver como sair é uma armadilha; e mexer na
 * cabine sem poder desfazer, também. Daí "Voltar ao padrão" morar aqui, ao
 * lado de "Concluir".
 */
export function ReorganizeBar() {
  const reorganizando = useOpsStore((s) => s.reorganizando);
  const setReorganizando = useOpsStore((s) => s.setReorganizando);
  const ordem = useOpsStore((s) => s.ordemPaineis);
  const setOrdem = useOpsStore((s) => s.setOrdemPaineis);

  // Esc sai do modo, como sai de qualquer outra camada do app.
  useEffect(() => {
    if (!reorganizando) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setReorganizando(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [reorganizando, setReorganizando]);

  if (!reorganizando) return null;

  const noPadrao = ordem.every((id, i) => id === ORDEM_PADRAO[i]);

  return (
    <div className="animate-swap-in flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-3 py-1">
      <LayoutGrid className="size-3.5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-secondary text-fg">
        Arraste uma coluna sobre outra para trocá-las de lugar.{" "}
        <span className="text-muted">
          Ordem atual: {ordem.map((id) => NOME_PAINEL[id]).join(" · ")}
        </span>
      </p>
      <Button
        size="sm"
        variant="ghost"
        disabled={noPadrao}
        onClick={() => setOrdem([...ORDEM_PADRAO])}
      >
        <RotateCcw /> Voltar ao padrão
      </Button>
      <Button size="sm" onClick={() => setReorganizando(false)}>
        <Check /> Concluir
      </Button>
    </div>
  );
}
