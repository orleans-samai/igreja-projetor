import type { Luminosidade } from "../documento.ts";
import { PARECIDA, contraste, distancia, luminancia, melhorContraste, misturar, saturacao } from "./cores.ts";

/**
 * Paletas: conjuntos de cor com função, não cores soltas.
 *
 * Cada uma diz qual cor é fundo, qual é texto, qual é destaque e o que vai
 * em cima de cada painel — e o teste confere o contraste de cada par. Por
 * isso o gerador nunca sorteia "uma cor de texto": ele escolhe uma paleta,
 * e a legibilidade vem junto.
 *
 * A variedade é de propósito. Fundo preto com dourado é uma paleta entre
 * vinte e tantas, e só aparece quando a categoria pede — igreja não é só
 * vigília.
 */

export interface Paleta {
  id: string;
  nome: string;
  fundo: string;
  /** Segundo tom do fundo: gradiente, faixa, metade da composição. */
  fundo2: string;
  /** Painel e cartão. */
  superficie: string;
  texto: string;
  /** Texto secundário sobre o fundo — ainda lê a 4,5:1. */
  textoSuave: string;
  /** Data, chamada, marcador: salta do fundo a 3:1. */
  destaque: string;
  /** Segundo acento, só para forma — nunca carrega texto. */
  acento: string;
  textoSobreDestaque: string;
  textoSobreSuperficie: string;
  linha: string;
  tags: string[];
  /** Paleta montada a partir das cores da igreja. */
  daMarca?: boolean;
}

export const PALETAS: readonly Paleta[] = [
  // ── claras
  { id: "papel-terracota", nome: "Papel e terracota", fundo: "#f6f1e7", fundo2: "#ece3d2", superficie: "#b8532f", texto: "#221b14", textoSuave: "#5b4d3e", destaque: "#a8462a", acento: "#e3b77a", textoSobreDestaque: "#fff8f0", textoSobreSuperficie: "#fff8f0", linha: "#cbbca4", tags: ["editorial", "caloroso", "ensino", "sobrio"] },
  { id: "salvia-creme", nome: "Sálvia e creme", fundo: "#f3f1e8", fundo2: "#dfe6d6", superficie: "#46604c", texto: "#1d2a21", textoSuave: "#4b5c4f", destaque: "#3f6b4b", acento: "#b9cda8", textoSobreDestaque: "#f6f8f1", textoSobreSuperficie: "#f6f8f1", linha: "#c3ccb8", tags: ["natureza", "suave", "gratidao", "ensino"] },
  { id: "ceu-tangerina", nome: "Céu e tangerina", fundo: "#eaf3fb", fundo2: "#cfe3f4", superficie: "#1f4f82", texto: "#0f2640", textoSuave: "#3b5774", destaque: "#c4541a", acento: "#f4a259", textoSobreDestaque: "#ffffff", textoSobreSuperficie: "#ffffff", linha: "#b3cbe2", tags: ["fresco", "infantil", "familia", "jovem"] },
  { id: "manteiga-anil", nome: "Manteiga e anil", fundo: "#fbf3d6", fundo2: "#f4e3a6", superficie: "#23336e", texto: "#1c2350", textoSuave: "#45497a", destaque: "#2f45a8", acento: "#f0c34a", textoSobreDestaque: "#fffaf0", textoSobreSuperficie: "#fffaf0", linha: "#e2d49c", tags: ["festivo", "infantil", "ensino", "vibrante"] },
  { id: "lilas-ameixa", nome: "Lilás e ameixa", fundo: "#f3eef8", fundo2: "#e2d6ef", superficie: "#4d2a63", texto: "#2a1638", textoSuave: "#5c4870", destaque: "#7b3a8f", acento: "#c8a8e0", textoSobreDestaque: "#fbf6ff", textoSobreSuperficie: "#fbf6ff", linha: "#d3c4e2", tags: ["suave", "mulheres", "editorial"] },
  { id: "branco-vermelho", nome: "Branco e vermelho", fundo: "#fbfaf8", fundo2: "#efece6", superficie: "#c62f2f", texto: "#151515", textoSuave: "#4a4a4a", destaque: "#b72525", acento: "#1f1f1f", textoSobreDestaque: "#ffffff", textoSobreSuperficie: "#ffffff", linha: "#d9d5ce", tags: ["cartaz", "jovem", "vibrante", "institucional"] },
  { id: "areia-oceano", nome: "Areia e oceano", fundo: "#f2ebdd", fundo2: "#e3d6bd", superficie: "#1d5c63", texto: "#1a2b2c", textoSuave: "#4c5a57", destaque: "#1f6a72", acento: "#d99a5b", textoSobreDestaque: "#f5fbfb", textoSobreSuperficie: "#f5fbfb", linha: "#cfc1a5", tags: ["natureza", "batismo", "familia", "sobrio"] },
  { id: "rosa-vinho", nome: "Rosa e vinho", fundo: "#f8ece9", fundo2: "#f0d6d0", superficie: "#6e1f33", texto: "#3b1220", textoSuave: "#6b3f4a", destaque: "#9b2c46", acento: "#e59a92", textoSobreDestaque: "#fff5f6", textoSobreSuperficie: "#fff5f6", linha: "#e3c4bd", tags: ["mulheres", "casais", "caloroso", "suave"] },
  { id: "menta-grafite", nome: "Menta e grafite", fundo: "#e9f4ef", fundo2: "#cfe7dc", superficie: "#26312d", texto: "#17201c", textoSuave: "#435049", destaque: "#1d7a57", acento: "#8fd1b3", textoSobreDestaque: "#f2fbf7", textoSobreSuperficie: "#f2fbf7", linha: "#b7d6c8", tags: ["fresco", "jovem", "institucional", "ensino"] },
  { id: "cinza-cobalto", nome: "Cinza e cobalto", fundo: "#f1f2f4", fundo2: "#e1e4e9", superficie: "#1f3fbf", texto: "#12151c", textoSuave: "#4a505c", destaque: "#1f3fbf", acento: "#ffb020", textoSobreDestaque: "#ffffff", textoSobreSuperficie: "#ffffff", linha: "#cfd3da", tags: ["institucional", "editorial", "sobrio"] },

  // ── intermediárias: fundo em meio-tom, texto só onde contrasta
  { id: "terracota-cheia", nome: "Terracota", fundo: "#b0552f", fundo2: "#9f4a2b", superficie: "#f6ead9", texto: "#fff7ee", textoSuave: "#fff1e2", destaque: "#2b1a12", acento: "#f2b77c", textoSobreDestaque: "#fff7ee", textoSobreSuperficie: "#2b1a12", linha: "#e89b76", tags: ["caloroso", "gratidao", "festivo", "editorial"] },
  { id: "salvia-cheia", nome: "Sálvia", fundo: "#7d9a82", fundo2: "#6b8a71", superficie: "#f3f1e6", texto: "#0f1c13", textoSuave: "#1c2d21", destaque: "#1f3326", acento: "#dfe8d6", textoSobreDestaque: "#f3f1e6", textoSobreSuperficie: "#1c2a20", linha: "#9db3a1", tags: ["natureza", "gratidao", "suave", "ensino"] },
  { id: "azul-medio", nome: "Azul sereno", fundo: "#3f6fb0", fundo2: "#335f9d", superficie: "#f4f7fc", texto: "#ffffff", textoSuave: "#eef3fb", destaque: "#ffd166", acento: "#9cc0ec", textoSobreDestaque: "#1b2a44", textoSobreSuperficie: "#1b2d4d", linha: "#7ea2d4", tags: ["fresco", "institucional", "familia", "batismo"] },
  { id: "mostarda-cheia", nome: "Mostarda", fundo: "#e2b33f", fundo2: "#d6a22c", superficie: "#1f2a44", texto: "#1b1a14", textoSuave: "#2e2a1c", destaque: "#1f2a44", acento: "#f6dd96", textoSobreDestaque: "#fdf6e3", textoSobreSuperficie: "#fdf6e3", linha: "#c99b2a", tags: ["festivo", "jovem", "infantil", "vibrante"] },
  { id: "coral-cheio", nome: "Coral", fundo: "#e8735f", fundo2: "#dc604b", superficie: "#fff4ee", texto: "#1f0e0a", textoSuave: "#2e1813", destaque: "#3a1710", acento: "#ffc2a8", textoSobreDestaque: "#fff4ee", textoSobreSuperficie: "#3a1710", linha: "#f19f8f", tags: ["jovem", "festivo", "mulheres", "vibrante"] },
  { id: "lavanda-cheia", nome: "Lavanda", fundo: "#9b87c9", fundo2: "#8a74bd", superficie: "#fbf8ff", texto: "#160d2b", textoSuave: "#241838", destaque: "#231640", acento: "#d4c8f0", textoSobreDestaque: "#fbf8ff", textoSobreSuperficie: "#2a1a4d", linha: "#b6a6dc", tags: ["suave", "mulheres", "jovem"] },

  // ── escuras
  { id: "noite-coral", nome: "Noite e coral", fundo: "#141a2e", fundo2: "#1f2847", superficie: "#26315a", texto: "#f4f5fb", textoSuave: "#c3c8dc", destaque: "#ff8a6b", acento: "#6c7bd9", textoSobreDestaque: "#1a0f0a", textoSobreSuperficie: "#f4f5fb", linha: "#34406b", tags: ["jovem", "noturno", "vibrante", "cartaz"] },
  { id: "floresta-menta", nome: "Floresta", fundo: "#10261d", fundo2: "#18362a", superficie: "#1e4334", texto: "#eef7f1", textoSuave: "#b9d3c4", destaque: "#8fe0b0", acento: "#e8c97a", textoSobreDestaque: "#0d2118", textoSobreSuperficie: "#eef7f1", linha: "#2a5442", tags: ["natureza", "gratidao", "sobrio"] },
  { id: "petroleo-pessego", nome: "Petróleo e pêssego", fundo: "#0f2e33", fundo2: "#164047", superficie: "#1c4e55", texto: "#f1f8f7", textoSuave: "#b9d6d4", destaque: "#ffb38a", acento: "#5fb8b0", textoSobreDestaque: "#2a1308", textoSobreSuperficie: "#f1f8f7", linha: "#2b5f66", tags: ["sobrio", "batismo", "editorial", "casais"] },
  { id: "vinho-rose", nome: "Vinho", fundo: "#2b0f1b", fundo2: "#43182b", superficie: "#521d35", texto: "#fcf0f4", textoSuave: "#e0bfcb", destaque: "#f29bb4", acento: "#c9636f", textoSobreDestaque: "#2b0f1b", textoSobreSuperficie: "#fcf0f4", linha: "#5e2a40", tags: ["ceia", "mulheres", "casais", "noturno"] },
  { id: "grafite-lima", nome: "Grafite e lima", fundo: "#17181b", fundo2: "#222429", superficie: "#2c2f35", texto: "#f5f6f7", textoSuave: "#c3c6cc", destaque: "#c8f169", acento: "#6b7280", textoSobreDestaque: "#17181b", textoSobreSuperficie: "#f5f6f7", linha: "#393c43", tags: ["jovem", "cartaz", "vibrante", "noturno"] },
  { id: "marinho-areia", nome: "Marinho e areia", fundo: "#101c33", fundo2: "#18294a", superficie: "#f2e6cf", texto: "#f3f5fa", textoSuave: "#c5cde0", destaque: "#e9c98f", acento: "#3d5a8c", textoSobreDestaque: "#1a1a24", textoSobreSuperficie: "#141c30", linha: "#2c3d61", tags: ["institucional", "sobrio", "ensino", "editorial"] },
  { id: "ameixa-mostarda", nome: "Ameixa e mostarda", fundo: "#26122f", fundo2: "#3a1b47", superficie: "#4a2559", texto: "#f8f1fb", textoSuave: "#d8c4e0", destaque: "#f2c14e", acento: "#b06fc9", textoSobreDestaque: "#26122f", textoSobreSuperficie: "#f8f1fb", linha: "#4c2a5c", tags: ["festivo", "jovem", "vibrante"] },
  { id: "carvao-ouro", nome: "Carvão e ouro", fundo: "#151412", fundo2: "#221f1b", superficie: "#2b2722", texto: "#f7f3ea", textoSuave: "#cfc6b5", destaque: "#d9b25f", acento: "#8a7650", textoSobreDestaque: "#1a1510", textoSobreSuperficie: "#f7f3ea", linha: "#3a342c", tags: ["noturno", "sobrio", "ceia", "vigilia"] },
];

export function luminosidadeDe(p: Paleta): Luminosidade {
  const l = luminancia(p.fundo);
  // Meio-tom é estreito de propósito: acima de 0,55 o texto escuro já lê
  // folgado, abaixo de 0,14 o fundo é escuro para qualquer olho.
  return l > 0.55 ? "clara" : l > 0.14 ? "media" : "escura";
}

/** A paleta contém uma cor parecida com esta? */
export function temCorParecida(p: Paleta, cor: string, limite = PARECIDA): boolean {
  return coresDa(p).some((c) => distancia(c, cor) < limite);
}

export function coresDa(p: Paleta): string[] {
  return [p.fundo, p.fundo2, p.superficie, p.texto, p.textoSuave, p.destaque, p.acento, p.textoSobreDestaque, p.textoSobreSuperficie];
}

export interface ProblemaDePaleta {
  par: string;
  contraste: number;
  minimo: number;
}

/**
 * Os pares de cor que carregam texto, e o mínimo de cada um. É isto que o
 * teste percorre em todas as paletas — inclusive as montadas da marca.
 */
export function conferirPaleta(p: Paleta): ProblemaDePaleta[] {
  const pares: [string, string, string, number][] = [
    ["texto/fundo", p.texto, p.fundo, 4.5],
    ["texto/fundo2", p.texto, p.fundo2, 4.5],
    ["textoSuave/fundo", p.textoSuave, p.fundo, 4.5],
    ["destaque/fundo", p.destaque, p.fundo, 3],
    ["textoSobreDestaque/destaque", p.textoSobreDestaque, p.destaque, 4.5],
    ["textoSobreSuperficie/superficie", p.textoSobreSuperficie, p.superficie, 4.5],
  ];
  return pares
    .map(([par, a, b, minimo]) => ({ par, contraste: contraste(a, b), minimo }))
    .filter((x) => x.contraste < x.minimo);
}

const QUASE_PRETO = "#141414";
const QUASE_BRANCO = "#fbfaf7";

/** Escurece ou clareia até o contraste pedido, sem mudar de matiz. */
function ateContrastar(cor: string, fundo: string, minimo: number): string {
  if (contraste(cor, fundo) >= minimo) return cor;
  const alvo = luminancia(fundo) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const c = misturar(cor, alvo, t);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return alvo;
}

/**
 * A cor que vai carregar texto por cima: anda um pouco para o escuro (ou
 * para o claro) até branco ou preto lerem a 4,5:1. Meio-tom puro — o
 * vermelho de muita logo de igreja — não lê bem com nenhum dos dois.
 */
function paraCarregarTexto(cor: string, preferir?: string): { cor: string; texto: string } {
  let atual = cor;
  for (let i = 0; i < 14; i++) {
    // Com `preferir`, o texto é fixo e só a cor anda: no fundo escuro, o
    // destaque tem de clarear — escurecer para o branco ler o afundaria de
    // volta no fundo.
    const texto = preferir ?? melhorContraste(atual, [QUASE_BRANCO, QUASE_PRETO]);
    if (contraste(texto, atual) >= 4.6) return { cor: atual, texto };
    atual = misturar(atual, texto === QUASE_BRANCO ? "#000000" : "#ffffff", 0.06);
  }
  return { cor: atual, texto: melhorContraste(atual, [QUASE_BRANCO, QUASE_PRETO]) };
}

/**
 * Paletas feitas com as cores da igreja.
 *
 * Três leituras da mesma marca — clara, na cor cheia e escura — e cada cor
 * de texto é empurrada até contrastar, sem trocar de matiz. A que não passa
 * na conferência fica de fora: marca ilegível não ajuda ninguém.
 */
export function paletasDaMarca(cores: string[]): Paleta[] {
  return montarPaletasDaMarca(cores).filter((p) => conferirPaleta(p).length === 0);
}

/** As três leituras, antes da conferência — o teste olha as reprovadas. */
export function montarPaletasDaMarca(cores: string[]): Paleta[] {
  const marcantes = cores.filter(Boolean);
  if (marcantes.length === 0) return [];
  const principal = marcantes.reduce((a, b) => (saturacao(b) > saturacao(a) ? b : a), marcantes[0]);
  const segunda = marcantes.find((c) => c !== principal) ?? misturar(principal, "#ffffff", 0.55);
  const candidatas: Paleta[] = [];

  // Clara: um véu da cor no papel, a cor inteira no destaque.
  {
    const fundo = misturar(principal, "#ffffff", 0.9);
    const fundo2 = misturar(principal, "#ffffff", 0.78);
    const texto = ateContrastar(misturar(principal, "#000000", 0.78), fundo2, 4.5);
    const sup = paraCarregarTexto(principal);
    const dst = paraCarregarTexto(ateContrastar(principal, fundo, 3));
    candidatas.push({
      id: "marca-clara",
      nome: "Cores da igreja, claro",
      fundo,
      fundo2,
      superficie: sup.cor,
      texto,
      textoSuave: ateContrastar(misturar(principal, "#000000", 0.6), fundo, 4.5),
      destaque: ateContrastar(dst.cor, fundo, 3),
      acento: segunda,
      textoSobreDestaque: dst.texto,
      textoSobreSuperficie: sup.texto,
      linha: misturar(principal, "#ffffff", 0.6),
      tags: ["marca"],
      daMarca: true,
    });
  }
  // Cheia: a cor da igreja é o fundo.
  {
    // A cor cheia raramente lê a 4,5:1 com branco ou preto; o fundo anda
    // um pouco na direção oposta ao texto até ler, e continua sendo a cor
    // da igreja — só mais funda ou mais clara.
    const texto = melhorContraste(principal, [QUASE_BRANCO, QUASE_PRETO]);
    const direcao = texto === QUASE_BRANCO ? "#000000" : "#ffffff";
    let fundo = principal;
    for (let i = 0; i < 12 && contraste(texto, fundo) < 4.6; i++) fundo = misturar(fundo, direcao, 0.07);
    const fundo2 = misturar(fundo, direcao, 0.1);
    const superficie = misturar(principal, "#ffffff", 0.9);
    const dst = paraCarregarTexto(ateContrastar(segunda, fundo, 3));
    const destaque = ateContrastar(dst.cor, fundo, 3);
    candidatas.push({
      id: "marca-cheia",
      nome: "Cores da igreja",
      fundo,
      fundo2,
      superficie,
      texto,
      textoSuave: texto,
      destaque,
      acento: misturar(principal, "#ffffff", 0.35),
      textoSobreDestaque: dst.texto,
      textoSobreSuperficie: ateContrastar(misturar(principal, "#000000", 0.7), superficie, 4.5),
      linha: misturar(principal, texto, 0.35),
      tags: ["marca"],
      daMarca: true,
    });
  }
  // Escura: a cor da igreja afundada, a segunda cor acendendo.
  {
    const fundo = misturar(principal, "#000000", 0.78);
    const fundo2 = misturar(principal, "#000000", 0.68);
    const sup = paraCarregarTexto(misturar(principal, "#000000", 0.55));
    const dst = paraCarregarTexto(ateContrastar(misturar(segunda, "#ffffff", 0.15), fundo2, 3), QUASE_PRETO);
    const superficie = sup.cor;
    const destaque = dst.cor;
    candidatas.push({
      id: "marca-escura",
      nome: "Cores da igreja, escuro",
      fundo,
      fundo2,
      superficie,
      texto: QUASE_BRANCO,
      textoSuave: ateContrastar(misturar(principal, "#ffffff", 0.75), fundo2, 4.5),
      destaque,
      acento: principal,
      textoSobreDestaque: dst.texto,
      textoSobreSuperficie: sup.texto,
      linha: misturar(principal, "#000000", 0.45),
      tags: ["marca"],
      daMarca: true,
    });
  }
  return candidatas;
}

export function acharPaleta(id: string, extras: Paleta[] = []): Paleta | null {
  return [...PALETAS, ...extras].find((p) => p.id === id) ?? null;
}
