import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  applyMediaFolder,
  mediaKindLabel,
  type EscolhaDePasta,
  type MediaKind,
} from "@/lib/media-library";

/**
 * A pergunta que faltava ao trocar a pasta de mídia.
 *
 * Trocar a pasta com arquivos na antiga tem três respostas possíveis, e antes
 * o app escolhia uma sozinho — em silêncio, sem mover nada, deixando a
 * biblioteca aparentemente vazia. Agora quem decide é quem conhece o acervo.
 */
export function MediaFolderDialog({
  kind,
  escolha,
  onClose,
  onDone,
}: {
  kind: MediaKind;
  escolha: EscolhaDePasta | null;
  onClose: () => void;
  onDone: (dir: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const aberto = Boolean(escolha?.ok && escolha.dir);
  const pendentes = escolha?.pendentes ?? 0;

  const aplicar = async (mover: boolean) => {
    if (!escolha?.dir) return;
    setOcupado(true);
    try {
      const r = await applyMediaFolder(kind, escolha.dir, mover);
      if (!r.ok) {
        toast.error(r.error || "Não consegui trocar a pasta.");
        return;
      }
      // Cada arquivo que ficou para trás é dito pelo nome: "alguns falharam"
      // não diz ao operador o que procurar no Explorer depois.
      if (r.falhas?.length) {
        const lista = r.falhas.slice(0, 3).map((f) => `${f.nome} (${f.erro})`).join("; ");
        const resto = r.falhas.length > 3 ? ` e mais ${r.falhas.length - 3}` : "";
        toast.error(`Não movi: ${lista}${resto}. Os arquivos continuam na pasta antiga.`, {
          duration: 12000,
        });
      }
      if (r.aviso) toast.error(r.aviso, { duration: 10000 });
      if (mover && r.movidos) toast(`${r.movidos} arquivo(s) movido(s) para a pasta nova.`);
      else if (!r.falhas?.length && !r.aviso) toast(`Pasta de ${mediaKindLabel(kind).toLowerCase()} alterada.`);
      onDone(r.dir || escolha.dir);
      onClose();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !ocupado && onClose()}>
      <DialogContent title="Mover as mídias existentes?" className="max-w-md">
        <div className="space-y-4">
          <p className="text-body text-muted">
            A pasta antiga ainda tem {pendentes} arquivo{pendentes === 1 ? "" : "s"} de{" "}
            {mediaKindLabel(kind).toLowerCase()}. Deseja mover para a pasta nova?
          </p>

          <div className="space-y-1 rounded-lg bg-elevated p-3">
            <p className="text-caption uppercase tracking-wide text-subtle">De</p>
            <p className="break-all text-secondary text-fg">{escolha?.anterior}</p>
            <p className="mt-2 text-caption uppercase tracking-wide text-subtle">Para</p>
            <p className="break-all text-secondary text-fg">{escolha?.dir}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button loading={ocupado} onClick={() => void aplicar(true)}>
              Mover arquivos
            </Button>
            <Button variant="secondary" disabled={ocupado} onClick={() => void aplicar(false)}>
              Usar a nova pasta sem mover
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
