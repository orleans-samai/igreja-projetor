import { Copy, Power, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const VAZIO: RemoteStatus = {
  ligado: false,
  porta: null,
  enderecos: [],
  sessoesAtivas: 0,
};

const PERMISSOES_UI: PermissaoRemota[] = ["chat", "editor", "controle"];


/**
 * Quem está conectado, o que cada um pode, e como tirar alguém.
 *
 * É a resposta para "quem mexeu no telão?": a lista tem nome, permissão e
 * quando o aparelho deu notícia pela última vez. Desconectar vale só para
 * aquele aparelho — os outros continuam trabalhando.
 */
export function Dispositivos({
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


/**
 * O endereço para a equipe, e quem está conectado.
 *
 * O controle sobe junto com o app: deixar isso para um clique significava
 * que, no domingo, ninguém lembrava — e a equipe chegava com o endereço na
 * mão e nada atendendo do outro lado. Desligar continua possível, para a
 * semana em que a igreja não quiser ninguém entrando.
 *
 * Entrar não pede senha, pede nome. "Desconectar todos" encerra de uma vez
 * qualquer aparelho de antes, sem precisar saber quem era.
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
    // A lista só muda quando alguém entra ou sai pelo celular — um relógio
    // lento basta para ela não ficar velha na tela.
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

  const desconectarTodos = async () => {
    setOcupado(true);
    try {
      setStatus(await window.lumenDesktop!.remoteControlDisconnectAll());
    } finally {
      setOcupado(false);
    }
  };

  const enderecos = enderecosDeAcesso(status);
  const enderecoPrincipal = enderecos[0] ?? null;
  const fixo = enderecoFixo(status);
  const [copiado, setCopiado] = useState(false);
  const [senhaDirigente, setSenhaDirigente] = useState("");

  useEffect(() => {
    // O QR leva o endereço fixo quando ele existe: é o que sobrevive à troca
    // de IP pelo roteador, e por isso é o único que vale imprimir e colar na
    // parede da cabine. Sem o nome de pé, cai no IP, que funciona hoje.
    const alvo = fixo ?? enderecoPrincipal;
    if (!alvo) {
      setQr(null);
      return;
    }
    let vivo = true;
    QRCode.toDataURL(alvo, {
      margin: 1,
      width: 320,
      color: { dark: "#0f1115", light: "#ffffff" },
    })
      .then((url) => vivo && setQr(url))
      .catch(() => vivo && setQr(null));
    return () => {
      vivo = false;
    };
  }, [enderecoPrincipal, fixo]);

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
                      alt="QR code para entrar pelo celular"
                      className="size-28 shrink-0 rounded-md"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                      Aponte a câmera do celular
                    </p>
                    <p className="mt-1 text-body text-fg">{fixo ?? enderecoPrincipal}</p>
                    {/* Vale imprimir só se o QR levar o nome fixo: um QR com
                        o número do computador vira papel inútil na semana em
                        que o roteador entregar outro. */}
                    <p className="mt-1 text-secondary text-muted">
                      {fixo
                        ? "Este QR não vence — dá para imprimir e deixar colado na cabine."
                        : "Este QR leva o número de hoje. Se o roteador trocar, ele deixa de valer."}
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
                  {/* O endereço deixou de envelhecer: a porta é a mesma toda
                      vez, e quem já entrou continua entrando. Dizer isto aqui
                      é o que dá ao operador coragem de mandar o endereço no
                      grupo da igreja durante a semana. */}
                  {enderecos.length > 0 && (
                    <p className="mt-1.5 text-secondary text-muted">
                      Este endereço não muda quando o Lúmen fecha e abre. Quem já entrou uma
                      vez continua entrando, sem se identificar de novo.
                    </p>
                  )}
                </div>

                {(fixo || enderecoPrincipal) && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const recado = [
                        "Lúmen — controle pelo celular",
                        fixo,
                        fixo ? `Se não abrir: ${enderecoPrincipal}` : enderecoPrincipal,
                        "Basta escrever o seu nome para entrar.",
                      ]
                        .filter(Boolean)
                        .join("\n");
                      try {
                        await navigator.clipboard.writeText(recado);
                        setCopiado(true);
                        window.setTimeout(() => setCopiado(false), 2000);
                      } catch {
                        setCopiado(false);
                      }
                    }}
                  >
                    <Copy /> {copiado ? "Copiado" : "Copiar endereço"}
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
                    Estar na Wi-Fi da igreja não quer dizer que a pessoa deva comandar o telão.
                    Por isso todo mundo entra só no chat, e é a cabine que libera o resto.
                  </p>
                </div>

                {/* A página do dirigente é a única do Lúmen que pede senha:
                    mandar arquivo para o computador da igreja é bem mais
                    arriscado que mandar recado no chat, e aqui não há
                    operador olhando quem entrou. */}
                <div className="border-t border-border pt-3">
                  <p className="text-caption font-medium uppercase tracking-wide text-subtle">
                    Enviar arquivos para o culto
                  </p>
                  <p className="mt-1 text-body text-fg">{`${fixo ?? enderecoPrincipal}/dirigente`}</p>
                  <p className="mt-1 text-secondary text-muted">
                    Para o dirigente mandar a apresentação de casa. Sem senha definida, a página
                    não abre.
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Input
                      type="password"
                      value={senhaDirigente}
                      onChange={(e) => setSenhaDirigente(e.target.value)}
                      placeholder={status.temSenhaDirigente ? "Trocar a senha" : "Definir uma senha"}
                      aria-label="Senha da página de envio"
                      autoComplete="new-password"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={senhaDirigente.trim().length < 4}
                      onClick={async () => {
                        const d = window.lumenDesktop;
                        if (!d) return;
                        setStatus(await d.remoteControlSetDirigentePassword(senhaDirigente.trim()));
                        setSenhaDirigente("");
                      }}
                    >
                      Guardar
                    </Button>
                    {status.temSenhaDirigente && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const d = window.lumenDesktop;
                          if (!d) return;
                          setStatus(await d.remoteControlSetDirigentePassword(""));
                          setSenhaDirigente("");
                        }}
                      >
                        Desligar
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-caption text-subtle">
                    {status.temSenhaDirigente
                      ? "A página está no ar. Quatro letras ou mais para trocar a senha."
                      : "Desligada. Defina uma senha de quatro letras ou mais para abrir."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void desconectarTodos()}
                    loading={ocupado}
                  >
                    <RefreshCw /> Desconectar todos
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
