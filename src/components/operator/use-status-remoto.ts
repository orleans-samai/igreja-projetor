import { useEffect, useState } from "react";
import type { RemoteStatus } from "@/lib/remote-control";

const VAZIO: RemoteStatus = {
  ligado: false,
  porta: null,
  enderecos: [],
  sessoesAtivas: 0,
};

/**
 * O retrato do controle remoto, mantido fresco enquanto um painel olha.
 *
 * Mora fora dos componentes de propósito: um arquivo que exporta componente e
 * função ao mesmo tempo quebra a recarga rápida do Vite no desenvolvimento.
 */
export function useStatusRemoto(ativo: boolean) {
  const [status, setStatus] = useState<RemoteStatus>(VAZIO);
  const suportado = typeof window !== "undefined" && window.lumenDesktop?.isDesktop;
  useEffect(() => {
    if (!ativo || !suportado) return;
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
  }, [ativo, suportado]);
  return { status, setStatus, suportado };
}
