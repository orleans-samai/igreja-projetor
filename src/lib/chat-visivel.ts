import type { PosicaoChat } from "@/store/chat-store";

/**
 * Quando o chat está à vista.
 *
 * Como coluna ele é móvel da cabine, não uma janelinha: ocupa lugar próprio
 * na fileira, arrastável como as outras, não cobre nada e fica. Recado de culto só serve se for lido na
 * hora — "repete o refrão" que chega num painel fechado é recado perdido, e
 * era isso que acontecia, porque o painel nascia fechado.
 *
 * Flutuante é o único que se fecha por cima do trabalho, e por isso continua
 * podendo ser dispensado: ali ele sobrepõe, e o que sobrepõe tem que sair.
 */
export function chatVisivel(posicao: PosicaoChat, aberto: boolean): boolean {
  if (posicao === "oculto") return false;
  if (posicao === "flutuante") return aberto;
  return true;
}

/**
 * Se o chat ocupa uma das colunas arrastáveis da cabine.
 *
 * É o que decide se ele entra na fileira de painéis: flutuante mora por cima
 * e oculto não mora em lugar nenhum.
 */
export function chatEhColuna(posicao: PosicaoChat): boolean {
  return posicao === "coluna";
}
