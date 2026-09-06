/**
 * Local Bible engine. The built-in text is Almeida 1819 (public domain).
 * Extra versions the church legally owns can be imported as JSON:
 *   { id, name, license, books: [{ i, o, c: string[][] }] }
 * or the midvash/bible-data shape ({ books: [{ bookId, book, chapters }] }).
 */

import { BOOKS, bookById, bookByOsis } from "./bible-books";
import { fold, nid } from "./fold";
import { parseBibleRef, formatRef, type ParsedRef } from "./bible-ref";
import type { CompactBible, CompactBook, Slide } from "./types";

const BUILTIN_URL = "/bible/almeida-1819.json";
const IDB_NAME = "lumen-bible";
const IDB_STORE = "versions";

let builtin: CompactBible | null = null;
const extras = new Map<string, CompactBible>();
let loadPromise: Promise<CompactBible> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(id: string): Promise<CompactBible | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result as CompactBible | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(bible: CompactBible): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(bible, bible.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode */
  }
}

async function idbKeys(): Promise<string[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result.map(String));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export function normalizeImported(raw: unknown): CompactBible {
  if (!raw || typeof raw !== "object") throw new Error("JSON inválido");
  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.books)) {
    const books = data.books as Array<Record<string, unknown>>;
    if (books[0] && Array.isArray((books[0] as { c?: unknown }).c)) {
      return {
        id: String(data.id ?? nid()),
        name: String(data.name ?? "Versão importada"),
        license: String(data.license ?? "importada"),
        books: books as unknown as CompactBook[],
      };
    }
    if (books[0] && (books[0].bookId || books[0].chapters)) {
      return {
        id: String(data.version ?? data.id ?? nid()),
        name: String(data.name ?? "Versão importada"),
        license: String(data.license ?? "importada"),
        books: books.map((b) => ({
          i: Number(b.bookId ?? 0),
          o: String(b.book ?? ""),
          c: (b.chapters as { verses: { text: string }[] }[]).map((ch) =>
            ch.verses.map((v) => v.text),
          ),
        })),
      };
    }
  }
  throw new Error("Formato não reconhecido. Use o JSON compacto Lúmen ou o formato midvash.");
}

export async function loadBuiltinBible(): Promise<CompactBible> {
  if (builtin) return builtin;
  if (!loadPromise) {
    loadPromise = fetch(BUILTIN_URL)
      .then((r) => {
        if (!r.ok) throw new Error("Não foi possível carregar a Bíblia");
        return r.json() as Promise<CompactBible>;
      })
      .then((data) => {
        builtin = data;
        return data;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

export async function hydrateExtraVersions(): Promise<CompactBible[]> {
  const keys = await idbKeys();
  const list: CompactBible[] = [];
  for (const key of keys) {
    const v = await idbGet(key);
    if (v) {
      extras.set(v.id, v);
      list.push(v);
    }
  }
  return list;
}

export async function importBibleVersion(raw: unknown): Promise<CompactBible> {
  const bible = normalizeImported(raw);
  extras.set(bible.id, bible);
  await idbSet(bible);
  return bible;
}

export function getBible(versionId: string): CompactBible | null {
  if (builtin && (versionId === builtin.id || versionId === "almeida-1819")) return builtin;
  return extras.get(versionId) ?? builtin;
}

export function listVersions(): { id: string; name: string; license: string }[] {
  const list = builtin
    ? [{ id: builtin.id, name: builtin.name, license: builtin.license }]
    : [{ id: "almeida-1819", name: "Almeida 1819", license: "domínio público" }];
  for (const v of extras.values()) list.push({ id: v.id, name: v.name, license: v.license });
  return list;
}

export function chapterVerseCount(versionId: string, bookId: number, chapter: number): number {
  const bible = getBible(versionId);
  const book = bible?.books.find((b) => b.i === bookId);
  return book?.c[chapter - 1]?.length ?? 0;
}

export function chapterCount(versionId: string, bookId: number): number {
  const bible = getBible(versionId);
  const book = bible?.books.find((b) => b.i === bookId);
  return book?.c.length ?? 0;
}

export function getVerseText(
  versionId: string,
  bookId: number,
  chapter: number,
  verse: number,
): string | null {
  const bible = getBible(versionId);
  const book = bible?.books.find((b) => b.i === bookId);
  return book?.c[chapter - 1]?.[verse - 1] ?? null;
}

export function chapterVerses(
  versionId: string,
  bookId: number,
  chapter: number,
): { n: number; text: string }[] {
  const bible = getBible(versionId);
  const book = bible?.books.find((b) => b.i === bookId);
  return (book?.c[chapter - 1] ?? []).map((text, i) => ({ n: i + 1, text }));
}


export function chapterSlides(
  versionId: string,
  bookId: number,
  chapter: number,
  maxLines: number,
): Slide[] {
  const bible = getBible(versionId);
  const book = bible?.books.find((b) => b.i === bookId);
  const meta = bookById(bookId) ?? (book ? bookByOsis(book.o) : undefined);
  const verses = book?.c[chapter - 1] ?? [];
  const slides: Slide[] = [];
  verses.forEach((text, i) => {
    const verse = i + 1;
    const reference = formatRef(meta?.name ?? "Livro", chapter, verse);
    const wrapped = wrapVerse(text, maxLines);
    wrapped.forEach((piece, p) => {
      slides.push({
        id: `${bookId}-${chapter}-${verse}-${p}`,
        label: wrapped.length > 1 ? `${reference} · ${p + 1}` : reference,
        text: piece,
        reference,
        sortOrder: slides.length,
      });
    });
  });
  return slides;
}

function wrapVerse(text: string, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  const maxChars = 42;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return [lines.join("\n")];
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    out.push(lines.slice(i, i + maxLines).join("\n"));
  }
  return out;
}

export function searchVerses(
  versionId: string,
  query: string,
  limit = 40,
): { bookId: number; bookName: string; chapter: number; verse: number; text: string; ref: string }[] {
  const bible = getBible(versionId);
  if (!bible || !query.trim()) return [];
  const q = fold(query);
  const hits: ReturnType<typeof searchVerses> = [];
  for (const book of bible.books) {
    const meta = bookById(book.i) ?? bookByOsis(book.o);
    const name = meta?.name ?? book.o;
    book.c.forEach((verses, ci) => {
      verses.forEach((text, vi) => {
        if (hits.length >= limit) return;
        if (fold(text).includes(q)) {
          hits.push({
            bookId: book.i,
            bookName: name,
            chapter: ci + 1,
            verse: vi + 1,
            text,
            ref: formatRef(name, ci + 1, vi + 1),
          });
        }
      });
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export { parseBibleRef };
export type { ParsedRef };
