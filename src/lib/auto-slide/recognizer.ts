import { paraWav, TAXA } from "@/lib/auto-slide/audio";

/**
 * Reconhecimento de canto.
 *
 * Contrato estreito de propósito: recebe uma janela de PCM, devolve texto.
 * O motor de decisão e o casador de letra não sabem quem transcreveu, então
 * trocar o mecanismo — whisper.cpp, Vosk, outro — não mexe em mais nada.
 *
 * Tudo local: o áudio vai do renderer para o processo principal por IPC e
 * morre lá, num buffer temporário. Nada sai da máquina, nada vira arquivo
 * permanente.
 */
export interface Reconhecedor {
  /** Nome do mecanismo, para a tela de configuração dizer o que está em uso. */
  nome: string;
  transcrever: (amostras: Float32Array) => Promise<string>;
  encerrar: () => void;
}

export type Disponibilidade =
  | { ok: true; nome: string }
  | { ok: false; motivo: string; comoResolver: string };

interface PonteLocal {
  autoSlideStatus?: () => Promise<{ pronto: boolean; nome?: string; motivo?: string }>;
  autoSlideTranscrever?: (wav: Uint8Array) => Promise<{ ok: boolean; texto?: string; erro?: string }>;
}

function ponte(): PonteLocal | undefined {
  const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  return d?.isDesktop ? (d as unknown as PonteLocal) : undefined;
}

/**
 * O reconhecimento local está pronto?
 *
 * Fora do app Windows, não: navegador não tem como rodar um modelo local sem
 * baixar centenas de megabytes por conta própria. Dentro do app, depende do
 * modelo estar instalado — e enquanto não estiver, o Auto-Slide continua
 * inteiro no modo de teste, que é onde a lógica de casamento se ajusta.
 */
export async function disponibilidade(): Promise<Disponibilidade> {
  const p = ponte();
  if (!p?.autoSlideStatus) {
    return {
      ok: false,
      motivo: "O reconhecimento local só roda no aplicativo do Windows.",
      comoResolver: "Abra o Lúmen instalado. No navegador, use o modo de teste.",
    };
  }
  try {
    const s = await p.autoSlideStatus();
    if (s.pronto) return { ok: true, nome: s.nome ?? "modelo local" };
    return {
      ok: false,
      motivo: s.motivo ?? "O modelo de reconhecimento ainda não está instalado.",
      comoResolver: "Instale o modelo em Tela → Reconhecimento de canto.",
    };
  } catch {
    return {
      ok: false,
      motivo: "Não foi possível falar com o reconhecimento local.",
      comoResolver: "Feche e abra o Lúmen. Se persistir, use o modo de teste.",
    };
  }
}

/**
 * Reconhecedor local.
 *
 * Uma janela por vez: transcrever duas ao mesmo tempo dobraria a CPU para
 * entregar a segunda resposta atrasada de qualquer jeito. Janela que chega
 * enquanto a anterior roda é descartada — em tempo real, áudio velho não
 * ajuda, atrapalha.
 */
export function criarReconhecedorLocal(): Reconhecedor {
  const p = ponte();
  let ocupado = false;
  let encerrado = false;
  return {
    nome: "modelo local",
    transcrever: async (amostras) => {
      if (encerrado || ocupado || !p?.autoSlideTranscrever) return "";
      ocupado = true;
      try {
        const r = await p.autoSlideTranscrever(paraWav(amostras, TAXA));
        return r.ok ? (r.texto ?? "") : "";
      } catch {
        return "";
      } finally {
        ocupado = false;
      }
    },
    encerrar: () => {
      encerrado = true;
    },
  };
}
