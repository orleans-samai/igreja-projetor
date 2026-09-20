import { Check, Mic, Send, Square, Trash2, Undo2, Settings2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { AVISO_PRIVACIDADE } from "@/lib/ia/conversa";
import type { EstadoIA } from "@/lib/ia/tipos";
import { startVoice, voiceSupported } from "@/lib/voice";
import { useIaStore } from "@/store/ia-store";

/**
 * O assistente, numa janela só.
 *
 * Fica fechado até alguém abrir, e no modo "sob demanda" é a abertura que
 * carrega o modelo. Enquanto ele não estiver pronto, a janela diz o que
 * falta — não há barra girando sem explicação, porque quem abre isto no meio
 * de um culto precisa saber em dois segundos se dá para contar com ele.
 */

const SUGESTOES = [
  "Procure o hino Castelo Forte",
  "Coloque João 3:16 na projeção",
  "Mostre um aviso: o culto começa em cinco minutos",
  "Quais músicas foram projetadas hoje?",
  "Crie o culto Culto da Benção para toda quarta-feira",
];

function Situacao({ estado }: { estado: EstadoIA | null }) {
  if (!estado) return null;
  const mapa: Record<string, { texto: string; cor: string }> = {
    desativada: { texto: "Desativado", cor: "bg-subtle" },
    carregando: { texto: "Carregando o modelo…", cor: "bg-accent" },
    pronta: { texto: "Pronto", cor: "bg-ok" },
    erro: { texto: "Com problema", cor: "bg-danger" },
  };
  const s = mapa[estado.situacao] ?? mapa.desativada;
  return (
    <p className="flex items-center gap-1.5 text-caption text-subtle">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", s.cor)} />
      {s.texto}
      {estado.modelo && <span className="truncate">· {estado.modelo.nome}</span>}
    </p>
  );
}

export function IaDialog({ onConfiguracoes }: { onConfiguracoes: () => void }) {
  const aberto = useIaStore((s) => s.aberto);
  const abrir = useIaStore((s) => s.abrir);
  const recados = useIaStore((s) => s.recados);
  const pensando = useIaStore((s) => s.pensando);
  const pendente = useIaStore((s) => s.pendente);
  const estado = useIaStore((s) => s.estado);
  const atualizarEstado = useIaStore((s) => s.atualizarEstado);
  const perguntar = useIaStore((s) => s.perguntar);
  const confirmar = useIaStore((s) => s.confirmar);
  const cancelar = useIaStore((s) => s.cancelar);
  const limpar = useIaStore((s) => s.limpar);
  const desfazer = useIaStore((s) => s.desfazer);

  const [texto, setTexto] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const pararVoz = useRef<(() => void) | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Abrir é o gatilho: no modo sob demanda, é aqui que o modelo sobe.
  useEffect(() => {
    if (!aberto) return;
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    let vivo = true;
    const olhar = () => void d.iaEstado().then((e) => vivo && atualizarEstado(e));
    olhar();
    void d.iaLigar().finally(olhar);
    const id = window.setInterval(olhar, 2500);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [aberto, atualizarEstado]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [recados.length, pensando, pendente]);

  useEffect(() => {
    if (aberto) window.setTimeout(() => campo.current?.focus(), 60);
    else {
      pararVoz.current?.();
      pararVoz.current = null;
      setOuvindo(false);
    }
  }, [aberto]);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    void perguntar(t);
  };

  const semRuntime = estado && !estado.runtime.achado;
  const desativado = estado?.modo === "desativado";

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogContent
        title="Assistente Lúmen"
        className="flex h-[min(34rem,calc(100vh-6rem))] w-[min(34rem,calc(100%-1.5rem))] flex-col"
      >
        <div className="flex items-center justify-between gap-2">
          <Situacao estado={estado} />
          <div className="flex shrink-0 items-center gap-0.5">
            <Hint label="Desfazer a última alteração">
              <Button size="iconSm" variant="ghost" aria-label="Desfazer" onClick={desfazer}>
                <Undo2 />
              </Button>
            </Hint>
            <Hint label="Limpar a conversa">
              <Button size="iconSm" variant="ghost" aria-label="Limpar a conversa" onClick={limpar}>
                <Trash2 />
              </Button>
            </Hint>
            <Hint label="Configurações do assistente">
              <Button
                size="iconSm"
                variant="ghost"
                aria-label="Configurações do assistente"
                onClick={() => {
                  abrir(false);
                  onConfiguracoes();
                }}
              >
                <Settings2 />
              </Button>
            </Hint>
          </div>
        </div>

        {(desativado || semRuntime || estado?.situacao === "erro") && (
          <div className="rounded-md bg-elevated p-3">
            <p className="text-secondary text-fg">
              {desativado
                ? "O assistente está desativado."
                : semRuntime
                  ? "Falta o programa que roda o modelo (llama-server)."
                  : (estado?.erro ?? "O assistente está com problema.")}
            </p>
            <p className="mt-1 text-secondary text-muted">
              A cabine funciona igual sem ele, e os comandos de voz simples continuam valendo.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                abrir(false);
                onConfiguracoes();
              }}
            >
              Abrir as configurações do assistente
            </Button>
          </div>
        )}

        <ul
          className="lumen-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
          aria-label="Conversa com o assistente"
          aria-live="polite"
        >
          {recados.length === 0 && (
            <li className="space-y-2">
              <p className="text-secondary text-muted">Pergunte qualquer coisa, ou experimente:</p>
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void perguntar(s)}
                  className={cn(
                    "block w-full rounded-md bg-elevated px-2.5 py-1.5 text-left text-secondary text-fg",
                    "transition-colors duration-[var(--motion-fast)] hover:bg-raised",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  )}
                >
                  {s}
                </button>
              ))}
            </li>
          )}
          {recados.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-secondary",
                r.papel === "usuario" && "bg-elevated text-fg",
                r.papel === "assistente" && "bg-raised text-fg",
                r.papel === "sistema" && "text-muted",
              )}
            >
              {r.papel === "sistema" && (
                <span aria-hidden className={cn("mr-1.5", r.feito ? "text-ok" : "text-subtle")}>
                  {r.feito ? "✓" : "·"}
                </span>
              )}
              <span className="whitespace-pre-wrap break-words">{r.texto}</span>
            </li>
          ))}
          {pensando && <li className="px-2.5 text-secondary text-subtle">Pensando…</li>}
          <div ref={fim} />
        </ul>

        {pendente && (
          <div className="rounded-md bg-elevated p-3">
            {/* O operador aprova uma frase, não um nome de função. */}
            <p className="text-secondary text-fg">Quer que eu {pendente.previa}?</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => confirmar(true)}>
                <Check /> Fazer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => confirmar(false)}>
                Não
              </Button>
            </div>
          </div>
        )}

        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <Input
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte ou peça alguma coisa"
            aria-label="Pergunta para o assistente"
            disabled={pensando}
          />
          {voiceSupported() && (
            <Hint label={ouvindo ? "Parar de ouvir" : "Falar em vez de digitar"}>
              <Button
                type="button"
                size="iconSm"
                variant={ouvindo ? "secondary" : "ghost"}
                aria-label="Falar"
                aria-pressed={ouvindo}
                onClick={() => {
                  if (ouvindo) {
                    pararVoz.current?.();
                    pararVoz.current = null;
                    setOuvindo(false);
                    return;
                  }
                  setOuvindo(true);
                  pararVoz.current = startVoice((t) => setTexto((antes) => (antes ? `${antes} ${t}` : t)));
                }}
              >
                <Mic />
              </Button>
            </Hint>
          )}
          {pensando ? (
            <Button type="button" size="iconSm" variant="ghost" aria-label="Parar" onClick={cancelar}>
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="iconSm" aria-label="Enviar" disabled={!texto.trim()}>
              <Send />
            </Button>
          )}
        </form>

        {/* A promessa fica à vista porque é verificável: o modelo roda aqui,
            preso ao 127.0.0.1, e não há chamada de rede nenhuma neste caminho. */}
        <p className="flex items-center gap-1.5 text-caption text-subtle">
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {AVISO_PRIVACIDADE}
        </p>
      </DialogContent>
    </Dialog>
  );
}
