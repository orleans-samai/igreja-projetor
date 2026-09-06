/**
 * Quick-reference parser
 * ----------------------
 * Accepts operator shorthand used in the cabine:
 *   "jo 3 16"     → João 3:16
 *   "jo 3.16"     → João 3:16
 *   "jo 3:16-18"  → João 3:16–18
 *   "sl 23"       → Salmos 23 (whole chapter)
 *   "1co 13.4-7"  → 1 Coríntios 13:4–7
 *   "1 co 13 4"   → 1 Coríntios 13:4
 *
 * "jo" prefers João over Jó (culto usage). Jó is "jó" or "job".
 */

import { BOOKS, type BookMeta } from "./bible-books.ts";
import { fold } from "./fold.ts";

export interface ParsedRef {
  book: BookMeta;
  chapter: number;
  verse: number;
  endVerse?: number;
}

const INDEX: { abbrev: string; book: BookMeta }[] = BOOKS.flatMap((book) =>
  [fold(book.name), ...book.abbrevs.map(fold)].map((abbrev) => ({ abbrev, book })),
).sort((a, b) => b.abbrev.length - a.abbrev.length);

export function parseBibleRef(input: string): ParsedRef | null {
  let q = fold(input)
    .replace(/[.]/g, " ")
    .replace(/:/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/,/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  q = q.replace(/^(\d)\s+/, "$1");

  if (!q) return null;

  let matched: BookMeta | undefined;
  let rest = q;

  for (const row of INDEX) {
    if (q === row.abbrev || q.startsWith(row.abbrev + " ") || q.startsWith(row.abbrev + "-")) {
      // Disambiguate jo → João (not Jó)
      if (row.abbrev === "jo" && row.book.osis === "Job") continue;
      matched = row.book;
      rest = q.slice(row.abbrev.length).trim();
      break;
    }
  }

  if (!matched) return null;

  if (!rest) {
    return { book: matched, chapter: 1, verse: 1 };
  }

  const nums = rest.match(/^(\d+)(?:\s+(\d+))?(?:-(\d+))?$/);
  if (!nums) return null;

  const chapter = Number(nums[1]);
  const verse = nums[2] ? Number(nums[2]) : 1;
  const endVerse = nums[3] ? Number(nums[3]) : undefined;
  return { book: matched, chapter, verse, endVerse };
}

export function formatRef(bookName: string, chapter: number, verse: number, endVerse?: number): string {
  if (endVerse && endVerse !== verse) return `${bookName} ${chapter}:${verse}-${endVerse}`;
  return `${bookName} ${chapter}:${verse}`;
}
