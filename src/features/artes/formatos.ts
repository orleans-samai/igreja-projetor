/**
 * Os tamanhos em que uma arte de igreja sai.
 *
 * Pixels de verdade, porque é o que o Instagram, a gráfica e o telão pedem —
 * mas o documento guarda tudo em fração, e é só na hora de desenhar que
 * estes números entram. Trocar de formato reposiciona; não estica.
 */

export interface Formato {
  id: string;
  nome: string;
  largura: number;
  altura: number;
  grupo: "rede" | "projecao" | "impresso";
  /** Para que serve, em palavras de quem nunca abriu um editor. */
  ajuda: string;
}

export const FORMATOS: readonly Formato[] = [
  {
    id: "quadrado",
    nome: "Instagram quadrado",
    largura: 1080,
    altura: 1080,
    grupo: "rede",
    ajuda: "O post de sempre.",
  },
  {
    id: "retrato",
    nome: "Instagram retrato",
    largura: 1080,
    altura: 1350,
    grupo: "rede",
    ajuda: "Ocupa mais tela no feed.",
  },
  {
    id: "story",
    nome: "Stories",
    largura: 1080,
    altura: 1920,
    grupo: "rede",
    ajuda: "Tela cheia do celular.",
  },
  {
    id: "status",
    nome: "Status do WhatsApp",
    largura: 1080,
    altura: 1920,
    grupo: "rede",
    ajuda: "Mesmo tamanho do Stories.",
  },
  {
    id: "facebook",
    nome: "Facebook",
    largura: 1200,
    altura: 630,
    grupo: "rede",
    ajuda: "Link compartilhado.",
  },
  {
    id: "youtube",
    nome: "Capa do YouTube",
    largura: 1280,
    altura: 720,
    grupo: "rede",
    ajuda: "A miniatura do vídeo.",
  },
  {
    id: "projecao",
    nome: "Projeção Full HD",
    largura: 1920,
    altura: 1080,
    grupo: "projecao",
    ajuda: "Para pôr no telão do culto.",
  },
  {
    id: "vertical",
    nome: "Tela vertical",
    largura: 1080,
    altura: 1920,
    grupo: "projecao",
    ajuda: "Painel de LED em pé.",
  },
  {
    id: "a4",
    nome: "Cartaz A4",
    largura: 2480,
    altura: 3508,
    grupo: "impresso",
    ajuda: "Para imprimir e colar no mural. 300 dpi.",
  },
  {
    id: "a5",
    nome: "Folheto A5",
    largura: 1748,
    altura: 2480,
    grupo: "impresso",
    ajuda: "Metade do A4, para distribuir. 300 dpi.",
  },
] as const;

export function acharFormato(id: string): Formato | null {
  return FORMATOS.find((f) => f.id === id) ?? null;
}

/**
 * Como o quadro se parece, em três palavras.
 *
 * O template usa isto para escolher a disposição: o que funciona num quadro
 * deitado não funciona num em pé, e adivinhar pela razão exata daria três
 * casos quase iguais espalhados pelo código.
 */
export type Feitio = "deitado" | "quadrado" | "empe";

export function feitioDe(largura: number, altura: number): Feitio {
  const razao = largura / altura;
  if (razao > 1.2) return "deitado";
  if (razao < 0.85) return "empe";
  return "quadrado";
}

/** A margem de segurança, em fração — nada importante encosta na borda. */
export function margemSegura(feitio: Feitio): number {
  // Em pé sobra altura e falta largura; deitado é o contrário. A margem
  // acompanha, senão o texto fica espremido num e perdido no outro.
  return feitio === "empe" ? 0.075 : feitio === "deitado" ? 0.06 : 0.07;
}
