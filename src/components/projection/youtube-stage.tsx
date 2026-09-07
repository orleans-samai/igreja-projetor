import { useEffect, useRef, useState } from "react";
import { publishOps } from "@/lib/ops-channel";
import { mensagemDeErro } from "@/lib/youtube";
import type { YoutubeFrame } from "@/lib/types";

/**
 * O YouTube na janela de projeção.
 *
 * O player não é criado aqui: ele mora numa página servida por http://127.0.0.1
 * e esta janela conversa com ela por postMessage. O motivo é concreto — o app
 * instalado roda de lumen://app, e de um esquema próprio o YouTube recusa a
 * reprodução com o erro 153, porque não há referrer http para mandar aos
 * servidores dele. Servido por http, o mesmo vídeo toca.
 *
 * Isso custa uma página e uma porta no laço local, e evita mexer na origem do
 * app inteiro — que é onde moram a autorização de IPC e as travas de
 * navegação. O player continua existindo só aqui: a cabine manda, o telão
 * reproduz, e o som sai uma vez só.
 */

interface Mensagem {
  lumen?: string;
  estado?: "tocando" | "pausado" | "parado" | "carregando" | "fim";
  tempo?: number;
  duracao?: number;
  codigo?: number;
}

/** Endereço da página do player: servidor local no app, mesma origem na web. */
async function enderecoDoPlayer(): Promise<string> {
  const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  const ponte = d as unknown as { youtubeHost?: () => Promise<string> } | undefined;
  if (d?.isDesktop && ponte?.youtubeHost) return ponte.youtubeHost();
  return "/youtube-player.html";
}

export function YoutubeStage({ frame }: { frame: YoutubeFrame }) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vivo, setVivo] = useState(false);
  const buscaFeita = useRef(frame.busca);

  useEffect(() => {
    let ativo = true;
    enderecoDoPlayer()
      .then((url) => ativo && setEndereco(url))
      .catch(() => ativo && setErro("Não foi possível preparar o player do YouTube."));
    return () => {
      ativo = false;
    };
  }, []);

  // O que a página do player conta de volta vira o que a cabine mostra.
  //
  // A conferência é pela origem, não por comparar objetos de janela: entre
  // origens diferentes essa comparação é frágil, e a origem é justamente a
  // garantia que interessa — só a página que servimos em 127.0.0.1 fala aqui.
  const origemDoPlayer = endereco ? new URL(endereco, window.location.href).origin : null;
  useEffect(() => {
    if (!origemDoPlayer) return;
    const onMsg = (ev: MessageEvent<Mensagem>) => {
      if (ev.origin !== origemDoPlayer) return;
      const d = ev.data;
      if (!d || typeof d.lumen !== "string") return;
      if (d.lumen === "yt-vivo" || d.lumen === "yt-pronto") {
        setVivo(true);
        return;
      }
      if (d.lumen === "yt-erro") {
        const msg =
          d.codigo === -1
            ? "Sem internet para carregar o player do YouTube."
            : mensagemDeErro(d.codigo ?? 0);
        setErro(msg);
        publishOps({ type: "youtube-tempo", tempo: 0, duracao: 0, estado: "parado", erro: msg });
        return;
      }
      if (d.lumen === "yt-estado") {
        setErro(null);
        publishOps({
          type: "youtube-tempo",
          tempo: d.tempo ?? 0,
          duracao: d.duracao ?? 0,
          estado: d.estado ?? "parado",
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [origemDoPlayer]);

  // Estado desejado → página do player. A busca só viaja quando o contador
  // muda, senão todo ajuste de volume rebobinaria o vídeo.
  useEffect(() => {
    const janela = quadro.current?.contentWindow;
    if (!vivo || !janela) return;
    const buscar = frame.busca !== buscaFeita.current ? frame.tempo : undefined;
    buscaFeita.current = frame.busca;
    janela.postMessage(
      {
        lumen: "yt",
        videoId: frame.videoId,
        acao: frame.acao,
        volume: frame.volume,
        mudo: frame.mudo,
        ...(buscar === undefined ? {} : { buscar }),
      },
      "*",
    );
  }, [vivo, frame.videoId, frame.acao, frame.volume, frame.mudo, frame.busca, frame.tempo]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
      <div className="relative aspect-video max-h-full w-full max-w-full">
        {endereco && (
          <iframe
            ref={quadro}
            src={endereco}
            title="Vídeo do YouTube"
            allow="autoplay; encrypted-media; fullscreen"
            // Carregou é sinal suficiente de que a página está lá: não depender
            // só do aperto de mão evita o vídeo ficar parado se a primeira
            // mensagem se perder.
            onLoad={() => setVivo(true)}
            className="absolute inset-0 size-full border-0"
          />
        )}
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
