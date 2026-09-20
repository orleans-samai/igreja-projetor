import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { MotorVfx } from "../motor.ts";
import type { VfxComposicao } from "../tipos.ts";

/**
 * A composição rodando, em tempo real.
 *
 * O mesmo motor que gera o arquivo de vídeo, na resolução da caixinha: o
 * que o operador vê aqui é o que vai sair de lá, e não uma aproximação
 * feita com outro código.
 *
 * Desenha no tamanho de verdade do elemento, não no tamanho em CSS. Numa
 * tela com escala 150% — comum no PC da cabine — o canvas ficaria borrado
 * se ignorasse isso, e o operador aprovaria um vídeo achando que a culpa
 * era do efeito.
 */
export function TelaVfx({
  comp,
  className,
  rodando = true,
  aoQuadro,
}: {
  comp: VfxComposicao;
  className?: string;
  rodando?: boolean;
  /** Chamado a cada quadro, para quem mede desempenho. */
  aoQuadro?: (agora: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Numa ref e não no estado: mudar a composição não pode reiniciar o
  // laço, senão cada arrasto de controle deslizante volta a animação ao
  // começo e o operador nunca vê o efeito inteiro.
  const atual = useRef(comp);
  atual.current = comp;
  const aoQuadroRef = useRef(aoQuadro);
  aoQuadroRef.current = aoQuadro;

  useEffect(() => {
    const tela = ref.current;
    if (!tela) return;
    const ctx = tela.getContext("2d", { alpha: false });
    if (!ctx) return;
    const motor = new MotorVfx();
    let pedido = 0;
    const inicio = performance.now();

    const medir = () => {
      const r = tela.getBoundingClientRect();
      const escala = Math.min(2, window.devicePixelRatio || 1);
      const l = Math.max(1, Math.round(r.width * escala));
      const a = Math.max(1, Math.round(r.height * escala));
      if (tela.width !== l || tela.height !== a) {
        tela.width = l;
        tela.height = a;
      }
      return { l, a };
    };

    const passo = (agora: number) => {
      const { l, a } = medir();
      motor.desenhar(ctx, atual.current, (agora - inicio) / 1000, l, a);
      aoQuadroRef.current?.(agora);
      pedido = requestAnimationFrame(passo);
    };

    if (rodando) {
      pedido = requestAnimationFrame(passo);
    } else {
      // Parado ainda mostra um quadro: caixa preta não diz nada sobre a
      // composição, e é justamente o que o operador quer conferir.
      const { l, a } = medir();
      motor.desenhar(ctx, atual.current, 0.8, l, a);
    }

    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      motor.descartar();
    };
  }, [rodando]);

  return (
    <canvas
      ref={ref}
      aria-label="Pré-visualização da composição"
      className={cn("block size-full rounded-md bg-stage", className)}
    />
  );
}
