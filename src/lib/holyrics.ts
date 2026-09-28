import type { MusicaDoPacote } from "./muf.ts";
import { ehSerializacaoJava, FormatoJavaInvalido, lerSerializacaoJava, type ValorJava } from "./serializacao-java.ts";
import { lerMusicasJson } from "./songs-json.ts";

/**
 * Músicas exportadas do Holyrics.
 *
 * A igreja exportou o repertório do Holyrics em lote para trazer ao Lúmen,
 * e deu erro: o leitor só conhecia o pacote do próprio Lúmen. O Holyrics
 * exporta de quatro jeitos, conferidos com arquivos gravados pelo próprio
 * Holyrics 2.29 (ver amostras-holyrics/):
 *
 * - **.mufl** — "Exportação em lote..." com "Arquivo único": a lista de
 *   músicas gravada pela serialização do Java (ver serializacao-java.ts).
 * - **.json** e **.txt** — as outras opções de exportação, abertas.
 * - **.muf** — uma música por arquivo, cifrado pelo Holyrics. Esse o Lúmen
 *   não abre (quebrar a cifra de outro programa não é o caminho, quando o
 *   próprio Holyrics exporta as mesmas músicas abertas): a mensagem diz
 *   exatamente como exportar do jeito que entra.
 */

/** Onde a música do Holyrics guarda o tom e o copyright (Music.PARAM_*_INDEX). */
const PARAM_TOM = 3;
const PARAM_COPYRIGHT = 6;

export const COMO_EXPORTAR_DO_HOLYRICS =
  "No Holyrics, use a “Exportação em lote...” marcando “Arquivo único”: sai um arquivo .mufl com todas as músicas, e é esse que o Lúmen importa.";

export const MUF_CIFRADO =
  `Este .muf do Holyrics é o de uma música por arquivo, que vem cifrado e só o Holyrics abre. ${COMO_EXPORTAR_DO_HOLYRICS}`;

const NAO_E_DE_NENHUM = `Este arquivo não é um pacote de letras do Lúmen nem uma exportação do Holyrics. ${COMO_EXPORTAR_DO_HOLYRICS}`;

export type LeituraHolyrics = { ok: true; musicas: MusicaDoPacote[] } | { ok: false; erro: string };

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function letraLimpa(v: string): string {
  return v.replace(/\r\n?/g, "\n").trim();
}

/** Uma música do Holyrics (com.limagiran.holyrics.model.Music), ou null se o objeto não for uma. */
function musicaDoObjeto(v: ValorJava): MusicaDoPacote | null {
  if (!v || typeof v !== "object" || Array.isArray(v) || !("extras" in v)) return null;
  const c = v.campos;
  if (!("title" in c) || !("lyrics" in c)) return null;
  const letra = letraLimpa(texto(c.lyrics));
  if (!letra) return null;
  const params = Array.isArray(c.strParams) ? c.strParams : [];
  return {
    titulo: texto(c.title).trim() || "Sem título",
    // "artist" é quem canta; sem ele, quem compôs.
    artista: texto(c.artist).trim() || texto(c.author).trim(),
    tom: texto(params[PARAM_TOM]).trim(),
    copyright: texto(params[PARAM_COPYRIGHT]).trim(),
    letra,
  };
}

/**
 * As músicas de um .mufl, na ordem em que o Holyrics as gravou.
 *
 * Procura pelo que tem cara de música em vez de exigir o caminho exato
 * (ArrayList → Music): uma versão nova do Holyrics que embrulhe a lista em
 * outra coisa continua funcionando.
 */
export function musicasDaSerializacao(bytes: Uint8Array): MusicaDoPacote[] {
  const achadas: MusicaDoPacote[] = [];
  const vistos = new Set<object>();
  const pilha: ValorJava[] = [...lerSerializacaoJava(bytes)].reverse();
  while (pilha.length > 0) {
    const v = pilha.pop();
    if (!v || typeof v !== "object" || vistos.has(v)) continue;
    vistos.add(v);
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i -= 1) pilha.push(v[i]);
      continue;
    }
    const musica = musicaDoObjeto(v);
    if (musica) {
      achadas.push(musica);
      continue;
    }
    if ("extras" in v) {
      const filhos = [...Object.values(v.campos), ...v.extras];
      for (let i = filhos.length - 1; i >= 0; i -= 1) pilha.push(filhos[i]);
    }
  }
  return achadas;
}

/** Rótulos do cabeçalho do .txt do Holyrics, em português, inglês e espanhol. */
const ROTULOS: Record<string, keyof Omit<MusicaDoPacote, "letra">> = {
  titulo: "titulo",
  title: "titulo",
  artista: "artista",
  artist: "artista",
  autor: "artista",
  author: "artista",
  tom: "tom",
  key: "tom",
  tono: "tom",
  copyright: "copyright",
};

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * As músicas do .txt do Holyrics: cada uma com um cabeçalho ("Título:",
 * "Artista:"...), uma linha em branco e a letra; entre elas, uma linha de
 * sinais de igual.
 */
export function musicasDoTxt(conteudo: string, nomeDoArquivo = ""): MusicaDoPacote[] {
  const blocos = conteudo
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n={20,}\n/);
  const musicas: MusicaDoPacote[] = [];
  for (const bloco of blocos) {
    const linhas = bloco.replace(/^\n+/, "").split("\n");
    const m: MusicaDoPacote = { titulo: "", artista: "", tom: "", copyright: "", letra: "" };
    let i = 0;
    for (; i < linhas.length; i += 1) {
      const r = /^([^:]{2,20}):\s*(.*)$/.exec(linhas[i]);
      const campo = r ? ROTULOS[semAcento(r[1].trim())] : undefined;
      if (!r || !campo) break;
      // O primeiro "Autor" não apaga o "Artista" que já veio.
      if (!m[campo]) m[campo] = r[2].trim();
    }
    const letra = letraLimpa(linhas.slice(i).join("\n"));
    if (!letra) continue;
    m.letra = letra;
    m.titulo ||= blocos.length === 1 ? nomeDoArquivo.replace(/\.[^.]+$/, "").trim() : "";
    m.titulo ||= "Sem título";
    musicas.push(m);
  }
  return musicas;
}

/**
 * Lê um arquivo exportado do Holyrics: .mufl, .json ou .txt. O .muf de
 * uma música por arquivo volta com a explicação de como exportar certo.
 */
export function lerArquivoDoHolyrics(bytes: Uint8Array, nome = ""): LeituraHolyrics {
  if (bytes.length === 0) return { ok: false, erro: "O arquivo está vazio." };
  if (ehSerializacaoJava(bytes)) {
    try {
      const musicas = musicasDaSerializacao(bytes);
      if (musicas.length === 0) return { ok: false, erro: "O arquivo do Holyrics não tem nenhuma música com letra." };
      return { ok: true, musicas };
    } catch (e) {
      const motivo = e instanceof FormatoJavaInvalido ? e.message : "formato inesperado";
      return { ok: false, erro: `Não consegui ler este arquivo do Holyrics (${motivo}). ${COMO_EXPORTAR_DO_HOLYRICS}` };
    }
  }
  let conteudo: string;
  try {
    conteudo = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    // Nem Java, nem texto: é o .muf cifrado de uma música só.
    return { ok: false, erro: /\.muf$/i.test(nome) ? MUF_CIFRADO : NAO_E_DE_NENHUM };
  }
  const inicio = conteudo.trimStart()[0];
  if (inicio === "[" || inicio === "{") {
    let dado: unknown;
    try {
      dado = JSON.parse(conteudo);
    } catch {
      return { ok: false, erro: "O arquivo .json está incompleto ou com defeito." };
    }
    const musicas = lerMusicasJson(dado).musicas.map((m) => ({
      titulo: m.titulo,
      artista: m.artista,
      tom: m.tom,
      copyright: m.copyright,
      letra: m.letra,
    }));
    if (musicas.length === 0) return { ok: false, erro: "Nenhuma música com letra foi encontrada no arquivo." };
    return { ok: true, musicas };
  }
  // Texto só vira música quando é o .txt do Holyrics (com o cabeçalho) ou
  // um .txt escolhido de propósito: qualquer texto solto viraria uma música
  // "Sem título" no repertório.
  if (!/^\s*(t[ií]tulo|title)\s*:/i.test(conteudo) && !/\.txt$/i.test(nome)) {
    return { ok: false, erro: NAO_E_DE_NENHUM };
  }
  const musicas = musicasDoTxt(conteudo, nome);
  if (musicas.length === 0) return { ok: false, erro: "Nenhuma música com letra foi encontrada no arquivo." };
  return { ok: true, musicas };
}
