/**
 * A logo da igreja, do tamanho certo para viajar.
 *
 * Ela não fica só num canto da cabine: vai dentro do quadro publicado a cada
 * troca de slide, para o projetor e para o palco. Uma foto de 4000px salva
 * como texto base64 são vários megabytes copiados a cada avanço de verso —
 * num PC de igreja isso aparece como engasgo na projeção.
 *
 * Por isso a imagem escolhida é reduzida antes de ser guardada. 640px de
 * maior lado cobre um telão de 1920 com folga, porque a logo nunca ocupa a
 * tela inteira.
 */
export const LADO_MAX_LOGO = 640;

/** Acima disto a imagem é recusada antes mesmo de ser lida. */
export const PESO_MAX_BYTES = 12 * 1024 * 1024;

export const TIPOS_ACEITOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export function ehImagemAceita(tipo: string | undefined): boolean {
  return TIPOS_ACEITOS.includes(String(tipo || "").toLowerCase());
}

/**
 * SVG não é reduzido: é desenho, não foto.
 *
 * Rasterizar um SVG para caber em 640px jogaria fora justamente o que ele tem
 * de melhor — e ele já costuma pesar menos que o JPEG equivalente.
 */
export function ehVetor(tipo: string | undefined): boolean {
  return String(tipo || "").toLowerCase() === "image/svg+xml";
}

/**
 * O tamanho que a imagem terá depois de caber no quadrado de `lado`.
 *
 * Nunca aumenta: uma logo pequena esticada para 640px só ficaria borrada e
 * mais pesada. Nunca devolve zero, senão o canvas se recusa a desenhar.
 */
export function caberEm(
  largura: number,
  altura: number,
  lado: number = LADO_MAX_LOGO,
): { largura: number; altura: number } {
  const l = Math.floor(largura);
  const a = Math.floor(altura);
  if (!Number.isFinite(l) || !Number.isFinite(a) || l <= 0 || a <= 0) {
    return { largura: 0, altura: 0 };
  }
  if (l <= lado && a <= lado) return { largura: l, altura: a };
  const fator = lado / Math.max(l, a);
  return {
    largura: Math.max(1, Math.round(l * fator)),
    altura: Math.max(1, Math.round(a * fator)),
  };
}

/** Quanto pesa o que está guardado, em palavras que o operador entende. */
export function pesoLegivel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Quanto ocupa um endereço `data:` — o que é guardado, não o arquivo de
 * origem. Base64 engorda o original em cerca de um terço, e é o valor
 * engordado que viaja no quadro.
 */
export function pesoDoDataUrl(url: string | undefined): number {
  if (!url) return 0;
  const virgula = url.indexOf(",");
  if (!url.startsWith("data:") || virgula < 0) return url.length;
  const corpo = url.length - virgula - 1;
  if (!url.slice(0, virgula).includes(";base64")) return corpo;
  const enchimento = url.endsWith("==") ? 2 : url.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((corpo * 3) / 4) - enchimento);
}
