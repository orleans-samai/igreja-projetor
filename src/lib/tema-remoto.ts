/**
 * Quais temas o celular precisa conhecer para desenhar as miniaturas.
 *
 * A grade de slides do aparelho mostra a estrofe sobre o fundo do tema. Só
 * que "o tema" não é um: cada música pode ter um preso nela, e o que vale no
 * telão é o preso quando existe, o padrão quando não. Mandar a coleção
 * inteira seria mandar fundo de imagem que nenhuma música usa.
 *
 * Esta parte é separada do hook de propósito: é escolha, não desenho, e
 * escolha se testa sem abrir um navegador.
 */
import type { Song, Theme } from "@/lib/types";

/**
 * Teto de temas que viajam com capa.
 *
 * Cada fundo de imagem vira um JPEG decodificado no PC que está projetando
 * um culto. Oito cobre igreja nenhuma passar aperto; além disso o tema vai
 * sem capa e a miniatura fica só com a cor — feia, mas na hora.
 */
export const TETO_DE_TEMAS = 8;

/** O tema que vale para uma música: o preso nela, ou o padrão. */
export function temaDaMusica(song: Song, padraoId: string): string {
  return song.themeId || padraoId;
}

/**
 * Os temas que valem a viagem, o padrão sempre na frente.
 *
 * Na frente porque o teto corta o fim da lista, e ficar sem a capa do tema
 * que quase todas as músicas usam seria perder justamente a que importa.
 */
export function temasUsados(themes: Theme[], songs: Song[], padraoId: string): Theme[] {
  const querem = new Set<string>([padraoId]);
  for (const s of songs) querem.add(temaDaMusica(s, padraoId));
  const escolhidos = themes.filter((t) => querem.has(t.id));
  escolhidos.sort((a, b) => (a.id === padraoId ? -1 : b.id === padraoId ? 1 : 0));
  return escolhidos.slice(0, TETO_DE_TEMAS);
}
