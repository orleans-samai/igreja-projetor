import { Power, RefreshCw, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { enderecosDeAcesso, type RemoteStatus } from "@/lib/remote-control";

const VAZIO: RemoteStatus = {
  ligado: false,
  porta: null,
  pin: null,
  enderecos: [],
  sessoesAtivas: 0,
};

/**
 * Ligar, desligar e mostrar o PIN do controle remoto.
 *
 * Fica desligado até o operador pedir: um servidor escutando na rede da
 * igreja o tempo todo, sem necessidade, é superfície exposta à toa. O PIN
 * muda a cada vez que liga, e "Gerar novo PIN" encerra de uma vez qualquer
 * aparelho pareado antes — o jeito de tirar alguém do controle sem precisar
 * saber quem foi.
 */
export function RemoteControlDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [status, setStatus] = useState<RemoteStatus>(VAZIO);
  const [ocupado, setOcupado] = useState(false);
  const suportado = typeof window !== "undefined" && window.lumenDesktop?.isDesktop;

  useEffect(() => {
    if (!open || !suportado) return;
    let vivo = true;
    const atualizar = () => {
      void window.lumenDesktop!.remoteControlStatus().then((s) => vivo && setStatus(s));
    };
    atualizar();
    // As sessões pareadas só mudam quando alguém digita o PIN no celular —
    // um relógio lento é o bastante para o número na tela não ficar velho.
    const id = window.setInterval(atualizar, 4000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [open, suportado]);

  const ligar = async () => {
    setOcupado(true);
    try {
      setStatus(await window.lumenDesktop!.remoteControlStart());
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    setOcupado(true);
    try {
      setStatus(await window.lumenDesktop!.remoteControlStop());
    } finally {
      setOcupado(false);
    }
  };

  const gerarNovoPin = async () => {
    setOcupado(true);
    try {
      setStatus(await window.lumenDesktop!.remoteControlRegeneratePin());
    } finally {
      setOcupado(false);
    }
  };

  const enderecos = enderecosDeAcesso(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Controle remoto pelo celular" className="w-[min(28rem,calc(100%-1.5rem))]">
        {!suportado ? (
          <p className="text-secondary text-muted">
            Só funciona no aplicativo do Windows — no navegador não há como abrir uma porta na
            rede da igreja.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-secondary text-muted">
              O celular entra pela Wi-Fi da igreja e comanda os slides: próximo, anterior, preto,
              logo, ocultar letra, parar, próximo item. Nada que troque de música ou apague o
              repertório — isso continua exigindo a cabine.
            </p>

            {!status.ligado ? (
              <Button onClick={() => void ligar()} loading={ocupado}>
                <Power /> Ativar controle remoto
              </Button>
            ) : (
              <>
                <div className="rounded-lg bg-elevated p-4 text-center">
                  <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                    PIN para parear
                  </p>
                  <p className="tnum mt-1 text-display-sm font-semibold tracking-[0.2em] text-fg">
                    {status.pin}
                  </p>
                </div>

                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                    Endereço no celular
                  </p>
                  {enderecos.length === 0 ? (
                    <p className="mt-1 text-secondary text-muted">
                      Nenhuma rede Wi-Fi encontrada. Conecte o computador à rede da igreja.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {enderecos.map((e) => (
                        <li key={e} className="tnum text-body text-fg">
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="flex items-center gap-1.5 text-caption text-subtle">
                  <Smartphone className="size-3" aria-hidden />
                  {status.sessoesAtivas === 0
                    ? "Nenhum aparelho pareado ainda"
                    : `${status.sessoesAtivas} aparelho${status.sessoesAtivas > 1 ? "s" : ""} pareado${status.sessoesAtivas > 1 ? "s" : ""}`}
                </p>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="secondary" onClick={() => void gerarNovoPin()} loading={ocupado}>
                    <RefreshCw /> Gerar novo PIN
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void desligar()} loading={ocupado}>
                    <Power /> Desativar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
