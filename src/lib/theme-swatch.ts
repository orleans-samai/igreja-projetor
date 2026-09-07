import type { CSSProperties } from "react";
import type { Theme } from "./types";

/**
 * Como pintar a amostra de um tema fora do telão — na tira de temas, no
 * seletor do preview e no editor.
 *
 * Existe num lugar só porque são três telas desenhando a mesma coisa: quando
 * entrou o fundo animado, as três teriam tentado carregar "bg-aurora" como
 * endereço de imagem e mostrado um quadrado vazio.
 */
export function themeSwatch(theme: Theme | undefined): {
  className: string;
  style: CSSProperties;
} {
  if (!theme) return { className: "", style: {} };

  if (theme.backgroundType === "animated") {
    // `relative` é obrigatório: as camadas do fundo são pseudoelementos com
    // inset negativo e, sem contexto de posicionamento aqui, elas se ancoram
    // no ancestral posicionado mais próximo e vazam por cima da cabine.
    return { className: `relative lumen-bg ${theme.backgroundValue}`, style: {} };
  }

  if (theme.backgroundType === "color") {
    return { className: "", style: { background: theme.backgroundValue } };
  }

  // Imagem e vídeo: o pôster do vídeo não existe, então a amostra usa o
  // primeiro quadro só quando é imagem; vídeo cai no fundo neutro.
  if (theme.backgroundType === "image") {
    return {
      className: "bg-center bg-cover bg-no-repeat",
      style: { backgroundImage: `url(${theme.backgroundValue})` },
    };
  }

  return { className: "bg-stage", style: {} };
}
