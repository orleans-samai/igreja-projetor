import { FolderOpen, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MediaFolderDialog } from "@/components/operator/media-folder-dialog";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  MEDIA_KINDS,
  applyMediaFolder,
  chooseMediaFolder,
  hasMediaFolders,
  mediaKindLabel,
  openMediaFolder,
  resetMediaFolder,
  type EscolhaDePasta,
  type MediaKind,
} from "@/lib/media-library";

/**
 * Onde ficam vídeos, áudios e imagens — nas Configurações, que é onde o
 * operador procura.
 *
 * O mesmo controle existe na aba Mídia da biblioteca; aqui ele aparece junto
 * do resto dos ajustes, com o caminho de cada tipo à vista, porque "onde o
 * Lúmen guarda as mídias" é pergunta de configuração, não de biblioteca.
 */
export function MediaFoldersSection() {
  const suportado = hasMediaFolders();
  const [pastas, setPastas] = useState<Record<string, string>>({});
  const [troca, setTroca] = useState<{ kind: MediaKind; escolha: EscolhaDePasta } | null>(null);

  const recarregar = useCallback(async () => {
    const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
    if (!d?.isDesktop) return;
    try {
      setPastas(await d.mediaFolders());
    } catch {
      /* sem pastas: a mensagem de "só no Windows" já cobre */
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!suportado) {
    return (
      <p className="text-secondary text-muted">
        As pastas de mídia só existem no aplicativo do Windows. No navegador, a importação vale
        para a sessão.
      </p>
    );
  }

  const escolher = async (kind: MediaKind) => {
    const escolha = await chooseMediaFolder(kind);
    if (escolha.canceled) return;
    if (escolha.mesmaPasta) {
      toast("Essa já é a pasta atual.");
      return;
    }
    if (!escolha.ok || !escolha.dir) {
      toast.error(escolha.error || "Não consegui usar essa pasta.");
      return;
    }
    if (!escolha.pendentes) {
      const r = await applyMediaFolder(kind, escolha.dir, false);
      if (!r.ok) {
        toast.error(r.error || "Não consegui trocar a pasta.");
        return;
      }
      if (r.aviso) toast.error(r.aviso, { duration: 10000 });
      else toast(`Pasta de ${mediaKindLabel(kind).toLowerCase()} alterada.`);
      void recarregar();
      return;
    }
    setTroca({ kind, escolha });
  };

  const voltarAoPadrao = async (kind: MediaKind) => {
    const r = await resetMediaFolder(kind);
    if (!r.ok) {
      toast.error(r.error || "Não consegui voltar ao padrão.");
      return;
    }
    if (r.aviso) toast.error(r.aviso, { duration: 10000 });
    else toast(`Pasta de ${mediaKindLabel(kind).toLowerCase()} de volta ao padrão.`);
    void recarregar();
  };

  return (
    <div className="space-y-3">
      {troca && (
        <MediaFolderDialog
          kind={troca.kind}
          escolha={troca.escolha}
          onClose={() => setTroca(null)}
          onDone={() => void recarregar()}
        />
      )}

      <p className="text-secondary text-muted">
        É de onde o Lúmen lê os arquivos para projetar. Pode ser um pendrive ou uma pasta da
        rede — o Lúmen confere se dá para ler e gravar antes de aceitar.
      </p>

      {MEDIA_KINDS.map(({ value, label }) => (
        <div key={value} className="flex flex-wrap items-center gap-2 rounded-lg bg-elevated p-2">
          <div className="min-w-0 flex-1">
            <p className="text-caption font-medium uppercase tracking-wide text-subtle">{label}</p>
            <p className="break-all text-secondary text-fg">{pastas[value] || "—"}</p>
          </div>
          <Hint label="Abrir no Explorer">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label={`Abrir a pasta de ${label.toLowerCase()}`}
              onClick={async () => {
                const dir = await openMediaFolder(value);
                if (!dir) toast.error("Não consegui abrir a pasta.");
              }}
            >
              <FolderOpen />
            </Button>
          </Hint>
          <Hint label="Voltar à pasta padrão">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label={`Voltar a pasta de ${label.toLowerCase()} ao padrão`}
              onClick={() => void voltarAoPadrao(value)}
            >
              <RotateCcw />
            </Button>
          </Hint>
          <Button size="sm" variant="secondary" onClick={() => void escolher(value)}>
            Selecionar pasta
          </Button>
        </div>
      ))}
    </div>
  );
}
