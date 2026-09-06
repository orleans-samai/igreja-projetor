import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseBibleRef } from "@/lib/bible-ref";
import { makeRequest, publishOps } from "@/lib/ops-channel";

export const Route = createFileRoute("/pedido")({ component: Pedido });

const CHIPS = ["João 3:16", "João 14:6", "Salmos 23:1", "Romanos 8:28", "Filipenses 4:13"];

export function Pedido() {
  const [book, setBook] = useState("João");
  const [chapter, setChapter] = useState("3");
  const [verse, setVerse] = useState("16");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const ref = `${book} ${chapter}:${verse}`.replace(/\s+/g, " ").trim();
  const parsed = parseBibleRef(ref);

  const sendVerse = (value: string) => {
    const ok = parseBibleRef(value);
    const text = `solicitou ${value}`;
    publishOps({
      type: "request",
      request: makeRequest("pastor", "verse", `Pastor ${text}`, value),
    });
    setSent(ok ? value : value);
  };

  const sendChat = () => {
    const text = note.trim();
    if (!text) return;
    publishOps({
      type: "request",
      request: makeRequest("pastor", "chat", text),
    });
    setNote("");
    setSent(text);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-bg px-4 py-8 text-fg">
      <header>
        <p className="text-xs uppercase tracking-widest text-subtle">Pedido do pastor</p>
        <h1 className="font-display text-4xl tracking-tight">Pedir versículo</h1>
        <p className="mt-2 text-sm text-muted">
          Você não controla o telão. O operador recebe o pedido e decide a hora de projetar.
        </p>
      </header>

      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendVerse(ref);
        }}
      >
        <label className="grid gap-1 text-xs font-medium text-muted">
          Livro
          <Input value={book} onChange={(e) => setBook(e.target.value)} placeholder="João" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted">
            Capítulo
            <Input inputMode="numeric" value={chapter} onChange={(e) => setChapter(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted">
            Verso
            <Input inputMode="numeric" value={verse} onChange={(e) => setVerse(e.target.value)} />
          </label>
        </div>
        <Button size="lg" type="submit" disabled={!parsed}>
          Enviar {parsed ? ref : ""}
        </Button>
        {!parsed && ref.length > 3 && (
          <p className="text-xs text-danger">Não reconheci esse versículo. Ex.: João 3 16</p>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <Button key={c} size="sm" variant="secondary" type="button" onClick={() => sendVerse(c)}>
            {c}
          </Button>
        ))}
      </div>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendChat();
        }}
      >
        <label className="grid gap-1 text-xs font-medium text-muted">
          Recado para a cabine
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vou encerrar em 5 min"
          />
        </label>
        <Button variant="secondary" type="submit">
          Enviar recado
        </Button>
      </form>

      {sent && <p className="rounded-lg bg-ok/15 px-3 py-2 text-sm text-ok">Enviado: {sent}</p>}
    </div>
  );
}
