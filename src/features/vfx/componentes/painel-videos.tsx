import { Copy, FolderOpen, MoreVertical, Pencil, Play, Trash2, Wallpaper } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Empty } from "@/components/ui/panel";
import { humanSize, listMedia, openMediaFolder, type MediaFile } from "@/lib/media-library";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";

/**
 * A aba Vídeos da coluna de temas: a pasta de vídeo da igreja, incluindo o
 * que saiu dos vídeos dinâmicos, como fundo da letra.
 *
 * Um clique põe o vídeo atrás da letra; projetar o vídeo sozinho, na tela
 * inteira, fica no menu de cada um. A igreja pediu a coluna toda de temas —
 * antes o clique aqui trocava o que estava no telão, e a letra sumia.
 */

export function PainelVideos({ recarregarEm }: { recarregarEm?: number }) {
  const [itens, setItens] = useState<MediaFile[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const addMedia = useLumenStore((s) => s.addMedia);
  const projetarDaBiblioteca = useLumenStore((s) => s.projetarDaBiblioteca);
  const usarComoFundo = useLumenStore((s) => s.usarVideoComoFundoDaLetra);
  const fundoDaLetra = useLumenStore((s) => {
    const t = s.themes.find((x) => x.id === s.songThemeId);
    return t?.backgroundType === "video" ? t.backgroundValue : "";
  });
  const aplicar = (m: MediaFile) => {
    const tema = usarComoFundo({ url: m.url, titulo: m.title });
    toast(`Fundo das letras: “${tema.name}”.`);
  };

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
          className={cn(
            "group/item flex items-center gap-2 rounded-md p-1.5",
            fundoDaLetra === m.url ? "shadow-[0_0_0_1px_var(--color-fg)]" : "shadow-[var(--shadow-border)]",
          )}
        >
          <button
            type="button"
            onClick={() => aplicar(m)}
            title="Usar como fundo da letra"
            aria-label={`Usar ${m.title} como fundo da letra`}
            aria-pressed={fundoDaLetra === m.url}
            className={cn(
              "h-9 w-16 shrink-0 overflow-hidden rounded-sm bg-stage",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {/* Um quadro parado do vídeo: tocar todos juntos na coluna
                gastaria o processador da cabine que projeta. */}
            <video className="size-full object-cover" src={`${m.url}#t=0.5`} muted preload="metadata" aria-hidden />
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
              <MenuItem onSelect={() => aplicar(m)}>
                <span className="flex items-center gap-2">
                  <Wallpaper className="size-3.5" aria-hidden />
                  Usar como fundo da letra
                </span>
              </MenuItem>
              <MenuItem onSelect={() => projetar(m)}>
                <span className="flex items-center gap-2">
                  <Play className="size-3.5" aria-hidden />
                  Pôr no telão, na tela inteira
                </span>
              </MenuItem>
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
