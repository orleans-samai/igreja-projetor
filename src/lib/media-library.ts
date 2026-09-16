import type {
  EscolhaDePasta,
  MediaFile,
  MediaKind,
  MediaListing,
  TrocaDePasta,
} from "./windows-desktop";

export type { EscolhaDePasta, MediaFile, MediaKind, MediaListing, TrocaDePasta };

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

/**
 * Passo 1 de trocar a pasta: perguntar onde, validar e contar o que ficaria
 * para trás. Não troca nada ainda — quem troca é `applyMediaFolder`, depois de
 * a cabine decidir o que fazer com o acervo antigo.
 */
export async function chooseMediaFolder(kind: MediaKind): Promise<EscolhaDePasta> {
  const desktop = bridge();
  if (!desktop) {
    return { ok: false, error: "Pastas de mídia só existem no app do Windows." };
  }
  try {
    return await desktop.mediaChooseFolder(kind);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao abrir o seletor." };
  }
}

/** Passo 2: aplicar a pasta nova, movendo ou não o que estava na antiga. */
export async function applyMediaFolder(
  kind: MediaKind,
  dir: string,
  mover: boolean,
): Promise<TrocaDePasta> {
  const desktop = bridge();
  if (!desktop) return { ok: false, error: "Pastas de mídia só existem no app do Windows." };
  try {
    return await desktop.mediaApplyFolder(kind, dir, mover);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao trocar a pasta." };
  }
}

/** Volta ao padrão, dentro dos dados do usuário. */
export async function resetMediaFolder(kind: MediaKind): Promise<TrocaDePasta> {
  const desktop = bridge();
  if (!desktop) return { ok: false, error: "Pastas de mídia só existem no app do Windows." };
  try {
    return await desktop.mediaResetFolder(kind);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao voltar ao padrão." };
  }
}

/** Tamanho legível para a linha de apoio do item. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
