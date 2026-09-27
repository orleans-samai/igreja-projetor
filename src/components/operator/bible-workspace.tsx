import {
  ArrowLeft,
  BookOpen,
  Check,
  Heart,
  History,
  Minus,
  Play,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SlideStage } from "@/components/slide/slide-renderer";
import { OptimizeButton } from "@/components/operator/optimize-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import {
  BUILTIN_BIBLES,
  carregarVersao,
  chapterCount,
  chapterVerseCount,
  chapterVerses,
  hydrateExtraVersions,
  importarArquivoDeBiblia,
  listVersions,
  loadBuiltinBible,
  searchVerses,
  versaoTemLivro,
} from "@/lib/bible";
import {
  BOOKS,
  bookById,
  bookSection,
  bookShort,
  bookTinyName,
} from "@/lib/bible-books";
import { cn } from "@/lib/cn";
import { fold } from "@/lib/fold";
import { BibleReferencePopup } from "@/components/operator/bible-reference-popup";
import { ParteDaBibliaArrastavel } from "@/components/operator/reorganize";
import { arranjoValido, type ParteDaBiblia } from "@/lib/paineis-da-biblia";
import {
  degrauAbaixo,
  escalaDaBiblia,
  escalaMaxima,
  maiorEscalaQueCabe,
  proximaEscala,
} from "@/lib/tamanho-da-biblia";
import type { LiveFrame } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

/** A opção do seletor que abre o arquivo, em vez de trocar de versão. */
const IMPORTAR_VERSAO = "__importar";

/** Rótulo de seção: o que faltava para os três níveis se distinguirem. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-muted">{children}</p>
  );
}

/**
 * Um testamento e seus livros.
 *
 * O filete colorido na borda esquerda carrega a seção — lei, profetas,
 * evangelhos. É a memória que a equipe já tem, sem o preenchimento saturado
 * que fazia o livro selecionado desaparecer no meio dos vizinhos.
 */
function Testamento({
  titulo,
  livros,
  atual,
  aoEscolher,
  temLivro,
}: {
  titulo: string;
  livros: typeof BOOKS;
  atual: number;
  aoEscolher: (id: number) => void;
  /** Livro que a versão escolhida não traz fica apagado — continua clicável e explica o porquê. */
  temLivro: (id: number) => boolean;
}) {
  if (livros.length === 0) return null;
  return (
    <div>
      <Rotulo>
        {titulo} <span className="tnum text-subtle">{livros.length}</span>
      </Rotulo>
      <div className="bible-mosaic mt-1.5">
        {livros.map((book) => {
          const tem = temLivro(book.id);
          return (
            <button
              key={book.id}
              type="button"
              title={tem ? book.name : `${book.name} — não está nesta versão`}
              aria-label={tem ? book.name : `${book.name}, não está nesta versão`}
              data-ausente={!tem || undefined}
              aria-pressed={book.id === atual}
              data-on={book.id === atual}
              onClick={() => aoEscolher(book.id)}
              style={
                { "--secao": `var(--color-bible-${bookSection(book.id)})` } as React.CSSProperties
              }
              className={cn(
                "bible-tile focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                !tem && "opacity-35",
              )}
            >
              <span className="bible-tile-abbr">{bookShort(book)}</span>
              <span className="bible-tile-name">{bookTinyName(book)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function BibleWorkspace({
  previewFrame,
  onBack,
}: {
  previewFrame: LiveFrame;
  onBack: () => void;
}) {
  const cursor = useLumenStore((s) => s.bibleCursor);
  const versionId = useLumenStore((s) => s.bibleVersionId);
  const arranjo = arranjoValido(useOpsStore((s) => s.arranjoBiblia));
  const tamanhoMaximo = escalaDaBiblia(useOpsStore((s) => s.tamanhoMaximoBiblia));
  const setTamanhoMaximo = useOpsStore((s) => s.setTamanhoMaximoBiblia);
  // O tamanho que está na tela: o maior até o máximo em que tudo cabe.
  const [naTela, setNaTela] = useState(tamanhoMaximo);
  const navegacao = useRef<HTMLDivElement>(null);
  const extra = useLumenStore((s) => s.extraVersionIds);
  const addExtraVersion = useLumenStore((s) => s.addExtraVersion);
  const arquivoDeVersao = useRef<HTMLInputElement>(null);

  // Versão que a igreja tem licença para usar (NVI, NAA…): importa daqui
  // mesmo, onde se escolhe a versão, e já entra na tela.
  const importarVersao = async (file: File) => {
    try {
      const bible = await importarArquivoDeBiblia(file);
      addExtraVersion(bible.id, bible.name);
      changeVersion(bible.id);
      toast(`${bible.name} importada — já está na tela.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui importar essa versão.");
    }
  };
  const query = useLumenStore((s) => s.bibleQuery);
  const setQuery = useLumenStore((s) => s.setBibleQuery);
  const load = useLumenStore((s) => s.loadBibleChapter);
  const changeVersion = useLumenStore((s) => s.changeVersion);
  const jumpRef = useLumenStore((s) => s.jumpRef);
  const present = useLumenStore((s) => s.presentPreview);
  const favorites = useLumenStore((s) => s.favorites);
  const toggleFavorite = useLumenStore((s) => s.toggleFavorite);
  const logs = useLumenStore((s) => s.logs);
  const searchRef = useRef<HTMLInputElement>(null);
  const verseListRef = useRef<HTMLUListElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [filtro, setFiltro] = useState("");
  const [refAberta, setRefAberta] = useState(false);
  const [refTexto, setRefTexto] = useState("");
  const [projected, setProjected] = useState<Set<string>>(() => new Set());
  const typeBuf = useRef("");
  const typeTimer = useRef(0);

  useEffect(() => {
    let alive = true;
    // A Almeida é a rede de segurança de `getBible`; a escolhida é a que a
    // tela mostra. As outras só descem do disco quando alguém as escolhe.
    Promise.all([loadBuiltinBible(), hydrateExtraVersions(), carregarVersao(versionId)])
      .then(() => {
        if (!alive) return;
        setReady(true);
        load(cursor.bookId, cursor.chapter, cursor.verse, false);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = bookById(cursor.bookId);
  const chapters = ready ? chapterCount(versionId, cursor.bookId) : 0;
  const verseTotal = ready ? chapterVerseCount(versionId, cursor.bookId, cursor.chapter) : 0;
  const verses = ready ? chapterVerses(versionId, cursor.bookId, cursor.chapter) : [];
  const hits = ready && query.length > 2 ? searchVerses(versionId, query) : [];
  /** Livros que sobrevivem ao filtro: casa por nome ou por sigla, sem acento. */
  const livros = useMemo(() => {
    const alvo = fold(filtro.trim());
    if (!alvo) return BOOKS;
    return BOOKS.filter(
      (b) => fold(b.name).includes(alvo) || fold(bookShort(b)).includes(alvo),
    );
  }, [filtro]);
  /**
   * Livros, capítulos e versículos cabendo inteiros na tela: sem barra de
   * rolagem e sem cortar, como a igreja pediu. Mede antes de pintar — a
   * escala é trocada direto na caixa enquanto a busca procura, e só a
   * escolhida chega à tela. Mede de novo quando muda o livro, o capítulo,
   * o filtro, o máximo ou o tamanho da própria caixa.
   */
  useLayoutEffect(() => {
    const caixa = navegacao.current;
    if (!caixa) return;
    const ajustar = () => {
      const escala = maiorEscalaQueCabe(tamanhoMaximo, (e) => {
        caixa.style.setProperty("--biblia-escala", String(e));
        return caixa.scrollHeight <= caixa.clientHeight + 1;
      });
      caixa.style.setProperty("--biblia-escala", String(escala));
      setNaTela((antes) => (Math.abs(antes - escala) < 0.002 ? antes : escala));
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(caixa);
    // A fonte que termina de carregar depois muda a altura dos números.
    let vivo = true;
    void document.fonts?.ready.then(() => vivo && ajustar());
    return () => {
      vivo = false;
      observador.disconnect();
    };
  }, [tamanhoMaximo, chapters, verseTotal, livros.length, ready]);
  const cabeMais = !escalaMaxima(tamanhoMaximo) && naTela >= tamanhoMaximo - 0.001;
  const currentRef = meta ? `${meta.name} ${cursor.chapter}:${cursor.verse}` : "";
  const livroFalta = ready && !versaoTemLivro(versionId, cursor.bookId);
  const nomeDaVersao = listVersions().find((v) => v.id === versionId);
  const loved = favorites.includes(currentRef);
  const recentBible = useMemo(
    () => logs.filter((l) => l.kind === "bible").slice(0, 12),
    [logs],
  );

  const go = (bookId: number, chapter: number, verse = 1, fire = false) => {
    load(bookId, chapter, verse, fire);
    if (fire) {
      setProjected((prev) => new Set(prev).add(`${bookId}:${chapter}:${verse}`));
    }
  };

  const fireCurrent = () => {
    present();
    setProjected((prev) => new Set(prev).add(`${cursor.bookId}:${cursor.chapter}:${cursor.verse}`));
  };

  const submitQuery = () => {
    const ok = jumpRef(query, true);
    if (ok) {
      setProjected((prev) => new Set(prev).add(`${cursor.bookId}:${cursor.chapter}:${cursor.verse}`));
      return;
    }
    if (query.length > 2) {
      const hit = hits[0];
      if (hit) go(hit.bookId, hit.chapter, hit.verse, true);
      else toast.error("Referência não reconhecida");
    }
  };

  useEffect(() => {
    const el = verseListRef.current?.querySelector(`[data-verse="${cursor.verse}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor.verse, cursor.chapter, cursor.bookId]);

  const latest = useRef({ cursor, chapters, verseTotal, go, fireCurrent, refAberta });
  latest.current = { cursor, chapters, verseTotal, go, fireCurrent, refAberta };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const state = latest.current;
      // Com a busca de referência aberta, a tela de trás não responde: um
      // Enter que escapasse do campo projetaria o versículo errado no telão.
      // Letra que chega antes de o campo pegar o foco soma ao que já foi
      // digitado ("jo" rápido não vira "o").
      if (state.refAberta) {
        if (e.key === "Escape") {
          // Consumido aqui: sem isso o atalho global, que roda depois e já
          // não vê o pop-up, fecharia a Bíblia inteira no mesmo Esc.
          e.preventDefault();
          e.stopImmediatePropagation();
          typeBuf.current = "";
          setRefAberta(false);
        } else if (e.key.length === 1 && /^[0-9a-zA-ZáéíóúãõâêôçÁÉÍÓÚ ]$/.test(e.key)) {
          e.preventDefault();
          typeBuf.current += e.key;
          setRefTexto(typeBuf.current);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        state.fireCurrent();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(state.verseTotal, state.cursor.verse + 1);
        if (next !== state.cursor.verse) state.go(state.cursor.bookId, state.cursor.chapter, next);
        else if (state.cursor.chapter < state.chapters) {
          state.go(state.cursor.bookId, state.cursor.chapter + 1, 1);
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(1, state.cursor.verse - 1);
        if (prev !== state.cursor.verse) state.go(state.cursor.bookId, state.cursor.chapter, prev);
        else if (state.cursor.chapter > 1) {
          state.go(state.cursor.bookId, state.cursor.chapter - 1, 1);
        }
        return;
      }
      if (e.key === "Backspace") {
        typeBuf.current = typeBuf.current.slice(0, -1);
        setHint(typeBuf.current);
        return;
      }
      if (e.key.length !== 1 || e.key === " ") return;
      if (!/^[0-9a-zA-ZáéíóúãõâêôçÁÉÍÓÚ]$/.test(e.key)) return;
      e.preventDefault();
      typeBuf.current += e.key;
      const buf = typeBuf.current;
      setHint(buf);
      window.clearTimeout(typeTimer.current);
      typeTimer.current = window.setTimeout(() => {
        typeBuf.current = "";
        setHint("");
      }, 900);
      if (/^\d+$/.test(buf)) {
        const n = Number(buf);
        if (n >= 1 && n <= state.verseTotal) {
          state.go(state.cursor.bookId, state.cursor.chapter, n);
        } else if (n >= 1 && n <= state.chapters) {
          state.go(state.cursor.bookId, n, 1);
        }
        return;
      }
      // Letra digitada abre a busca de referência com o que já foi teclado.
      // Antes o app adivinhava o livro e pulava sozinho: quando errava, o
      // operador não via o que o programa tinha entendido.
      if (buf.length >= 1) {
        // O buffer continua vivo até o pop-up fechar: é ele que junta as
        // letras que chegam antes do foco.
        window.clearTimeout(typeTimer.current);
        setRefTexto(buf);
        setRefAberta(true);
        setHint("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(typeTimer.current);
    };
  }, []);

  /*
   * As três partes da tela, cada uma inteira, para caberem no lugar que o
   * operador escolheu (Reorganizar, com a Bíblia aberta). O conteúdo não
   * muda de lugar para lugar; só a caixa em volta.
   */
  const parteVersiculos = (
    <>
      {/* A fita de referência: o que vai ao telão, sempre à vista e sem
          precisar procurar. É a resposta ao "onde eu estou" no meio de um
          culto, e por isso é a única coisa desta tela em tipo grande. */}
      <div className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-display-sm font-semibold tracking-tight text-fg">
          {meta?.name} {cursor.chapter}:{cursor.verse}
        </h2>
        <span className="tnum ml-auto shrink-0 text-caption text-subtle">
          {verses.length} versículos
        </span>
      </div>
      <ul ref={verseListRef} className="min-h-0 flex-1 overflow-y-auto lumen-scroll">
        {verses.map((v) => {
          const key = `${cursor.bookId}:${cursor.chapter}:${v.n}`;
          const done = projected.has(key);
          return (
            <li key={v.n}>
              <button
                type="button"
                data-verse={v.n}
                // Um clique já projeta: a igreja pediu, e é o que se faz no
                // meio da pregação, com pressa — dois cliques faziam o
                // versículo esperar no escuro enquanto o pastor já lia.
                onClick={() => go(cursor.bookId, cursor.chapter, v.n, true)}
                className={cn(
                  "relative flex w-full items-baseline gap-3 px-4 py-2 text-left",
                  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                  "hover:bg-elevated/60",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  v.n === cursor.verse && "bg-elevated",
                )}
              >
                {/* Filete no versículo escolhido: a marca não depende só
                    do fundo, que some em monitor mal calibrado. */}
                {v.n === cursor.verse && (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-fg" />
                )}
                <span className="w-6 shrink-0 text-caption tnum text-subtle">{v.n}</span>
                {v.text ? (
                  <span className="min-w-0 flex-1 text-body leading-relaxed text-fg">
                    {v.text}
                  </span>
                ) : (
                  // Vazio de propósito: a tradução segue os manuscritos
                  // mais antigos, que não trazem este versículo.
                  <span className="min-w-0 flex-1 text-body italic text-subtle">
                    não consta nesta tradução
                  </span>
                )}
                {done && <Check className="size-3.5 shrink-0 text-ok" />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
  // Na coluna larga, a prévia em 16:9 passaria da altura da tela: largura
  // limitada e centralizada. Na coluna estreita o limite nem chega a valer.
  const partePrevia = (
    <div className="mx-auto w-full max-w-[56rem] p-2">
      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-md bg-stage shadow-[var(--shadow-border)]"
        onClick={fireCurrent}
        aria-label="Projetar versículo"
      >
        <div className="aspect-video">
          <SlideStage
            frame={previewFrame}
            variant="preview"
            statusOverride="presenting"
            className="size-full"
          />
        </div>
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-live px-2 py-0.5 text-caption font-semibold text-live-fg">
          <Play className="size-3" /> Projetar
        </span>
      </button>
    </div>
  );
  const parteNavegacao = (
    <div
      ref={navegacao}
      data-navegacao-da-biblia
      className="lumen-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg p-3"
      style={{ "--biblia-escala": naTela } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle"
          />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const primeiro = livros[0];
              if (primeiro) {
                go(primeiro.id, 1, 1);
                setFiltro("");
              }
            }}
            placeholder="Buscar livro"
            aria-label="Buscar livro"
            className="pl-8"
          />
        </div>
        {/* O tamanho dos quadrados, na mão de quem opera: a igreja pediu
            os livros maiores, e cada tela e cada vista pede um tamanho. */}
        <div
          className="flex shrink-0 items-center gap-0.5"
          role="group"
          aria-label="Tamanho dos quadrados da Bíblia"
        >
          <Hint label="Diminuir os quadrados">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Diminuir os quadrados da Bíblia"
              disabled={degrauAbaixo(naTela) === null}
              onClick={() => {
                const abaixo = degrauAbaixo(naTela);
                if (abaixo !== null) setTamanhoMaximo(abaixo);
              }}
            >
              <Minus />
            </Button>
          </Hint>
          <span
            className="tnum w-10 text-center text-caption text-subtle"
            aria-live="polite"
            data-escala-da-biblia={naTela}
          >
            {Math.round(naTela * 100)}%
          </span>
          <Hint label={cabeMais ? "Aumentar os quadrados" : "Já é o maior tamanho que cabe na tela"}>
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Aumentar os quadrados da Bíblia"
              disabled={!cabeMais}
              onClick={() => setTamanhoMaximo(proximaEscala(tamanhoMaximo, 1))}
            >
              <Plus />
            </Button>
          </Hint>
        </div>
      </div>

      <Testamento
        titulo="Antigo Testamento"
        livros={livros.filter((b) => b.id <= 39)}
        atual={cursor.bookId}
        aoEscolher={(id) => go(id, 1, 1)}
        temLivro={(id) => versaoTemLivro(versionId, id)}
      />
      <Testamento
        titulo="Novo Testamento"
        livros={livros.filter((b) => b.id > 39)}
        atual={cursor.bookId}
        aoEscolher={(id) => go(id, 1, 1)}
        temLivro={(id) => versaoTemLivro(versionId, id)}
      />

      {livros.length === 0 && (
        <p className="text-secondary text-subtle">
          Nenhum livro com “{filtro}”. Apague para ver todos.
        </p>
      )}

      <div>
        <Rotulo>
          Capítulos <span className="tnum text-subtle">{chapters}</span>
        </Rotulo>
        <div className="bible-nums bible-nums-ch mt-1.5">
          {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              data-on={n === cursor.chapter}
              aria-label={`Capítulo ${n}`}
              aria-pressed={n === cursor.chapter}
              onClick={() => go(cursor.bookId, n, 1)}
              className="bible-num bible-num-ch focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Rotulo>
          Versículos{" "}
          <span className="font-normal text-subtle">
            {meta?.name} {cursor.chapter} · {verseTotal}
          </span>
        </Rotulo>
        <div className="bible-nums bible-nums-vs mt-1.5">
          {Array.from({ length: verseTotal }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              data-on={n === cursor.verse}
              aria-label={`Versículo ${n}`}
              aria-pressed={n === cursor.verse}
              onClick={() => go(cursor.bookId, cursor.chapter, n, true)}
              className={cn(
                "bible-num bible-num-vs",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                projected.has(`${cursor.bookId}:${cursor.chapter}:${n}`) && "bible-num-feito",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  const conteudoDa: Record<ParteDaBiblia, React.ReactNode> = {
    versiculos: parteVersiculos,
    previa: partePrevia,
    navegacao: parteNavegacao,
  };
  const [emCima, embaixo, aoLado] = arranjo.lugares;
  /**
   * A caixa de cada lugar. A prévia fica com a altura dela (16:9); as outras
   * partes ocupam o que sobra e rolam por dentro.
   */
  const lugar = (parte: ParteDaBiblia, borda?: string) => (
    <div
      key={parte}
      data-lugar-da-biblia={parte}
      className={cn(
        "relative flex min-h-0 flex-col",
        parte === "previa" ? "shrink-0" : "flex-1",
        borda,
      )}
    >
      {conteudoDa[parte]}
      <ParteDaBibliaArrastavel parte={parte} />
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        {/* Dourado como o botão "Bíblia" do Repertório: quem entrou pelo
            dourado acha a saída pela mesma cor. Botão simples, não o
            <Button>: a variante pintaria o fundo por cima do `.ouro`. */}
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "ouro inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5",
            "text-secondary font-semibold whitespace-nowrap",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          )}
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar
        </button>
        <p className="text-title font-semibold tracking-tight">
          {meta?.name}: {cursor.chapter}
        </p>
        <select
          className="field w-52 max-w-full"
          value={versionId}
          onChange={(e) => {
            if (e.target.value === IMPORTAR_VERSAO) {
              arquivoDeVersao.current?.click();
              return;
            }
            changeVersion(e.target.value);
          }}
          aria-label="Versão da Bíblia"
          title={nomeDaVersao ? `${nomeDaVersao.name} · ${nomeDaVersao.license}` : undefined}
        >
          {BUILTIN_BIBLES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          {extra.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value={IMPORTAR_VERSAO}>Importar outra versão…</option>
        </select>
        <input
          ref={arquivoDeVersao}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Arquivo da versão da Bíblia"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importarVersao(file);
          }}
        />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitQuery();
              }
            }}
            placeholder='jo 3 16 — ou um trecho'
            className="pl-8"
            aria-label="Buscar referência ou texto"
          />
          {hits.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {hits.slice(0, 8).map((h) => (
                <li key={h.ref + h.text.slice(0, 8)}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left hover:bg-raised"
                    onClick={() => {
                      go(h.bookId, h.chapter, h.verse, true);
                      setQuery("");
                    }}
                  >
                    <p className="text-secondary font-medium text-fg">{h.ref}</p>
                    <p className="line-clamp-1 text-secondary text-muted">{h.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <Button
            size="sm"
            variant={loved ? "default" : "ghost"}
            onClick={() => {
              if (currentRef) toggleFavorite(currentRef);
              if (favorites.length > 0) setFavOpen((v) => !v);
            }}
          >
            <Heart className="size-3.5" /> Favoritos
          </Button>
          {favOpen && (
            <ul className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {favorites.length === 0 && (
                <li className="px-3 py-2 text-body text-muted">Nenhum favorito ainda.</li>
              )}
              {favorites.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-body hover:bg-raised"
                    onClick={() => {
                      jumpRef(f, true);
                      setFavOpen(false);
                    }}
                  >
                    <Star className="mr-1 inline size-3" />
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((v) => !v)}>
            <History className="size-3.5" /> Histórico
          </Button>
          {historyOpen && (
            <ul className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg bg-elevated py-1 shadow-[var(--shadow-border)] lumen-scroll">
              {recentBible.length === 0 && (
                <li className="px-3 py-2 text-body text-muted">Ainda sem projeções.</li>
              )}
              {recentBible.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-body hover:bg-raised"
                    onClick={() => {
                      jumpRef(l.title, true);
                      setHistoryOpen(false);
                    }}
                  >
                    {l.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <OptimizeButton />
        <Button size="sm" onClick={fireCurrent}>
          <Play className="size-3.5" /> Projetar
        </Button>
      </div>

      {!ready && !err && (
        <p className="px-4 py-10 text-body text-muted">Carregando a Bíblia…</p>
      )}
      {err && <p className="px-4 py-10 text-body text-danger">{err}</p>}

      {livroFalta && (
        <div
          role="status"
          className="animate-swap-in flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 text-body text-muted"
        >
          <span className="min-w-0 flex-1">
            A {nomeDaVersao?.name ?? "versão escolhida"} não traz {meta?.name ?? "este livro"} — ela
            só tem o Novo Testamento.
          </span>
          <Button size="sm" variant="secondary" onClick={() => changeVersion("almeida-1819")}>
            Abrir na Almeida 1819
          </Button>
        </div>
      )}

      {ready && (
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1",
            arranjo.duplaNa === "esquerda"
              ? "md:grid-cols-[minmax(24rem,34%)_1fr]"
              : "md:grid-cols-[1fr_minmax(24rem,34%)]",
          )}
        >
          <section
            className={cn(
              "flex min-h-0 flex-col border-b border-border md:border-b-0",
              arranjo.duplaNa === "esquerda" ? "md:border-r" : "md:order-2 md:border-l",
            )}
          >
            {lugar(emCima)}
            {lugar(embaixo, "border-t border-border")}
          </section>
          <section className="flex min-h-0 flex-col">{lugar(aoLado)}</section>
        </div>
      )}

      <BibleReferencePopup
        aberto={refAberta}
        textoInicial={refTexto}
        versionId={versionId}
        aoFechar={() => {
          typeBuf.current = "";
          setRefAberta(false);
        }}
        aoEscolher={(bookId, capitulo, versiculo, projetar) =>
          go(bookId, capitulo, versiculo, projetar)
        }
      />

      <p className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-secondary text-subtle">
        <BookOpen className="size-3" />
        <span className="min-w-0 flex-1 truncate">
          Digite o nome de um livro para abrir a busca · número vai ao versículo · um clique no
          versículo projeta · Enter envia ao telão · Esc volta à cabine
        </span>
        {hint && (
          <kbd className="rounded bg-elevated px-2 py-0.5 font-mono text-secondary text-fg">{hint}</kbd>
        )}
      </p>
    </div>
  );
}
