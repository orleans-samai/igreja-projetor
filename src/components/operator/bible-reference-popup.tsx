import { ChevronRight, CornerDownLeft, Play, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { chapterCount, chapterVerseCount } from "@/lib/bible";
import { BOOKS, bookById, bookShort, bookSection } from "@/lib/bible-books";
import { cn } from "@/lib/cn";
import { fold } from "@/lib/fold";

/**
 * Ir para uma referência, sem sair da Bíblia.
 *
 * Antes, digitar na tela da Bíblia enchia um buffer invisível e o app pulava
 * sozinho para o primeiro livro que casasse. Quando acertava, parecia mágica;
 * quando errava, o operador não fazia ideia do que tinha acontecido nem do que
 * o programa tinha entendido.
 *
 * Agora o que ele digita aparece, as opções aparecem, e ele escolhe: livro,
 * capítulo, versículo, nessa ordem. Três passos visíveis valem mais que um
 * palpite invisível quando há uma igreja esperando.
 */

type Passo = "livro" | "capitulo" | "versiculo";

/** "provér 3", "1 co 13", "joao 3:16" — o que a pessoa digita de verdade. */
function separar(texto: string): { nome: string; capitulo?: number; versiculo?: number } {
  const limpo = texto.trim().replace(/\s+/g, " ");
  const m = limpo.match(/^(.*?)[\s]*(\d+)(?:\s*[:.\s]\s*(\d+))?$/);
  // Um número no fim só é capítulo se sobrar nome antes dele: "1 co" é o nome
  // inteiro de 1 Coríntios, não o capítulo 1 de "co".
  if (m && m[1] && fold(m[1]).replace(/\d/g, "").trim().length > 0) {
    return { nome: m[1].trim(), capitulo: Number(m[2]), versiculo: m[3] ? Number(m[3]) : undefined };
  }
  return { nome: limpo };
}

export function BibleReferencePopup({
  aberto,
  textoInicial,
  versionId,
  aoFechar,
  aoEscolher,
}: {
  aberto: boolean;
  textoInicial: string;
  versionId: string;
  aoFechar: () => void;
  aoEscolher: (bookId: number, capitulo: number, versiculo: number, projetar: boolean) => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [passo, setPasso] = useState<Passo>("livro");
  const [livro, setLivro] = useState<number | null>(null);
  const [capitulo, setCapitulo] = useState<number | null>(null);
  const [marcado, setMarcado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  // Cada abertura começa limpa, com o que já foi digitado dentro.
  useEffect(() => {
    if (!aberto) return;
    setTexto(textoInicial);
    setPasso("livro");
    setLivro(null);
    setCapitulo(null);
    setMarcado(0);
    campo.current?.focus();
  }, [aberto, textoInicial]);

  const pedido = useMemo(() => separar(texto), [texto]);

  const achados = useMemo(() => {
    const alvo = fold(pedido.nome);
    if (!alvo) return BOOKS;
    const casa = BOOKS.filter(
      (b) => fold(b.name).includes(alvo) || fold(bookShort(b)).includes(alvo),
    );
    // Quem começa com o que foi digitado vem primeiro: "jo" deve oferecer João
    // antes de Josué, porque é o que se digita com mais frequência.
    return casa.sort((a, b) => {
      const pa = fold(a.name).startsWith(alvo) ? 0 : 1;
      const pb = fold(b.name).startsWith(alvo) ? 0 : 1;
      return pa - pb || a.id - b.id;
    });
  }, [pedido.nome]);

  const capitulos = livro ? chapterCount(versionId, livro) : 0;
  const versiculos = livro && capitulo ? chapterVerseCount(versionId, livro, capitulo) : 0;

  if (!aberto) return null;

  const escolherLivro = (id: number) => {
    setLivro(id);
    // O que já veio digitado pula os passos: "joão 3:16" vai direto ao fim.
    if (pedido.capitulo && pedido.capitulo <= chapterCount(versionId, id)) {
      const cap = pedido.capitulo;
      setCapitulo(cap);
      if (pedido.versiculo && pedido.versiculo <= chapterVerseCount(versionId, id, cap)) {
        aoEscolher(id, cap, pedido.versiculo, false);
        aoFechar();
        return;
      }
      setPasso("versiculo");
      setMarcado(0);
      return;
    }
    setPasso("capitulo");
    setMarcado(0);
  };

  const escolherCapitulo = (n: number) => {
    setCapitulo(n);
    setPasso("versiculo");
    setMarcado(0);
  };

  const lista: number[] =
    passo === "livro"
      ? achados.map((b) => b.id)
      : passo === "capitulo"
        ? Array.from({ length: capitulos }, (_, i) => i + 1)
        : Array.from({ length: versiculos }, (_, i) => i + 1);

  const confirmar = (indice: number, projetar = false) => {
    const valor = lista[indice];
    if (valor === undefined) return;
    if (passo === "livro") return escolherLivro(valor);
    if (passo === "capitulo") return escolherCapitulo(valor);
    if (livro && capitulo) {
      aoEscolher(livro, capitulo, valor, projetar);
      aoFechar();
    }
  };

  const voltarUmPasso = () => {
    if (passo === "versiculo" && capitulos > 1) {
      setPasso("capitulo");
      setCapitulo(null);
    } else if (passo !== "livro") {
      setPasso("livro");
      setLivro(null);
      setCapitulo(null);
    } else {
      aoFechar();
    }
    setMarcado(0);
  };

  const noTeclado = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      voltarUmPasso();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar(marcado, e.ctrlKey || e.metaKey);
      return;
    }
    const passoDoCursor =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 8 : e.key === "ArrowUp" ? -8 : 0;
    if (passoDoCursor === 0) return;
    e.preventDefault();
    setMarcado((v) => Math.max(0, Math.min(lista.length - 1, v + passoDoCursor)));
  };

  const nomeDoLivro = livro ? (bookById(livro)?.name ?? "") : "";
  const trilha = [nomeDoLivro, capitulo ? String(capitulo) : ""].filter(Boolean).join(" ");

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center p-6" role="dialog" aria-modal="true" aria-label="Ir para referência">
      <button
        type="button"
        aria-label="Fechar"
        className="veil absolute inset-0 cursor-default bg-stage/70"
        data-state="open"
        onClick={aoFechar}
      />

      <div className="animate-pop-in relative flex max-h-full w-[min(38rem,100%)] flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-pop),var(--shadow-border)]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <input
            ref={campo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPasso("livro");
              setLivro(null);
              setCapitulo(null);
              setMarcado(0);
            }}
            onKeyDown={noTeclado}
            placeholder="Livro, ou a referência inteira: provér 3, joão 3:16"
            aria-label="Livro ou referência"
            className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-subtle"
          />
          {trilha && (
            <span className="flex shrink-0 items-center gap-1 text-caption text-muted">
              {trilha} <ChevronRight className="size-3" aria-hidden />
            </span>
          )}
        </div>

        <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {passo === "livro" && (
            <>
              {achados.length === 0 && (
                <p className="px-2 py-3 text-secondary text-subtle">
                  Nenhum livro com “{pedido.nome}”.
                </p>
              )}
              <ul>
                {achados.slice(0, 40).map((b, i) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setMarcado(i)}
                      onClick={() => escolherLivro(b.id)}
                      className={cn(
                        "relative flex w-full items-baseline gap-3 rounded-md px-2.5 py-1.5 text-left",
                        i === marcado ? "bg-elevated" : "hover:bg-elevated/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                        style={{ background: `var(--color-bible-${bookSection(b.id)})` }}
                      />
                      <span className="w-10 shrink-0 text-body font-semibold text-fg">
                        {bookShort(b)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body text-muted">{b.name}</span>
                      <span className="tnum shrink-0 text-caption text-subtle">
                        {chapterCount(versionId, b.id)} cap.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {passo !== "livro" && (
            <div>
              <p className="px-1 pb-1.5 text-caption font-medium uppercase tracking-wide text-subtle">
                {passo === "capitulo" ? "Capítulo" : "Versículo"}
              </p>
              <div
                className={cn(
                  "bible-nums",
                  passo === "capitulo" ? "bible-nums-ch" : "bible-nums-vs",
                )}
              >
                {lista.map((n, i) => (
                  <button
                    key={n}
                    type="button"
                    data-on={i === marcado}
                    onMouseEnter={() => setMarcado(i)}
                    onClick={() =>
                      passo === "capitulo" ? escolherCapitulo(n) : confirmar(i, false)
                    }
                    onDoubleClick={() => passo === "versiculo" && confirmar(i, true)}
                    aria-label={`${passo === "capitulo" ? "Capítulo" : "Versículo"} ${n}`}
                    className={cn("bible-num", passo === "capitulo" ? "bible-num-ch" : "bible-num-vs")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
          <p className="min-w-0 flex-1 truncate text-caption text-subtle">
            <CornerDownLeft className="mr-1 inline size-3" aria-hidden />
            Enter escolhe · Esc volta um passo
          </p>
          {passo === "versiculo" && livro && capitulo && (
            <Button size="sm" onClick={() => confirmar(marcado, true)}>
              <Play /> Projetar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
