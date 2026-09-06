/**
 * Lyrics parser
 * --------------
 * Blank line → new slide.
 * Markers like [Verso 1], [Coro], [Ponte], [Final], [Intro], [Tag], [Instrumental]
 * start a labelled slide (and close the previous one).
 * Chord tokens such as [C] [G/B] [Am7] are kept in the stored text so the
 * operator/stage can show them, and stripped for the public projector unless
 * the operator enables chords on the audience screen.
 */

import { nid } from "./fold";
import type { Slide } from "./types";

const LABEL_RE =
  /^\s*\[(intro|verso\s*\d*|pre[- ]?coro|pré[- ]?coro|coro\s*\d*|ponte\s*\d*|tag|final|instrumental|bridge|ending|chorus|verse\s*\d*|coda)\]\s*$/i;

const INLINE_CHORD_RE =
  /\[([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][#b]?)?)\]/g;

const CHORD_LINE_RE =
  /^\s*(?:\[?[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][#b]?)?\]?(?:\s+|$)){2,}\s*$/;

function prettyLabel(raw: string): string {
  const inner = raw.replace(/^\s*\[|\]\s*$/g, "").trim();
  const folded = inner
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (folded.startsWith("verso")) return inner.replace(/verso/i, "Verso");
  if (folded.startsWith("coro") || folded.startsWith("chorus"))
    return inner.replace(/coro|chorus/i, "Coro");
  if (folded.startsWith("ponte") || folded === "bridge") return "Ponte";
  if (folded.startsWith("final") || folded === "ending") return "Final";
  if (folded === "intro") return "Intro";
  if (folded === "tag" || folded === "coda") return "Tag";
  if (folded.startsWith("instrumental")) return "Instrumental";
  if (folded.startsWith("pre") || folded.startsWith("pré")) return "Pré-coro";
  return inner;
}

export function stripChords(text: string): string {
  return text
    .split("\n")
    .filter((line) => !CHORD_LINE_RE.test(line))
    .join("\n")
    .replace(INLINE_CHORD_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function parseLyrics(raw: string, maxLines = 6): Slide[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const chunks: { label: string; lines: string[] }[] = [];
  let current: { label: string; lines: string[] } = { label: "Verso", lines: [] };
  let verseCount = 0;
  let started = false;

  const push = () => {
    const compact = current.lines.join("\n").trim();
    if (!compact) return;
    chunks.push({ ...current, lines: current.lines });
  };

  for (const line of lines) {
    const labelMatch = line.match(LABEL_RE);
    if (labelMatch) {
      if (started || current.lines.some((l) => l.trim())) push();
      const label = prettyLabel(line);
      if (/^Verso/i.test(label) && !/\d/.test(label)) {
        verseCount += 1;
        current = { label: `Verso ${verseCount}`, lines: [] };
      } else {
        if (/^Verso/i.test(label)) verseCount += 1;
        current = { label, lines: [] };
      }
      started = true;
      continue;
    }
    if (line.trim() === "") {
      if (current.lines.some((l) => l.trim())) {
        push();
        current = { label: current.label, lines: [] };
        started = true;
      }
      continue;
    }
    current.lines.push(line);
    started = true;
  }
  push();

  if (chunks.length === 0 && raw.trim()) {
    chunks.push({ label: "Verso 1", lines: raw.split("\n") });
  }

  const numbered = new Map<string, number>();
  const slides: Slide[] = [];
  let order = 0;
  for (const chunk of chunks) {
    let label = chunk.label;
    if (label === "Verso") {
      const n = (numbered.get("Verso") ?? 0) + 1;
      numbered.set("Verso", n);
      label = `Verso ${n}`;
    }
    const pieces = splitByMaxLines(chunk.lines.join("\n").trim(), maxLines);
    pieces.forEach((text, i) => {
      slides.push({
        id: nid(),
        label: pieces.length > 1 ? `${label} · ${i + 1}` : label,
        text,
        sortOrder: order++,
      });
    });
  }
  return slides;
}

/** Prefer line breaks, then sentence ends; never split a word. */
export function splitByMaxLines(text: string, maxLines: number): string[] {
  const lines = text.split("\n").map((l) => l.trimEnd());
  if (lines.length <= maxLines) return [text.trim()];
  const out: string[] = [];
  let bucket: string[] = [];
  for (const line of lines) {
    if (bucket.length >= maxLines) {
      out.push(bucket.join("\n").trim());
      bucket = [];
    }
    if (line.length > 90 && bucket.length >= maxLines - 1) {
      out.push(bucket.join("\n").trim());
      bucket = [line];
      continue;
    }
    bucket.push(line);
  }
  if (bucket.length) out.push(bucket.join("\n").trim());
  return out.filter(Boolean);
}

export function duplicateLabeled(
  slides: Slide[],
  labelPrefix: string,
): Slide[] {
  const extras = slides
    .filter((s) => s.label.toLowerCase().startsWith(labelPrefix.toLowerCase()))
    .map((s, i) => ({
      ...s,
      id: nid(),
      sortOrder: slides.length + i,
    }));
  return [...slides, ...extras];
}

/** Turn a pasted/web lyric block into Lúmen markers when none are present. */
export function formatImportedLyrics(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (/^\s*\[(verso|coro|ponte|intro|final|tag|pre)/im.test(text)) return text;
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return text;
  let verse = 0;
  return blocks
    .map((block) => {
      const first = block.split("\n")[0] ?? "";
      const folded = first
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      if (/^(coro|refrain|refrão|chorus)\b/.test(folded)) {
        const rest = block.replace(/^[^\n]+\n?/, "").trim() || block;
        return `[Coro]\n${rest}`;
      }
      if (/^(ponte|bridge)\b/.test(folded)) {
        const rest = block.replace(/^[^\n]+\n?/, "").trim() || block;
        return `[Ponte]\n${rest}`;
      }
      verse += 1;
      return `[Verso ${verse}]\n${block}`;
    })
    .join("\n\n");
}
