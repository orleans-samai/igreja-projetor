import { useEffect, useRef, useState } from "react";
import { publishOps } from "@/lib/ops-channel";
import { mensagemDeErro } from "@/lib/youtube";
import type { YoutubeFrame } from "@/lib/types";

/**
 * O player do YouTube, na janela de projeção.
 *
 * Só existe aqui. A cabine descreve o estado desejado no quadro e este
 * componente aplica — se a cabine também tivesse um player, o áudio sairia
 * duas vezes na caixa da igreja, que é exatamente o problema que o player de
 * áudio local já resolveu do mesmo jeito.
 *
 * Tudo pela IFrame Player API oficial: nada é baixado, nada é extraído, e as
 * restrições de incorporação do dono do vídeo são respeitadas — quando ele
 * não deixa, a tela diz isso ao operador em vez de tentar contornar.
 */

interface Player {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (s: number, exato: boolean) => void;
  setVolume: (v: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YT {
  Player: new (
    el: HTMLElement,
    opcoes: Record<string, unknown>,
  ) => Player;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
}

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** A API entra uma vez por janela; todo player depois disso reaproveita. */
let carregando: Promise<YT> | null = null;
function carregarApi(): Promise<YT> {
  if (typeof window === "undefined") return Promise.reject(new Error("sem janela"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (carregando) return carregando;
  carregando = new Promise<YT>((resolve, reject) => {
    const anterior = window.onYouTubeIframeAPIReady;
    const limite = window.setTimeout(
      () => reject(new Error("A API do YouTube não respondeu.")),
      15000,
    );
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(limite);
      anterior?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("A API do YouTube carregou incompleta."));
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      window.clearTimeout(limite);
      carregando = null;
      reject(new Error("Sem internet para carregar o player do YouTube."));
    };
    document.head.appendChild(tag);
  });
  return carregando;
}

export function YoutubeStage({ frame }: { frame: YoutubeFrame }) {
  const caixa = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const buscaFeita = useRef(frame.busca);
  const videoNoPlayer = useRef<string>("");
  // O relógio publica a cada meio segundo e não sabe o que o player está
  // fazendo; quem sabe é o onStateChange. Sem guardar o estado aqui, a cabine
  // receberia "tocando" para sempre e o botão de Tocar nunca voltaria ao
  // normal depois de uma pausa.
  const estadoAtual = useRef<"tocando" | "pausado" | "parado" | "carregando" | "fim">("parado");

  // Um player por janela, criado uma vez. Trocar de vídeo é carregar outro id
  // dentro do mesmo player, não montar tudo de novo.
  useEffect(() => {
    let vivo = true;
    let relogio = 0;
    carregarApi()
      .then((yt) => {
        if (!vivo || !caixa.current) return;
        player.current = new yt.Player(caixa.current, {
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (!vivo) return;
              setPronto(true);
              relogio = window.setInterval(() => {
                const p = player.current;
                if (!p) return;
                try {
                  publishOps({
                    type: "youtube-tempo",
                    tempo: p.getCurrentTime() || 0,
                    duracao: p.getDuration() || 0,
                    estado: estadoAtual.current,
                  });
                } catch {
                  /* player entre estados */
                }
              }, 500);
            },
            onError: (e: { data: number }) => {
              if (!vivo) return;
              const msg = mensagemDeErro(e.data);
              setErro(msg);
              publishOps({ type: "youtube-tempo", tempo: 0, duracao: 0, estado: "parado", erro: msg });
            },
            onStateChange: (e: { data: number }) => {
              if (!vivo || !window.YT) return;
              const s = window.YT.PlayerState;
              const estado =
                e.data === s.PLAYING
                  ? "tocando"
                  : e.data === s.PAUSED
                    ? "pausado"
                    : e.data === s.ENDED
                      ? "fim"
                      : e.data === s.BUFFERING
                        ? "carregando"
                        : "parado";
              estadoAtual.current = estado;
              const p = player.current;
              publishOps({
                type: "youtube-tempo",
                tempo: p?.getCurrentTime() ?? 0,
                duracao: p?.getDuration() ?? 0,
                estado,
              });
            },
          },
        });
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      });

    return () => {
      vivo = false;
      window.clearInterval(relogio);
      try {
        player.current?.destroy();
      } catch {
        /* já destruído */
      }
      player.current = null;
    };
  }, []);

  // Vídeo pedido pela cabine.
  useEffect(() => {
    const p = player.current;
    if (!pronto || !p || videoNoPlayer.current === frame.videoId) return;
    videoNoPlayer.current = frame.videoId;
    setErro(null);
    try {
      // Entra preparado, não tocando: quem decide a hora é a cabine.
      p.cueVideoById(frame.videoId);
    } catch {
      setErro("Não foi possível carregar este vídeo.");
    }
  }, [pronto, frame.videoId]);

  // Tocar, pausar, parar.
  useEffect(() => {
    const p = player.current;
    if (!pronto || !p || erro) return;
    try {
      if (frame.acao === "tocar") p.playVideo();
      else if (frame.acao === "pausar") p.pauseVideo();
      else {
        p.stopVideo();
        p.seekTo(0, true);
      }
    } catch {
      /* comando chegou entre estados do player */
    }
  }, [pronto, erro, frame.acao, frame.videoId]);

  // Ir para um ponto: só quando o contador de pedidos muda.
  useEffect(() => {
    const p = player.current;
    if (!pronto || !p || frame.busca === buscaFeita.current) return;
    buscaFeita.current = frame.busca;
    try {
      p.seekTo(frame.tempo, true);
    } catch {
      /* player ainda carregando */
    }
  }, [pronto, frame.busca, frame.tempo]);

  // Volume e mudo.
  useEffect(() => {
    const p = player.current;
    if (!pronto || !p) return;
    try {
      p.setVolume(Math.max(0, Math.min(100, frame.volume)));
      if (frame.mudo) p.mute();
      else p.unMute();
    } catch {
      /* player ainda carregando */
    }
  }, [pronto, frame.volume, frame.mudo]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
      {/* Proporção mantida, preto em volta: a caixa acompanha a menor sobra. */}
      <div className="relative aspect-video max-h-full max-w-full" style={{ width: "100%" }}>
        <div ref={caixa} className="absolute inset-0 size-full" />
      </div>

      {erro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-12 text-center">
          <p className="text-[2.2rem] font-semibold text-white">{erro}</p>
          <p className="text-[1.4rem] text-white/60">
            O telão continua aqui. O operador pode escolher outro vídeo ou voltar ao culto.
          </p>
        </div>
      )}
    </div>
  );
}
