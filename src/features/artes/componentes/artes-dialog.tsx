import { lazy, Suspense, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * A casca da área de Artes.
 *
 * O painel de verdade — Konva, fontes das artes, gerador — só é carregado
 * quando alguém abre as Artes. A cabine abre mais leve, e o que desenha no
 * canvas nunca é importado fora do navegador.
 */
const PainelDeArtes = lazy(() => import("./painel-de-artes.tsx").then((m) => ({ default: m.PainelDeArtes })));

export function ArtesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const guarda = useRef<() => boolean>(() => true);
  const registrarGuarda = useCallback((g: () => boolean) => {
    guarda.current = g;
  }, []);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !guarda.current()) return;
        onOpenChange(v);
      }}
    >
      <DialogContent title="Artes" scrollBody={false} className="h-[min(56rem,calc(100dvh-2rem))] w-[min(88rem,calc(100%-2rem))]">
        {/* As teclas ficam no painel: sem isto, a seta que empurra um texto
            também passaria o slide no telão. Esc segue para fechar. */}
        <div
          className="flex h-full min-h-0 flex-col"
          onKeyDown={(e) => {
            if (e.key !== "Escape") e.stopPropagation();
          }}
        >
          {open && (
            <Suspense fallback={<p className="text-secondary text-muted">Abrindo as Artes…</p>}>
              <PainelDeArtes registrarGuarda={registrarGuarda} />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
