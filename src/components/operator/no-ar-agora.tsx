import { Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import { stripChords } from "@/lib/lyrics";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O que está no ar agora, e o que vem em seguida.
 *
 * Não é um segundo preview: é a linha que o operador lê sem tirar a mão do
 * teclado, para saber se o telão está mostrando o que ele acha que está. Por
 * isso texto, e não imagem — uma miniatura obriga a interpretar; "Música:
 * Porque Ele Vive · Coro" não obriga.
 */
function tipoDoDeck(kind: string | undefined): string {
  if (kind === "song") return "Música";
  if (kind === "bible") return "Bíblia";
  if (kind === "media") return "Mídia";
  if (kind === "text") return "Aviso";
  if (kind === "countdown") return "Contagem";
  return "";
}

/** Uma prévia curta do slide, para quando ele não tem rótulo próprio. */
function resumo(texto: string | undefined, limite = 48): string {
  if (!texto) return "";
  const limpo = stripChords(texto).replace(/\s+/g, " ").trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}

export function NoArAgora({ className }: { className?: string }) {
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const status = useLumenStore((s) => s.status);

  const noAr = status !== "idle" && Boolean(live);
  const slide = live?.slides[liveIndex];
  const proximo = live?.slides[liveIndex + 1];

  // Preto, logo e ocultar continuam sendo "no ar" — e é justamente aí que o
  // operador mais precisa de uma frase dizendo o que a igreja está vendo.
  const cobertura =
    status === "black"
      ? "Tela preta"
      : status === "logo"
        ? "Logo da igreja"
        : status === "clear"
          ? "Só o fundo, sem letra"
          : null;

  if (!noAr) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className="text-caption font-medium uppercase tracking-wide text-subtle">
          Nada no ar
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className="flex shrink-0 items-center gap-1 text-caption font-semibold uppercase tracking-wide text-live">
        <Radio className="size-3" aria-hidden />
        No ar
      </span>
      <span className="min-w-0 truncate text-secondary text-fg">
        {cobertura ?? (
          <>
            {tipoDoDeck(live?.kind) && (
              <span className="text-muted">{tipoDoDeck(live?.kind)}: </span>
            )}
            {live?.title}
            {slide?.label && <span className="text-muted"> · {slide.label}</span>}
          </>
        )}
      </span>

      {proximo && !cobertura && (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-caption font-semibold uppercase tracking-wide text-subtle">
            Próximo
          </span>
          <span className="min-w-0 truncate text-secondary text-muted">
            {proximo.label || resumo(proximo.text)}
          </span>
        </span>
      )}
    </div>
  );
}
