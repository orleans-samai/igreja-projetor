import { Image as ImageIcon, Music, Pause, Play, Repeat, RotateCcw, RotateCw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import {
  carregadoAte,
  duracaoUtil,
  porcento,
  proximaVelocidade,
  relogio,
  restante,
  rotuloVelocidade,
  tempoDoPonto,
} from "@/lib/media-player";
import { assinarLocal } from "@/lib/media-local";
import { subscribeOps } from "@/lib/ops-channel";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O player de mídia da cabine.
 *
 * Um componente, duas origens. O vídeo toca no telão — a cabine manda o
 * comando e recebe de volta onde ele está; o áudio toca aqui mesmo, porque
 * se a cabine e o telão tocassem o mesmo arquivo a igreja ouviria tudo duas
 * vezes. Por fora os dois se parecem, que é o ponto: quem opera não deveria
 * precisar saber de qual lado do aplicativo o som está saindo.
 *
 * A barra mostra três camadas — trilho, o quanto já carregou e o quanto já
 * passou — porque "está travado" e "ainda está carregando" são problemas
 * diferentes, e no meio do culto não dá para adivinhar qual é.
 */

const VOLTAR = 15;
const AVANCAR = 30;

interface Estado {
  tempo: number;
  duracao: number;
  carregado: number;
  terminou: boolean;
}

const VAZIO: Estado = { tempo: 0, duracao: 0, carregado: 0, terminou: false };

export function MediaPlayer() {
  const live = useLumenStore((s) => s.live);
  const preview = useLumenStore((s) => s.preview);
  const status = useLumenStore((s) => s.status);
  const comandar = useLumenStore((s) => s.comandarMedia);
  const buscar = useLumenStore((s) => s.buscarMedia);

  // Vídeo é comandado quando está no ar, que é onde ele toca. Áudio aparece
  // já na seleção: o player é aqui, e ouvir antes de mandar é metade do uso.
  const noAr = status !== "idle" && live?.kind === "media" ? live : null;
  const deck = noAr?.mediaType === "video" ? noAr : preview?.kind === "media" ? preview : null;
  const ehVideo = deck?.mediaType === "video" && deck === noAr;
  const ehAudio = deck?.mediaType === "audio";

  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [arrastando, setArrastando] = useState<number | null>(null);
  /**
   * O arrasto também vive numa ref, e não só no estado.
   *
   * Num clique rápido o `pointerup` chega antes de o React ter redesenhado
   * com o estado do `pointerdown` — e aí o soltar concluía que não havia
   * arrasto nenhum e não buscava nada. Clicar rápido na barra é o gesto mais
   * comum que existe; ele não pode depender do ritmo de renderização.
   */
  const arrastandoRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const trilho = useRef<HTMLDivElement>(null);

  const src = deck?.mediaSrc;
  useEffect(() => setEstado(VAZIO), [src]);

  /**
   * De onde vêm os números do vídeo.
   *
   * Do telão, quando ele está aberto: é o que a igreja está vendo, então é a
   * verdade. Com a janela de projeção fechada não há relato nenhum, e aí vale
   * o preview da cabine — outro `<video>` do mesmo arquivo, obedecendo aos
   * mesmos comandos. Sem essa segunda fonte a barra ficaria sem duração e
   * sem posição, um controle morto na tela.
   */
  const ultimoDoTelao = useRef(0);
  useEffect(() => {
    if (!ehVideo) return;
    const aplicar = (r: Estado) => setEstado(r);
    const paradoTelao = subscribeOps((msg) => {
      if (msg.type !== "media-tempo") return;
      ultimoDoTelao.current = Date.now();
      aplicar({
        tempo: msg.tempo,
        duracao: msg.duracao,
        carregado: msg.carregado,
        terminou: msg.estado === "fim",
      });
    });
    const paradoLocal = assinarLocal((r) => {
      // O telão mandou notícia há pouco? Então ele manda.
      if (Date.now() - ultimoDoTelao.current < 2000) return;
      aplicar({
        tempo: r.tempo,
        duracao: r.duracao,
        carregado: r.carregado,
        terminou: r.estado === "fim",
      });
    });
    return () => {
      paradoTelao();
      paradoLocal();
    };
  }, [ehVideo]);

  const velocidade = deck?.mediaVelocidade ?? 1;

  // Áudio: o player é este, então a velocidade se aplica direto.
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = velocidade > 0 ? velocidade : 1;
  }, [velocidade, src]);

  const lerAudio = useCallback((el: HTMLAudioElement) => {
    setEstado({
      tempo: el.currentTime,
      duracao: Number.isFinite(el.duration) ? el.duration : 0,
      carregado: carregadoAte(el.buffered, el.currentTime),
      terminou: el.ended,
    });
  }, []);

  if (!deck || !src || (!ehVideo && !ehAudio)) return null;

  /*
    O botão nunca pergunta ao telão se está tocando.

    Ele sabe o que a própria cabine mandou. Com a janela de projeção fechada
    o relato não chega, e um botão que depende do relato mente — diz "Tocar"
    com o vídeo já tocando, e o operador aperta de novo achando que falhou.
    O telão só acrescenta uma coisa: quando o vídeo acabou sozinho.
  */
  const tocandoAudio = Boolean(audioRef.current && !audioRef.current.paused);
  const tocando = ehVideo
    ? !estado.terminou && (deck.mediaAcao ?? "tocar") === "tocar"
    : tocandoAudio;

  const duracao = estado.duracao;
  const tempoMostrado = arrastando ?? estado.tempo;
  const temDuracao = duracaoUtil(duracao);

  const irPara = (segundos: number) => {
    const alvo = temDuracao ? Math.min(duracao, Math.max(0, segundos)) : Math.max(0, segundos);
    if (ehVideo) {
      buscar(alvo);
      setEstado((e) => ({ ...e, tempo: alvo, terminou: false }));
      return;
    }
    const el = audioRef.current;
    if (el) el.currentTime = alvo;
  };

  const alternar = () => {
    if (ehVideo) {
      // Terminado, tocar recomeça — senão o clique não faria nada visível.
      if (estado.terminou) buscar(0);
      comandar({ mediaAcao: tocando ? "pausar" : "tocar" });
      setEstado((e) => ({ ...e, terminou: false }));
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  const parar = () => {
    if (ehVideo) {
      comandar({ mediaAcao: "parar" });
      setEstado((e) => ({ ...e, tempo: 0, terminou: false }));
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  const doPonto = (clientX: number) => {
    const caixa = trilho.current?.getBoundingClientRect();
    if (!caixa) return 0;
    return tempoDoPonto(clientX, caixa, duracao);
  };

  const pctTocado = porcento(tempoMostrado, duracao);
  const pctCarregado = Math.max(pctTocado, porcento(estado.carregado, duracao));

  const teclado = (e: React.KeyboardEvent) => {
    const passo: Record<string, number> = {
      ArrowRight: 10,
      ArrowUp: 10,
      ArrowLeft: -10,
      ArrowDown: -10,
    };
    if (e.key in passo) {
      e.preventDefault();
      irPara(estado.tempo + passo[e.key]);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      irPara(0);
    } else if (e.key === "End" && temDuracao) {
      e.preventDefault();
      irPara(duracao);
    }
  };

  return (
    <div className="animate-swap-in border-t border-border bg-elevated px-3 py-2">
      {ehAudio && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={(e) => lerAudio(e.currentTarget)}
          onProgress={(e) => lerAudio(e.currentTarget)}
          onLoadedMetadata={(e) => lerAudio(e.currentTarget)}
          onPlay={(e) => lerAudio(e.currentTarget)}
          onPause={(e) => lerAudio(e.currentTarget)}
          onEnded={(e) => lerAudio(e.currentTarget)}
        />
      )}

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-md bg-raised text-subtle"
        >
          {ehVideo ? <ImageIcon className="size-4" /> : <Music className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption uppercase tracking-wide text-subtle">
            {ehVideo ? "Vídeo no telão" : "Áudio na cabine"}
          </p>
          <p className="truncate text-body font-medium text-fg">{deck.title}</p>
        </div>
        <Hint label="Velocidade de reprodução">
          <Button
            size="sm"
            variant="ghost"
            className="tnum shrink-0"
            aria-label={`Velocidade ${rotuloVelocidade(velocidade)}`}
            onClick={() => {
              const proxima = proximaVelocidade(velocidade);
              if (ehVideo) comandar({ mediaVelocidade: proxima });
              else if (audioRef.current) {
                audioRef.current.playbackRate = proxima;
                comandar({ mediaVelocidade: proxima });
              }
            }}
          >
            {rotuloVelocidade(velocidade)}
          </Button>
        </Hint>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="tnum shrink-0 text-caption text-muted">{relogio(tempoMostrado)}</span>

        {/* A área de toque é maior que o traço: acertar 4px no meio do culto
            não é razoável. */}
        <div
          className="group/barra relative flex-1 cursor-pointer py-2"
          onPointerDown={(e) => {
            if (!temDuracao) return;
            // Capturar o ponteiro é o que mantém o arrasto vivo quando o dedo
            // sai da barra; quando não dá, o arrasto ainda funciona dentro
            // dela, e falhar aqui não pode derrubar o clique.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ponteiro que já sumiu */
            }
            arrastandoRef.current = true;
            setArrastando(doPonto(e.clientX));
          }}
          onPointerMove={(e) => {
            // Enquanto arrasta, a posição é local: mandar um comando por pixel
            // encheria o canal e faria o telão pular.
            if (!arrastandoRef.current) return;
            setArrastando(doPonto(e.clientX));
          }}
          onPointerUp={(e) => {
            if (!arrastandoRef.current) return;
            arrastandoRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* nunca chegou a capturar */
            }
            irPara(doPonto(e.clientX));
            setArrastando(null);
          }}
          onPointerCancel={() => {
            arrastandoRef.current = false;
            setArrastando(null);
          }}
        >
          <div
            ref={trilho}
            role="slider"
            tabIndex={0}
            aria-label="Posição da mídia"
            aria-valuemin={0}
            aria-valuemax={temDuracao ? Math.round(duracao) : 0}
            aria-valuenow={Math.round(tempoMostrado)}
            aria-valuetext={
              temDuracao
                ? `${relogio(tempoMostrado)} de ${relogio(duracao)}`
                : `${relogio(tempoMostrado)}, duração desconhecida`
            }
            onKeyDown={teclado}
            className={cn(
              "relative h-1.5 w-full rounded-full bg-raised",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-full bg-border-strong"
              style={{ width: `${pctCarregado}%` }}
            />
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${pctTocado}%` }}
            />
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent",
                "shadow-[0_0_0_3px_var(--color-elevated)] transition-transform",
                "group-hover/barra:scale-110",
                arrastando !== null && "scale-125",
              )}
              style={{ left: `${pctTocado}%` }}
            />
          </div>
        </div>

        <span className="tnum shrink-0 text-caption text-muted">
          {restante(tempoMostrado, duracao)}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1">
        <Hint label={`Voltar ${VOLTAR} segundos`}>
          <Button
            size="iconSm"
            variant="ghost"
            aria-label={`Voltar ${VOLTAR} segundos`}
            onClick={() => irPara(estado.tempo - VOLTAR)}
          >
            <RotateCcw />
          </Button>
        </Hint>
        <Hint label={tocando ? "Pausar" : "Tocar"}>
          <Button size="sm" variant={tocando ? "secondary" : "default"} onClick={alternar}>
            {tocando ? <Pause /> : <Play />}
            {tocando ? "Pausar" : "Tocar"}
          </Button>
        </Hint>
        <Hint label={`Avançar ${AVANCAR} segundos`}>
          <Button
            size="iconSm"
            variant="ghost"
            aria-label={`Avançar ${AVANCAR} segundos`}
            onClick={() => irPara(estado.tempo + AVANCAR)}
          >
            <RotateCw />
          </Button>
        </Hint>
        <Hint label="Parar e voltar ao início">
          <Button size="iconSm" variant="ghost" aria-label="Parar" onClick={parar}>
            <Square />
          </Button>
        </Hint>

        {ehVideo && (
          <label className="ml-auto flex select-none items-center gap-1.5 text-caption text-muted">
            <Repeat className="size-3.5 text-subtle" aria-hidden />
            <button
              type="button"
              role="switch"
              aria-checked={!!deck.mediaLoop}
              data-on={!!deck.mediaLoop}
              className="lumen-switch"
              onClick={() => comandar({ mediaLoop: !deck.mediaLoop })}
            />
            Repetir
          </label>
        )}

        <p className={cn("tnum text-caption text-subtle", ehVideo ? "ml-2" : "ml-auto")}>
          {estado.terminou
            ? "terminou"
            : temDuracao
              ? `carregado ${Math.round(pctCarregado)}% · reproduzido ${Math.round(pctTocado)}%`
              : "carregando…"}
        </p>
      </div>
    </div>
  );
}
