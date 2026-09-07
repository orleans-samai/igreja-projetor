import { ChevronDown, Copy, Minus, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";
import { GRID_ZOOM_MAX, useOpsStore } from "@/store/ops-store";

/**
 * Quatro tamanhos, não um controle contínuo.
 *
 * O operador escolhe entre "cabe tudo na tela" e "dá para ler de longe";
 * qualquer valor entre um e outro só daria trabalho de mirar. A faixa cresce
 * junto com o cartão, então a altura nunca fica sobrando nem faltando.
 */
const PASSOS = [
  { largura: 148, rotulo: "P" },
  { largura: 208, rotulo: "M" },
  { largura: 288, rotulo: "G" },
  { largura: 384, rotulo: "GG" },
] as const;

/**
 * Tamanho de letra que faz o slide inteiro caber no cartão.
 *
 * Cortar a letra derrotaria a grade: ela existe justamente para o operador
 * ler o slide todo sem abrir nada. Então o texto encolhe até caber — pela
 * altura, contando as linhas, e pela largura, medindo a linha mais longa.
 * A conta é aproximada de propósito; medir de verdade custaria um layout por
 * cartão a cada tecla, e o erro de meio caractere não muda nada aqui.
 */
function tamanhoDaLetra(texto: string, largura: number, altura: number) {
  const linhas = texto.split("\n");
  const maisLonga = linhas.reduce((n, l) => Math.max(n, l.length), 1);
  const porAltura = (altura - 22) / (Math.max(1, linhas.length) * 1.35);
  const porLargura = (largura - 18) / (maisLonga * 0.54);
  return Math.max(7, Math.min(Math.round(largura * 0.055), porAltura, porLargura));
}

/**
 * A grade de letras.
 *
 * Todos os slides do que está no preview, lado a lado, com a letra inteira
 * visível — é a folha do músico, não um índice. Um clique manda o slide para
 * o telão na hora: é o gesto do culto, e o mesmo que o preview grande já faz.
 *
 * Editar e repetir seção continuam existindo, agora no próprio cartão: o
 * botão aparece com o cursor, e o clique com o botão direito abre a edição —
 * como já era na lista que esta faixa substituiu.
 */
export function SlideGrid() {
  const preview = useLumenStore((s) => s.preview);
  const previewIndex = useLumenStore((s) => s.previewIndex);
  const setPreviewIndex = useLumenStore((s) => s.setPreviewIndex);
  const presentSlide = useLumenStore((s) => s.presentSlide);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const status = useLumenStore((s) => s.status);
  const reorderPreview = useLumenStore((s) => s.reorderPreview);
  const duplicatePreviewLabel = useLumenStore((s) => s.duplicatePreviewLabel);

  const zoom = useOpsStore((s) => s.gridZoom);
  const bumpZoom = useOpsStore((s) => s.bumpGridZoom);
  const aberta = useOpsStore((s) => s.gridOpen);
  const setAberta = useOpsStore((s) => s.setGridOpen);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const passo = PASSOS[Math.max(0, Math.min(PASSOS.length - 1, zoom))] ?? PASSOS[1];
  const largura = passo.largura;
  const altura = Math.round((largura * 9) / 16);
  const slides = preview?.slides ?? [];
  const noArAqui = status !== "idle" && live?.refId === preview?.refId;

  return (
    <section
      aria-label="Letras do slide"
      className="shrink-0 border-t border-border bg-surface"
      data-tour="grade"
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          aria-expanded={aberta}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-caption font-medium text-subtle",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-[var(--motion-base)] ease-[var(--ease-out)]",
              !aberta && "-rotate-90",
            )}
          />
          Letras <span className="tnum">{slides.length}</span>
        </button>

        <p className="min-w-0 flex-1 truncate text-caption text-subtle">
          {slides.length > 0 ? "Um clique manda o slide para o telão." : ""}
        </p>

        <div className="flex shrink-0 items-center gap-0.5">
          <Hint label="Diminuir os cartões">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Diminuir os cartões"
              disabled={zoom <= 0}
              onClick={() => bumpZoom(-1)}
            >
              <Minus />
            </Button>
          </Hint>
          <span className="tnum w-6 text-center text-caption text-subtle">{passo.rotulo}</span>
          <Hint label="Aumentar os cartões">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Aumentar os cartões"
              disabled={zoom >= GRID_ZOOM_MAX}
              onClick={() => bumpZoom(1)}
            >
              <Plus />
            </Button>
          </Hint>
        </div>
      </div>

      {aberta && (
        <div
          className="lumen-scroll overflow-y-auto border-t border-border px-2 py-2"
          style={{ height: altura + 28 }}
        >
          {slides.length === 0 ? (
            <p className="text-secondary text-subtle">
              Escolha uma música ou um versículo para ver as letras aqui.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {slides.map((slide, i) => {
                const noAr = noArAqui && i === liveIndex;
                const emPreparo = i === previewIndex;
                return (
                  <li key={slide.id}>
                    <div
                      draggable
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => setDragFrom(null)}
                      onDrop={() => {
                        if (dragFrom !== null && dragFrom !== i) reorderPreview(dragFrom, i);
                        setDragFrom(null);
                      }}
                      className={cn("group/card relative", dragFrom === i && "opacity-40")}
                    >
                      <button
                        type="button"
                        onClick={() => presentSlide(i)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setPreviewIndex(i);
                          useOpsStore.getState().setSlideEditId(slide.id);
                        }}
                        aria-label={`Mandar ${slide.label} para o telão`}
                        style={{ width: largura, height: altura }}
                        className={cn(
                          "relative block overflow-hidden rounded-md bg-stage text-center",
                          "transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                          "active:scale-[0.97]",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          noAr
                            ? "shadow-[0_0_0_2px_var(--color-live)]"
                            : emPreparo
                              ? "shadow-[0_0_0_2px_var(--color-fg)]"
                              : "shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                        )}
                      >
                        <span className="flex size-full items-center justify-center px-2 py-4">
                          <span
                            className="whitespace-pre-wrap leading-snug text-stage-fg"
                            style={{ fontSize: tamanhoDaLetra(slide.text, largura, altura) }}
                          >
                            {slide.text}
                          </span>
                        </span>

                        {largura >= 208 && (
                          <span className="absolute left-1.5 top-1 max-w-[60%] truncate text-caption text-stage-fg/60">
                            {slide.label}
                          </span>
                        )}

                        <span
                          className={cn(
                            "tnum absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm px-1.5",
                            "text-caption",
                            noAr ? "bg-live text-live-fg" : "bg-stage/80 text-stage-fg/70",
                          )}
                        >
                          {i + 1}
                        </span>
                      </button>

                      {/* Ações do cartão: só com o cursor em cima, para a grade
                          continuar sendo letra e não uma parede de botões. */}
                      <div
                        className={cn(
                          "absolute right-1 top-1 flex items-center gap-0.5 opacity-0",
                          "transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                          "group-hover/card:opacity-100 focus-within:opacity-100",
                        )}
                      >
                        <Hint label="Editar este slide">
                          <Button
                            size="iconSm"
                            variant="secondary"
                            aria-label={`Editar ${slide.label}`}
                            onClick={() => {
                              setPreviewIndex(i);
                              useOpsStore.getState().setSlideEditId(slide.id);
                            }}
                          >
                            <Pencil />
                          </Button>
                        </Hint>
                        <Hint label="Repetir esta seção no fim">
                          <Button
                            size="iconSm"
                            variant="secondary"
                            aria-label={`Repetir ${slide.label}`}
                            onClick={() =>
                              duplicatePreviewLabel(slide.label.split(" ")[0] ?? slide.label)
                            }
                          >
                            <Copy />
                          </Button>
                        </Hint>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <SlideEditorDialog />
    </section>
  );
}

/**
 * Edição de um slide.
 *
 * Vive fora do cartão porque o cartão é pequeno demais para escrever dentro,
 * e porque o clique com o botão direito no preview grande abre a mesma coisa.
 */
function SlideEditorDialog() {
  const editId = useOpsStore((s) => s.slideEditId);
  const setEditId = useOpsStore((s) => s.setSlideEditId);
  const preview = useLumenStore((s) => s.preview);
  const updatePreviewSlide = useLumenStore((s) => s.updatePreviewSlide);
  const slide = preview?.slides.find((s) => s.id === editId) ?? null;

  const [text, setText] = useState("");
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (slide) {
      setText(slide.text);
      setComment(slide.comment ?? "");
    }
  }, [slide]);

  return (
    <Dialog open={Boolean(slide)} onOpenChange={(v) => !v && setEditId(null)}>
      <DialogContent title={slide ? `Editar ${slide.label}` : "Editar slide"} className="w-[min(34rem,calc(100%-1.5rem))]">
        {slide && (
          <div className="space-y-2">
            <textarea
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              aria-label="Texto do slide"
              className="field min-h-32 w-full resize-y py-2"
            />
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentário interno — só o palco vê"
              aria-label="Comentário interno"
              className="field w-full"
            />
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  updatePreviewSlide(slide.id, { text, comment });
                  setEditId(null);
                }}
              >
                Aplicar no telão
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
