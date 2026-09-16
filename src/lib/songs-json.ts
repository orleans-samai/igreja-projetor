/**
 * Importação de músicas em JSON.
 *
 * Existe porque repertório vem de todo lado: de um hinário que alguém montou
 * numa planilha, de outro projetor, de um script caseiro. Cada um chama os
 * campos do seu jeito, e recusar por causa do nome do campo seria recusar
 * material que está bom.
 *
 * Então a leitura tem duas camadas de propósito:
 *
 *   validar     — o que falta para isto ser uma música projetável?
 *   normalizar  — como transformar o que chegou no formato do Lúmen?
 *
 * A camada de nomes alternativos fica num mapa só (CAMPOS), para o dia em que
 * o padrão mudar: mexe ali, e não em quem chama.
 *
 * Erro numa música não derruba as outras. O relatório diz qual música, qual
 * campo e por quê — importar 40 de 42 e saber quais duas faltaram é muito
 * melhor que recusar o arquivo inteiro.
 */

import { nid } from "./fold.ts";
import { parseLyrics } from "./lyrics.ts";
import type { Song } from "./types.ts";

/** Limite de sanidade: um hinário grande tem centenas, não milhões. */
const MAX_MUSICAS = 20_000;

/** Nome no Lúmen → nomes que já vimos por aí. */
const CAMPOS = {
  titulo: ["titulo", "título", "title", "nome", "name", "cantico", "cântico"],
  artista: ["artista", "autor", "artist", "author", "compositor", "interprete", "intérprete"],
  tom: ["tom", "key", "tonalidade"],
  copyright: ["copyright", "credito", "crédito", "creditos", "créditos", "licenca", "licença"],
  letra: ["letra", "lyrics", "lyricsraw", "texto", "body", "conteudo", "conteúdo"],
  estrofes: ["estrofes", "versos", "verses", "stanzas", "strofes", "partes"],
  refrao: ["refrao", "refrão", "coro", "chorus", "estribilho"],
  ponte: ["ponte", "bridge"],
} as const;

type Campo = keyof typeof CAMPOS;

function pegar(o: Record<string, unknown>, campo: Campo): unknown {
  for (const alias of CAMPOS[campo]) {
    for (const chave of Object.keys(o)) {
      if (chave.toLowerCase().trim() === alias) {
        const v = o[chave];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
  }
  return undefined;
}

function texto(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/**
 * Uma estrofe pode chegar como texto, como lista de linhas, ou como objeto
 * com rótulo — `{ "rotulo": "Verso 1", "texto": "..." }`. Todas viram bloco.
 */
function bloco(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map((l) => bloco(l)).filter(Boolean).join("\n");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const corpo = bloco(pegar(o, "letra") ?? o.texto ?? o.text ?? o.linhas ?? o.lines);
    const rotulo = texto(o.rotulo ?? o.rótulo ?? o.label ?? o.tipo ?? o.type).trim();
    if (!corpo) return "";
    return rotulo ? `[${rotulo}]\n${corpo}` : corpo;
  }
  return "";
}

/**
 * Monta a letra no formato do Lúmen: linha em branco separa slide, e
 * `[Coro]` / `[Ponte]` viram rótulo de slide (ver parseLyrics).
 */
function montarLetra(o: Record<string, unknown>): string {
  const direta = texto(pegar(o, "letra")).trim();
  if (direta) return direta;

  const partes: string[] = [];
  const estrofes = pegar(o, "estrofes");
  const lista = Array.isArray(estrofes) ? estrofes : estrofes ? [estrofes] : [];
  lista.forEach((estrofe, i) => {
    const corpo = bloco(estrofe);
    if (!corpo) return;
    // Só rotula quando o próprio dado não trouxe rótulo, para não duplicar.
    partes.push(corpo.startsWith("[") ? corpo : `[Verso ${i + 1}]\n${corpo}`);
  });

  const refrao = bloco(pegar(o, "refrao"));
  // O refrão entra depois da primeira estrofe, que é como se canta.
  if (refrao) {
    const texto = refrao.startsWith("[") ? refrao : `[Coro]\n${refrao}`;
    partes.splice(Math.min(1, partes.length), 0, texto);
  }

  const ponte = bloco(pegar(o, "ponte"));
  if (ponte) partes.push(ponte.startsWith("[") ? ponte : `[Ponte]\n${ponte}`);

  return partes.join("\n\n").trim();
}

export interface MusicaLida {
  titulo: string;
  artista: string;
  tom: string;
  copyright: string;
  letra: string;
}

export interface FalhaDeMusica {
  /** Como identificar a música no relatório: título, ou a posição no arquivo. */
  onde: string;
  campo: string;
  motivo: string;
}

export interface RelatorioJson {
  musicas: MusicaLida[];
  falhas: FalhaDeMusica[];
}

/** Valida e normaliza uma entrada. Devolve a música ou o porquê de não dar. */
export function lerMusica(bruto: unknown, posicao: number): MusicaLida | FalhaDeMusica {
  const onde = `música ${posicao + 1}`;
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { onde, campo: "(registro)", motivo: "não é um objeto de música" };
  }
  const o = bruto as Record<string, unknown>;
  const titulo = texto(pegar(o, "titulo")).trim();
  const letra = montarLetra(o);
  const identidade = titulo ? `“${titulo}”` : onde;

  if (!letra) {
    return {
      onde: identidade,
      campo: "letra / estrofes",
      motivo: "sem nada para projetar — faltou letra, estrofes, refrão ou ponte",
    };
  }
  return {
    // Sem título a música ainda serve: o operador renomeia em dois cliques,
    // e perder o louvor por causa de um campo vazio seria pior.
    titulo: titulo || "Sem título",
    artista: texto(pegar(o, "artista")).trim(),
    tom: texto(pegar(o, "tom")).trim(),
    copyright: texto(pegar(o, "copyright")).trim(),
    letra,
  };
}

function ehFalha(v: MusicaLida | FalhaDeMusica): v is FalhaDeMusica {
  return "motivo" in v;
}

/**
 * Encontra as músicas, venham elas soltas, numa lista, ou dentro de um
 * envelope — e aceita também um arquivo com uma única música.
 */
export function lerMusicasJson(dado: unknown): RelatorioJson {
  const envelope =
    dado && typeof dado === "object" && !Array.isArray(dado)
      ? ((dado as Record<string, unknown>).musicas ??
        (dado as Record<string, unknown>).músicas ??
        (dado as Record<string, unknown>).songs ??
        (dado as Record<string, unknown>).items ??
        (dado as Record<string, unknown>).repertorio ??
        (dado as Record<string, unknown>).lista)
      : null;

  const lista = Array.isArray(dado)
    ? dado
    : Array.isArray(envelope)
      ? envelope
      : dado && typeof dado === "object"
        ? [dado] // uma música sozinha no arquivo
        : [];

  const musicas: MusicaLida[] = [];
  const falhas: FalhaDeMusica[] = [];
  lista.slice(0, MAX_MUSICAS).forEach((item, i) => {
    const r = lerMusica(item, i);
    if (ehFalha(r)) falhas.push(r);
    else musicas.push(r);
  });
  return { musicas, falhas };
}

/** Chave de duplicata: título e artista, sem acento, caixa ou espaço a mais. */
export function chaveDeMusica(titulo: string, artista: string): string {
  const limpar = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  return `${limpar(titulo)}|${limpar(artista)}`;
}

export interface ResultadoImportacao {
  novas: Song[];
  duplicadas: MusicaLida[];
  falhas: FalhaDeMusica[];
}

/**
 * Transforma o que foi lido em músicas do repertório, deixando de fora o que
 * já existe. Duplicata aqui é acidente de importar o mesmo arquivo duas
 * vezes, não escolha — por isso o padrão é pular e contar quantas pulou.
 */
export function prepararImportacao(
  relatorio: RelatorioJson,
  existentes: Song[],
  groupId: string,
): ResultadoImportacao {
  const jaTem = new Set(existentes.map((s) => chaveDeMusica(s.title, s.artist)));
  const novas: Song[] = [];
  const duplicadas: MusicaLida[] = [];

  for (const m of relatorio.musicas) {
    const chave = chaveDeMusica(m.titulo, m.artista);
    if (jaTem.has(chave)) {
      duplicadas.push(m);
      continue;
    }
    // Conta como existente já: dois registros iguais no mesmo arquivo também
    // são duplicata.
    jaTem.add(chave);
    const agora = Date.now();
    novas.push({
      id: nid(),
      title: m.titulo,
      artist: m.artista,
      groupId,
      key: m.tom,
      copyright: m.copyright,
      lyricsRaw: m.letra,
      slides: parseLyrics(m.letra),
      createdAt: agora,
      updatedAt: agora,
    });
  }

  return { novas, duplicadas, falhas: relatorio.falhas };
}
