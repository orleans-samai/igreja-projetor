import type { Briefing } from "../briefing.ts";

/**
 * O que a arte escreve, tirado do briefing sem acrescentar palavra.
 *
 * A única costura é o separador: data e horário viram "12 de março · 19h30"
 * numa linha só, e contato e redes idem. Não há "Data:", "Local:", nem
 * texto de exemplo — campo vazio simplesmente não existe aqui, e o layout
 * que monta a pilha nem sabe que ele poderia ter existido.
 */

export interface LinhaDeTexto {
  campo: string;
  texto: string;
}

export interface Conteudo {
  titulo: string;
  /** Linha pequena acima do título: o tema, quando há. */
  sobretitulo: LinhaDeTexto | null;
  subtitulo: LinhaDeTexto | null;
  mensagem: LinhaDeTexto | null;
  /** Texto bíblico com a referência, ou só a referência/palavra-base. */
  versiculo: { texto: string | null; referencia: string | null } | null;
  /** "12 de março · 19h30". */
  quando: LinhaDeTexto | null;
  onde: LinhaDeTexto | null;
  endereco: LinhaDeTexto | null;
  pessoas: LinhaDeTexto[];
  informacoes: LinhaDeTexto | null;
  contato: LinhaDeTexto | null;
  organizacao: LinhaDeTexto | null;
}

const linha = (campo: string, texto: string): LinhaDeTexto | null => (texto ? { campo, texto } : null);

/**
 * O separador entre data e horário, com espaços inseparáveis dos dois
 * lados: o "·" nunca abre nem fecha linha sozinho — "· 9h30" no começo de
 * uma linha, ou "novembro ·" no fim, parece erro de digitação.
 */
export const SEPARADOR = "\u00a0·\u00a0";

export function conteudoDe(b: Briefing): Conteudo {
  const quando = [b.data, b.horario].filter(Boolean).join(SEPARADOR);
  const contato = [b.contato, b.redes].filter(Boolean).join(SEPARADOR);
  const referencia = b.referencia || b.palavraBase || "";
  return {
    titulo: b.titulo,
    sobretitulo: linha("tema", b.tema),
    subtitulo: linha("subtitulo", b.subtitulo),
    mensagem: linha("mensagem", b.mensagem),
    versiculo: b.textoBiblico || referencia ? { texto: b.textoBiblico || null, referencia: referencia || null } : null,
    quando: linha(b.data && b.horario ? "data+horario" : b.data ? "data" : "horario", quando),
    onde: linha("local", b.local),
    endereco: linha("endereco", b.endereco),
    pessoas: [linha("pregador", b.pregador), linha("ministerio", b.ministerio)].filter((l): l is LinhaDeTexto => !!l),
    informacoes: linha("informacoes", b.informacoes),
    contato: linha(b.contato && b.redes ? "contato+redes" : b.contato ? "contato" : "redes", contato),
    organizacao: linha("organizacao", b.organizacao),
  };
}

/** As linhas de informação, na ordem em que se lê um convite. */
export function linhasDeInfo(c: Conteudo, incluirContato = true): LinhaDeTexto[] {
  return [c.quando, c.onde, c.endereco, ...c.pessoas, incluirContato ? c.contato : null].filter(
    (l): l is LinhaDeTexto => !!l,
  );
}

/** Quantos caracteres de apoio a arte carrega — decide densidade. */
export function pesoDoApoio(c: Conteudo): number {
  return [c.subtitulo?.texto, c.mensagem?.texto, c.versiculo?.texto, c.informacoes?.texto]
    .filter(Boolean)
    .join(" ").length;
}
