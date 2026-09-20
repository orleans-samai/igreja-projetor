/**
 * Transformar a composição num arquivo de vídeo.
 *
 * É o ponto da área inteira. Efeito em tempo real custa CPU a cada quadro,
 * no mesmo computador que está projetando o culto; um .webm pronto custa o
 * que qualquer vídeo custa, e o Chromium decodifica em hardware. Renderizar
 * uma vez, na terça, é trocar risco de domingo por paciência de terça.
 *
 * A captura é em tempo real, e isso é escolha, não limitação aceita de
 * mau grado: o MediaRecorder carimba cada quadro pelo relógio de parede.
 * Renderizar mais rápido que o tempo real daria um arquivo com a duração
 * errada — quinze segundos de composição virando quatro de vídeo.
 */
import { MotorVfx } from "./motor.ts";
import type { VfxComposicao, VfxQualidade } from "./tipos.ts";

/** O mesmo teto que a cabine aceita guardar na pasta de mídia. */
export const MAX_BYTES = 64 * 1024 * 1024;
/** Além disto a renderização vira uma espera que ninguém tem no ensaio. */
export const MAX_SEGUNDOS = 120;
export const MIN_SEGUNDOS = 3;

export const RESOLUCOES = [
  { id: "720", rotulo: "1280 × 720 (HD)", largura: 1280, altura: 720 },
  { id: "1080", rotulo: "1920 × 1080 (Full HD)", largura: 1920, altura: 1080 },
  { id: "854", rotulo: "854 × 480 (leve)", largura: 854, altura: 480 },
] as const;

/**
 * Taxa de bits por qualidade.
 *
 * Escolhidas para 120 segundos — o máximo — caberem nos 64 MB que a pasta
 * de mídia aceita. Não é chute: 4 Mbps × 120 s ≈ 60 MB.
 */
export const BITRATE: Record<VfxQualidade, number> = {
  leve: 1_200_000,
  equilibrado: 2_500_000,
  alta: 4_000_000,
};

export const FPS: Record<VfxQualidade, number> = {
  leve: 24,
  equilibrado: 30,
  alta: 30,
};

/** Quanto o arquivo deve pesar, para avisar antes de gastar dois minutos. */
export function tamanhoEstimado(segundos: number, qualidade: VfxQualidade): number {
  return Math.round((BITRATE[qualidade] / 8) * Math.max(0, segundos));
}

export function cabeNaPasta(segundos: number, qualidade: VfxQualidade): boolean {
  return tamanhoEstimado(segundos, qualidade) <= MAX_BYTES;
}

/** O nome do arquivo, a partir do que o operador escreveu. */
export function nomeDoArquivo(nome: string): string {
  const limpo = String(nome || "").trim().replace(/[<>:"/\\|?*]/g, "-").slice(0, 80);
  const base = limpo || "Vídeo dinâmico";
  return base.toLowerCase().endsWith(".webm") ? base : `${base}.webm`;
}

/**
 * O formato que este Chromium grava.
 *
 * VP9 quando dá, VP8 quando não. Os dois tocam no telão do Lúmen, que é o
 * mesmo Chromium — o arquivo não precisa agradar a nenhum outro tocador.
 */
export function formatoDisponivel(): string | null {
  const candidatos = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return candidatos.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export interface PedidoDeRender {
  comp: VfxComposicao;
  largura: number;
  altura: number;
  segundos: number;
  qualidade: VfxQualidade;
}

export interface AndamentoDoRender {
  /** 0 a 100. */
  pct: number;
  /** Segundos já gravados. */
  feitos: number;
  /** Segundos que faltam, pelo relógio — a captura é em tempo real. */
  faltam: number;
}

export class RenderCancelado extends Error {
  constructor() {
    super("Renderização cancelada.");
    this.name = "RenderCancelado";
  }
}

/**
 * Renderiza e devolve os bytes do vídeo.
 *
 * Nunca resolve com um arquivo vazio: gravador que não entregou nada é
 * erro, não é um vídeo de zero byte indo para a pasta da igreja.
 */
export async function renderizarVideo(
  pedido: PedidoDeRender,
  aoAndar: (a: AndamentoDoRender) => void,
  sinal?: AbortSignal,
): Promise<Blob> {
  const formato = formatoDisponivel();
  if (!formato) throw new Error("Este computador não sabe gravar vídeo pelo navegador.");

  const segundos = Math.min(MAX_SEGUNDOS, Math.max(MIN_SEGUNDOS, pedido.segundos));
  const fps = FPS[pedido.qualidade];
  const tela = document.createElement("canvas");
  tela.width = pedido.largura;
  tela.height = pedido.altura;
  const ctx = tela.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Não consegui abrir a tela de desenho.");

  const motor = new MotorVfx();
  const fluxo = tela.captureStream(fps);
  const gravador = new MediaRecorder(fluxo, {
    mimeType: formato,
    videoBitsPerSecond: BITRATE[pedido.qualidade],
  });
  const pedacos: BlobPart[] = [];
  gravador.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) pedacos.push(ev.data);
  };

  let quadro = 0;
  let cancelado = false;

  const parar = () => {
    if (quadro) cancelAnimationFrame(quadro);
    quadro = 0;
    for (const trilha of fluxo.getTracks()) trilha.stop();
    motor.descartar();
  };

  return new Promise<Blob>((resolve, reject) => {
    const cancelar = () => {
      cancelado = true;
      parar();
      if (gravador.state !== "inactive") gravador.stop();
      else reject(new RenderCancelado());
    };
    sinal?.addEventListener("abort", cancelar, { once: true });

    gravador.onerror = () => {
      parar();
      reject(new Error("O gravador parou no meio da renderização."));
    };
    gravador.onstop = () => {
      sinal?.removeEventListener("abort", cancelar);
      parar();
      if (cancelado) {
        reject(new RenderCancelado());
        return;
      }
      const blob = new Blob(pedacos, { type: formato });
      if (blob.size === 0) {
        reject(new Error("A renderização não produziu vídeo nenhum."));
        return;
      }
      resolve(blob);
    };

    const inicio = performance.now();
    const passo = () => {
      if (cancelado) return;
      const t = (performance.now() - inicio) / 1000;
      const feitos = Math.min(segundos, t);
      motor.desenhar(ctx, pedido.comp, feitos, pedido.largura, pedido.altura);
      aoAndar({
        pct: Math.min(100, Math.round((feitos / segundos) * 100)),
        feitos,
        faltam: Math.max(0, segundos - feitos),
      });
      if (t >= segundos) {
        // Um último pedaço antes de parar, senão o fim do vídeo some.
        gravador.requestData();
        gravador.stop();
        return;
      }
      quadro = requestAnimationFrame(passo);
    };

    gravador.start(1000);
    quadro = requestAnimationFrame(passo);
  });
}
