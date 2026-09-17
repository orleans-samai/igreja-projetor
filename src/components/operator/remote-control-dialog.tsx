import { Copy, Power, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  AJUDA_PERMISSAO,
  ROTULO_PERMISSAO,
  enderecoFixo,
  enderecosDeAcesso,
  type DispositivoRemoto,
  type PermissaoRemota,
  type RemoteStatus,
} from "@/lib/remote-control";

const PERMISSOES_UI: PermissaoRemota[] = ["chat", "editor", "controle"];

/**
 * Quem está conectado, o que cada um pode, e como tirar alguém.
 *
 * É a resposta para "quem mexeu no telão?": a lista tem nome, permissão e
 * quando o aparelho deu notícia pela última vez. Desconectar vale só para
 * aquele aparelho — os outros continuam trabalhando.
 */
function Dispositivos({
  status,
  aoMudar,
}: {
  status: RemoteStatus;
  aoMudar: (s: RemoteStatus) => void;
}) {
  const lista = status.dispositivos ?? [];

  if (lista.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-caption text-subtle">
        <Smartphone className="size-3" aria-hidden />
        Nenhum aparelho pareado ainda
      </p>
    );
  }

  return (
    <div>
      <p className="text-caption font-medium uppercase tracking-wide text-subtle">
        Aparelhos conectados
      </p>
      <ul className="mt-1 space-y-1.5">
        {lista.map((d: DispositivoRemoto) => (
          <li key={d.id} className="rounded-md bg-elevated p-2">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", d.online ? "bg-ok" : "bg-subtle")}
              />
              <p className="min-w-0 flex-1 truncate text-body font-medium text-fg">{d.nome}</p>
              <span className="shrink-0 text-caption text-subtle">
                {d.online ? "conectado" : "sem sinal"}
              </span>
              <Button
                size="iconSm"
                variant="ghost"
                aria-label={`Desconectar ${d.nome}`}
                className="hover:text-danger"
                onClick={async () => {
                  const bridge = window.lumenDesktop;
                  if (bridge) aoMudar(await bridge.remoteControlDisconnect(d.id));
                }}
              >
                <Power />
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {PERMISSOES_UI.map((p) => (
                <button
                  key={p}
                  type="button"
                  title={AJUDA_PERMISSAO[p]}
                  aria-pressed={d.permissao === p}
                  onClick={async () => {
                    const bridge = window.lumenDesktop;
                    if (bridge) aoMudar(await bridge.remoteControlSetPermission(d.id, p));
                  }}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-caption font-medium",
                    "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    d.permissao === p
                      ? "bg-primary text-primary-fg"
                      : "bg-raised text-muted hover:text-fg",
                  )}
                >
                  {ROTULO_PERMISSAO[p]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const [qr, setQr] = useState<string | null>(null);
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
  const enderecoPrincipal = enderecos[0] ?? null;
  const fixo = enderecoFixo(status);
  const [copiado, setCopiado] = useState(false);

  // O QR carrega o PIN junto no endereço: aponta a câmera e o celular já
  // pareia sozinho, sem digitar nada. Só existe enquanto o servidor estiver
  // de pé — gerar um QR para um PIN que já morreu seria um convite que não
  // funciona.
  useEffect(() => {
    if (!enderecoPrincipal || !status.pin) {
      setQr(null);
      return;
    }
    let vivo = true;
    QRCode.toDataURL(`${enderecoPrincipal}/?pin=${status.pin}`, {
      margin: 1,
      width: 176,
      color: { dark: "#17171a", light: "#e9e8e5" },
    })
      .then((url) => vivo && setQr(url))
      .catch(() => vivo && setQr(null));
    return () => {
      vivo = false;
    };
  }, [enderecoPrincipal, status.pin]);

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
                <div className="flex items-center gap-3 rounded-lg bg-elevated p-4">
                  {qr && (
                    <img
                      src={qr}
                      alt="QR code para parear o celular"
                      className="size-24 shrink-0 rounded-md"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                      {qr ? "Aponte a câmera, ou digite o PIN" : "PIN para parear"}
                    </p>
                    <p className="tnum mt-1 text-display-sm font-semibold tracking-[0.2em] text-fg">
                      {status.pin}
                    </p>
                  </div>
                </div>

                {/* O endereço que vale guardar vem primeiro, e o por IP logo
                    abaixo como plano B. O nome sobrevive à troca de IP pelo
                    roteador; o IP funciona em qualquer aparelho, hoje. Dizer
                    qual é qual é mais honesto do que escolher um e torcer. */}
                {fixo && (
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                      Endereço fixo — este é o de guardar
                    </p>
                    <p className="mt-1 text-body font-medium text-fg">{fixo}</p>
                    <p className="mt-1 text-secondary text-muted">
                      Não muda nem quando o roteador troca o número do computador. Em celular
                      antigo pode não abrir; nesse caso use o endereço de baixo.
                    </p>
                  </div>
                )}
                {!fixo && status.avisoNome && (
                  <p className="text-secondary text-muted">
                    Não consegui publicar o nome <span className="text-fg">lumen.local</span> na
                    rede ({status.avisoNome}). O endereço abaixo continua valendo.
                  </p>
                )}

                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                    {fixo ? "Endereço por número, se o nome não abrir" : "Endereço no celular"}
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
                  {/* O endereço deixou de envelhecer: porta e PIN são os
                      mesmos toda vez, e quem já pareou entra sem PIN. Dizer
                      isto aqui é o que dá ao operador coragem de mandar o
                      endereço no grupo da igreja durante a semana. */}
                  {enderecos.length > 0 && (
                    <p className="mt-1.5 text-secondary text-muted">
                      Este endereço e este PIN não mudam quando o Lúmen fecha e abre. Quem já
                      pareou entra direto, sem digitar o PIN de novo.
                    </p>
                  )}
                </div>

                {enderecoPrincipal && status.pin && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const recado = [
                        "Lúmen — controle pelo celular",
                        fixo,
                        fixo ? `Se não abrir: ${enderecoPrincipal}` : enderecoPrincipal,
                        `PIN: ${status.pin}`,
                      ]
                        .filter(Boolean)
                        .join("\n");
                      try {
                        await navigator.clipboard.writeText(recado);
                        setCopiado(true);
                        window.setTimeout(() => setCopiado(false), 2000);
                      } catch {
                        // Sem permissão da área de transferência, o endereço
                        // continua na tela para ser copiado à mão.
                        setCopiado(false);
                      }
                    }}
                  >
                    <Copy /> {copiado ? "Copiado" : "Copiar endereço e PIN"}
                  </Button>
                )}

                <Dispositivos status={status} aoMudar={setStatus} />

                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                    Ao parear, o aparelho entra como
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {PERMISSOES_UI.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={(status.permissaoPadrao ?? "chat") === p}
                        onClick={async () => {
                          const d = window.lumenDesktop;
                          if (d) setStatus(await d.remoteControlSetDefaultPermission(p));
                        }}
                        className={cn(
                          "rounded-md px-2 py-1 text-caption font-medium",
                          "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          (status.permissaoPadrao ?? "chat") === p
                            ? "bg-primary text-primary-fg"
                            : "bg-elevated text-muted hover:text-fg",
                        )}
                      >
                        {ROTULO_PERMISSAO[p]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-caption text-subtle">
                    O PIN prova que a pessoa está na sala, não que ela deve comandar o telão.
                    Por isso o padrão é entrar só no chat e a cabine liberar o resto.
                  </p>
                </div>

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
