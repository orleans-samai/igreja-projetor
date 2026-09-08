import { parseBibleRef } from "./bible-ref.ts";
import { describeIntent, type CopilotIntent } from "./copilot.ts";
import { fold } from "./fold.ts";
import { searchSongs, useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

export interface ExecResult {
  ok: boolean;
  message: string;
}

function jumpSection(label: string): boolean {
  const s = useLumenStore.getState();
  return s.jumpLabel(label);
}

export function executeIntent(intent: CopilotIntent): ExecResult {
  const lumen = useLumenStore.getState();
  const ops = useOpsStore.getState();
  const msg = describeIntent(intent);

  switch (intent.type) {
    case "bible": {
      const parsed = parseBibleRef(intent.query);
      const ok = lumen.jumpRef(intent.query, intent.present);
      if (!ok) return { ok: false, message: `Não reconheci o versículo “${intent.query}”` };
      ops.logAction(
        intent.present ? "Projetou versículo" : "Preparou versículo",
        parsed ? `${parsed.book.name} ${parsed.chapter}:${parsed.verse}` : intent.query,
      );
      return { ok: true, message: msg };
    }
    case "next":
      lumen.next();
      ops.logAction("Avançou slide");
      return { ok: true, message: msg };
    case "prev":
      lumen.prev();
      ops.logAction("Voltou slide");
      return { ok: true, message: msg };
    case "black":
      lumen.goBlack();
      ops.logAction("Tela preta");
      return { ok: true, message: msg };
    case "logo":
      lumen.goLogo();
      ops.logAction("Logo");
      return { ok: true, message: msg };
    case "clear":
      lumen.goClear();
      return { ok: true, message: msg };
    case "stop":
      lumen.stop();
      ops.logAction("Parou a apresentação");
      return { ok: true, message: msg };
    case "present":
      lumen.presentPreview();
      ops.logAction("Projetou", lumen.preview?.title);
      return { ok: true, message: msg };
    case "section": {
      const ok = jumpSection(intent.label);
      if (!ok) return { ok: false, message: `Não achei a seção “${intent.label}” neste item` };
      ops.logAction("Seção", intent.label);
      return { ok: true, message: msg };
    }
    case "nextItem":
      lumen.nextPlaylistItem();
      ops.logAction("Próximo item da playlist");
      return { ok: true, message: msg };
    case "prepareNext": {
      const pl = lumen.playlists.find((p) => p.id === lumen.activePlaylistId);
      const currentId = lumen.live?.refId ?? lumen.preview?.refId;
      const idx = pl?.items.findIndex((i) => i.refId === currentId) ?? -1;
      const next = idx >= 0 ? idx + 1 : 0;
      if (!pl || next >= pl.items.length) return { ok: false, message: "Não há próximo item" };
      lumen.previewPlaylistItem(next);
      ops.logAction("Preparou próximo", pl.items[next]?.title);
      return { ok: true, message: `Preparou ${pl.items[next]?.title}` };
    }
    case "countdown":
      lumen.startCountdown(intent.label, intent.seconds);
      ops.logAction("Contagem", intent.label);
      return { ok: true, message: msg };
    case "overlay":
      lumen.bumpOverlay(intent.delta);
      return { ok: true, message: msg };
    case "optimize":
      return { ok: true, message: "optimize" };
    case "emergency":
      ops.setEmergencyOpen(true);
      return { ok: true, message: msg };
    case "liveMode":
      ops.setLiveMode(intent.on);
      return { ok: true, message: msg };
    case "undo": {
      const ok = ops.undoCulto();
      return { ok, message: ok ? "Estado anterior restaurado" : "Nada para desfazer" };
    }
    case "song": {
      const hits = searchSongs(lumen.songs, intent.query, "all");
      if (!hits.length) return { ok: false, message: `Nenhuma música para “${intent.query}”` };
      lumen.selectSong(hits[0].id);
      if (intent.present) lumen.presentPreview();
      ops.logAction(intent.present ? "Projetou música" : "Selecionou música", hits[0].title);
      return { ok: true, message: `${intent.present ? "Projetou" : "Selecionou"} ${hits[0].title}` };
    }
    case "search":
      return { ok: true, message: "search" };
    case "alert":
      lumen.setAlert(intent.text, 12, "bottom");
      return { ok: true, message: msg };
    default:
      return { ok: false, message: msg };
  }
}

export function labelsOf(deck: { kind?: string; slides: { label: string }[] } | null): string[] {
  if (!deck) return [];
  if (deck.kind === "bible" || deck.kind === "countdown" || deck.kind === "media") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sl of deck.slides) {
    const key = fold(sl.label.replace(/\s+\d+$/, ""));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sl.label.replace(/\s+\d+$/, ""));
  }
  return out;
}
