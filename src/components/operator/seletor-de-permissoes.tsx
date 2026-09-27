import { cn } from "@/lib/cn";
import {
  AJUDA_CAPACIDADE,
  CAPACIDADES,
  ROTULO_CAPACIDADE,
  acessoCompleto,
  alternarCapacidade,
  normalizarPermissoes,
  pode,
  type PermissoesRemotas,
} from "@/lib/permissoes";

/**
 * O que um aparelho (ou uma conta) pode fazer pelo celular: só o chat,
 * uma ou mais partes — culto, mídia, letras, controle — ou tudo.
 *
 * Eram três degraus, e quem precisava só da mídia levava junto as letras e
 * o culto. Agora cada parte liga sozinha; "Só chat" desliga todas e "Acesso
 * completo" liga todas, inclusive as que vierem depois.
 */
export function SeletorDePermissoes({
  valor,
  aoMudar,
  rotulo,
  compacto = false,
}: {
  valor: unknown;
  aoMudar: (permissoes: PermissoesRemotas) => void;
  /** Nome do grupo para quem usa leitor de tela: de quem são estas permissões. */
  rotulo: string;
  compacto?: boolean;
}) {
  const atual = normalizarPermissoes(valor);
  const soChat = atual.length === 0;
  const completo = acessoCompleto(atual);
  // "Incluída": a parte vem junto do acesso completo. Aparece ligada, mais
  // clara, para ninguém achar que o completo deixou alguma de fora.
  const botao = (estado: "ligado" | "incluido" | "desligado") =>
    cn(
      "rounded-md font-medium",
      compacto ? "px-2 py-0.5 text-caption" : "px-2 py-1 text-caption",
      "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
      estado === "ligado"
        ? "bg-primary text-primary-fg"
        : estado === "incluido"
          ? "bg-primary/25 text-fg"
          : "bg-raised text-muted hover:text-fg",
    );

  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1">
      <button
        type="button"
        aria-pressed={soChat}
        title="Só envia e recebe mensagens: o celular mostra só o chat"
        onClick={() => aoMudar([])}
        className={botao(soChat ? "ligado" : "desligado")}
      >
        Só chat
      </button>
      {CAPACIDADES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={pode(atual, c)}
          title={AJUDA_CAPACIDADE[c]}
          onClick={() => aoMudar(alternarCapacidade(atual, c))}
          className={botao(completo ? "incluido" : pode(atual, c) ? "ligado" : "desligado")}
        >
          {ROTULO_CAPACIDADE[c]}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={completo}
        title="Tudo o que o celular faz, inclusive o que vier nas próximas versões"
        onClick={() => aoMudar(completo ? [] : ["completo"])}
        className={botao(completo ? "ligado" : "desligado")}
      >
        Acesso completo
      </button>
    </div>
  );
}
