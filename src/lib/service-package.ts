import { z } from "zod";
import { toast } from "sonner";
import { getBible, importBibleVersion } from "@/lib/bible";
import { useLumenStore } from "@/store/lumen-store";
import { useAutoSlideStore } from "@/store/auto-slide-store";
import type { CompactBible, Theme, Settings } from "@/lib/types";

const id = z.string().min(1).max(500);
const slide = z.object({ id, label: z.string(), text: z.string(), sortOrder: z.number(), reference: z.string().optional(), themeOverrideId: id.optional(), comment: z.string().optional() });
const theme = z.object({ id, name: z.string(), backgroundType: z.enum(["color", "image", "video", "animated"]), backgroundValue: z.string(), fontFamily: z.string(), fontSize: z.number().min(12).max(300), fontWeight: z.number(), overlayOpacity: z.number().min(0).max(1), textColor: z.string(), outlineColor: z.string(), outlineWidth: z.number(), shadow: z.boolean(), uppercase: z.boolean(), alignH: z.enum(["left", "center", "right"]), alignV: z.enum(["top", "center", "bottom"]), lineHeight: z.number().positive(), margin: z.number().min(0).max(45), showTitle: z.boolean(), showCopyright: z.boolean(), showReference: z.boolean(), applyTo: z.enum(["songs", "bible", "both"]) });
const projectionSettings = z.object({ churchName: z.string(), logoUrl: z.string(), maxLines: z.number().int().min(1).max(20), margins: z.object({ t: z.number().min(0).max(45), r: z.number().min(0).max(45), b: z.number().min(0).max(45), l: z.number().min(0).max(45) }), showWallpaper: z.boolean(), baseFill: z.enum(["dark", "light"]), fitMode: z.enum(["contain", "cover"]) });
const serviceSchema = z.object({
  format: z.literal("lumen-service-v1"),
  playlist: z.object({ id, name: z.string(), updatedAt: z.number(), items: z.array(z.object({ id, type: z.enum(["song", "bible", "media", "text", "countdown"]), refId: z.string(), title: z.string(), notes: z.string(), subtitle: z.string().optional() })) }),
  songs: z.array(z.object({ id, title: z.string(), artist: z.string(), groupId: z.string(), key: z.string(), copyright: z.string(), themeId: id.optional(), lyricsRaw: z.string(), slides: z.array(slide), createdAt: z.number(), updatedAt: z.number() })),
  groups: z.array(z.object({ id, name: z.string() })),
  texts: z.array(z.object({ id, title: z.string(), body: z.string(), updatedAt: z.number() })),
  media: z.array(z.object({ id, title: z.string(), type: z.enum(["image", "video", "audio", "announcement"]), path: z.string(), body: z.string().optional() })),
  themes: z.array(theme).min(1), settings: projectionSettings,
  songThemeId: id, bibleThemeId: id, stageThemeId: id,
  bible: z.unknown().optional(),
});

export function serviceSnapshot() {
  const s = useLumenStore.getState();
  const playlist = s.playlists.find((p) => p.id === s.activePlaylistId);
  if (!playlist?.items.length) throw new Error("Escolha uma programação com pelo menos um item.");
  const refs = new Set(playlist.items.map((i) => i.refId));
  const songs = s.songs.filter((song) => refs.has(song.id));
  const themes = new Set([s.songThemeId, s.bibleThemeId, s.stageThemeId]);
  for (const song of songs) {
    if (song.themeId) themes.add(song.themeId);
    for (const sl of song.slides) if (sl.themeOverrideId) themes.add(sl.themeOverrideId);
  }
  const data = { format: "lumen-service-v1" as const, playlist, songs, groups: s.groups,
    texts: s.texts.filter((t) => refs.has(t.id)), media: s.media.filter((m) => refs.has(m.id)),
    themes: s.themes.filter((t) => themes.has(t.id)), settings: s.settings,
    songThemeId: s.songThemeId, bibleThemeId: s.bibleThemeId, stageThemeId: s.stageThemeId,
    bible: getBible(s.bibleVersionId) ?? undefined,
  };
  const missing = playlist.items.filter((i) =>
    (i.type === "song" && !data.songs.some((s) => s.id === i.refId)) ||
    (i.type === "text" && !data.texts.some((s) => s.id === i.refId)) ||
    (i.type === "media" && !data.media.some((s) => s.id === i.refId)));
  if (missing.length) throw new Error(`Itens ausentes da biblioteca: ${missing.map((i) => i.title).join(", ")}`);
  if (playlist.items.some((i) => i.type === "bible") && !data.bible) throw new Error("Aguarde a Bíblia carregar antes de exportar.");
  return data;
}

export function serviceMedia() {
  const d = serviceSnapshot();
  return [
    ...d.media.filter((m) => m.type !== "announcement" && m.path).map((m) => ({ title: m.title, url: m.path, type: m.type })),
    ...d.themes.filter((t) => ["image", "video"].includes(t.backgroundType)).map((t) => ({ title: `Tema: ${t.name}`, url: t.backgroundValue, type: t.backgroundType })),
    ...(d.settings.logoUrl ? [{ title: "Logo", url: d.settings.logoUrl, type: "image" }] : []),
  ];
}

let transferring = false;
export async function exportService() {
  if (transferring) return;
  const desktop = window.lumenDesktop;
  if (!desktop) { toast("Exporte o culto com mídias no aplicativo Windows."); return; }
  transferring = true;
  const message = toast.loading("Preparando o culto com todas as mídias…");
  try {
    const data = serviceSchema.parse(serviceSnapshot());
    // Session blobs belong to the renderer. Materialize them before crossing IPC.
    for (const m of data.media) if (m.path.startsWith("blob:")) throw new Error(`Coloque “${m.title}” na pasta de mídia antes de exportar.`);
    const result = await desktop.exportService(data);
    if (!result.canceled) toast.success(`Culto exportado com ${result.files} arquivos.`, { description: result.path });
  } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível exportar o culto."); }
  finally { toast.dismiss(message); transferring = false; }
}

export async function importService() {
  if (transferring) return;
  const desktop = window.lumenDesktop;
  if (!desktop) { toast("Importe o pacote no aplicativo Windows."); return; }
  if (useLumenStore.getState().status !== "idle") { toast("Encerre a apresentação para importar um culto."); return; }
  transferring = true;
  const message = toast.loading("Conferindo e importando o culto…");
  try {
    const raw = await desktop.importService();
    if (!raw) return;
    const data = serviceSchema.parse(raw);
    if (useLumenStore.getState().status !== "idle") throw new Error("A apresentação começou. Encerre e importe novamente.");
    const prefix = `import-${crypto.randomUUID()}-`;
    const ids = new Map<string, string>();
    for (const group of [data.songs, data.groups, data.texts, data.media, data.themes]) for (const item of group) ids.set(item.id, prefix + item.id);
    const remap = (value: string) => ids.get(value) ?? value;
    const available = new Map([ ...data.songs.map((s) => [s.id, "song"] as const), ...data.texts.map((s) => [s.id, "text"] as const), ...data.media.map((s) => [s.id, "media"] as const) ]);
    for (const item of data.playlist.items) if (["song", "text", "media"].includes(item.type) && available.get(item.refId) !== item.type) throw new Error("Há itens ausentes no pacote.");
    for (const value of [data.songThemeId, data.bibleThemeId, data.stageThemeId]) if (!data.themes.some((t) => t.id === value)) throw new Error("Tema ausente no pacote.");
    const bible = data.bible ? await importBibleVersion({ ...(data.bible as CompactBible), id: prefix + "bible" }) : null;
    if (useLumenStore.getState().status !== "idle") throw new Error("A apresentação começou. Encerre e importe novamente.");
    useAutoSlideStore.getState().setLigado(false);
    useLumenStore.setState((s) => ({
      songs: [...s.songs, ...data.songs.map((song) => ({ ...song, id: remap(song.id), groupId: remap(song.groupId), themeId: song.themeId ? remap(song.themeId) : undefined, slides: song.slides.map((sl) => ({ ...sl, id: prefix + sl.id, themeOverrideId: sl.themeOverrideId ? remap(sl.themeOverrideId) : undefined })) }))],
      groups: [...s.groups, ...data.groups.map((g) => ({ ...g, id: remap(g.id) }))],
      texts: [...s.texts, ...data.texts.map((t) => ({ ...t, id: remap(t.id) }))],
      media: [...s.media, ...data.media.map((m) => ({ ...m, id: remap(m.id) }))],
      themes: [...s.themes, ...data.themes.map((t) => ({ ...t, id: remap(t.id) } as Theme))],
      playlists: [...s.playlists, { ...data.playlist, id: prefix + "playlist", items: data.playlist.items.map((i) => ({ ...i, id: prefix + i.id, refId: ["song", "text", "media"].includes(i.type) ? remap(i.refId) : i.refId })) }],
      activePlaylistId: prefix + "playlist", songThemeId: remap(data.songThemeId), bibleThemeId: remap(data.bibleThemeId), stageThemeId: remap(data.stageThemeId),
      settings: { ...s.settings, ...data.settings } as Settings,
      ...(bible ? { bibleVersionId: bible.id, extraVersionIds: [...s.extraVersionIds, { id: bible.id, name: bible.name }] } : {}),
      preview: null, previewIndex: 0,
    }));
    toast.success(`“${data.playlist.name}” importado. A biblioteca anterior foi preservada.`);
  } catch (e) { toast.error(e instanceof z.ZodError ? "Pacote inválido: dados do culto incompletos." : e instanceof Error ? e.message : "Não foi possível importar."); }
  finally { toast.dismiss(message); transferring = false; }
}
