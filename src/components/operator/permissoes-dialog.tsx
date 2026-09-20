import { Smartphone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dispositivos } from "@/components/operator/remote-control-dialog";
import { useStatusRemoto } from "@/components/operator/use-status-remoto";
import { AJUDA_PERMISSAO, ROTULO_PERMISSAO } from "@/lib/remote-control";

/**
 * Quem entrou pelo celular, e o que cada pessoa pode fazer.
 *
 * Entrar no Lúmen pelo celular deixou de pedir senha: quem está na Wi-Fi da
 * igreja já está dentro, e cobrar seis dígitos de toda a equipe toda semana
 * custava mais do que protegia. A proteção mudou de lugar — está aqui.
 *
 * Todo mundo entra podendo só conversar. Dar mais que isso é um gesto do
 * operador, com o nome da pessoa na frente dele. Um celular esquecido
 * conectado na semana passada não avança slide no meio da pregação.
 */
export function PermissoesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { status, setStatus, suportado } = useStatusRemoto(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Permissões do celular" className="w-[min(30rem,calc(100%-1.5rem))]">
        {!suportado ? (
          <p className="text-secondary text-muted">
            Só funciona no aplicativo do Windows.
          </p>
        ) : !status.ligado ? (
          <p className="flex items-center gap-1.5 text-secondary text-muted">
            <Smartphone className="size-3.5 shrink-0" aria-hidden />
            O controle pelo celular está desligado. Ligue em Tela → Controle remoto pelo celular.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              {(["chat", "editor", "controle"] as const).map((p) => (
                <p key={p} className="text-secondary text-muted">
                  <span className="font-medium text-fg">{ROTULO_PERMISSAO[p]}</span> —{" "}
                  {AJUDA_PERMISSAO[p]}
                </p>
              ))}
            </div>
            <Dispositivos status={status} aoMudar={setStatus} />
            <p className="text-caption text-subtle">
              Todo aparelho entra podendo só conversar. O resto é você quem libera, com o nome da
              pessoa na frente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
