import "@fontsource-variable/oswald";
import "@fontsource/anton";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource/dm-serif-display";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/caveat";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { useEffect, useState } from "react";
import type { EstiloDeTexto } from "../catalogo/tipografia.ts";
import { todasAsCamadas, type Camada } from "../documento.ts";
import type { Medidor } from "../gerador/texto.ts";

/**
 * Fontes e imagens das artes: carregadas uma vez, reaproveitadas sempre.
 *
 * As fontes vêm embutidas (pacotes @fontsource) — arte feita sem internet
 * sai com a letra que a prévia mostrou. Antes de medir texto ou exportar, a
 * família precisa estar carregada de fato: o canvas desenha com a fonte de
 * reserva sem avisar, e a medida sairia errada em silêncio.
 */

const AMOSTRA = "Aa ÁÉÍÓÚ ÂÊÔ ÃÕ Ç àèìòù ç 0123456789";
const fontesProntas = new Map<string, Promise<void>>();

export function chaveDaFonte(familia: string, peso: number, estilo: string): string {
  return `${estilo === "italic" ? "italic " : ""}${peso} 40px "${familia}"`;
}

export function garantirFonte(familia: string, peso: number, estilo: "normal" | "italic" = "normal"): Promise<void> {
  const chave = chaveDaFonte(familia, peso, estilo);
  let p = fontesProntas.get(chave);
  if (!p) {
    p = typeof document === "undefined" || !document.fonts
      ? Promise.resolve()
      : document.fonts.load(chave, AMOSTRA).then(() => undefined, () => undefined);
    fontesProntas.set(chave, p);
  }
  return p;
}

/** Todas as fontes que as camadas usam, carregadas. */
export async function garantirFontesDe(camadas: Camada[]): Promise<void> {
  const pedidos: Promise<void>[] = [];
  for (const { camada } of todasAsCamadas(camadas)) {
    if (camada.tipo === "texto") pedidos.push(garantirFonte(camada.fonte, camada.peso, camada.estilo));
  }
  await Promise.all(pedidos);
}

// ─────────────────────────────────────────────── imagens

const imagens = new Map<string, HTMLImageElement>();
const carregando = new Map<string, Promise<HTMLImageElement | null>>();

export function imagemPronta(src: string): HTMLImageElement | null {
  return imagens.get(src) ?? null;
}

/**
 * Carrega uma imagem para o canvas, uma vez por endereço.
 *
 * `crossOrigin` fica anônimo: as imagens do app são do mesmo endereço
 * (lumen://app) ou data:, que não sujam o canvas; se um dia vier uma de
 * fora, ela só entra se o servidor permitir — senão a exportação quebraria
 * com o canvas "contaminado", sem explicação.
 */
export function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  const pronta = imagens.get(src);
  if (pronta) return Promise.resolve(pronta);
  let p = carregando.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => {
        imagens.set(src, img);
        carregando.delete(src);
        resolve(img);
      };
      img.onerror = () => {
        carregando.delete(src);
        resolve(null);
      };
      img.src = src;
    });
    carregando.set(src, p);
  }
  return p;
}

export async function carregarImagensDe(camadas: Camada[]): Promise<void> {
  const pedidos: Promise<unknown>[] = [];
  for (const { camada } of todasAsCamadas(camadas)) {
    if (camada.tipo === "imagem" || camada.tipo === "logo" || camada.tipo === "textura") pedidos.push(carregarImagem(camada.src));
  }
  await Promise.all(pedidos);
}

/** A imagem para um nó Konva: aparece quando carrega, sem piscar se já estava. */
export function useImagem(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() => (src ? imagemPronta(src) : null));
  useEffect(() => {
    if (!src) return;
    const pronta = imagemPronta(src);
    if (pronta) {
      setImg(pronta);
      return;
    }
    let vivo = true;
    void carregarImagem(src).then((i) => vivo && setImg(i));
    return () => {
      vivo = false;
    };
  }, [src]);
  return img;
}

// ─────────────────────────────────────────────── medidor

/**
 * O medidor de verdade: a largura que o canvas vai desenhar, com a fonte
 * carregada. É a mesma conta que o Konva faz ao pôr o texto na tela — por
 * isso a quebra escolhida pelo gerador é a quebra que aparece.
 */
export function medidorDeCanvas(): Medidor {
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d")!;
  const cache = new Map<string, number>();
  return {
    largura(texto: string, estilo: EstiloDeTexto, tamanho: number) {
      const t = estilo.maiusculas ? texto.toLocaleUpperCase("pt-BR") : texto;
      const fonte = `${estilo.estilo === "italic" ? "italic " : ""}${estilo.peso} ${tamanho}px "${estilo.fonte}"`;
      // Com espaço entre letras, o Konva desenha letra por letra e mede sem
      // kerning. Medir com kerning dava alguns px a menos — e o Konva, com a
      // quebra desligada, cortava a última letra que não coube.
      const kerning = estilo.espacamento !== 0 ? "none" : "auto";
      const chave = `${fonte}|${kerning}|${t}`;
      let w = cache.get(chave);
      if (w === undefined) {
        ctx.font = fonte;
        ctx.fontKerning = kerning;
        w = ctx.measureText(t).width;
        if (cache.size > 20000) cache.clear();
        cache.set(chave, w);
      }
      return w + estilo.espacamento * tamanho * [...t].length;
    },
  };
}

/** Carrega todas as fontes do catálogo — antes de gerar um lote. */
export async function garantirFontesDoCatalogo(estilos: EstiloDeTexto[]): Promise<void> {
  await Promise.all(estilos.map((e) => garantirFonte(e.fonte, e.peso, e.estilo)));
}
