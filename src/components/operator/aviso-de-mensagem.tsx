import { MessageCircle, Mic } from "lucide-react";
import { toast } from "sonner";
import type { MensagemChat } from "@/lib/remote-control";
import { useChatStore } from "@/store/chat-store";

/**
 * Mensagem nova vira um aviso dourado, no alto da tela.
 *
 * O chat pode estar numa coluna que o operador não está olhando, fechado,
 * ou por trás da Bíblia aberta — e "repete o refrão" lido dois minutos
 * depois é recado perdido. Um contador vermelho no canto já existia e não
 * bastava: no meio do louvor, ninguém procura contador.
 *
 * Dourado e no alto de propósito. O canto de baixo é onde moram os avisos
 * de sistema — "salvo", "importado" —, e um recado de gente não pode se
 * perder no meio deles. Tocar no aviso abre o chat.
 */

/** Quanto tempo o aviso fica, pelo tamanho do recado: dá tempo de ler. */
export function duracaoDoAviso(texto: string): number {
  const palavras = String(texto ?? "").trim().split(/\s+/).filter(Boolean).length;
  // Leitura de relance, ~3 palavras por segundo, com piso e teto: o aviso
  // curto não pisca e some, e o longo não fica cobrindo a tela.
  return Math.min(14000, Math.max(6000, 2500 + (palavras / 3) * 1000));
}

export function avisarMensagem(m: MensagemChat): void {
  const texto = m.texto?.trim() || (m.audio ? "Recado de voz" : "");
  if (!texto) return;

  toast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          useChatStore.getState().abrir(true);
          toast.dismiss(id);
        }}
        // O dourado mora em `.ouro` (styles.css), junto com o porquê.
        className="ouro flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-[rgb(255_236_180/0.7)] px-4 py-3 text-left shadow-[0_18px_40px_rgba(0,0,0,.45)]"
      >
        <span className="mt-0.5 shrink-0 rounded-full bg-[rgba(29,22,5,.12)] p-1.5">
          {m.audio ? <Mic className="size-4" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-caption font-semibold uppercase tracking-[0.08em] opacity-75">
            {m.de || "Celular"}
          </span>
          <span className="mt-0.5 block break-words text-body font-semibold leading-snug">
            {texto.length > 180 ? `${texto.slice(0, 177)}…` : texto}
          </span>
        </span>
      </button>
    ),
    {
      id: `chat-${m.id}`,
      position: "top-center",
      duration: duracaoDoAviso(texto),
    },
  );
}
