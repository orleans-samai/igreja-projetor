import { createServerFn } from "@tanstack/react-start";
import { formatImportedLyrics } from "./lyrics";

export interface LyricsHit {
  title: string;
  artist: string;
  lyrics: string;
  sourceUrl: string;
  sourceName: string;
  copyright: string;
  publicDomain: boolean;
  note?: string;
}

export type LyricsSearchResult =
  | { ok: true; hits: LyricsHit[]; warning?: string; moreAvailable?: boolean }
  | { ok: false; error: string };

const cache = new Map<string, { at: number; value: LyricsSearchResult }>();
const CACHE_MS = 10 * 60 * 1000;
const COPYRIGHT_WARNING =
  "A igreja precisa ter direito de projetar (domínio público, CCLI ou autorização). Lúmen só ajuda a achar o texto.";
const UA = "Lumen/1.0 (church projection operator; local cabine)";

function cacheGet(key: string): LyricsSearchResult | null {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return row.value;
}

function stripLrc(text: string): string {
  return text
    .replace(/\[(?:ti|ar|al|by|offset|length|id):[^\]]*\]/gi, "")
    .replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asHits(raw: unknown): LyricsHit[] {
  if (!raw || typeof raw !== "object") return [];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { results?: unknown }).results)
      ? (raw as { results: unknown[] }).results
      : Array.isArray((raw as { hits?: unknown }).hits)
        ? (raw as { hits: unknown[] }).hits
        : [raw];
  const hits: LyricsHit[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const lyrics = formatImportedLyrics(stripLrc(String(row.lyrics ?? "")));
    const title = String(row.title ?? "").trim();
    if (!title && !lyrics) continue;
    hits.push({
      title: title || "Sem título",
      artist: String(row.artist ?? "").trim(),
      lyrics,
      sourceUrl: String(row.sourceUrl ?? row.url ?? "").trim(),
      sourceName: String(row.sourceName ?? row.source ?? "").trim(),
      copyright: String(row.copyright ?? "").trim(),
      publicDomain: Boolean(row.publicDomain),
      note: row.note ? String(row.note) : undefined,
    });
  }
  return hits;
}

function splitQuery(query: string): { artist: string; title: string } {
  const q = query.trim();
  const dash = q.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    return { artist: dash[0]!.trim(), title: dash.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: q };
}

function hitKey(hit: LyricsHit): string {
  return `${hit.title}|${hit.artist}`.toLowerCase();
}

function mergeHits(...lists: LyricsHit[][]): LyricsHit[] {
  const out: LyricsHit[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const hit of list) {
      const id = hitKey(hit);
      if (seen.has(id)) {
        const prev = out.find((h) => hitKey(h) === id);
        if (prev && hit.lyrics.length > prev.lyrics.length) {
          Object.assign(prev, hit);
        }
        continue;
      }
      seen.add(id);
      out.push(hit);
    }
  }
  return out
    .sort((a, b) => Number(Boolean(b.lyrics)) - Number(Boolean(a.lyrics)) || b.lyrics.length - a.lyrics.length)
    .slice(0, 5);
}

async function fetchJson(url: string, ms: number, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function searchLrclib(query: string, artist: string, title: string): Promise<LyricsHit[]> {
  const params = new URLSearchParams();
  if (artist && title) {
    params.set("track_name", title);
    params.set("artist_name", artist);
  } else {
    params.set("q", query);
  }
  const body = await fetchJson(`https://lrclib.net/api/search?${params.toString()}`, 6000);
  if (!Array.isArray(body)) return [];
  const hits: LyricsHit[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.instrumental) continue;
    const plain = stripLrc(String(row.plainLyrics ?? ""));
    if (plain.length < 24) continue;
    const track = String(row.trackName ?? row.name ?? "").trim();
    const who = String(row.artistName ?? "").trim();
    hits.push({
      title: track || title || query,
      artist: who,
      lyrics: formatImportedLyrics(plain),
      sourceUrl: row.id ? `https://lrclib.net/api/get/${row.id}` : "https://lrclib.net",
      sourceName: "LRCLIB",
      copyright: "",
      publicDomain: false,
      note: "Catálogo público — confira se a igreja pode projetar.",
    });
    if (hits.length >= 5) break;
  }
  return hits;
}

async function searchLyricsOvh(artist: string, title: string): Promise<LyricsHit | null> {
  if (!artist || !title) return null;
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const body = (await fetchJson(url, 5000)) as { lyrics?: string } | null;
  if (!body?.lyrics?.trim()) return null;
  return {
    title,
    artist,
    lyrics: formatImportedLyrics(stripLrc(body.lyrics)),
    sourceUrl: url,
    sourceName: "lyrics.ovh",
    copyright: "",
    publicDomain: false,
    note: "API pública — confira se a igreja pode projetar.",
  };
}

async function searchOvhSuggest(query: string): Promise<LyricsHit[]> {
  const body = (await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, 5000)) as
    | { data?: { title?: string; artist?: { name?: string } }[] }
    | null;
  const rows = body?.data?.slice(0, 3) ?? [];
  const hits = await Promise.all(
    rows.map((row) => {
      const artist = String(row.artist?.name ?? "").trim();
      const title = String(row.title ?? "").trim();
      return searchLyricsOvh(artist, title);
    }),
  );
  return hits.filter((h): h is LyricsHit => Boolean(h));
}

async function searchCatalog(query: string, artist: string, title: string): Promise<LyricsHit[]> {
  const [lrclib, ovhDirect, ovhSuggest] = await Promise.all([
    searchLrclib(query, artist, title),
    artist ? searchLyricsOvh(artist, title) : Promise.resolve(null),
    artist ? Promise.resolve([] as LyricsHit[]) : searchOvhSuggest(query),
  ]);
  return mergeHits(lrclib, ovhDirect ? [ovhDirect] : [], ovhSuggest);
}

async function searchWithXai(query: string): Promise<{ hits: LyricsHit[]; error?: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { hits: [], error: "missing-key" };

  const user = `Busque a letra completa desta música para projeção em culto (preferir português do Brasil se existir).
Consulta do operador: ${JSON.stringify(query)}

Responda SOMENTE um JSON:
{"results":[{"title":"","artist":"","lyrics":"texto com marcadores [Verso 1], [Coro], [Ponte], [Final] e linha em branco entre slides","sourceUrl":"https://...","sourceName":"","copyright":"","publicDomain":false,"note":""}]}

Regras:
- Não invente letra. Se não achar o texto completo, deixe lyrics vazio e preencha title, artist, sourceUrl e note.
- Até 3 resultados, o mais fiel primeiro.
- Inclua a URL da fonte.
- Prefira hinários e fontes em domínio público (hymnary.org, wikisource). Não copie de letras.mus.br nem Genius.
- Hinários em domínio público podem vir completos.`;

  const messages = [
    {
      role: "system",
      content: "Você é um assistente da cabine de uma igreja. Devolve só JSON válido com letras encontradas na web.",
    },
    { role: "user", content: user },
  ];

  const parseBody = (body: {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  }): LyricsHit[] => {
    const hits = asHits(extractJson(body.choices?.[0]?.message?.content ?? ""));
    if (hits.length && body.citations?.[0]) {
      return hits.map((h, i) =>
        h.sourceUrl ? h : { ...h, sourceUrl: body.citations?.[i] ?? body.citations![0]! },
      );
    }
    return hits;
  };

  const post = (payload: Record<string, unknown>) =>
    fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(18000),
    });

  try {
    const res = await post({
      model: "grok-4.5",
      temperature: 0.1,
      max_tokens: 2500,
      messages,
      search_parameters: {
        mode: "on",
        return_citations: true,
        max_search_results: 6,
      },
    });

    if (!res.ok) {
      const retry = await post({
        model: "grok-4.5",
        temperature: 0.1,
        max_tokens: 2500,
        messages,
        tools: [{ type: "web_search" }],
      });
      if (!retry.ok) return { hits: [], error: `xAI ${retry.status}` };
      const body = (await retry.json()) as {
        choices?: { message?: { content?: string } }[];
        citations?: string[];
      };
      return { hits: parseBody(body) };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
    };
    return { hits: parseBody(body) };
  } catch {
    return { hits: [], error: "timeout" };
  }
}

export const searchWebLyrics = createServerFn({ method: "POST" })
  .validator((input: { query: string; artist?: string; deep?: boolean }) => ({
    query: String(input.query ?? "").trim().slice(0, 180),
    artist: String(input.artist ?? "").trim().slice(0, 80),
    deep: Boolean(input.deep),
  }))
  .handler(async ({ data }): Promise<LyricsSearchResult> => {
    if (data.query.length < 3) {
      return { ok: false, error: "Digite pelo menos 3 caracteres." };
    }
    const key = `${data.deep ? "d" : "c"}::${data.artist}::${data.query}`.toLowerCase();
    const cached = cacheGet(key);
    if (cached) return cached;

    const combined = data.artist ? `${data.artist} - ${data.query}` : data.query;
    const parts = splitQuery(combined);
    const title = parts.title || data.query;
    const artist = parts.artist || data.artist;

    const catalog = await searchCatalog(combined, artist, title);
    const catalogHasLyrics = catalog.some((h) => h.lyrics.length > 40);

    let xai: { hits: LyricsHit[]; error?: string } = { hits: [] };
    if (data.deep || !catalogHasLyrics) {
      xai = await searchWithXai(combined);
    }

    const hits = mergeHits(catalog, xai.hits);

    let result: LyricsSearchResult;
    if (hits.length === 0) {
      result = {
        ok: false,
        error:
          xai.error === "missing-key"
            ? "Busca profunda indisponível. Cole a letra no cadastro da música."
            : "Não achei essa letra. Tente 'artista - título' ou cole o texto.",
      };
    } else {
      result = {
        ok: true,
        hits,
        warning: COPYRIGHT_WARNING,
        moreAvailable: catalogHasLyrics && !data.deep,
      };
    }
    cache.set(key, { at: Date.now(), value: result });
    return result;
  });
