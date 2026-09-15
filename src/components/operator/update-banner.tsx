import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EstadoAtualizacao } from "@/lib/updates";

const VAZIO: EstadoAtualizacao = { fase: "sem-verificacao", versao: null, progresso: 0, erro: null };

/**
 * Faixa de atualização.
 *
 * Só aparece quando há algo para fazer: uma versão nova esperando, baixando,
 * ou pronta para instalar — o resto do tempo não ocupa espaço nenhum. Cada
 * push para o GitHub publica uma versão sozinho; é esta faixa que avisa
 * quando ela chega à cabine, e o botão que baixa e instala é o mesmo lugar,
 * sem sair da tela.
 *
 * Nunca baixa nem reinicia sozinha — só o clique do operador faz isso.
 */
export function UpdateBanner() {
  const [estado, setEstado] = useState<EstadoAtualizacao>(VAZIO);
  const [dispensada, setDispensada] = useState<string | null>(null);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    let vivo = true;
    void d.updateStatus().then((s) => vivo && setEstado(s));
    const parar = d.onUpdateStatus((s) => vivo && setEstado(s));
    return () => {
      vivo = false;
      parar();
    };
  }, []);

  const visivel = estado.fase === "disponivel" || estado.fase === "baixando" || estado.fase === "pronto";
  if (!visivel || dispensada === estado.versao) return null;

  const acao = () => {
    const d = window.lumenDesktop;
    if (!d) return;
    if (estado.fase === "disponivel") void d.updateDownload();
    else if (estado.fase === "pronto") void d.updateInstall();
  };

  return (
    <div className="animate-swap-in flex items-center gap-2 border-b border-border bg-elevated px-3 py-1">
      <Download className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-secondary text-muted">
        {estado.fase === "disponivel" && `Versão ${estado.versao} disponível.`}
        {estado.fase === "baixando" && `Baixando a versão ${estado.versao}… ${estado.progresso}%`}
        {estado.fase === "pronto" && `Versão ${estado.versao} pronta. Reinicie para aplicar.`}
      </p>
      {estado.fase !== "baixando" && (
        <Button size="sm" variant="ghost" onClick={acao}>
          {estado.fase === "pronto" ? "Atualizar e reiniciar" : "Atualizar"}
        </Button>
      )}
      <Button
        size="iconSm"
        variant="ghost"
        aria-label="Dispensar"
        onClick={() => setDispensada(estado.versao)}
      >
        <X />
      </Button>
    </div>
  );
}
