import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCheckup } from "./health.ts";
import { applyTemplate, SERVICE_TEMPLATES } from "./templates.ts";
import { parseCommand } from "./copilot.ts";
import type { Song, Theme } from "./types.ts";

const theme: Theme = {
  id: "t",
  name: "t",
  backgroundType: "image",
  backgroundValue: "/themes/louvor.jpg",
  overlayOpacity: 0.5,
  fontFamily: "Fraunces",
  fontSize: 64,
  fontWeight: 600,
  uppercase: false,
  textColor: "#f4f1ea",
  outlineColor: "#07080b",
  outlineWidth: 2,
  shadow: true,
  alignH: "center",
  alignV: "center",
  lineHeight: 1.2,
  margin: 9,
  showTitle: false,
  showCopyright: false,
  showReference: true,
  applyTo: "both",
};

const song: Song = {
  id: "s1",
  title: "Teste",
  artist: "",
  groupId: "g-louvor",
  key: "G",
  copyright: "",
  lyricsRaw: "[Coro]\nSanto\n",
  slides: [{ id: "a", label: "Coro", text: "Santo", sortOrder: 0 }],
  createdAt: 1,
  updatedAt: 1,
};

describe("checkup e templates", () => {
  it("playlist vazia falha o check-up", () => {
    const r = runCheckup({
      songs: [song],
      playlists: [{ id: "p", name: "X", items: [], updatedAt: 1 }],
      activePlaylistId: "p",
      themes: [theme],
      songThemeId: "t",
      settings: {
        churchName: "Igreja",
        logoUrl: "",
        maxLines: 5,
        transition: "fade",
        fadeMs: 200,
        chordsOnStage: true,
        chordsOnAudience: false,
        fitMode: "contain",
        margins: { t: 8, r: 8, b: 8, l: 8 },
        openStageWindow: false,
        showWallpaper: true,
        showClock: false,
        baseFill: "dark",
        clockPosition: "top-right",
        emergencyVerse: "João 14:6",
        emergencySongId: "song-castelo",
        operatorName: "Operador",
        secondMonitor: true,
        wakeLock: true,
        startFullscreen: true,
      },
      projectorOpen: false,
      palcoOpen: false,
      bibleReady: true,
      online: true,
    });
    assert.equal(r.ready, false);
    assert.ok(r.items.some((i) => i.id === "playlist" && i.level === "fail"));
  });

  it("template domingo gera itens", () => {
    const pl = applyTemplate(SERVICE_TEMPLATES[0], [song], [
      { id: "txt-bemvindo", title: "Boas-vindas" },
      { id: "txt-oferta", title: "Oferta" },
    ]);
    assert.ok(pl.items.length >= 3);
    assert.equal(parseCommand("rm 8:28").type, "bible");
  });
});
