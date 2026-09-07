import { fold, nid } from "@/lib/fold";
import { formatImportedLyrics } from "@/lib/lyrics";
import { loadSong } from "@/lib/lyrics-suggestions";
import type { LyricsHit } from "@/lib/lyrics-web";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Grava no repertório uma letra vinda da internet.
 *
 * A mesma música importada duas vezes não vira duas: com título e artista
 * batendo — sem acento, sem caixa — a letra nova entra por cima e o id
 * continua o mesmo, então quem já tinha posto a música no culto não perde a
 * referência. Devolve o id, que é do que a chamada precisa para levá-la ao
 * culto do dia.
 */
export function importWebSong(hit: LyricsHit): string {
  const store = useLumenStore.getState();
  const groupId = store.selectedGroupId === "all" ? "g-louvor" : store.selectedGroupId;
  const existing = store.songs.find(
    (s) => fold(s.title) === fold(hit.title || "") && fold(s.artist) === fold(hit.artist || ""),
  );
  const id = existing?.id ?? nid();
  store.saveSong({
    id,
    title: hit.title || "Música importada",
    artist: hit.artist || existing?.artist || "",
    groupId: existing?.groupId ?? groupId,
    key: existing?.key ?? "",
    copyright: [hit.copyright, hit.publicDomain ? "domínio público" : "", hit.sourceName]
      .filter(Boolean)
      .join(" · "),
    lyricsRaw: formatImportedLyrics(hit.lyrics),
    slides: [],
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

/**
 * Busca a letra na fonte, se ela ainda não veio, e importa.
 *
 * A sugestão da busca costuma trazer só título e artista; a letra inteira
 * custa uma segunda ida à internet, que só vale a pena quando o operador
 * escolhe a música.
 */
export async function fetchAndImportWebSong(
  hit: LyricsHit,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let completa = hit;
  if (!completa.lyrics?.trim()) {
    if (!hit.sourceUrl) return { ok: false, error: "Esta fonte não tem a letra." };
    try {
      const r = await loadSong(hit.sourceUrl);
      if (!r.ok || !r.lyrics?.trim()) {
        return { ok: false, error: r.error || "A letra não veio desta fonte." };
      }
      completa = { ...hit, lyrics: r.lyrics };
    } catch {
      return { ok: false, error: "Sem resposta da internet. Tente de novo." };
    }
  }
  return { ok: true, id: importWebSong(completa) };
}
