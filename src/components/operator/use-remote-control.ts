import { useEffect } from "react";
import { estadoRemoto, type AcaoRemota } from "@/lib/remote-control";
import { useLumenStore, type LumenState } from "@/store/lumen-store";

/**
 * Ponte entre o celular e a cabine.
 *
 * Publica o estado a cada troca de slide — o processo principal repassa por
 * SSE para quem estiver conectado — e escuta os comandos que o processo
 * principal manda de volta, aprovados pelo servidor (PIN certo, sessão
 * válida, ação da lista). O celular nunca fala com a cabine direto; tudo
 * passa pelo mesmo canal de IPC que qualquer outro recurso do app Windows, e
 * fora do app Windows este hook simplesmente não faz nada.
 */
const ACOES: Record<AcaoRemota, (s: LumenState) => void> = {
  proximo: (s) => s.next(),
  anterior: (s) => s.prev(),
  preto: (s) => s.goBlack(),
  logo: (s) => s.goLogo(),
  "ocultar-letra": (s) => s.goClear(),
  parar: (s) => s.stop(),
  "proximo-item": (s) => s.nextPlaylistItem(),
};

export function useRemoteControl() {
  const status = useLumenStore((s) => s.status);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    d.remoteControlPushState(estadoRemoto(status, live, liveIndex));
  }, [status, live, liveIndex]);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    return d.onRemoteCommand((acao) => {
      const aplicar = (ACOES as Record<string, (s: LumenState) => void>)[acao];
      aplicar?.(useLumenStore.getState());
    });
  }, []);
}
