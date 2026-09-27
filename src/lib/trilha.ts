import type { CamposDeMidia, Deck, TrilhaDeAudio } from "./types.ts";

/**
 * "Tirar vídeo": a imagem sai do telão, o som do vídeo continua.
 *
 * A igreja toca o clipe de um louvor e quer só o áudio — com a letra dela
 * no telão, ou o fundo, ou a logo. O som vira uma trilha que sobrevive à
 * troca do que está no ar: projetar a letra, o versículo, a logo ou o preto
 * não corta a música. Outro vídeo ou áudio no ar encerra a trilha, porque
 * dois sons juntos no culto nunca é o que alguém quer.
 */

function camposDe(m: CamposDeMidia): CamposDeMidia {
  return {
    mediaSrc: m.mediaSrc,
    mediaType: m.mediaType,
    mediaAcao: m.mediaAcao,
    mediaLoop: m.mediaLoop,
    mediaTempo: m.mediaTempo,
    mediaBusca: m.mediaBusca,
    mediaVelocidade: m.mediaVelocidade,
    mediaVolume: m.mediaVolume,
    mediaMudo: m.mediaMudo,
    mediaSeq: m.mediaSeq,
  };
}

/** A trilha de um vídeo no ar, com o estado de reprodução dele; null se não é vídeo. */
export function trilhaDoVideo(deck: Deck | null | undefined): TrilhaDeAudio | null {
  if (!deck || deck.kind !== "media" || deck.mediaType !== "video" || !deck.mediaSrc) return null;
  return { ...camposDe(deck), mediaAcao: deck.mediaAcao ?? "tocar", refId: deck.refId, title: deck.title };
}

/** Vídeo ou áudio no ar que não é o da trilha: a trilha acaba, para não tocarem dois sons. */
export function trilhaSobrevive(trilha: TrilhaDeAudio | null | undefined, live: Deck | null | undefined): boolean {
  if (!trilha) return false;
  const outroSom =
    live?.kind === "media" &&
    (live.mediaType === "video" || live.mediaType === "audio") &&
    live.mediaSrc !== trilha.mediaSrc;
  return !outroSom;
}

/** Os campos que voltam para o baralho quando o vídeo volta à tela. */
export function camposDaTrilha(trilha: TrilhaDeAudio): CamposDeMidia {
  return camposDe(trilha);
}

export interface MidiaNoTelao extends CamposDeMidia {
  title: string;
  /** Tocando, mas sem aparecer: é a trilha. */
  oculta: boolean;
}

/**
 * O que o telão toca e mostra de mídia.
 *
 * `principal` é o único elemento com som — a trilha (oculta) ou a mídia do
 * baralho (à vista) — e mora sempre no mesmo lugar da tela: tirar e mostrar
 * o vídeo reaproveitam o mesmo elemento, e o som não corta nem recomeça.
 * `imagem` é uma imagem no ar enquanto a trilha toca por baixo.
 *
 * @param conteudoEscondido  preto, logo ou "ocultar letra": a mídia do
 *   baralho sai de cena; a trilha, não — é para isso que ela existe.
 */
export function midiaDoTelao(
  deck: Deck | null | undefined,
  trilha: TrilhaDeAudio | null | undefined,
  conteudoEscondido: boolean,
): { principal: MidiaNoTelao | null; imagem: MidiaNoTelao | null } {
  const doDeck = deck?.kind === "media" && deck.mediaSrc ? deck : null;
  const deckComSom = Boolean(doDeck && (doDeck.mediaType === "video" || doDeck.mediaType === "audio"));
  if (trilha && trilhaSobrevive(trilha, deck)) {
    return {
      principal: { ...camposDe(trilha), title: trilha.title, oculta: true },
      imagem:
        doDeck && !deckComSom && !conteudoEscondido ? { ...camposDe(doDeck), title: doDeck.title, oculta: false } : null,
    };
  }
  return {
    principal: doDeck && !conteudoEscondido ? { ...camposDe(doDeck), title: doDeck.title, oculta: false } : null,
    imagem: null,
  };
}
