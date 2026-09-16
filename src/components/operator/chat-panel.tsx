import { MessageSquare, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { MensagemChat } from "@/lib/remote-control";
import { useChatStore } from "@/store/chat-store";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O chat da cabine.
 *
 * Fica ao lado, nunca por cima: quem está projetando não pode ter um balão
 * tapando o botão de Próximo. Por isso o painel ocupa uma coluna própria e o
 * aviso de mensagem nova é um número no botão, não uma janela.
 */

function hora(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** O botão que abre o chat, com o número de mensagens não lidas. */
export function ChatButton() {
  const aberto = useChatStore((s) => s.aberto);
  const naoLidas = useChatStore((s) => s.naoLidas);
  const posicao = useChatStore((s) => s.posicao);
  const abrir = useChatStore((s) => s.abrir);
  const suportado = typeof window !== "undefined" && window.lumenDesktop?.isDesktop;

  if (!suportado || posicao === "oculto") return null;

  return (
    <Hint label={aberto ? "Fechar o chat" : "Abrir o chat com os celulares"}>
      <Button
        size="sm"
        variant={aberto ? "secondary" : "ghost"}
        onClick={() => abrir(!aberto)}
        aria-label={naoLidas > 0 ? `Chat, ${naoLidas} não lidas` : "Chat"}
      >
        <MessageSquare />
        Chat
        {naoLidas > 0 && (
          <span className="tnum ml-0.5 rounded-sm bg-live px-1 text-caption font-semibold text-live-fg">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </Button>
    </Hint>
  );
}

/**
 * O aviso discreto de mensagem nova.
 *
 * Uma linha que aparece e sai sozinha — nunca um popup no meio da tela, que
 * é exatamente o que não se pode fazer com quem está projetando um culto.
 */
export function ChatAviso() {
  const aviso = useChatStore((s) => s.aviso);
  const limpar = useChatStore((s) => s.limparAviso);
  const abrir = useChatStore((s) => s.abrir);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(limpar, 6000);
    return () => window.clearTimeout(t);
  }, [aviso, limpar]);

  if (!aviso) return null;
  return (
    <button
      type="button"
      onClick={() => abrir(true)}
      className={cn(
        "animate-swap-in flex w-full items-baseline gap-2 border-b border-border bg-elevated px-3 py-1 text-left",
        "hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <MessageSquare className="size-3.5 shrink-0 translate-y-0.5 text-accent" aria-hidden />
      <span className="shrink-0 text-secondary font-medium text-fg">{aviso.de}</span>
      <span className="min-w-0 flex-1 truncate text-secondary text-muted">{aviso.texto}</span>
    </button>
  );
}

function Mensagem({ m }: { m: MensagemChat }) {
  return (
    <li
      className={cn(
        "rounded-md px-2 py-1.5",
        m.daCabine ? "bg-raised" : "bg-elevated shadow-[inset_0_0_0_1px_var(--color-border)]",
      )}
    >
      <p className="flex items-baseline gap-1.5">
        <span className="truncate text-caption font-semibold text-fg">{m.de}</span>
        <span className="tnum shrink-0 text-caption text-subtle">{hora(m.em)}</span>
      </p>
      <p className="whitespace-pre-wrap break-words text-secondary text-fg">{m.texto}</p>
    </li>
  );
}

export function ChatPanel() {
  const mensagens = useChatStore((s) => s.mensagens);
  const aberto = useChatStore((s) => s.aberto);
  const posicao = useChatStore((s) => s.posicao);
  const abrir = useChatStore((s) => s.abrir);
  const operador = useLumenStore((s) => s.settings.operatorName);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, aberto]);

  if (!aberto || posicao === "oculto") return null;

  const enviar = async () => {
    const limpo = texto.trim();
    const d = window.lumenDesktop;
    if (!limpo || !d?.isDesktop) return;
    setEnviando(true);
    try {
      const msg = await d.remoteControlChat(limpo, operador || "Cabine");
      // Quem manda também vê: o servidor devolve a mensagem já registrada.
      if (msg) useChatStore.getState().receber(msg);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-surface",
        // Flutuante encosta no canto inferior e some da árvore de colunas;
        // lateral vira uma coluna de verdade, que nunca cobre nada.
        posicao === "flutuante"
          ? "pop-layer absolute bottom-3 right-3 z-30 h-80 w-72 rounded-lg shadow-[var(--shadow-pop),var(--shadow-border)]"
          : "h-full w-full border-border",
        posicao === "direita" && "border-l",
        posicao === "esquerda" && "border-r",
      )}
      aria-label="Chat com os celulares"
    >
      <div className="panel-head justify-between">
        <h2 className="flex items-center gap-1.5">
          <MessageSquare className="size-3.5 text-subtle" aria-hidden /> Chat
        </h2>
        <Button size="iconSm" variant="ghost" aria-label="Fechar o chat" onClick={() => abrir(false)}>
          <X />
        </Button>
      </div>

      <ul className="lumen-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {mensagens.length === 0 && (
          <li className="px-1 py-6 text-center text-secondary text-subtle">
            Nada ainda. Quem estiver com o celular conectado pode escrever aqui.
          </li>
        )}
        {mensagens.map((m) => (
          <Mensagem key={m.id} m={m} />
        ))}
        <div ref={fim} />
      </ul>

      <form
        className="flex items-center gap-1.5 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Responder"
          aria-label="Mensagem para os celulares"
          maxLength={500}
        />
        <Button size="iconSm" type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </aside>
  );
}
