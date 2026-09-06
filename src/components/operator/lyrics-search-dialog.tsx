import { Globe, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { searchWebLyrics, type LyricsHit } from "@/lib/lyrics-web";
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
  const [usedDeep, setUsedDeep] = useState(false);

  useEffect(() => {
    setQuery(prefillQuery);
    setArtist(prefillArtist);
    setError(null);
    setWarning(null);
    setHits([]);
    setPaste("");
    setSelected(0);
    setMoreAvailable(false);
    setUsedDeep(false);
  }, [prefillQuery, prefillArtist]);

  const runSearch = async (deep = false) => {
    const q = query.trim();
    if (q.length < 3) {
      setError("Digite o título (pelo menos 3 letras).");
      return;
    }
    setLoading(true);
    setError(null);
    if (!deep) setHits([]);
    try {
      const result = await searchWebLyrics({
        data: { query: q, artist: artist.trim(), deep },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHits(result.hits);
      setWarning(result.warning ?? null);
      setMoreAvailable(Boolean(result.moreAvailable));
      setUsedDeep(deep);
      setSelected(0);
      if (result.hits.every((h) => !h.lyrics)) {
        setError("Achei referências, mas sem a letra completa. Cole o texto abaixo.");
      }
    } catch {
      setError("Falha na busca. Tente de novo ou cole a letra.");
    } finally {
      setLoading(false);
    }
  };

  const current = hits[selected];
  const slideCount = useMemo(
    () => (current?.lyrics ? parseLyrics(current.lyrics).length : 0),
    [current?.lyrics],
  );

  return (
    <div>
      <form
        className="space-y-3"
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

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {warning && !error && <p className="mt-3 text-xs text-muted">{warning}</p>}

      {loading && (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          Procurando letras públicas
          {usedDeep || moreAvailable === false ? " e na web" : ""} — alguns segundos.
        </p>
      )}

      {hits.length > 0 && (
        <div
          id="lyrics-search-results"
          role="region"
          aria-label="Resultados da busca de letras"
          className="mt-4 grid gap-3 md:grid-cols-[14rem_1fr]"
        >
          <ul role="listbox" aria-label="Letras encontradas" className="space-y-1">
            {hits.map((hit, i) => (
              <li key={`${hit.title}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-sm",
                    i === selected ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span className="block truncate font-medium">{hit.title}</span>
                  <span className="block truncate text-xs text-subtle">
                    {hit.artist || hit.sourceName || "Fonte web"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <div className="min-w-0 rounded-lg bg-elevated p-3">
              <p className="text-sm font-semibold">{current.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>{current.artist || "Artista não informado"}</span>
                {current.sourceName ? <Badge>{current.sourceName}</Badge> : null}
                {current.publicDomain ? <Badge>domínio público</Badge> : null}
                {slideCount > 0 ? <span className="tabular-nums">{slideCount} slides</span> : null}
              </p>
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
                  className="mt-2 block truncate text-xs text-primary hover:underline"
                >
                  {current.sourceUrl}
                </a>
              )}
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-sans text-sm text-fg lumen-scroll">
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
          className="mt-1 min-h-28 font-mono text-xs"
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
      <DialogContent title="Buscar letra na internet" className="max-h-[86vh] max-w-3xl overflow-y-auto">
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
