/**
 * Projection layout doctor.
 * Detects slides that will fail on a 1920×1080 telão and rewrites them:
 * phrase-sized lines, no orphans, readable type, contrast, safe margins.
 * Pure and sync so the cabine can apply it instantly; AI is an optional polish.
 */

import type { Settings, Slide, SlideKind, Theme } from "./types.ts";

export type IssueKind =
  | "wall"
  | "overflow"
  | "tooManyLines"
  | "fontSmall"
  | "orphan"
  | "longWord"
  | "edge"
  | "contrast"
  | "background";

export interface SlideIssue {
  kind: IssueKind;
  label: string;
  slideIndex?: number;
}

export interface OptimizeInput {
  kind: SlideKind;
  title?: string;
  slides: Pick<Slide, "id" | "label" | "text" | "reference">[];
  raw?: string;
  theme: Theme;
  settings: Pick<Settings, "maxLines" | "margins" | "showWallpaper" | "baseFill">;
  focusIndex?: number;
}

export interface OptimizeResult {
  issues: SlideIssue[];
  slides: Slide[];
  raw: string;
  themePatch: Partial<Theme>;
  settingsPatch: Partial<Settings>;
  summary: string[];
  usedAi: boolean;
}

const TARGET_CHARS = 34;
const MAX_CHARS = 42;
const KEEP = [
  "espírito santo",
  "filho unigênito",
  "filho unigenito",
  "vida eterna",
  "jesus cristo",
  "senhor jesus",
  "reino de deus",
  "cordeiro de deus",
  "pão da vida",
  "palavra de deus",
  "amor de deus",
  "deus pai",
];

const STRONG_SEP = "para que|porque|porém|todavia|portanto|pois|mas";

let slideSeq = 0;
function nid(): string {
  slideSeq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `opt-${slideSeq}-${rand}`;
}

const ISSUE_LABEL: Record<IssueKind, string> = {
  wall: "Bloco corrido — ilegível no telão",
  overflow: "Texto estoura a área segura",
  tooManyLines: "Excesso de linhas neste slide",
  fontSmall: "Fonte pequena para a plateia",
  orphan: "Linha com uma palavra só",
  longWord: "Palavra longa demais para a linha",
  edge: "Texto encostando na borda",
  contrast: "Contraste fraco entre letra e fundo",
  background: "Fundo atrapalhando a leitura",
};

export function isWall(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (trimmed.length < 70) return false;
  if (lines.length <= 1 && trimmed.length >= 70) return true;
  if (lines.length <= 2 && trimmed.split(" ").length >= 28) return true;
  const longLines = lines.filter((l) => l.length > 70).length;
  return longLines > 0 && longLines >= lines.length - 1;
}

function protect(text: string): { text: string; restore: (s: string) => string } {
  const map: string[] = [];
  let next = text;
  for (const phrase of KEEP) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    next = next.replace(re, (m) => {
      map.push(m);
      return `§${map.length - 1}§`;
    });
  }
  return {
    text: next,
    restore: (s) => s.replace(/§(\d+)§/g, (_, n) => map[Number(n)] ?? _),
  };
}

function splitClauses(text: string): string[] {
  const { text: src0, restore } = protect(text.replace(/\s+/g, " ").trim());
  const src = src0;
  if (!src) return [];

  type Sep = { index: number; skip: number };
  const seps: Sep[] = [];
  const strong = new RegExp(`\\s+(?:${STRONG_SEP})\\s+`, "gi");
  let m: RegExpExecArray | null;
  while ((m = strong.exec(src))) {
    if (m.index === 0) continue;
    seps.push({ index: m.index, skip: 1 });
  }
  const que = /\sque\s/gi;
  while ((m = que.exec(src))) {
    if (m.index < 6) continue;
    const prev = [...seps].filter((s) => s.index < m!.index).pop();
    const leftStart = prev ? prev.index + prev.skip : 0;
    const left = src.slice(leftStart, m.index).trim();
    if (left.length < 24) continue;
    if (/\b(aquele|aquela|aqueles|aquelas|todo|toda|quem|o|a|os|as|um|uma|este|esta|isso)$/i.test(left)) {
      continue;
    }
    seps.push({ index: m.index, skip: 1 });
  }
  const punct = /[.!?;:]\s+/g;
  while ((m = punct.exec(src))) {
    if (m.index + m[0].length >= src.length) continue;
    seps.push({ index: m.index + m[0].length - 1, skip: 1 });
  }
  seps.sort((a, b) => a.index - b.index);
  const uniq: Sep[] = [];
  for (const s of seps) {
    const last = uniq[uniq.length - 1];
    if (last && s.index - last.index < 8) continue;
    uniq.push(s);
  }

  const chunks: string[] = [];
  let start = 0;
  for (const s of uniq) {
    const left = src.slice(start, s.index).trim();
    if (left) chunks.push(restore(left));
    start = s.index + s.skip;
  }
  const tail = src.slice(start).trim();
  if (tail) chunks.push(restore(tail));
  return chunks.length ? chunks : [restore(src)];
}

function bestBreak(words: string[], max: number): number {
  if (words.length <= 1) return words.length;
  const total = words.join(" ").length;
  if (total <= max) return words.length;
  let best = Math.max(1, words.length - 1);
  let bestScore = Infinity;
  let len = 0;
  for (let i = 0; i < words.length - 1; i += 1) {
    len += (i === 0 ? 0 : 1) + words[i].length;
    if (len > max) break;
    const rest = total - len - 1;
    const dangling = /^(o|a|e|os|as|de|do|da|dos|das|um|uma)$/i.test(words[i]);
    const nextPrep = /^(de|do|da|dos|das|em|no|na|com|por|para)$/i.test(words[i + 1] ?? "");
    const shortPenalty =
      (len < 12 ? 18 : 0) +
      (rest < 12 ? 18 : 0) +
      (dangling ? 14 : 0) +
      (nextPrep && len >= 18 ? -10 : 0);
    const overflow = Math.max(0, rest - max) * 4;
    const score = Math.abs(len - rest) + shortPenalty + overflow;
    if (score < bestScore) {
      bestScore = score;
      best = i + 1;
    }
  }
  return best;
}

function wrapClause(clause: string, max = TARGET_CHARS): string {
  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length === 0) return clause;
  if (clause.length <= max) return clause;
  const at = bestBreak(words, max);
  const line1 = words.slice(0, at).join(" ");
  const rest = words.slice(at).join(" ");
  if (rest.length <= max) return `${line1}\n${rest}`;
  const restWords = words.slice(at);
  const at2 = bestBreak(restWords, max);
  const line2 = restWords.slice(0, at2).join(" ");
  const line3 = restWords.slice(at2).join(" ");
  return [line1, line2, line3].filter(Boolean).join("\n");
}

function packLines(lines: string[], per = 2): string[] {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += per) {
    out.push(clean.slice(i, i + per).join("\n"));
  }
  return out;
}

function alreadyPhrased(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const long = lines.filter((l) => l.length > 50).length;
  return long === 0;
}

export function phraseForScreen(text: string): string[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const source = blocks.length ? blocks : [text.trim()];
  const slides: string[] = [];
  for (const block of source) {
    if (alreadyPhrased(block)) {
      slides.push(...packLines(block.split("\n")));
      continue;
    }
    if (!isWall(block) && block.split("\n").length <= 2 && block.length <= MAX_CHARS * 2) {
      slides.push(block.trim());
      continue;
    }
    const clauses = splitClauses(block.replace(/\n/g, " "));
    for (const clause of clauses) {
      const wrapped = wrapClause(clause);
      const lines = wrapped.split("\n").filter(Boolean);
      if (lines.length <= 2) slides.push(lines.join("\n"));
      else slides.push(...packLines(lines, 2));
    }
  }
  return slides.filter(Boolean);
}

function usableBox(theme: Theme, settings: OptimizeInput["settings"]) {
  const ml = Math.max(theme.margin, settings.margins.l, settings.margins.r);
  const mt = Math.max(theme.margin, settings.margins.t, settings.margins.b);
  const usableW = 1920 * (1 - (ml * 2) / 100);
  const usableH = 1080 * (1 - (mt * 2) / 100);
  const charW = (theme.uppercase ? 0.62 : 0.52) * theme.fontSize;
  const maxChars = Math.max(14, Math.floor(usableW / charW));
  const lineH = theme.fontSize * theme.lineHeight;
  const maxLinesFit = Math.max(1, Math.floor((usableH * 0.9) / lineH));
  return { usableW, usableH, maxChars, lineH, maxLinesFit, ml, mt };
}

function hexLum(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (raw.length < 6) return 0.5;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function layoutSlide(text: string, theme: Theme, settings: OptimizeInput["settings"]) {
  const box = usableBox(theme, settings);
  const visual = text.split("\n").flatMap((line) => {
    const words = line.trim().split(/\s+/);
    const rows: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > box.maxChars && cur) {
        rows.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) rows.push(cur);
    return rows;
  });
  const height = visual.length * box.lineH;
  const longest = visual.reduce((m, l) => Math.max(m, l.length), 0);
  return {
    visual,
    overflowW: longest > box.maxChars,
    overflowH: height > box.usableH * 0.92,
    lineCount: visual.length,
    longest,
    orphans: visual.filter((l) => l.trim().split(/\s+/).length === 1 && l.length < 12).length,
    longWords: text.split(/\s+/).filter((w) => w.length > 16).length,
  };
}

export function diagnose(input: OptimizeInput): SlideIssue[] {
  const issues: SlideIssue[] = [];
  const add = (kind: IssueKind, slideIndex?: number) => {
    if (issues.some((i) => i.kind === kind && i.slideIndex === slideIndex)) return;
    issues.push({ kind, label: ISSUE_LABEL[kind], slideIndex });
  };

  const joined = input.raw ?? input.slides.map((s) => s.text).join("\n\n");
  if (isWall(joined) || input.slides.some((s) => isWall(s.text))) add("wall");

  const box = usableBox(input.theme, input.settings);
  if (box.ml < 8 || box.mt < 8) add("edge");
  if (input.theme.fontSize < 52) add("fontSmall");

  const onImage =
    input.settings.showWallpaper &&
    (input.theme.backgroundType === "image" || input.theme.backgroundType === "video");
  if (onImage && input.theme.overlayOpacity < 0.38) {
    add("contrast");
    add("background");
  }
  if (
    !input.settings.showWallpaper &&
    input.settings.baseFill === "light" &&
    hexLum(input.theme.textColor) > 0.7
  ) {
    add("contrast");
  }

  input.slides.forEach((slide, i) => {
    const lay = layoutSlide(slide.text, input.theme, input.settings);
    if (lay.overflowW || lay.overflowH) add("overflow", i);
    if (lay.lineCount > Math.min(input.settings.maxLines, 4) || lay.lineCount > box.maxLinesFit) {
      add("tooManyLines", i);
    }
    if (lay.orphans) add("orphan", i);
    if (lay.longWords && lay.overflowW) add("longWord", i);
  });

  return issues;
}

function slidesToRaw(kind: SlideKind, slides: Slide[]): string {
  if (kind === "song") {
    const meaningful = slides.filter((s) => {
      const base = s.label.replace(/ · \d+$/, "");
      return base && !/^aviso$/i.test(base) && !/^verso(?:\s*\d+)?$/i.test(base);
    });
    if (meaningful.length === slides.length && slides.length > 0) {
      return slides
        .map((s) => {
          const label = s.label.replace(/ · \d+$/, "");
          return `[${label}]\n${s.text}`;
        })
        .join("\n\n");
    }
  }
  return slides.map((s) => s.text).join("\n\n");
}

function makeSlides(
  kind: SlideKind,
  source: { label: string; text: string; reference?: string }[],
): Slide[] {
  return source.map((s, i) => ({
    id: nid(),
    label:
      kind === "bible" && s.reference
        ? source.length > 1 && s.text !== source[0]?.text
          ? `${s.reference}`
          : s.reference
        : s.label || (kind === "text" ? "Aviso" : `Verso ${i + 1}`),
    text: s.text,
    reference: s.reference,
    sortOrder: i,
  }));
}

function pickFontSize(slides: Slide[], current: number): number | undefined {
  const maxLines = Math.max(1, ...slides.map((s) => s.text.split("\n").length));
  const longest = Math.max(0, ...slides.map((s) =>
    Math.max(0, ...s.text.split("\n").map((l) => l.length)),
  ));
  let next = current;
  if (maxLines <= 1) next = longest > 28 ? 70 : 82;
  else if (maxLines === 2) next = longest > 36 ? 62 : 72;
  else if (maxLines === 3) next = 60;
  else next = 54;
  if (Math.abs(next - current) < 8) return undefined;
  return next;
}

export function optimizeLocal(input: OptimizeInput): OptimizeResult {
  if (input.kind === "bible" && input.focusIndex != null && input.slides[input.focusIndex]) {
    const target = input.slides[input.focusIndex];
    const part = optimizeLocal({
      ...input,
      slides: [target],
      raw: target.text,
      focusIndex: undefined,
    });
    const slides = [
      ...input.slides.slice(0, input.focusIndex).map((s) => ({ ...s, id: s.id })),
      ...part.slides,
      ...input.slides.slice(input.focusIndex + 1).map((s) => ({ ...s, id: s.id })),
    ].map((s, i) => ({
      id: s.id,
      label: s.label,
      text: s.text,
      comment: undefined,
      sortOrder: i,
      reference: s.reference,
    }));
    return { ...part, slides, raw: slidesToRaw("bible", part.slides) };
  }
  const issues = diagnose(input);
  const chunks =
    input.slides.length > 0
      ? input.slides.map((s) => ({
          label: s.label,
          reference: s.reference,
          phrases: phraseForScreen(s.text),
        }))
      : [
          {
            label: input.kind === "text" ? "Aviso" : "Verso 1",
            reference: undefined as string | undefined,
            phrases: phraseForScreen(input.raw ?? ""),
          },
        ];

  const flattened: { label: string; text: string; reference?: string }[] = [];
  for (const chunk of chunks) {
    chunk.phrases.forEach((text, i) => {
      const base = chunk.label.replace(/ · \d+$/, "");
      flattened.push({
        label: chunk.phrases.length > 1 ? `${base} · ${i + 1}` : base,
        text,
        reference: chunk.reference,
      });
    });
  }

  const slides = makeSlides(
    input.kind,
    flattened.length
      ? flattened
      : [{ label: "Aviso", text: (input.raw ?? "").trim() }],
  );

  const themePatch: Partial<Theme> = {};
  const settingsPatch: Partial<Settings> = {};
  const summary: string[] = [];

  if (issues.some((i) => i.kind === "wall" || i.kind === "tooManyLines" || i.kind === "overflow")) {
    summary.push("Parti o texto em frases de duas linhas");
  }
  if (issues.some((i) => i.kind === "orphan")) {
    summary.push("Juntei linhas com uma palavra só");
  }

  const font = pickFontSize(slides, input.theme.fontSize);
  if (font) {
    themePatch.fontSize = font;
    summary.push("Ajustei o tamanho da fonte à plateia");
  }

  if (issues.some((i) => i.kind === "contrast" || i.kind === "background")) {
    if (input.theme.overlayOpacity < 0.52) themePatch.overlayOpacity = 0.52;
    if (!input.theme.shadow) themePatch.shadow = true;
    if (input.theme.outlineWidth < 2) themePatch.outlineWidth = 2.2;
    summary.push("Escureci o fundo para a letra aparecer");
  }

  if (issues.some((i) => i.kind === "edge") || issues.some((i) => i.kind === "overflow")) {
    const m = input.settings.margins;
    if (Math.min(m.t, m.r, m.b, m.l) < 10) {
      settingsPatch.margins = {
        t: Math.max(m.t, 10),
        r: Math.max(m.r, 10),
        b: Math.max(m.b, 10),
        l: Math.max(m.l, 10),
      };
    }
    if (input.theme.margin < 10) themePatch.margin = 10;
    summary.push("Afastei o texto das bordas");
  }

  const joined = slides.map((s) => s.text).join("\n\n");
  if (joined.length > 80 && input.theme.uppercase) {
    themePatch.uppercase = false;
    summary.push("Tirei a caixa-alta — versos longos ficam ilegíveis");
  }

  if (summary.length === 0) summary.push("Ajustei a quebra para o telão");

  return {
    issues,
    slides,
    raw: slidesToRaw(input.kind, slides),
    themePatch,
    settingsPatch,
    summary,
    usedAi: false,
  };
}

const FALLBACK_THEME: Theme = {
  id: "opt-fallback",
  name: "opt",
  backgroundType: "color",
  backgroundValue: "#111111",
  overlayOpacity: 0.4,
  fontFamily: "Fraunces",
  fontSize: 68,
  fontWeight: 600,
  uppercase: false,
  textColor: "#f4f1ea",
  outlineColor: "#07080b",
  outlineWidth: 2,
  shadow: true,
  alignH: "center",
  alignV: "center",
  lineHeight: 1.22,
  margin: 9,
  showTitle: false,
  showCopyright: false,
  showReference: false,
  applyTo: "both",
};

const FALLBACK_SETTINGS: OptimizeInput["settings"] = {
  maxLines: 5,
  margins: { t: 8, r: 8, b: 8, l: 8 },
  showWallpaper: true,
  baseFill: "dark",
};

export function optimizeRawText(text: string, kind: SlideKind = "text"): OptimizeResult {
  return optimizeLocal({
    kind,
    slides: [{ id: "tmp", label: kind === "text" ? "Aviso" : "Verso 1", text }],
    raw: text,
    theme: FALLBACK_THEME,
    settings: FALLBACK_SETTINGS,
  });
}

export function shouldRefineWithAi(issues: SlideIssue[], raw: string): boolean {
  if (raw.length < 60) return false;
  return issues.some((i) => i.kind === "wall" || i.kind === "tooManyLines" || i.kind === "orphan");
}

export function mergeAiSlides(
  local: OptimizeResult,
  aiTexts: { label?: string; text: string }[],
): OptimizeResult {
  if (!aiTexts.length) return local;
  const slides = aiTexts.map((s, i) => ({
    id: nid(),
    label: s.label?.trim() || local.slides[i]?.label || `Verso ${i + 1}`,
    text: s.text.replace(/\r/g, "").trim(),
    reference: local.slides[i]?.reference,
    sortOrder: i,
  }));
  return {
    ...local,
    slides,
    raw: slidesToRaw("text", slides),
    summary: [...local.summary.filter((x) => !x.startsWith("Parti")), "Afinei as quebras de frase"],
    usedAi: true,
  };
}
