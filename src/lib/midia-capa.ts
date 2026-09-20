/**
 * A capa e a duração de um arquivo da pasta, para o celular poder mostrar.
 *
 * Quem gera é a cabine, não o aparelho: o celular não alcança o disco do PC,
 * e mandar o vídeo inteiro pela Wi-Fi da igreja só para desenhar um
 * quadradinho de 104 pixels seria absurdo.
 *
 * Três cuidados, todos por causa do domingo:
 *
 * - Teto de arquivos. Uma pasta com trezentos vídeos decodificaria trezentos
 *   vídeos, e o PC está projetando um culto enquanto isso.
 * - Lembrança por sessão. O mesmo arquivo não é decodificado duas vezes.
 * - Capa pequena e feia de propósito: 160px de largura em JPEG a 0.6 dá uns
 *   4 KB, e é tudo que cabe num quadradinho. O que viaja a cada atualização
 *   da lista é isso vezes o número de arquivos.
 */

/** Acima disto, a lista vai sem capa — e some sem travar nada. */
export const TETO_DE_CAPAS = 40;
const LARGURA_DA_CAPA = 160;
/** Um vídeo costuma abrir no escuro; um segundo adiante já tem imagem. */
const SEGUNDO_DO_QUADRO = 1;
/** Arquivo que não abre em cinco segundos não vale segurar a lista. */
const PACIENCIA_MS = 5000;

export interface Capa {
  /** JPEG pequeno como endereço `data:`, ou vazio quando não deu. */
  capa: string;
  /** Duração em segundos, ou 0 quando não se aplica. */
  segundos: number;
}

const VAZIA: Capa = { capa: "", segundos: 0 };

/** O que já foi decodificado nesta sessão, por endereço do arquivo. */
const lembradas = new Map<string, Capa>();

function comPaciencia<T>(promessa: Promise<T>, senao: T): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((r) => setTimeout(() => r(senao), PACIENCIA_MS)),
  ]);
}

function desenhar(fonte: CanvasImageSource, largura: number, altura: number): string {
  if (!largura || !altura) return "";
  const escala = Math.min(1, LARGURA_DA_CAPA / largura);
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(largura * escala));
  tela.height = Math.max(1, Math.round(altura * escala));
  const pincel = tela.getContext("2d");
  if (!pincel) return "";
  pincel.drawImage(fonte, 0, 0, tela.width, tela.height);
  // JPEG, não PNG: a capa é foto, e PNG aqui pesaria cinco vezes mais por
  // arquivo — vezes quarenta arquivos, a cada atualização da lista.
  return tela.toDataURL("image/jpeg", 0.6);
}

function daImagem(url: string): Promise<Capa> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ capa: desenhar(img, img.naturalWidth, img.naturalHeight), segundos: 0 });
    img.onerror = () => resolve(VAZIA);
    img.src = url;
  });
}

function doVideo(url: string): Promise<Capa> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    v.crossOrigin = "anonymous";
    const desistir = () => resolve(VAZIA);
    v.onerror = desistir;
    v.onloadedmetadata = () => {
      const segundos = Number.isFinite(v.duration) ? Math.round(v.duration) : 0;
      // Vídeo curto não tem um segundo adiante; nesse caso pega o começo.
      v.currentTime = Math.min(SEGUNDO_DO_QUADRO, Math.max(0, (v.duration || 0) / 2));
      v.onseeked = () => {
        resolve({ capa: desenhar(v, v.videoWidth, v.videoHeight), segundos });
        v.src = "";
      };
      // Se o quadro não vier, a duração sozinha já vale a viagem.
      setTimeout(() => resolve({ capa: "", segundos }), PACIENCIA_MS - 500);
    };
    v.src = url;
  });
}

function doAudio(url: string): Promise<Capa> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onerror = () => resolve(VAZIA);
    a.onloadedmetadata = () =>
      resolve({ capa: "", segundos: Number.isFinite(a.duration) ? Math.round(a.duration) : 0 });
    a.src = url;
  });
}

/**
 * A capa de um arquivo, uma vez por sessão.
 *
 * Nunca rejeita: arquivo corrompido, codec que o Chromium não abre, disco
 * desconectado — tudo vira capa vazia, e a lista aparece do mesmo jeito.
 */
export async function capaDe(
  url: string,
  tipo: "video" | "audio" | "image",
): Promise<Capa> {
  const lembrada = lembradas.get(url);
  if (lembrada) return lembrada;
  let r = VAZIA;
  try {
    const feita =
      tipo === "image" ? daImagem(url) : tipo === "video" ? doVideo(url) : doAudio(url);
    r = await comPaciencia(feita, VAZIA);
  } catch {
    r = VAZIA;
  }
  lembradas.set(url, r);
  return r;
}

/** Esquece o que foi decodificado — usado quando a pasta muda de lugar. */
export function esquecerCapas(): void {
  lembradas.clear();
}
