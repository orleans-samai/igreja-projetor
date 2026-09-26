import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { DocumentoDeArte } from "../documento.ts";
import { miniatura } from "../konva/exportar.tsx";

/**
 * A miniatura de uma arte: a composição real, reduzida.
 *
 * Sai do mesmo desenho que o editor e a exportação usam, rasterizada uma
 * vez e guardada em memória — a galeria mostra oito opções sem manter oito
 * editores vivos.
 */
export function Miniatura({ doc, largura = 360, className }: { doc: DocumentoDeArte; largura?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setUrl(null);
    void miniatura(doc, largura).then(
      (u) => vivo && setUrl(u),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [doc, largura]);
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-elevated", className)}
      style={{ aspectRatio: `${doc.largura} / ${doc.altura}` }}
    >
      {url ? (
        <img src={url} alt="" className="block size-full" draggable={false} />
      ) : (
        <div className="sweep-bar absolute inset-x-0 top-1/2 h-0.5" aria-hidden />
      )}
    </div>
  );
}
