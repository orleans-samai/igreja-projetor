/**
 * Local Bible engine. Five versions ship with the app, all free to project
 * (the licenses are in public/bible/LICENCAS.txt). Extra versions the church
 * legally owns can be imported as JSON:
 *   { id, name, license, books: [{ i, o, c: string[][] }] }
 * or the midvash/bible-data shape ({ books: [{ bookId, book, chapters }] }).
 */

import { bookById, bookByOsis } from "./bible-books.ts";
import { fold, nid } from "./fold.ts";
import { parseBibleRef, formatRef, type ParsedRef } from "./bible-ref.ts";
import type { CompactBible, CompactBook, Slide } from "./types.ts";

export const BUILTIN_BIBLES = [
  { id: "almeida-1819", url: "/bible/almeida-1819.json", name: "Almeida 1819", license: "domínio público" },
  {
    id: "blivre-2018",
    url: "/bible/blivre-2018.json",
    name: "Bíblia Livre (BLIVRE)",
    license: "CC BY 4.0 — Diego Santos, Mario Sérgio e Marco Teles (biblialivre.org)",
  },
  // As três de baixo vêm do eBible.org, geradas por scripts/gerar-biblias.mjs.
  {
    id: "nvb-2007",
    url: "/bible/nvb-2007.json",
    name: "Nova Bíblia Viva",
    license: "Biblica® Open Nova Bíblia Viva™ © 2007, 2010 Biblica, Inc. — CC BY-SA 4.0",
  },
  {
    id: "bpm-2026",
    url: "/bible/bpm-2026.json",
    name: "Bíblia Portuguesa Mundial",
    license: "domínio público — eBible.org",
  },
  {
    // Só o Novo Testamento: quem pede Gênesis nela é avisado na tela da
    // Bíblia, em vez de ver a lista vazia.
    id: "blt-2022",
    url: "/bible/blt-2022.json",
    name: "Bíblia Livre Para Todos (NT)",
    license: "© 2022 Free Bible Ministry, Inc. — CC BY-SA 4.0 — eBible.org",
  },
] as const;

const IDB_NAME = "lumen-bible";
const IDB_STORE = "versions";

const builtins = new Map<string, CompactBible>();
const builtinLoads = new Map<string, Promise<CompactBible>>();
const extras = new Map<string, CompactBible>();

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

export async function loadBuiltinBible(id: string = "almeida-1819"): Promise<CompactBible> {
  const cached = builtins.get(id);
  if (cached) return cached;
  let p = builtinLoads.get(id);
  if (!p) {
    const meta = BUILTIN_BIBLES.find((b) => b.id === id);
    if (!meta) throw new Error(`Versão embutida desconhecida: ${id}`);
    p = fetch(meta.url)
      .then((r) => {
        if (!r.ok) throw new Error("Não foi possível carregar a Bíblia");
        return r.json() as Promise<CompactBible>;
      })
      .then((data) => {
        builtins.set(id, data);
        return data;
      })
      .catch((err) => {
        builtinLoads.delete(id);
        throw err;
      });
    builtinLoads.set(id, p);
  }
  return p;
}

export async function hydrateExtraVersions(): Promise<CompactBible[]> {
  const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (desktop?.isDesktop) {
    const raw = await desktop.storageGet("lumen-bibles-v1");
    const versions: CompactBible[] = raw ? JSON.parse(raw) : [];
    for (const bible of versions) extras.set(bible.id, bible);
    return versions;
  }
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
  const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (desktop?.isDesktop) {
    const raw = await desktop.storageGet("lumen-bibles-v1");
    const versions: CompactBible[] = raw ? JSON.parse(raw) : [];
    await desktop.storageSet("lumen-bibles-v1", JSON.stringify([...versions.filter((v) => v.id !== bible.id), bible]));
  } else {
    await idbSet(bible);
  }
  extras.set(bible.id, bible);
  return bible;
}

export function getBible(versionId: string): CompactBible | null {
  return builtins.get(versionId) ?? extras.get(versionId) ?? builtins.get("almeida-1819") ?? null;
}

/**
 * Deixa a versão pronta para uso. Devolve false se ela não existe.
 *
 * Tem que vir antes de a versão virar a escolhida. Com duas versões, as
 * duas desciam do disco quando a tela da Bíblia abria; com cinco (14 MB),
 * só desce a que alguém escolhe. E `getBible` cai na Almeida quando não
 * acha a pedida: trocar antes de carregar poria no telão o texto de uma
 * com o nome da outra embaixo.
 */
export async function carregarVersao(id: string): Promise<boolean> {
  if (BUILTIN_BIBLES.some((b) => b.id === id)) {
    await loadBuiltinBible(id);
    return true;
  }
  if (extras.has(id)) return true;
  await hydrateExtraVersions();
  return extras.has(id);
}

/** Se a versão traz o livro — a Bíblia Livre Para Todos só tem o Novo Testamento. */
export function versaoTemLivro(versionId: string, bookId: number): boolean {
  const bible = getBible(versionId);
  return !!bible?.books.some((b) => b.i === bookId && b.c.length > 0);
}

export function listVersions(): { id: string; name: string; license: string }[] {
  const list: { id: string; name: string; license: string }[] = BUILTIN_BIBLES.map(
    ({ id, name, license }) => ({ id, name, license }),
  );
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
    // Versículo que a tradução omite (Mateus 17:21 na NVB e na BLT) vem
    // vazio para os seguintes ficarem no número certo. No telão ele não
    // vira slide: seria só a referência sobre uma tela em branco.
    if (!text.trim()) return;
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
