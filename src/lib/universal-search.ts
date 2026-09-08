import { searchVerses } from "./bible.ts";
import { parseBibleRef, formatRef } from "./bible-ref.ts";
import { fold } from "./fold.ts";
import type { FreeText, MediaItem, Playlist, ProjectionLog, SearchHit, Song } from "./types.ts";

export function universalSearch(input: {
  query: string;
  songs: Song[];
  texts: FreeText[];
  media: MediaItem[];
  playlists: Playlist[];
  logs: ProjectionLog[];
  bibleVersionId: string;
  limit?: number;
}): SearchHit[] {
  const q = fold(input.query);
  if (!q) return [];
  const limit = input.limit ?? 24;
  const hits: SearchHit[] = [];

  const parsed = parseBibleRef(input.query);
  if (parsed) {
    hits.push({
      id: `bible-${parsed.book.id}-${parsed.chapter}-${parsed.verse}`,
      kind: "bible",
      title: formatRef(parsed.book.name, parsed.chapter, parsed.verse, parsed.endVerse),
      subtitle: "Bíblia · projetar",
      refId: `${parsed.book.id}:${parsed.chapter}:${parsed.verse}`,
    });
  }

  for (const song of input.songs) {
    if (hits.length >= limit) break;
    if (
      fold(song.title).includes(q) ||
      fold(song.artist).includes(q) ||
      fold(song.lyricsRaw).includes(q) ||
      fold(song.key).includes(q)
    ) {
      hits.push({
        id: song.id,
        kind: "song",
        title: song.title,
        subtitle: [song.artist, song.key].filter(Boolean).join(" · ") || "Música",
        refId: song.id,
      });
    }
  }

  for (const text of input.texts) {
    if (hits.length >= limit) break;
    if (fold(text.title).includes(q) || fold(text.body).includes(q)) {
      hits.push({
        id: text.id,
        kind: "text",
        title: text.title,
        subtitle: "Aviso",
        refId: text.id,
      });
    }
  }

  for (const m of input.media) {
    if (hits.length >= limit) break;
    if (fold(m.title).includes(q) || fold(m.body ?? "").includes(q)) {
      hits.push({
        id: m.id,
        kind: "media",
        title: m.title,
        subtitle: m.type,
        refId: m.id,
      });
    }
  }

  for (const pl of input.playlists) {
    if (hits.length >= limit) break;
    if (fold(pl.name).includes(q) || pl.items.some((i) => fold(i.title).includes(q))) {
      hits.push({
        id: pl.id,
        kind: "playlist",
        title: pl.name,
        subtitle: `${pl.items.length} itens`,
        refId: pl.id,
      });
    }
  }

  if (!parsed && q.length >= 4) {
    for (const v of searchVerses(input.bibleVersionId, input.query, 8)) {
      if (hits.length >= limit) break;
      hits.push({
        id: `verse-${v.bookId}-${v.chapter}-${v.verse}`,
        kind: "bible",
        title: v.ref,
        subtitle: v.text.slice(0, 90),
        refId: `${v.bookId}:${v.chapter}:${v.verse}`,
      });
    }
  }

  for (const log of input.logs.slice(0, 80)) {
    if (hits.length >= limit) break;
    if (fold(log.title).includes(q)) {
      hits.push({
        id: log.id,
        kind: "history",
        title: log.title,
        subtitle: "Histórico do culto",
        refId: log.refId,
      });
    }
  }

  return hits.slice(0, limit);
}
