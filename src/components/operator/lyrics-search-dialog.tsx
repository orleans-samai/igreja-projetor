import { Globe, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { type LyricsHit } from "@/lib/lyrics-web";
import { suggestSongs, loadSong } from "@/lib/lyrics-suggestions";
import { cn } from "@/lib/cn";
import { parseLyrics } from "@/lib/lyrics";

export function LyricsSearchPanel({
  prefillQuery = "",
  prefillArtist = "",
  onPick,
  onCancel,
}: {
  prefillQuery?: string;
  prefillArtist?: string;
  onPick: (hit: LyricsHit) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState(prefillQuery);
  const [artist, setArtist] = useState(prefillArtist);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hits, setHits] = useState<LyricsHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [paste, setPaste] = useState("");
  const [moreAvailable, setMoreAvailable] = useState(false);


  useEffect(() => {
    setQuery(prefillQuery);
    setArtist(prefillArtist);
    setError(null);
    setWarning(null);
    setHits([]);
    setPaste("");
    setSelected(0);
    setMoreAvailable(false);

  }, [prefillQuery, prefillArtist]);

  const requestId = useRef(0);
  const selectionId = useRef(0);
  const [loadingLyric, setLoadingLyric] = useState(false);
  const runSearch = async (_deep = false) => {
    const id = ++requestId.current;
    ++selectionId.current;
    setLoadingLyric(false);
    setHits([]);
    setWarning(null);
    setError(null);
    setMoreAvailable(false);
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await suggestSongs(query.trim(), artist.trim());
      if (id !== requestId.current) return;
      if (!result.ok) { setError(result.error); return; }
      setHits(result.hits);
      setSelected(0);
      setWarning(result.warning ?? null);
      if (!result.hits.length) setError("Nenhuma música encontrada. Tente outro título ou artista.");
    } catch {
      if (id === requestId.current) setError("Falha na busca. Verifique sua conexão e tente novamente.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };
  useEffect(() => {
    ++requestId.current;
    ++selectionId.current;
    setHits([]);
    setError(null);
    setWarning(null);
    setLoading(false);
    setLoadingLyric(false);
    const timer = setTimeout(() => void runSearch(), 300);
    // Estes refs são contadores de invalidação, não nós do DOM: a limpeza
    // precisa incrementar o valor vivo para descartar a busca em andamento.
    // Copiar para uma variável, como a regra sugere, desligaria o cancelamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { clearTimeout(timer); ++requestId.current; ++selectionId.current; };
    // Search only when the operator changes the query, not when results arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, artist]);

  const pickSuggestion = async (index: number) => {
    setSelected(index);
    const hit = hits[index];
    const id = ++selectionId.current;
    setError(null);
    setLoadingLyric(false);
    if (!hit || hit.lyrics) return;
    setLoadingLyric(true);
    try {
      const result = await loadSong(hit.sourceUrl);
      if (id !== selectionId.current) return;
      if (!result.ok || !result.lyrics) { setError(result.error || "Letra indisponível nesta fonte."); return; }
      setHits(previous => previous.map(item => item.sourceUrl === hit.sourceUrl ? { ...item, lyrics: result.lyrics! } : item));
    } catch {
      if (id === selectionId.current) setError("Não foi possível carregar a letra. Tente novamente ou abra a fonte.");
    } finally {
      if (id === selectionId.current) setLoadingLyric(false);
    }
  };

  const current = hits[selected];
  const slideCount = useMemo(
    () => (current?.lyrics ? parseLyrics(current.lyrics).length : 0),
    [current?.lyrics],
  );

  return (
    // Coluna de altura cheia: cabeçalho parado, corpo rolando. Enquanto o
    // operador digita, os campos não saem de baixo do cursor.
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="shrink-0 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(false);
        }}
      >
        <div className="grid gap-2 md:grid-cols-[1fr_11rem_auto]">
          <div>
            <Label htmlFor="lyrics-q">Título ou trecho</Label>
            <Input
              id="lyrics-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ex.: "castelo forte" ou "grande é o senhor"'
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="lyrics-a">Artista (opcional)</Label>
            <Input
              id="lyrics-a"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Fernandinho"
              className="mt-1"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              Buscar
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Voltar
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Uma linha só de estado, sempre presente, para o corpo não subir e
          descer conforme aparece aviso, erro ou "buscando". */}
      <p
        aria-live="polite"
        className={cn(
          "mt-2 min-h-8 shrink-0 border-b border-border pb-2 text-secondary",
          error ? "text-danger" : "text-muted",
        )}
        role={error ? "alert" : undefined}
      >
        {error
          ? error
          : loading
            ? "Buscando sugestões no Letras e Vagalume…"
            : warning
              ? warning
              : hits.length > 0
                ? `${hits.length} sugestões — clique para carregar a letra.`
                : "Digite pelo menos 2 letras para ver sugestões do Letras e Vagalume."}
      </p>

      {/* A única barra de rolagem do diálogo. */}
      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto pt-3">
      {hits.length > 0 && (
        <div
          id="lyrics-search-results"
          role="region"
          aria-label="Resultados da busca de letras"
          className="grid gap-3 md:grid-cols-[15rem_1fr]"
        >
          <ul role="listbox" aria-label="Letras encontradas" className="space-y-1">
            {hits.map((hit, i) => (
              <li key={`${hit.title}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  onClick={() => void pickSuggestion(i)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-body",
                    i === selected ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span className="block truncate font-medium">{hit.title}</span>
                  <span className="block truncate text-secondary text-subtle">
                    {hit.artist} · {hit.sourceName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <div className="min-w-0 rounded-lg bg-elevated p-3">
              <p className="text-body font-semibold">{current.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-secondary text-muted">
                <span>{current.artist || "Artista não informado"}</span>
                {current.sourceName ? <Badge>{current.sourceName}</Badge> : null}
                {current.publicDomain ? <Badge>domínio público</Badge> : null}
                {slideCount > 0 ? <span className="tnum">{slideCount} slides</span> : null}
              </p>
              {!current.lyrics && <Button type="button" className="mt-3" disabled={loadingLyric} onClick={() => void pickSuggestion(selected)}>{loadingLyric ? "Carregando letra…" : "Carregar letra"}</Button>}
              <Button
                className="mt-3"
                type="button"
                name="import-lyrics"
                aria-label="Importar para o repertório"
                disabled={!current.lyrics}
                onClick={() => {
                  onPick(current);
                  toast("Letra importada — revise os slides antes do culto");
                }}
              >
                Importar para o repertório
              </Button>
              {current.sourceUrl && (
                <a
                  href={current.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-secondary text-fg hover:underline"
                >
                  {current.sourceUrl}
                </a>
              )}
              {/* Sem rolagem própria: flui dentro da área única do diálogo. */}
              <pre className="mt-3 whitespace-pre-wrap font-sans text-body text-fg">
                {current.lyrics || current.note || "Letra não veio completa nesta fonte."}
              </pre>
            </div>
          )}
        </div>
      )}

      {moreAvailable && !loading && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={loading}
          onClick={() => void runSearch(true)}
        >
          Não é essa? Buscar mais na web
        </Button>
      )}

      <div className="mt-5 border-t border-border pt-3">
        <Label htmlFor="lyrics-paste">Ou cole a letra</Label>
        <Textarea
          id="lyrics-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Cole aqui o texto (linha em branco = novo slide). Use [Coro], [Verso 1]…"
          className="mt-1 min-h-28 font-mono text-secondary"
        />
        <Button
          className="mt-2"
          variant="secondary"
          type="button"
          disabled={!paste.trim()}
          onClick={() => {
            onPick({
              title: query.trim() || "Música importada",
              artist: artist.trim(),
              lyrics: paste,
              sourceUrl: "",
              sourceName: "colada pelo operador",
              copyright: "",
              publicDomain: false,
            });
            toast("Letra colada");
          }}
        >
          Usar texto colado
        </Button>
      </div>
      </div>
    </div>
  );
}

export function LyricsSearchDialog({
  open,
  onOpenChange,
  prefillQuery = "",
  prefillArtist = "",
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillQuery?: string;
  prefillArtist?: string;
  onPick: (hit: LyricsHit) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Altura fixa de propósito: a busca devolve de zero a oito sugestões a
          cada tecla, e um diálogo que cresce e encolhe junto tira o alvo de
          baixo do cursor. O tamanho é sempre o mesmo; quem rola é a lista. */}
      <DialogContent
        title="Buscar letra na internet"
        className="h-[min(44rem,calc(100dvh-3rem))] w-[min(60rem,calc(100%-1.5rem))]"
        scrollBody={false}
      >
        {open && (
          <LyricsSearchPanel
            prefillQuery={prefillQuery}
            prefillArtist={prefillArtist}
            onPick={(hit) => {
              onPick(hit);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
