import type { PosicaoChat } from "@/store/chat-store";

/**
 * Quando o chat está à vista.
 *
 * Nas laterais ele é móvel da cabine, não uma janelinha: ocupa coluna
 * própria, não cobre nada e fica. Recado de culto só serve se for lido na
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
 * Se o botão de fechar do próprio painel some o chat da tela.
 *
 * Na lateral, fechar quer dizer esconder de vez — e quem esconde de vez tem
 * que ter como trazer de volta, que é o botão Chat da barra de cima.
 */
export function fecharLeva(posicao: PosicaoChat): PosicaoChat | null {
  if (posicao === "oculto") return null;
  return "oculto";
}

/** A lateral para onde o botão Chat devolve o painel escondido. */
export function mostrarLeva(posicao: PosicaoChat, ultimaLateral: PosicaoChat): PosicaoChat {
  if (posicao !== "oculto") return posicao;
  return ultimaLateral === "esquerda" ? "esquerda" : "direita";
}
