import { useSyncExternalStore } from "react";
import type {
  EscolhaDePasta,
  ImportacaoDeMidia,
  MediaFile,
  MediaKind,
  MediaListing,
  TrocaDePasta,
} from "./windows-desktop";

export type { EscolhaDePasta, ImportacaoDeMidia, MediaFile, MediaKind, MediaListing, TrocaDePasta };

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

/**
 * O tipo de mídia de um arquivo pelo nome ou pelo tipo que o navegador deu.
 * Mesmas extensões que o app do Windows aceita na pasta (`desktop/media.cjs`).
 */
const EXTENSOES: Record<MediaKind, string[]> = {
  video: [".mp4", ".webm", ".m4v", ".ogv"],
  audio: [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"],
  image: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"],
};

export function tipoDoArquivo(nome: string, mime = ""): MediaKind | null {
  const ext = /\.[^.]+$/.exec(nome.toLowerCase())?.[0] ?? "";
  for (const k of MEDIA_KINDS) if (EXTENSOES[k.value].includes(ext)) return k.value;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return null;
}

/**
 * Copia arquivos para a pasta de mídia (app do Windows).
 *
 * No navegador não há pasta: devolve `null` e quem chamou decide o que fazer
 * — a Biblioteca cai no "só nesta sessão".
 */
export async function importarParaAPasta(
  files: File[] | FileList,
): Promise<ImportacaoDeMidia | null> {
  const desktop = bridge();
  if (!desktop) return null;
  try {
    return await desktop.mediaImportFiles(files);
  } catch (error) {
    return {
      ok: false,
      importados: [],
      recusados: [
        {
          nome: "",
          erro: error instanceof Error ? error.message : "Não consegui copiar para a pasta.",
        },
      ],
    };
  }
}

/** Manda um arquivo da pasta para a Lixeira do Windows (volta de lá se foi engano). */
export async function mandarParaALixeira(
  kind: MediaKind,
  nome: string,
): Promise<{ ok: boolean; error?: string }> {
  const desktop = bridge();
  if (!desktop) return { ok: false, error: "Só o app do Windows tem pasta de mídia." };
  try {
    return await desktop.mediaDelete(kind, nome);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não consegui excluir." };
  }
}

/**
 * "A mídia mudou" — para quem mostra a pasta (Biblioteca) e para quem a
 * espelha (celular).
 *
 * Duas fontes: o vigia das pastas no processo principal, que pega até arquivo
 * copiado pelo Explorer; e a própria cabine, ao importar ou excluir, que não
 * precisa esperar o vigia para atualizar a tela. `mostrar` só vem da cabine:
 * quem arrastou um vídeo quer ver a lista de vídeos; quem copiou algo pelo
 * Explorer não deve ter a lista trocada debaixo do mouse.
 */
export interface AvisoDeMidia {
  versao: number;
  mostrar?: MediaKind;
}

let aviso: AvisoDeMidia = { versao: 0 };
const ouvintes = new Set<() => void>();
let ligadoAoDisco = false;

export function avisarMidiaMudou(mostrar?: MediaKind) {
  aviso = { versao: aviso.versao + 1, mostrar };
  for (const ouvir of ouvintes) ouvir();
}

function assinar(ouvir: () => void) {
  ouvintes.add(ouvir);
  if (!ligadoAoDisco) {
    const desktop = bridge();
    if (desktop?.onMediaChanged) {
      ligadoAoDisco = true;
      desktop.onMediaChanged(() => avisarMidiaMudou());
    }
  }
  return () => {
    ouvintes.delete(ouvir);
  };
}

export function useMidiaMudou(): AvisoDeMidia {
  return useSyncExternalStore(
    assinar,
    () => aviso,
    () => aviso,
  );
}

/** Tamanho legível para a linha de apoio do item. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
