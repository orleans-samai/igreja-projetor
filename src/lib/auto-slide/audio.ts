/**
 * Captura de áudio para o Auto-Slide.
 *
 * Só o que entra: enumerar as entradas do sistema, abrir uma delas, medir o
 * nível e entregar janelas curtas de PCM. Não reconhece nada e não sabe o que
 * é um slide — quem transcreve e quem decide são outros módulos, e essa
 * separação é o que deixa testar cada um sozinho.
 *
 * O Chromium enxerga tudo que o Windows expõe como entrada: microfone,
 * entrada de linha, mesa USB e interface de áudio aparecem na mesma lista, e
 * é por isso que a escolha de fonte não precisa de nada nativo.
 */

export interface FonteDeAudio {
  id: string;
  nome: string;
}

/** Taxa que os modelos de reconhecimento esperam. */
export const TAXA = 16_000;

/**
 * Lista as entradas.
 *
 * Antes da primeira permissão o navegador devolve a lista com os nomes em
 * branco, por privacidade — daí pedir o acesso primeiro e só então enumerar.
 */
export async function listarFontes(): Promise<FonteDeAudio[]> {
  const midia = navigator.mediaDevices;
  if (!midia?.enumerateDevices) return [];
  let permissao: MediaStream | null = null;
  try {
    permissao = await midia.getUserMedia({ audio: true });
  } catch {
    /* segue mesmo sem permissão: a lista vem sem nome, mas vem */
  }
  try {
    const todos = await midia.enumerateDevices();
    return todos
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ id: d.deviceId, nome: d.label || `Entrada ${i + 1}` }));
  } finally {
    permissao?.getTracks().forEach((t) => t.stop());
  }
}

export interface JanelaDeAudio {
  /** PCM mono em 16 kHz, de -1 a 1. */
  amostras: Float32Array;
  /** Pico do trecho, de 0 a 1 — é o que alimenta o medidor de nível. */
  nivel: number;
}

export interface CapturaOpcoes {
  deviceId?: string;
  /** Tamanho da janela entregue ao reconhecimento. */
  janelaMs?: number;
  /** Quanto da janela anterior entra na próxima, para não cortar a frase no
   *  meio e perder justamente a palavra que identificaria o slide. */
  sobreposicaoMs?: number;
  onJanela: (janela: JanelaDeAudio) => void;
  onNivel?: (nivel: number) => void;
  onErro?: (erro: string) => void;
}

/**
 * Uma captura viva.
 *
 * `parar()` precisa devolver o dispositivo ao sistema: uma mesa de som presa
 * por um app que ninguém está mais usando é um problema de culto, não de
 * software.
 */
export interface Captura {
  parar: () => void;
}

export async function capturar(op: CapturaOpcoes): Promise<Captura> {
  const janelaMs = op.janelaMs ?? 2400;
  const sobreposicaoMs = Math.min(op.sobreposicaoMs ?? 800, janelaMs - 200);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: op.deviceId ? { exact: op.deviceId } : undefined,
      // O canto não é conversa: cancelamento de eco e supressão de ruído
      // comem sustentação e reverberação, que é onde a letra mora.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  });

  const ctx = new AudioContext({ sampleRate: TAXA });
  const fonte = ctx.createMediaStreamSource(stream);
  const analisador = ctx.createAnalyser();
  analisador.fftSize = 1024;
  fonte.connect(analisador);

  const porJanela = Math.round((janelaMs / 1000) * ctx.sampleRate);
  const porPasso = Math.round(((janelaMs - sobreposicaoMs) / 1000) * ctx.sampleRate);
  let buffer = new Float32Array(0);
  let vivo = true;

  // ScriptProcessor está obsoleto, mas é o único caminho que não exige
  // servir um arquivo de worklet — e o app roda de dentro de um protocolo
  // próprio no Electron, onde carregar módulo por URL é justamente o que
  // costuma quebrar. O trabalho por bloco aqui é copiar um array.
  const no = ctx.createScriptProcessor(4096, 1, 1);
  const mudo = ctx.createGain();
  mudo.gain.value = 0;
  fonte.connect(no);
  no.connect(mudo);
  mudo.connect(ctx.destination);

  no.onaudioprocess = (ev) => {
    if (!vivo) return;
    const bloco = ev.inputBuffer.getChannelData(0);
    let pico = 0;
    for (const v of bloco) {
      const a = Math.abs(v);
      if (a > pico) pico = a;
    }
    op.onNivel?.(pico);

    const junto = new Float32Array(buffer.length + bloco.length);
    junto.set(buffer);
    junto.set(bloco, buffer.length);
    buffer = junto;

    while (buffer.length >= porJanela) {
      const amostras = buffer.slice(0, porJanela);
      let picoJanela = 0;
      for (const v of amostras) {
        const a = Math.abs(v);
        if (a > picoJanela) picoJanela = a;
      }
      op.onJanela({ amostras, nivel: picoJanela });
      buffer = buffer.slice(porPasso);
    }
  };

  stream.getAudioTracks().forEach((t) => {
    t.onended = () => op.onErro?.("A entrada de áudio foi desconectada.");
  });

  return {
    parar: () => {
      vivo = false;
      no.onaudioprocess = null;
      try {
        no.disconnect();
        mudo.disconnect();
        fonte.disconnect();
        analisador.disconnect();
      } catch {
        /* já desconectado */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    },
  };
}

/** PCM em WAV de 16 bits — o formato que todo reconhecedor local aceita. */
export function paraWav(amostras: Float32Array, taxa = TAXA): Uint8Array {
  const bytes = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(bytes);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + amostras.length * 2, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(bytes);
}
