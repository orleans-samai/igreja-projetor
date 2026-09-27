import type { Theme } from "./types.ts";

/**
 * Um vídeo da pasta — um dinâmico que virou arquivo, ou qualquer outro —
 * como fundo de onde passa a letra.
 *
 * Vira um tema da casa com a letra do tema em uso: a igreja escolhe o
 * fundo, não refaz fonte, cor e contorno. Usar o mesmo vídeo outra vez
 * devolve o tema que ele já tem, com os ajustes que alguém tenha feito nele,
 * em vez de encher a lista de cópias.
 */
export function temaDeVideo(base: Theme, video: { url: string; titulo: string }, temas: readonly Theme[]): Theme {
  const existente = temas.find((t) => t.backgroundType === "video" && t.backgroundValue === video.url);
  if (existente) return existente;
  return {
    ...base,
    id: `theme-video-${codigoDe(video.url)}`,
    name: `Vídeo · ${video.titulo.trim() || "sem nome"}`.slice(0, 60),
    backgroundType: "video",
    backgroundValue: video.url,
    // Vídeo em movimento atrás da letra pede um véu: letra branca sobre um
    // brilho que passa some por um instante no meio do verso.
    overlayOpacity: Math.max(base.overlayOpacity, 0.35),
    applyTo: "songs",
  };
}

/** Um código curto e estável para o endereço: o mesmo vídeo, o mesmo id. */
function codigoDe(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i += 1) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
