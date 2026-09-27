import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  arquivoDoCulto,
  buscarNoHistorico,
  destinoEmPalavras,
  exportarCulto,
  type CultoDoChat,
  type RecadoGuardado,
} from "@/lib/chat-historico";
import { cn } from "@/lib/cn";
import { useChatHistorico } from "@/store/chat-historico-store";

/** "2026-09-27" → "27/09/2026". */
function data(dia: string): string {
  const [ano, mes, d] = dia.split("-");
  return `${d}/${mes}/${ano}`;
}

function hora(em: number): string {
  return new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Um recado guardado: quando, quem, para quem e o quê. Só conteúdo de linha
 * (span, img), para caber tanto num item de lista quanto dentro de um botão.
 */
function ConteudoDoRecado({ r }: { r: RecadoGuardado }) {
  return (
    <>
      <span className="flex items-baseline gap-1.5 text-caption">
        <span className="tnum shrink-0 text-subtle">{hora(r.em)}</span>
        <span className="truncate font-semibold text-fg">{r.daCabine ? "Cabine" : r.de}</span>
        <span className="shrink-0 text-subtle">→ {destinoEmPalavras(r.para)}</span>
      </span>
      {r.apagada ? (
        <span className="block text-secondary italic text-subtle">Recado apagado pela cabine</span>
      ) : (
        <>
          {r.foto && (
            <img
              src={`/__chat/${r.foto.arquivo}`}
              alt={`Foto de ${r.de}`}
              className="mt-1 block max-h-24 rounded-md"
              // A foto pode já ter saído do disco; o recado continua.
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {r.texto && (
            <span className="block whitespace-pre-wrap break-words text-secondary text-fg">{r.texto}</span>
          )}
          {r.voz && (
            <span className="block text-caption text-subtle">(recado de voz — o áudio não fica guardado)</span>
          )}
        </>
      )}
    </>
  );
}

/**
 * O histórico do chat, culto a culto.
 *
 * A igreja pediu o chat de cada culto guardado, com busca e exportação ao
 * final. Um culto é a programação aberta na cabine naquele dia; a busca
 * olha todos de uma vez, do mais novo para o mais velho.
 */
export function ChatHistoricoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const cultos = useChatHistorico((s) => s.cultos);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const lista = useMemo(() => [...cultos].reverse(), [cultos]);
  const atual: CultoDoChat | null = lista.find((c) => c.id === escolhido) ?? lista[0] ?? null;
  const achados = useMemo(
    () => (busca.trim() ? buscarNoHistorico({ cultos }, busca).slice(0, 200) : []),
    [cultos, busca],
  );

  const exportar = (c: CultoDoChat) => {
    const url = URL.createObjectURL(new Blob([exportarCulto(c)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivoDoCulto(c);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Histórico do chat"
        description="Os recados de cada culto, guardados neste computador."
        className="w-[min(780px,calc(100%-1.5rem))]"
      >
        <div className="flex min-h-0 flex-1 gap-3 px-4 pb-4">
          <div className="flex w-56 shrink-0 flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nos recados"
                aria-label="Buscar no histórico do chat"
                className="pl-7"
              />
            </div>
            {lista.length === 0 ? (
              <p className="text-secondary text-subtle">
                Nenhum culto guardado ainda. Os recados entram aqui assim que chegam.
              </p>
            ) : (
              <ul className="lumen-scroll min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Cultos">
                {lista.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={!busca.trim() && atual?.id === c.id ? "true" : undefined}
                      onClick={() => {
                        setEscolhido(c.id);
                        setBusca("");
                      }}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                        !busca.trim() && atual?.id === c.id ? "bg-raised text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      <span className="block truncate text-secondary font-medium">{c.nome}</span>
                      <span className="block text-caption text-subtle">
                        {data(c.dia)} · {c.recados.length} {c.recados.length === 1 ? "recado" : "recados"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[18rem] min-w-0 flex-1 flex-col">
            {busca.trim() ? (
              <>
                <p className="mb-2 text-caption text-subtle">
                  {achados.length === 0
                    ? "Nada com esse texto em nenhum culto."
                    : `${achados.length} ${achados.length === 1 ? "recado" : "recados"} com “${busca.trim()}”`}
                </p>
                <ul className="lumen-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                  {achados.map(({ culto, recado }) => (
                    <li key={`${culto.id}-${recado.id}`}>
                      <button
                        type="button"
                        className={cn(
                          "block w-full rounded-md bg-elevated px-2 py-1.5 text-left hover:bg-raised",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                        )}
                        onClick={() => {
                          setEscolhido(culto.id);
                          setBusca("");
                        }}
                      >
                        <span className="block text-caption text-accent">
                          {culto.nome} · {data(culto.dia)}
                        </span>
                        <ConteudoDoRecado r={recado} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : atual ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-fg">{atual.nome}</p>
                    <p className="text-caption text-subtle">{data(atual.dia)}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => exportar(atual)}>
                    <Download /> Exportar
                  </Button>
                </div>
                <ul className="lumen-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto" aria-label={`Recados de ${atual.nome}`}>
                  {atual.recados.map((r) => (
                    <li key={r.id} className="rounded-md bg-elevated px-2 py-1.5">
                      <ConteudoDoRecado r={r} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
