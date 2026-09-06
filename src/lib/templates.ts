import { nid } from "./fold.ts";
import type { Playlist, PlaylistItem, SlideKind, Song } from "./types.ts";

export interface ServiceTemplate {
  id: string;
  name: string;
  blurb: string;
  start: string;
  slots: { title: string; minutes: number; kind: SlideKind; pick?: "welcome" | "louvor" | "ceia" | "hinario" | "kids" | "oferta" | "aviso" }[];
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "domingo",
    name: "Culto Domingo",
    blurb: "Abertura, 3 músicas, palavra, oferta, encerramento",
    start: "19:00",
    slots: [
      { title: "Abertura", minutes: 3, kind: "text", pick: "welcome" },
      { title: "Louvor 1", minutes: 5, kind: "song", pick: "louvor" },
      { title: "Louvor 2", minutes: 5, kind: "song", pick: "louvor" },
      { title: "Louvor 3", minutes: 6, kind: "song", pick: "louvor" },
      { title: "Palavra", minutes: 35, kind: "bible" },
      { title: "Oferta", minutes: 4, kind: "text", pick: "oferta" },
      { title: "Encerramento", minutes: 4, kind: "song", pick: "hinario" },
    ],
  },
  {
    id: "jovem",
    name: "Culto Jovem",
    blurb: "Louvor longo, palavra curta, avisos",
    start: "19:30",
    slots: [
      { title: "Abertura", minutes: 2, kind: "text", pick: "welcome" },
      { title: "Louvor 1", minutes: 6, kind: "song", pick: "louvor" },
      { title: "Louvor 2", minutes: 6, kind: "song", pick: "louvor" },
      { title: "Louvor 3", minutes: 6, kind: "song", pick: "louvor" },
      { title: "Louvor 4", minutes: 5, kind: "song", pick: "louvor" },
      { title: "Palavra", minutes: 25, kind: "bible" },
      { title: "Avisos", minutes: 4, kind: "text", pick: "aviso" },
    ],
  },
  {
    id: "ceia",
    name: "Santa Ceia",
    blurb: "Louvor, mesa, pão e vinho",
    start: "19:00",
    slots: [
      { title: "Abertura", minutes: 3, kind: "text", pick: "welcome" },
      { title: "Louvor 1", minutes: 5, kind: "song", pick: "louvor" },
      { title: "Louvor 2", minutes: 5, kind: "song", pick: "louvor" },
      { title: "Pão partido", minutes: 8, kind: "song", pick: "ceia" },
      { title: "Palavra", minutes: 20, kind: "bible" },
      { title: "Ceia", minutes: 12, kind: "song", pick: "ceia" },
    ],
  },
  {
    id: "casamento",
    name: "Casamento",
    blurb: "Entrada, votos, bênção",
    start: "16:00",
    slots: [
      { title: "Entrada", minutes: 4, kind: "song", pick: "hinario" },
      { title: "Palavra", minutes: 15, kind: "bible" },
      { title: "Votos", minutes: 10, kind: "text", pick: "aviso" },
      { title: "Bênção", minutes: 5, kind: "song", pick: "hinario" },
    ],
  },
  {
    id: "infantil",
    name: "Culto Infantil",
    blurb: "Canções curtas e avisos da sala kids",
    start: "10:00",
    slots: [
      { title: "Casa aberta", minutes: 4, kind: "song", pick: "kids" },
      { title: "Louvor", minutes: 4, kind: "song", pick: "louvor" },
      { title: "Palavra", minutes: 12, kind: "bible" },
      { title: "Sala kids", minutes: 2, kind: "text", pick: "aviso" },
    ],
  },
  {
    id: "vigilia",
    name: "Vigília",
    blurb: "Ciclo de louvor e palavra",
    start: "22:00",
    slots: [
      { title: "Louvor 1", minutes: 8, kind: "song", pick: "louvor" },
      { title: "Louvor 2", minutes: 8, kind: "song", pick: "louvor" },
      { title: "Palavra", minutes: 20, kind: "bible" },
      { title: "Louvor 3", minutes: 10, kind: "song", pick: "louvor" },
      { title: "Encerramento", minutes: 6, kind: "song", pick: "hinario" },
    ],
  },
];

function pickSong(songs: Song[], groupId: string, used: Set<string>): Song | undefined {
  const pool = songs.filter((s) => s.groupId === groupId && !used.has(s.id));
  const hit = pool[0] ?? songs.find((s) => !used.has(s.id));
  if (hit) used.add(hit.id);
  return hit;
}

export function applyTemplate(
  tpl: ServiceTemplate,
  songs: Song[],
  texts: { id: string; title: string }[],
): Playlist {
  const used = new Set<string>();
  const items: PlaylistItem[] = [];
  const welcome = texts.find((t) => t.id === "txt-bemvindo") ?? texts[0];
  const oferta = texts.find((t) => t.id === "txt-oferta");
  const aviso = texts.find((t) => t.id === "txt-kids") ?? texts.find((t) => t.id === "txt-wifi");

  for (const slot of tpl.slots) {
    if (slot.kind === "song") {
      const group =
        slot.pick === "ceia"
          ? "g-ceia"
          : slot.pick === "hinario"
            ? "g-hinario"
            : slot.pick === "kids"
              ? "g-infantil"
              : "g-louvor";
      const song = pickSong(songs, group, used);
      if (song) {
        items.push({
          id: nid(),
          type: "song",
          refId: song.id,
          notes: slot.title,
          title: song.title,
          subtitle: `${slot.minutes} min`,
        });
      }
    } else if (slot.kind === "bible") {
      items.push({
        id: nid(),
        type: "bible",
        refId: "43:3:16",
        notes: slot.title,
        title: "João 3:16",
        subtitle: `${slot.minutes} min`,
      });
    } else {
      const text =
        slot.pick === "oferta"
          ? oferta
          : slot.pick === "welcome"
            ? welcome
            : aviso ?? welcome;
      if (text) {
        items.push({
          id: nid(),
          type: "text",
          refId: text.id,
          notes: slot.title,
          title: text.title,
          subtitle: `${slot.minutes} min`,
        });
      }
    }
  }

  return {
    id: `pl-${tpl.id}-${Date.now()}`,
    name: tpl.name,
    items,
    updatedAt: Date.now(),
  };
}

export function addMinutesToTime(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function plannedMinutesFor(kind: SlideKind, notes?: string): number {
  if (notes) {
    const n = notes.match(/(\d+)\s*min/);
    if (n) return Number(n[1]);
  }
  if (kind === "song") return 5;
  if (kind === "bible") return 8;
  if (kind === "text") return 3;
  if (kind === "countdown") return 5;
  return 4;
}
