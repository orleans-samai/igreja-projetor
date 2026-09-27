import type { Deck } from "./types.ts";

/**
 * Para onde vai o tema que o operador clicou.
 *
 * Ia pela categoria do tema ("só Bíblia", "Letras e Bíblia"), e não pelo
 * que estava no telão: com um versículo no ar, clicar num tema de letras
 * gravava o tema das letras, e a Bíblia na parede continuava igual — o
 * "às vezes clico no tema e não aplica" da igreja. O clique é um pedido
 * para o telão de agora: vai para o que está no ar, ou, sem nada no ar,
 * para o que está na prévia, que é o que entra a seguir.
 */
export function destinoDoTema(live: Pick<Deck, "kind"> | null, preview: Pick<Deck, "kind"> | null): "songs" | "bible" {
  return (live ?? preview)?.kind === "bible" ? "bible" : "songs";
}
