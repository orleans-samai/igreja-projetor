import { Copy, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { VfxQualidade } from "../tipos.ts";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Empty } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { MODELOS } from "../padroes.ts";
import { limitarPorQualidade } from "../qualidade.ts";
import { nomeNovoProjeto, useVfxStore } from "../store.ts";
import { useQualidadeEfetiva } from "../usar-vfx.ts";
import type { VfxProjeto } from "../tipos.ts";
import { EditorVfx } from "./editor-vfx.tsx";
import { TelaVfx } from "./tela-vfx.tsx";

/**
 * A aba Vídeos dinâmicos.
 *
 * Mostra os modelos prontos e as composições da casa. Cada cartão roda de
 * verdade, na miniatura: um quadro parado não diz se o efeito ficou bom, e
 * escolher pelo nome é escolher no escuro.
 *
 * Só aparece com o VFX ligado ou automático. Desligado, a coluna explica
 * em vez de sumir — quem desligou pode ter esquecido.
 */

export function PainelDinamicos({ aoSalvarVideo }: { aoSalvarVideo?: () => void }) {
  const modo = useVfxStore((s) => s.modo);
  const projetos = useVfxStore((s) => s.projetos);
  const criar = useVfxStore((s) => s.criar);
  const abrir = useVfxStore((s) => s.abrir);
  const fechar = useVfxStore((s) => s.fechar);
  const abertoId = useVfxStore((s) => s.abertoId);
  const duplicar = useVfxStore((s) => s.duplicar);
  const excluir = useVfxStore((s) => s.excluir);
  const { qualidade } = useQualidadeEfetiva();
  const [mostrarModelos, setMostrarModelos] = useState(false);

  if (modo === "desligado") {
    return (
      <Empty
        title="Os vídeos dinâmicos estão desativados para melhorar o desempenho."
        hint="Ative em Mais → VFX. Os vídeos já salvos continuam na aba Vídeos."
      />
    );
  }

  const aberto = projetos.find((p) => p.id === abertoId) ?? null;

  const novoDoModelo = (modeloId: string) => {
    const modelo = MODELOS.find((m) => m.id === modeloId);
    criar(nomeNovoProjeto(projetos, modelo?.nome ?? "Composição"), modeloId);
    setMostrarModelos(false);
  };

  return (
    <div className="grid gap-2">
      <Button
        size="sm"
        variant={mostrarModelos ? "secondary" : "ghost"}
        onClick={() => setMostrarModelos((v) => !v)}
        className="w-full"
      >
        <Plus />
        Nova composição
      </Button>

      {mostrarModelos && (
        <div className="grid gap-1.5 rounded-lg p-2 shadow-[var(--shadow-border)]">
          <p className="text-caption text-subtle">Comece por um modelo:</p>
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => novoDoModelo(m.id)}
              className={cn(
                "flex items-center gap-2 rounded-md p-1.5 text-left",
                "hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              )}
            >
              <span className="h-9 w-16 shrink-0 overflow-hidden rounded-sm">
                <TelaVfx comp={limitarPorQualidade(m.comp, qualidade)} rodando={false} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-secondary text-fg">{m.nome}</span>
                <span className="block truncate text-caption text-subtle">{m.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {projetos.length === 0 ? (
        <Empty
          title="Nenhuma composição ainda."
          hint="Comece por um modelo e ajuste o que quiser. Depois, salve como vídeo."
        />
      ) : (
        <ul className="grid gap-1.5">
          {projetos.map((p) => (
            <Cartao
              key={p.id}
              projeto={p}
              qualidade={qualidade}
              onAbrir={() => abrir(p.id)}
              onDuplicar={() => duplicar(p.id)}
              onExcluir={() => {
                if (
                  window.confirm(
                    `Tirar “${p.nome}” da lista? Os vídeos já salvos continuam na pasta.`,
                  )
                ) {
                  excluir(p.id);
                }
              }}
            />
          ))}
        </ul>
      )}

      {aberto && (
        <EditorVfx
          projeto={aberto}
          open
          onOpenChange={(v) => {
            if (!v) fechar();
          }}
          aoSalvarVideo={aoSalvarVideo}
        />
      )}
    </div>
  );
}

function Cartao({
  projeto,
  qualidade,
  onAbrir,
  onDuplicar,
  onExcluir,
}: {
  projeto: VfxProjeto;
  qualidade: VfxQualidade;
  onAbrir: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}) {
  // A miniatura só anima sob o cursor. Vinte composições na lista seriam
  // vinte animações rodando ao mesmo tempo na cabine que está projetando —
  // exatamente o gasto que esta área inteira existe para evitar.
  const [sobre, setSobre] = useState(false);
  return (
    <li
      className="flex items-center gap-2 rounded-md p-1.5 shadow-[var(--shadow-border)]"
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
    >
      <button
        type="button"
        onClick={onAbrir}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <span className="h-9 w-16 shrink-0 overflow-hidden rounded-sm">
          <TelaVfx comp={limitarPorQualidade(projeto.comp, qualidade)} rodando={sobre} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-secondary text-fg">{projeto.nome}</span>
          <span className="block truncate text-caption text-subtle">
            {projeto.gerados.length > 0
              ? `${projeto.gerados.length} vídeo${projeto.gerados.length > 1 ? "s" : ""} gerado${projeto.gerados.length > 1 ? "s" : ""}`
              : "Ainda não virou vídeo"}
          </span>
        </span>
      </button>

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`Opções de ${projeto.nome}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
          >
            <MoreVertical className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onAbrir}>Abrir no editor</MenuItem>
          <MenuItem onSelect={onDuplicar}>
            <span className="flex items-center gap-2">
              <Copy className="size-3.5" aria-hidden />
              Duplicar
            </span>
          </MenuItem>
          <MenuItem tone="danger" onSelect={onExcluir}>
            <span className="flex items-center gap-2">
              <Trash2 className="size-3.5" aria-hidden />
              Excluir
            </span>
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}
