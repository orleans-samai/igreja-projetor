/**
 * Pacote .muf — repertório em lote.
 *
 * Serve para levar dezenas de louvores de uma vez: de um computador para
 * outro, de uma igreja para outra, ou de um backup para a máquina nova da
 * cabine. Um arquivo, comprimido, sem mídia — só letra.
 *
 * O conteúdo é JSON compactado com gzip. Gzip porque é nativo no navegador e
 * no Node, sem dependência nova para instalar e sem formato binário próprio
 * para manter: um hinário inteiro cabe numa fração do tamanho, e qualquer
 * ferramenta comum consegue abrir se um dia for preciso inspecionar.
 *
 * A leitura é deliberadamente tolerante. Um arquivo que chega de fora pode
 * vir sem compressão, ou como uma lista solta de músicas, e recusar por
 * causa do invólucro seria recusar por burocracia.
 */

export const FORMATO = "lumen-muf-v1";

export interface MusicaDoPacote {
  titulo: string;
  artista: string;
  tom: string;
  copyright: string;
  letra: string;
}

export interface Pacote {
  format: string;
  geradoEm: number;
  musicas: MusicaDoPacote[];
}

/** Limite de sanidade: um hinário grande tem centenas, não milhões. */
const MAX_MUSICAS = 20_000;
const MAX_BYTES = 64 * 1024 * 1024;

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Aceita o que se parecer com música.
 *
 * Sem letra não há o que projetar, então essas caem. Sem título, a música
 * ganha um nome em vez de ser descartada: perder um louvor por causa de um
 * campo vazio seria pior que importá-lo com o nome errado, que o operador
 * conserta em dois cliques.
 */
function normalizar(bruto: unknown): MusicaDoPacote | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  // Nomes alternativos: pacote alheio raramente usa os nossos.
  const letra = texto(o.letra || o.lyricsRaw || o.lyrics || o.texto || o.body).trim();
  if (!letra) return null;
  const titulo = texto(o.titulo || o.title || o.nome || o.name).trim();
  return {
    titulo: titulo || "Sem título",
    artista: texto(o.artista || o.artist || o.autor || o.author).trim(),
    tom: texto(o.tom || o.key).trim(),
    copyright: texto(o.copyright || o.credito).trim(),
    letra,
  };
}

/** Monta o pacote a partir das músicas do repertório. */
export function montarPacote(musicas: MusicaDoPacote[]): Pacote {
  return { format: FORMATO, geradoEm: Date.now(), musicas };
}

/** Encontra a lista de músicas, venha ela dentro do envelope ou solta. */
export function extrairMusicas(dado: unknown): MusicaDoPacote[] {
  const lista = Array.isArray(dado)
    ? dado
    : dado && typeof dado === "object"
      ? ((dado as Record<string, unknown>).musicas ??
        (dado as Record<string, unknown>).songs ??
        (dado as Record<string, unknown>).items)
      : null;
  if (!Array.isArray(lista)) return [];
  const saida: MusicaDoPacote[] = [];
  for (const item of lista.slice(0, MAX_MUSICAS)) {
    const m = normalizar(item);
    if (m) saida.push(m);
  }
  return saida;
}

async function comprimir(texto: string): Promise<Uint8Array> {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function descomprimir(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Escreve o .muf: JSON do pacote, comprimido. */
export async function escreverMuf(musicas: MusicaDoPacote[]): Promise<Uint8Array> {
  return comprimir(JSON.stringify(montarPacote(musicas)));
}

export type LeituraMuf =
  | { ok: true; musicas: MusicaDoPacote[] }
  | { ok: false; erro: string };

/**
 * Lê o .muf.
 *
 * Tenta descomprimir; se o arquivo não estiver comprimido, lê como texto. O
 * gzip começa sempre com 0x1f 0x8b, então dá para saber antes de tentar em
 * vez de depender de a exceção acontecer.
 */
export async function lerMuf(bytes: Uint8Array): Promise<LeituraMuf> {
  if (bytes.length === 0) return { ok: false, erro: "O arquivo está vazio." };
  if (bytes.length > MAX_BYTES) {
    return { ok: false, erro: "O arquivo é grande demais para um pacote de letras." };
  }
  let cru: string;
  try {
    const ehGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    cru = ehGzip ? await descomprimir(bytes) : new TextDecoder().decode(bytes);
  } catch {
    return { ok: false, erro: "Não foi possível descompactar este arquivo." };
  }

  let dado: unknown;
  try {
    dado = JSON.parse(cru);
  } catch {
    return {
      ok: false,
      erro: "Este arquivo não é um pacote de letras do Lúmen.",
    };
  }

  const musicas = extrairMusicas(dado);
  if (musicas.length === 0) {
    return { ok: false, erro: "Nenhuma música com letra foi encontrada no arquivo." };
  }
  return { ok: true, musicas };
}
