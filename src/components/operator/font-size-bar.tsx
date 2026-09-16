import { AArrowDown, AArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_PADRAO,
  fontScaleDe,
  rotuloFontScale,
} from "@/lib/font-scale";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Tamanho da letra do telão, embaixo do que está sendo projetado.
 *
 * Fica aqui, e não escondido nos ajustes de tema, porque é o socorro do meio
 * do culto: a letra ficou pequena para quem está no fundo, aperta A+ e a
 * igreja já lê. Vale para música, Bíblia, aviso e texto ao mesmo tempo, e o
 * telão muda no mesmo instante.
 */
export function FontSizeBar({ className }: { className?: string }) {
  const settings = useLumenStore((s) => s.settings);
  const bump = useLumenStore((s) => s.bumpFontScale);
  const update = useLumenStore((s) => s.updateSettings);
  const escala = fontScaleDe(settings);

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <span className="mr-0.5 text-caption text-subtle">Letra no telão</span>
        <Hint label="Diminuir a letra no telão">
          <Button
            size="iconSm"
            variant="ghost"
            aria-label="Diminuir a letra no telão"
            disabled={escala <= FONT_SCALE_MIN}
            onClick={() => bump(-1)}
          >
            <AArrowDown />
          </Button>
        </Hint>
        <span className="tnum w-10 text-center text-caption font-medium text-fg">
          {rotuloFontScale(escala)}
        </span>
        <Hint label="Aumentar a letra no telão">
          <Button
            size="iconSm"
            variant="ghost"
            aria-label="Aumentar a letra no telão"
            disabled={escala >= FONT_SCALE_MAX}
            onClick={() => bump(1)}
          >
            <AArrowUp />
          </Button>
        </Hint>
        {escala !== FONT_SCALE_PADRAO && (
          <Hint label="Voltar ao tamanho padrão">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Voltar ao tamanho padrão da letra"
              onClick={() => update({ fontScale: FONT_SCALE_PADRAO })}
            >
              <RotateCcw />
            </Button>
          </Hint>
        )}
      </div>
    </div>
  );
}
