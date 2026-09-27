/**
 * O ZIP de um PowerPoint, aberto na janela.
 *
 * Um .pptx é um ZIP com XML e imagens dentro. O arquivo vem da rede, da
 * página do dirigente: todo tamanho e todo deslocamento é conferido antes
 * de ser usado, e há teto para o que se descompacta — um ZIP de 1 MB que se
 * expande em 10 GB é um ataque antigo, e o PC que projeta o culto não é o
 * lugar para descobrir isso. Só se descompacta a parte que o desenho pede,
 * na hora em que pede.
 */

export class ArquivoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ArquivoInvalido";
  }
}

/** Teto para uma parte descompactada. Slide não tem 200 MB. */
const MAX_ENTRADA = 200 * 1024 * 1024;
/** Teto para tudo o que se descompacta de um arquivo. */
const MAX_TOTAL = 512 * 1024 * 1024;

interface Entrada {
  metodo: number;
  compactado: number;
  cheio: number;
  local: number;
}

export interface Pacote {
  tem(caminho: string): boolean;
  bytes(caminho: string): Promise<Uint8Array | null>;
  texto(caminho: string): Promise<string | null>;
}

/**
 * O índice do ZIP: nome → onde está e como está guardado.
 *
 * Vem do diretório central, no fim do arquivo, e não dos cabeçalhos do
 * começo: é o índice em que o próprio formato manda confiar, e o que
 * resiste a um arquivo com lixo no meio.
 */
function indiceDoZip(buf: Uint8Array): Map<string, Entrada> {
  if (buf.length < 22) throw new ArquivoInvalido("Arquivo vazio ou cortado.");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fim = -1;
  const limite = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= limite; i -= 1) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new ArquivoInvalido("Isto não é um arquivo do PowerPoint.");
  const total = dv.getUint16(fim + 10, true);
  const tamanhoDir = dv.getUint32(fim + 12, true);
  const inicioDir = dv.getUint32(fim + 16, true);
  if (inicioDir === 0xffffffff || tamanhoDir === 0xffffffff) {
    throw new ArquivoInvalido("Arquivo grande demais para abrir aqui (ZIP64).");
  }
  if (inicioDir + tamanhoDir > buf.length) throw new ArquivoInvalido("Arquivo cortado.");

  const nomes = new TextDecoder("utf-8");
  const entradas = new Map<string, Entrada>();
  let p = inicioDir;
  for (let n = 0; n < total; n += 1) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new ArquivoInvalido("Índice do arquivo corrompido.");
    }
    const lenNome = dv.getUint16(p + 28, true);
    const lenExtra = dv.getUint16(p + 30, true);
    const lenComentario = dv.getUint16(p + 32, true);
    if (p + 46 + lenNome > buf.length) throw new ArquivoInvalido("Índice do arquivo corrompido.");
    entradas.set(nomes.decode(buf.subarray(p + 46, p + 46 + lenNome)), {
      metodo: dv.getUint16(p + 10, true),
      compactado: dv.getUint32(p + 20, true),
      cheio: dv.getUint32(p + 24, true),
      local: dv.getUint32(p + 42, true),
    });
    p += 46 + lenNome + lenExtra + lenComentario;
  }
  return entradas;
}

/**
 * Descompacta até `limite` bytes. O teto é de quem descompacta, não do
 * tamanho que o índice declara: um índice mentiroso para aqui.
 */
async function inflar(dados: Uint8Array, limite: number): Promise<Uint8Array> {
  const fluxo = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(dados);
      c.close();
    },
  }).pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const leitor = fluxo.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.length;
      if (total > limite) {
        await leitor.cancel().catch(() => {});
        throw new ArquivoInvalido("Uma parte do arquivo se expande demais.");
      }
      pedacos.push(value);
    }
  } catch (erro) {
    if (erro instanceof ArquivoInvalido) throw erro;
    throw new ArquivoInvalido("Uma parte do arquivo está corrompida.");
  }
  const saida = new Uint8Array(total);
  let p = 0;
  for (const pedaco of pedacos) {
    saida.set(pedaco, p);
    p += pedaco.length;
  }
  return saida;
}

export function abrirZip(buf: Uint8Array): Pacote {
  const indice = indiceDoZip(buf);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let usado = 0;
  const texto = new TextDecoder("utf-8");

  const bytes = async (caminho: string): Promise<Uint8Array | null> => {
    const e = indice.get(caminho);
    if (!e) return null;
    if (e.local + 30 > buf.length || dv.getUint32(e.local, true) !== 0x04034b50) {
      throw new ArquivoInvalido("Parte do arquivo corrompida.");
    }
    // O cabeçalho local tem os próprios tamanhos de nome e extra, que podem
    // diferir dos do índice central. É o local que diz onde os dados começam.
    const dados = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
    if (dados + e.compactado > buf.length) throw new ArquivoInvalido("Parte do arquivo cortada.");
    if (e.cheio > MAX_ENTRADA) throw new ArquivoInvalido("Uma parte do arquivo é grande demais.");
    if (usado + e.cheio > MAX_TOTAL) throw new ArquivoInvalido("O arquivo se expande demais.");
    const bruto = buf.subarray(dados, dados + e.compactado);
    let saida: Uint8Array;
    if (e.metodo === 0) saida = bruto.slice();
    else if (e.metodo === 8) saida = await inflar(bruto, Math.min(MAX_ENTRADA, Math.max(e.cheio, 1) + 1024));
    else throw new ArquivoInvalido("Compressão que o Lúmen não conhece.");
    usado += saida.length;
    if (usado > MAX_TOTAL) throw new ArquivoInvalido("O arquivo se expande demais.");
    return saida;
  };

  return {
    tem: (caminho) => indice.has(caminho),
    bytes,
    async texto(caminho) {
      // O TextDecoder já descarta o BOM que alguns geradores gravam.
      const b = await bytes(caminho);
      return b ? texto.decode(b) : null;
    },
  };
}
