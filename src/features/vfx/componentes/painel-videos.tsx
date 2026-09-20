import { Copy, FolderOpen, MoreVertical, Pencil, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Empty } from "@/components/ui/panel";
import { humanSize, listMedia, openMediaFolder, type MediaFile } from "@/lib/media-library";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";

/**
 * A aba Vídeos: o que já está pronto e otimizado.
 *
 * É a pasta de vídeo da igreja, incluindo o que saiu dos vídeos dinâmicos.
 * Um clique põe no telão — e é daqui que o culto deveria sair, porque um
 * arquivo pronto não gasta processador desenhando efeito a cada quadro.
 */

export function PainelVideos({ recarregarEm }: { recarregarEm?: number }) {
  const [itens, setItens] = useState<MediaFile[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const addMedia = useLumenStore((s) => s.addMedia);
  const projetarDaBiblioteca = useLumenStore((s) => s.projetarDaBiblioteca);

  const carregar = useCallback(async () => {
    const r = await listMedia("video");
    if (!r.ok) {
      setErro(r.error ?? "Não consegui ler a pasta de vídeo.");
      setItens([]);
      return;
    }
    setErro(null);
    setItens([...(r.items ?? [])].sort((a, b) => b.at - a.at));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar, recarregarEm]);

  const projetar = (m: MediaFile) => {
    // A store precisa conhecer o arquivo antes de projetá-lo — o mesmo
    // cuidado que a biblioteca da cabine toma ao clicar num item da pasta.
    addMedia({ id: m.id, type: "video", title: m.title, path: m.url });
    projetarDaBiblioteca("media", m.id);
  };

  const renomear = async (m: MediaFile) => {
    const novo = rascunho.trim();
    setRenomeando(null);
    if (!novo || novo === m.title) return;
    const r = await window.lumenDesktop?.mediaRename("video", m.name, novo);
    if (!r?.ok) {
      toast(r?.error ?? "Não consegui renomear.");
      return;
    }
    await carregar();
  };

  const duplicar = async (m: MediaFile) => {
    const r = await window.lumenDesktop?.mediaDuplicate("video", m.name);
    if (!r?.ok) {
      toast(r?.error ?? "Não consegui duplicar.");
      return;
    }
    toast(`Cópia criada: “${r.nome}”.`);
    await carregar();
  };

  const excluir = async (m: MediaFile) => {
    // Confirmação e lixeira: no domingo de manhã um clique errado não pode
    // ser definitivo.
    if (!window.confirm(`Mandar “${m.title}” para a lixeira do Windows?`)) return;
    const r = await window.lumenDesktop?.mediaDelete("video", m.name);
    if (!r?.ok) {
      toast(r?.error ?? "Não consegui excluir.");
      return;
    }
    toast(`“${m.title}” foi para a lixeira.`);
    await carregar();
  };

  if (erro) {
    return <Empty title="A pasta de vídeo não abriu." hint={erro} />;
  }

  if (itens.length === 0) {
    return (
      <Empty
        title="Nenhum vídeo na pasta ainda."
        hint="Monte uma composição em Vídeos dinâmicos e use Salvar como vídeo, ou largue arquivos na pasta."
      />
    );
  }

  return (
    <ul className="grid gap-1.5">
      {itens.map((m) => (
        <li
          key={m.id}
          className="group/item flex items-center gap-2 rounded-md p-1.5 shadow-[var(--shadow-border)]"
        >
          <button
            type="button"
            onDoubleClick={() => projetar(m)}
            onClick={() => projetar(m)}
            title="Pôr no telão"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md bg-elevated text-muted",
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "hover:bg-raised hover:text-fg",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <Play className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            {renomeando === m.id ? (
              <input
                autoFocus
                value={rascunho}
                maxLength={80}
                onChange={(e) => setRascunho(e.target.value)}
                onBlur={() => void renomear(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renomear(m);
                  if (e.key === "Escape") setRenomeando(null);
                }}
                className="w-full rounded-sm bg-elevated px-1.5 py-0.5 text-secondary text-fg outline-none"
                aria-label="Novo nome do vídeo"
              />
            ) : (
              <p className="truncate text-secondary text-fg">{m.title}</p>
            )}
            <p className="tnum text-caption text-subtle">{humanSize(m.size)}</p>
          </div>

          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Opções de ${m.title}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
              >
                <MoreVertical className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => projetar(m)}>Pôr no telão</MenuItem>
              <MenuItem
                onSelect={() => {
                  setRascunho(m.title);
                  setRenomeando(m.id);
                }}
              >
                <span className="flex items-center gap-2">
                  <Pencil className="size-3.5" aria-hidden />
                  Renomear
                </span>
              </MenuItem>
              <MenuItem onSelect={() => void duplicar(m)}>
                <span className="flex items-center gap-2">
                  <Copy className="size-3.5" aria-hidden />
                  Duplicar
                </span>
              </MenuItem>
              <MenuItem onSelect={() => void openMediaFolder("video")}>
                <span className="flex items-center gap-2">
                  <FolderOpen className="size-3.5" aria-hidden />
                  Abrir a pasta
                </span>
              </MenuItem>
              <MenuItem tone="danger" onSelect={() => void excluir(m)}>
                <span className="flex items-center gap-2">
                  <Trash2 className="size-3.5" aria-hidden />
                  Excluir
                </span>
              </MenuItem>
            </MenuContent>
          </Menu>
        </li>
      ))}
    </ul>
  );
}
