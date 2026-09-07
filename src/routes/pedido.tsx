import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { bookSection } from "@/lib/bible-books";
import { parseBibleRef } from "@/lib/bible-ref";
import { cn } from "@/lib/cn";
import { makeRequest, publishOps, readInbox, subscribeOps } from "@/lib/ops-channel";
import type { StageRequest } from "@/lib/types";

export const Route = createFileRoute("/pedido")({ component: Pedido });

const FAVORITOS = ["João 3:16", "João 14:6", "Salmos 23:1", "Romanos 8:28", "Filipenses 4:13"];

/** A referência herda a cor da parte da Escritura em que está — a mesma
 *  linguagem do mosaico da Bíblia na cabine. */
const SECTION_COLOR: Record<string, string> = {
  law: "var(--color-bible-law)",
  hist: "var(--color-bible-hist)",
  wisdom: "var(--color-bible-wisdom)",
  prophet: "var(--color-bible-prophet)",
  gospel: "var(--color-bible-gospel)",
  acts: "var(--color-bible-acts)",
  paul: "var(--color-bible-paul)",
  general: "var(--color-bible-general)",
  rev: "var(--color-bible-rev)",
};

/**
 * Controle de púlpito.
 *
 * O pastor está de pé, com o celular numa mão, no meio da pregação. Então a
 * referência que ele está montando aparece grande no alto — para conferir de
 * relance — e tudo que se toca fica embaixo, no alcance do polegar. Nada rola.
 */
export function Pedido() {
  const [book, setBook] = useState("João");
  const [chapter, setChapter] = useState("3");
  const [verse, setVerse] = useState("16");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<StageRequest[]>([]);

  // A cabine e o púlpito compartilham a mesma origem, então o pastor vê a
  // resposta assim que o operador atende ou adia.
  useEffect(() => {
    const sync = () => setEnviados(readInbox().filter((r) => r.from === "pastor").slice(0, 12));
    sync();
    return subscribeOps(sync);
  }, []);

  const ref = `${book} ${chapter}:${verse}`.replace(/\s+/g, " ").trim();
  const parsed = parseBibleRef(ref);
  const cor = parsed ? SECTION_COLOR[bookSection(parsed.book.id)] : undefined;

  const confirmar = (texto: string) => {
    setSent(texto);
    setErro(null);
    // BroadcastChannel não entrega para quem enviou, então a própria lista
    // precisa ser relida aqui — senão o pedido só apareceria na cabine.
    setEnviados(readInbox().filter((r) => r.from === "pastor").slice(0, 12));
    window.setTimeout(() => setSent((v) => (v === texto ? null : v)), 4000);
  };

  const sendVerse = (value: string) => {
    // Antes o pedido saía mesmo sem referência válida e a cabine recebia lixo.
    if (!parseBibleRef(value)) {
      setErro(`Não achei “${value}”. Confira o livro e o capítulo.`);
      return;
    }
    publishOps({
      type: "request",
      request: makeRequest("pastor", "verse", `Pastor pediu ${value}`, value),
    });
    confirmar(value);
  };

  const sendChat = () => {
    const texto = note.trim();
    if (!texto) return;
    publishOps({ type: "request", request: makeRequest("pastor", "chat", texto) });
    setNote("");
    confirmar(texto);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h1 className="text-title font-semibold tracking-tight">Pedido do pastor</h1>
        <span className="text-caption text-subtle">quem projeta é a cabine</span>
      </header>

      {/* Zona de leitura: o que está sendo montado, no tamanho de conferir de
          relance, e a confirmação do último envio no mesmo lugar. */}
      <div className="shrink-0 px-4 pb-3 pt-5">
        <p
          className="text-display font-semibold tracking-tight transition-colors duration-[var(--motion-base)] ease-[var(--ease-out)]"
          style={{ color: cor }}
        >
          {ref}
        </p>
        <p className="mt-1 text-secondary text-muted" aria-live="polite">
          {erro ? (
            <span className="animate-swap-in text-danger">{erro}</span>
          ) : sent ? (
            <span className="animate-swap-in text-ok">Enviado: {sent}</span>
          ) : parsed ? (
            "Toque em enviar quando quiser que a cabine prepare."
          ) : (
            "Escreva o livro, o capítulo e o versículo."
          )}
        </p>
      </div>

      {/* O que já foi pedido, e se a cabine já atendeu. Antes esta faixa da
          tela era só vazio. */}
      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto border-t border-border px-4 py-3">
        <p className="text-caption text-subtle">Pedidos desta noite</p>
        {enviados.length === 0 ? (
          <p className="mt-2 text-secondary text-subtle">
            Nada pedido ainda. O que você enviar aparece aqui com a resposta da cabine.
          </p>
        ) : (
          <ul className="mt-2 space-y-px">
            {enviados.map((r) => (
              <li key={r.id} className="flex items-baseline gap-2 py-1">
                <span className="tnum shrink-0 font-mono text-caption text-subtle">
                  {new Date(r.at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate text-secondary text-fg">
                  {r.verse ?? r.text}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-caption",
                    r.status === "done"
                      ? "text-ok"
                      : r.status === "dismissed"
                        ? "text-subtle"
                        : "text-accent",
                  )}
                >
                  {r.status === "done"
                    ? "atendido"
                    : r.status === "dismissed"
                      ? "deixado para depois"
                      : "na cabine"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zona do polegar. */}
      <div className="space-y-4 border-t border-border px-4 pb-6 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {FAVORITOS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => sendVerse(c)}
              className={cn(
                "min-h-9 rounded-md bg-elevated px-3 text-secondary font-medium text-fg",
                "transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                "hover:bg-raised active:scale-[0.97]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendVerse(ref);
          }}
        >
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
            <div className="grid gap-1">
              <Label htmlFor="livro">Livro</Label>
              <Input
                id="livro"
                value={book}
                onChange={(e) => {
                  setBook(e.target.value);
                  setErro(null);
                }}
                placeholder="João"
                className="h-11 text-body"
                invalid={Boolean(erro)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cap">Capítulo</Label>
              <Input
                id="cap"
                inputMode="numeric"
                value={chapter}
                onChange={(e) => {
                  setChapter(e.target.value);
                  setErro(null);
                }}
                className="tnum h-11 text-body"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ver">Versículo</Label>
              <Input
                id="ver"
                inputMode="numeric"
                value={verse}
                onChange={(e) => {
                  setVerse(e.target.value);
                  setErro(null);
                }}
                className="tnum h-11 text-body"
              />
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full" disabled={!parsed}>
            <Send /> Enviar {parsed ? ref : "para a cabine"}
          </Button>
        </form>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendChat();
          }}
        >
          <div className="grid flex-1 gap-1">
            <Label htmlFor="recado">Recado para a cabine</Label>
            <Input
              id="recado"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vou encerrar em 5 minutos"
              className="h-11 text-body"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-11 px-4" disabled={!note.trim()}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
