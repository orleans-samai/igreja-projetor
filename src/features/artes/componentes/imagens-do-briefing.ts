import type { ImagemDoUsuario, LogoDoBriefing } from "../briefing.ts";
import { hash } from "../briefing.ts";

/**
 * Fotos e logo entrando no briefing.
 *
 * A imagem é reduzida (lado maior de até 2400 px — cobre um story de 1920
 * com folga), medida (mapa de luz 8×8, transparência) e guardada num lugar
 * que sobrevive ao app fechar: a pasta das artes no desktop, ou o próprio
 * endereço data: no navegador. Endereço de sessão (blob:) nunca entra numa
 * arte salva — reabrir amanhã mostraria um buraco.
 */

const LADO_MAX = 2400;

function linear(v: number): number {
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminância média numa grade 8×8, ponderada pela opacidade de cada pixel. */
export function mapaDeLuzDe(fonte: CanvasImageSource): { mapa: number[]; transparente: boolean; media: number } {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(fonte, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  const mapa: number[] = [];
  let transparente = false;
  let soma = 0;
  let pesoTotal = 0;
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      let s = 0;
      let p = 0;
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx < 4; xx++) {
          const i = ((gy * 4 + yy) * 32 + gx * 4 + xx) * 4;
          const a = d[i + 3] / 255;
          if (a < 0.98) transparente = true;
          const l = 0.2126 * linear(d[i] / 255) + 0.7152 * linear(d[i + 1] / 255) + 0.0722 * linear(d[i + 2] / 255);
          s += l * a;
          p += a;
        }
      }
      mapa.push(p > 0 ? Math.round((s / p) * 1000) / 1000 : 0.5);
      soma += s;
      pesoTotal += p;
    }
  }
  return { mapa, transparente, media: pesoTotal > 0 ? soma / pesoTotal : 0.5 };
}

async function paraBlob(c: HTMLCanvasElement, png: boolean): Promise<Blob> {
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, png ? "image/png" : "image/jpeg", 0.9));
  if (!b) throw new Error("Não consegui preparar a imagem.");
  return b;
}

/** Guarda os bytes e devolve um endereço permanente. */
async function guardar(blob: Blob): Promise<string> {
  const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (d?.isDesktop && d.artesImagemSalvar) {
    const r = await d.artesImagemSalvar(new Uint8Array(await blob.arrayBuffer()));
    if (!r.ok) throw new Error(r.error);
    return r.url;
  }
  return await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não consegui ler a imagem."));
    leitor.readAsDataURL(blob);
  });
}

async function carregar(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não consegui abrir a imagem."));
    img.src = src;
  });
}

export async function importarImagem(arquivo: File, tipo: "foto" | "ilustracao"): Promise<ImagemDoUsuario> {
  if (!/^image\/(png|jpeg|webp|gif)$/i.test(arquivo.type)) throw new Error("Use uma imagem JPEG, PNG ou WebP.");
  if (arquivo.size > 40 * 1024 * 1024) throw new Error("A imagem passa de 40 MB.");
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * escala);
  c.height = Math.round(bitmap.height * escala);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const luz = mapaDeLuzDe(c);
  const png = luz.transparente;
  const src = await guardar(await paraBlob(c, png));
  return {
    src,
    nome: arquivo.name.replace(/\.[^.]+$/, "") || "Imagem",
    largura: c.width,
    altura: c.height,
    tipo,
    pontoFocal: { x: 0.5, y: 0.5 },
    mapaDeLuz: luz.mapa,
    transparente: luz.transparente,
  };
}

const logosGuardadas = new Map<number, Promise<LogoDoBriefing | null>>();

/**
 * A logo das Configurações, pronta para as artes.
 *
 * Ela já vem reduzida (640 px) como data:. Aqui vira arquivo na pasta das
 * artes uma vez só por sessão — senão cada arte salva carregaria a logo
 * inteira dentro dela. SVG é desenhado num PNG antes: a pasta das artes só
 * aceita imagem de pixels.
 */
export function logoDaIgreja(url: string): Promise<LogoDoBriefing | null> {
  if (!url) return Promise.resolve(null);
  const chave = hash(url);
  let p = logosGuardadas.get(chave);
  if (!p) {
    p = (async () => {
      const img = await carregar(url);
      const w = img.naturalWidth || 640;
      const h = img.naturalHeight || 640;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const luz = mapaDeLuzDe(c);
      const src = await guardar(await paraBlob(c, true));
      return { src, largura: w, altura: h, luz: Math.round(luz.media * 1000) / 1000, transparente: luz.transparente };
    })().catch(() => null);
    logosGuardadas.set(chave, p);
  }
  return p;
}
