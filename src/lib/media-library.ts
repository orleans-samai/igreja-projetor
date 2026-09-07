import type { MediaFile, MediaKind, MediaListing } from "./windows-desktop";

export type { MediaFile, MediaKind, MediaListing };

export const MEDIA_KINDS = [
  { value: "video", label: "Vídeo" },
  { value: "audio", label: "Áudio" },
  { value: "image", label: "Imagem" },
] as const satisfies readonly { value: MediaKind; label: string }[];

export function mediaKindLabel(kind: MediaKind): string {
  return MEDIA_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function bridge() {
  const desktop = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  return desktop?.isDesktop ? desktop : null;
}

/** No navegador não há pasta no disco; a tela avisa e oferece importar por sessão. */
export function hasMediaFolders(): boolean {
  return bridge() !== null;
}

export async function listMedia(kind: MediaKind): Promise<MediaListing> {
  const desktop = bridge();
  if (!desktop) {
    return {
      ok: false,
      error: "Pastas de mídia só existem no app do Windows. No navegador, importe por sessão.",
    };
  }
  try {
    return await desktop.mediaList(kind);
  } catch {
    return { ok: false, error: "Não consegui ler a pasta. Ela pode ter sido movida ou desconectada." };
  }
}

export async function openMediaFolder(kind: MediaKind): Promise<string | null> {
  const desktop = bridge();
  if (!desktop) return null;
  const r = await desktop.mediaOpenFolder(kind);
  return r.ok ? (r.dir ?? null) : null;
}

export async function chooseMediaFolder(kind: MediaKind): Promise<string | null> {
  const desktop = bridge();
  if (!desktop) return null;
  const r = await desktop.mediaChooseFolder(kind);
  return r.ok ? (r.dir ?? null) : null;
}

/** Tamanho legível para a linha de apoio do item. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
