import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * A escala do console usa nomes semânticos (`text-body`, `text-caption`) em vez
 * de `text-sm`/`text-xs`. O tailwind-merge não tem como adivinhar que são
 * tamanhos, e os classificava como cor — então `text-body` derrubava
 * `text-primary-fg` e o botão claro ficava com texto claro por cima.
 * Declarar o grupo aqui resolve para o app inteiro.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["caption", "secondary", "body", "title", "display-sm", "display"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
