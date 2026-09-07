import {
  GripVertical,
  Monitor,
  MonitorOff,
  Pause,
  Play,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/panel";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { subscribeOps } from "@/lib/ops-channel";
import { capaDoVideo, dadosDoVideo, idDoVideo, relogio } from "@/lib/youtube";
import { useLumenStore } from "@/store/lumen-store";
import { useYoutubeStore } from "@/store/youtube-store";

/**
 * A seção YouTube da cabine.
 *
 * Aqui só há controle, nunca player: o vídeo toca na janela de projeção, e é
 * de lá que vêm tempo e duração pelo canal de operação. É a mesma divisão do
 * áudio local — a cabine comanda, o telão reproduz — e é o que impede o mesmo
 * som de sair duas vezes na caixa da igreja.
 */
export function YoutubePanel() {
  const aberto = useYoutubeStore((s) => s.aberto);
  const fila = useYoutubeStore((s) => s.fila);
  const atual = useYoutubeStore((s) => s.atual);
  const tempo = useYoutubeStore((s) => s.tempo);
  const duracao = useYoutubeStore((s) => s.duracao);
  const estado = useYoutubeStore((s) => s.estado);
  const erroPlayer = useYoutubeStore((s) => s.erro);
  const autoProximo = useYoutubeStore((s) => s.autoProximo);
  const adicionar = useYoutubeStore((s) => s.adicionar);
  const remover = useYoutubeStore((s) => s.remover);
  const mover = useYoutubeStore((s) => s.mover);
  const escolher = useYoutubeStore((s) => s.escolher);
  const setAutoProximo = useYoutubeStore((s) => s.setAutoProximo);
  const relatar = useYoutubeStore((s) => s.relatar);

  const projetado = useLumenStore((s) => s.youtube);
  const projetar = useLumenStore((s) => s.projetarYoutube);
  const comandar = useLumenStore((s) => s.comandarYoutube);
  const buscar = useLumenStore((s) => s.buscarYoutube);
  const tirar = useLumenStore((s) => s.removerYoutube);

  const [url, setUrl] = useState("");
  const [erroUrl, setErroUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);

  const item = fila.find((v) => v.id === atual) ?? null;
  const indice = item ? fila.findIndex((v) => v.id === item.id) : -1;
  const proximo = indice >= 0 ? (fila[indice + 1] ?? null) : null;
  const noAr = projetado?.videoId === item?.videoId && !!projetado;
  const tocando = estado === "tocando";

  // O projetor conta onde o vídeo está. Sem projetor aberto, nada chega — e a
  // barra parada é a informação correta, não um defeito.
  useEffect(() => {
    return subscribeOps((msg) => {
      if (msg.type !== "youtube-tempo") return;
      relatar({ tempo: msg.tempo, duracao: msg.duracao, estado: msg.estado, erro: msg.erro });
    });
  }, [relatar]);

  // Fim do vídeo: por padrão só prepara o próximo. Emendar sozinho no meio de
  // um culto é o tipo de ajuda que ninguém pediu.
  const fimTratado = useRef("");
  useEffect(() => {
    if (estado !== "fim" || !projetado) return;
    const marca = `${projetado.videoId}`;
    if (fimTratado.current === marca) return;
    fimTratado.current = marca;
    if (autoProximo && proximo) {
      escolher(proximo.id);
      projetar(proximo.videoId, proximo.titulo);
    } else if (proximo) {
      toast(`“${proximo.titulo}” está pronto. Clique em Projetar quando quiser.`);
    }
  }, [estado, projetado, autoProximo, proximo, escolher, projetar]);

  if (!aberto) return null;

  const carregar = async () => {
    const id = idDoVideo(url);
    if (!id) {
      setErroUrl("Não reconheci um vídeo do YouTube neste endereço. Cole o link da barra do navegador.");
      return;
    }
    setErroUrl(null);
    setCarregando(true);
    // O título é um extra: sem internet ou com vídeo restrito ele não vem, e
    // aí a fila mostra a capa e o endereço, que já bastam para trabalhar.
    const dados = await dadosDoVideo(id);
    setCarregando(false);
    adicionar({ videoId: id, titulo: dados?.titulo ?? "Vídeo do YouTube", autor: dados?.autor ?? "" });
    setUrl("");
  };

  return (
    <section
      aria-label="YouTube"
      className="animate-swap-in shrink-0 border-b border-border bg-surface"
      data-tour="youtube"
    >
      <div className="panel-head justify-between">
        <h2 className="flex items-center gap-1.5">
          <Youtube className="size-3.5 text-danger" aria-hidden /> YouTube
          {fila.length > 0 && <span className="tnum text-subtle">{fila.length}</span>}
        </h2>
        {noAr && (
          <span className="flex items-center gap-1.5 text-caption text-live">
            <span aria-hidden className="tally size-1.5 rounded-full bg-live" />
            No ar
          </span>
        )}
      </div>

      <div className="space-y-2 p-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void carregar();
          }}
        >
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErroUrl(null);
            }}
            placeholder="Cole o link do YouTube"
            aria-label="Endereço do vídeo do YouTube"
            invalid={Boolean(erroUrl)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" loading={carregando} disabled={!url.trim()}>
            Carregar vídeo
          </Button>
        </form>

        {erroUrl && (
          <p role="alert" className="text-secondary text-danger">
            {erroUrl}
          </p>
        )}
        {erroPlayer && (
          <p role="alert" className="text-secondary text-danger">
            {erroPlayer}
          </p>
        )}

        {item ? (
          <div className="flex gap-3 rounded-md bg-elevated p-2">
            <img
              src={capaDoVideo(item.videoId)}
              alt=""
              className="h-16 w-28 shrink-0 rounded-sm object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-fg">{item.titulo}</p>
                <p className="truncate text-secondary text-subtle">
                  {item.autor || "YouTube"} · {relogio(tempo)} / {relogio(duracao)}
                </p>
              </div>

              {/* Barra de progresso: comanda o player do projetor. */}
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duracao))}
                value={Math.floor(tempo)}
                disabled={!noAr || duracao <= 0}
                onChange={(e) => buscar(Number(e.target.value))}
                aria-label="Posição do vídeo"
                className="h-1 w-full accent-accent"
              />

              <div className="flex flex-wrap items-center gap-1">
                <Hint label={tocando ? "Pausar no telão" : "Tocar no telão"}>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={tocando ? "Pausar" : "Tocar"}
                    disabled={!noAr}
                    onClick={() => comandar({ acao: tocando ? "pausar" : "tocar" })}
                  >
                    {tocando ? <Pause /> : <Play />}
                  </Button>
                </Hint>
                <Hint label="Parar e voltar ao início">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label="Parar"
                    disabled={!noAr}
                    onClick={() => comandar({ acao: "parar" })}
                  >
                    <Square />
                  </Button>
                </Hint>
                <Hint label={projetado?.mudo ? "Tirar do mudo" : "Mudo"}>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={projetado?.mudo ? "Tirar do mudo" : "Mudo"}
                    disabled={!noAr}
                    onClick={() => comandar({ mudo: !projetado?.mudo })}
                  >
                    {projetado?.mudo ? <VolumeX /> : <Volume2 />}
                  </Button>
                </Hint>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={projetado?.volume ?? 85}
                  disabled={!noAr}
                  onChange={(e) => comandar({ volume: Number(e.target.value), mudo: false })}
                  aria-label="Volume do vídeo"
                  className="h-1 w-20 accent-accent"
                />

                <span className="ml-auto flex items-center gap-1">
                  {noAr ? (
                    <Button size="sm" variant="secondary" onClick={tirar}>
                      <MonitorOff /> Remover da projeção
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => projetar(item.videoId, item.titulo)}>
                      <Monitor /> Projetar
                    </Button>
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Empty
            title="Nenhum vídeo carregado."
            hint="Cole um link do YouTube acima. Aceita watch, youtu.be e live."
          />
        )}

        {fila.length > 0 && (
          <ul className="space-y-0.5">
            {fila.map((v, i) => (
              <li
                key={v.id}
                draggable
                onDragStart={() => setArrastando(i)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => setArrastando(null)}
                onDrop={() => {
                  if (arrastando !== null && arrastando !== i) mover(arrastando, i);
                  setArrastando(null);
                }}
                className={cn(
                  "group/yt flex items-center gap-2 rounded-sm px-1 py-1",
                  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                  v.id === atual && "bg-elevated",
                  projetado?.videoId === v.videoId && "shadow-[inset_2px_0_0_0_var(--color-live)]",
                  arrastando === i && "opacity-40",
                )}
              >
                <GripVertical
                  className="size-3.5 shrink-0 cursor-grab text-subtle opacity-0 transition-opacity group-hover/yt:opacity-100"
                  aria-hidden
                />
                <span className="tnum w-4 shrink-0 text-caption text-subtle">{i + 1}</span>
                <img
                  src={capaDoVideo(v.videoId)}
                  alt=""
                  className="h-7 w-12 shrink-0 rounded-sm object-cover"
                />
                <button
                  type="button"
                  onClick={() => escolher(v.id)}
                  className="min-w-0 flex-1 truncate text-left text-secondary text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {v.titulo}
                </button>
                <Hint label="Projetar este vídeo">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={`Projetar ${v.titulo}`}
                    onClick={() => {
                      escolher(v.id);
                      projetar(v.videoId, v.titulo);
                    }}
                  >
                    <Play />
                  </Button>
                </Hint>
                <Hint label="Tirar da fila">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={`Tirar ${v.titulo} da fila`}
                    className="hover:text-danger"
                    onClick={() => remover(v.id)}
                  >
                    <Trash2 />
                  </Button>
                </Hint>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2">
          <label className="flex select-none items-center gap-2 text-caption text-muted">
            <button
              type="button"
              role="switch"
              aria-checked={autoProximo}
              data-on={autoProximo}
              className="lumen-switch"
              onClick={() => setAutoProximo(!autoProximo)}
            />
            Reproduzir próximo automaticamente
          </label>
          {proximo && (
            <span className="min-w-0 flex-1 truncate text-caption text-subtle">
              A seguir: {proximo.titulo}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
