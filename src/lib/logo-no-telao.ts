/**
 * De que tamanho a logo da igreja aparece no telão.
 *
 * Ela ocupava a altura inteira da tela: `max-h-full` numa imagem que o
 * operador subiu com 900px de altura vira um brasão de parede a parede no
 * minuto em que o app abre. A logo é assinatura, não cartaz — ela diz "é
 * aqui", e o resto da tela respira em volta.
 *
 * O tamanho é uma fração da menor dimensão da tela, e não pixels: o mesmo
 * "pequeno" funciona num projetor de 1024 e numa TV de 4K.
 */

export type TamanhoDaLogo = "pequeno" | "medio" | "grande";

export const TAMANHOS_DA_LOGO: readonly TamanhoDaLogo[] = ["pequeno", "medio", "grande"];

export const NOME_DO_TAMANHO: Record<TamanhoDaLogo, string> = {
  pequeno: "Pequena",
  medio: "Média",
  grande: "Grande",
};

/** Fração da menor dimensão da tela que a logo ocupa. */
const FRACAO: Record<TamanhoDaLogo, number> = {
  pequeno: 0.22,
  medio: 0.34,
  grande: 0.5,
};

/** Pequena quando ninguém escolheu — era a queixa, e é o padrão agora. */
export const TAMANHO_PADRAO: TamanhoDaLogo = "pequeno";

export function tamanhoValido(bruto: unknown): TamanhoDaLogo {
  return TAMANHOS_DA_LOGO.includes(bruto as TamanhoDaLogo) ? (bruto as TamanhoDaLogo) : TAMANHO_PADRAO;
}

/**
 * Contra o que a logo é medida.
 *
 * No telão, a tela (`vmin`). Na prévia do diálogo, a caixinha que imita o
 * telão (`cqmin`, a unidade de contêiner): medir a prévia pela janela da
 * cabine daria uma logo do tamanho errado, e a prévia existe justamente
 * para não mentir sobre o tamanho.
 */
export type UnidadeDaLogo = "vmin" | "cqmin";

/** A altura máxima da logo, em unidade CSS que acompanha a tela. */
export function alturaDaLogo(tamanho: unknown, unidade: UnidadeDaLogo = "vmin"): string {
  return `${Math.round(FRACAO[tamanhoValido(tamanho)] * 100)}${unidade}`;
}

/**
 * O corpo do nome debaixo da logo, proporcional a ela.
 *
 * Nome grande debaixo de logo pequena desequilibra: a legenda vira o
 * título. Um quinto da altura da logo mantém a ordem.
 */
export function corpoDoNome(tamanho: unknown, unidade: UnidadeDaLogo = "vmin"): string {
  return `${(FRACAO[tamanhoValido(tamanho)] * 100 * 0.2).toFixed(1)}${unidade}`;
}

/*
  Cor do nome e sombras da logo e do nome, a pedido da igreja: sobre um fundo
  claro, o nome branco sumia; sobre um vídeo movimentado, a logo se perdia.
  A sombra vai de 0 (nenhuma) a 100.
*/

/** A cor do nome da igreja, em #rrggbb; qualquer outra coisa é "a do palco". */
export function corDoNomeValida(bruto: unknown): string | undefined {
  return typeof bruto === "string" && /^#[0-9a-f]{6}$/i.test(bruto) ? bruto.toLowerCase() : undefined;
}

/** A força da sombra, inteira de 0 a 100. Ausente ou estragada é 0. */
export function sombraValida(bruto: unknown): number {
  const n = Number(bruto);
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : 0;
}

/**
 * O filtro de sombra da logo, na unidade da tela (ou da prévia), ou nada.
 * `drop-shadow` segue o desenho da imagem: um brasão de fundo transparente
 * ganha sombra no contorno, não num retângulo em volta.
 */
export function sombraDaLogo(forca: unknown, unidade: UnidadeDaLogo = "vmin"): string | undefined {
  const f = sombraValida(forca) / 100;
  if (f === 0) return undefined;
  const desce = (0.3 + 0.9 * f).toFixed(2);
  const espalha = (0.6 + 2.4 * f).toFixed(2);
  const opaca = (0.35 + 0.55 * f).toFixed(2);
  return `drop-shadow(0 ${desce}${unidade} ${espalha}${unidade} rgba(0, 0, 0, ${opaca}))`;
}

/** A sombra do nome, em `em`: acompanha o corpo do texto no telão e na prévia. */
export function sombraDoNome(forca: unknown): string | undefined {
  const f = sombraValida(forca) / 100;
  if (f === 0) return undefined;
  const desce = (0.02 + 0.08 * f).toFixed(3);
  const espalha = (0.06 + 0.3 * f).toFixed(3);
  const opaca = (0.4 + 0.55 * f).toFixed(2);
  return `0 ${desce}em ${espalha}em rgba(0, 0, 0, ${opaca})`;
}

/** O que fica atrás da logo no telão, escolhido da pasta de mídia. */
export interface FundoDaLogo {
  tipo: "video" | "imagem";
  /** Endereço do arquivo na pasta de mídia, servido pelo protocolo do app. */
  url: string;
  titulo: string;
}

const PASTA_DO_FUNDO: Record<FundoDaLogo["tipo"], string> = { video: "video", imagem: "image" };

/**
 * O fundo da logo, conferido; ou null, que é o fundo do tema.
 *
 * Só vale endereço da pasta de mídia: o fundo viaja no quadro publicado a
 * cada troca de slide, e um vídeo embutido como `data:` ali dentro seriam
 * dezenas de megabytes copiados a cada avanço de verso — a projeção
 * engasgaria no meio do louvor.
 */
export function fundoDaLogoValido(bruto: unknown): FundoDaLogo | null {
  if (!bruto || typeof bruto !== "object") return null;
  const f = bruto as Partial<FundoDaLogo>;
  if (f.tipo !== "video" && f.tipo !== "imagem") return null;
  if (typeof f.url !== "string" || !f.url.startsWith(`lumen://app/__midia/${PASTA_DO_FUNDO[f.tipo]}/`)) return null;
  return { tipo: f.tipo, url: f.url, titulo: typeof f.titulo === "string" ? f.titulo : "" };
}
