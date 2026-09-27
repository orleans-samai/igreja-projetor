/**
 * Como os recados se agrupam na tela, do jeito dos apps de mensagem.
 *
 * Recados seguidos da mesma pessoa, com menos de 5 minutos entre um e
 * outro, formam um grupo: o nome e as iniciais aparecem uma vez, no
 * começo, e a hora uma vez, no fim. Antes cada linha repetia nome e hora, e
 * três recados rápidos do Som viravam seis linhas para ler.
 *
 * A mesma regra (e a mesma janela) mora em `public/chat-equipe.js`, o chat
 * das páginas do celular e do dirigente, que é JavaScript sem build — o
 * teste confere que continuam iguais.
 */

export const JANELA_DO_GRUPO_MS = 5 * 60 * 1000;

interface Recado {
  de: string;
  deId?: string;
  daCabine: boolean;
  em: number;
}

/** Quem escreveu, para agrupar: o id quando existe, senão o nome. */
function autor(r: Recado): string {
  if (r.daCabine) return "cabine";
  return r.deId || `nome:${r.de}`;
}

/** Se o recado `i` abre e/ou fecha um grupo. */
export function posicaoNoGrupo(recados: readonly Recado[], i: number): { primeiro: boolean; ultimo: boolean } {
  const atual = recados[i];
  const antes = recados[i - 1];
  const depois = recados[i + 1];
  const junto = (a: Recado | undefined, b: Recado | undefined) =>
    !!a && !!b && autor(a) === autor(b) && Math.abs(b.em - a.em) < JANELA_DO_GRUPO_MS;
  return { primeiro: !junto(antes, atual), ultimo: !junto(atual, depois) };
}

/** "Pastor João" → "PJ"; "Bia" → "B". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = [...partes[0]][0] ?? "";
  const ultima = partes.length > 1 ? ([...partes[partes.length - 1]][0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

interface Pessoa {
  id: string;
  nome: string;
}

/**
 * O texto sem acento e em minúscula, letra a letra, lembrando de onde veio
 * cada letra: é o que deixa destacar "@João" no texto original depois de
 * achá-lo como "@joao".
 */
function dobrarComOrigem(texto: string): { alvo: string; origem: number[] } {
  let alvo = "";
  const origem: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    const d = texto[i].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (const letra of d) {
      alvo += letra;
      origem.push(i);
    }
  }
  origem.push(texto.length);
  return { alvo, origem };
}

/** Um pedaço do recado: texto comum, ou a @menção a uma pessoa. */
export interface TrechoDoRecado {
  texto: string;
  pessoa?: Pessoa;
}

/**
 * O recado partido nas @menções, para o nome citado aparecer destacado.
 *
 * Quem decide quem foi citado é o servidor (`mencoes`); aqui só se acha
 * onde, sem acento e sem maiúscula, como ele achou. O nome mais comprido
 * vem primeiro: em "@Ana Paula", o destaque é da Ana Paula, não da Ana.
 */
export function trechosDoRecado(texto: string, mencoes: readonly Pessoa[] = []): TrechoDoRecado[] {
  if (!texto) return [];
  if (mencoes.length === 0) return [{ texto }];
  const { alvo, origem } = dobrarComOrigem(texto);
  const achados: { inicio: number; fim: number; pessoa: Pessoa }[] = [];
  for (const pessoa of [...mencoes].sort((a, b) => b.nome.length - a.nome.length)) {
    const chave = `@${dobrarComOrigem(pessoa.nome).alvo}`;
    let i = alvo.indexOf(chave);
    while (i >= 0) {
      const inicio = origem[i];
      const fim = origem[i + chave.length];
      if (!achados.some((a) => inicio < a.fim && fim > a.inicio)) {
        achados.push({ inicio, fim, pessoa });
        break;
      }
      i = alvo.indexOf(chave, i + 1);
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio);
  const trechos: TrechoDoRecado[] = [];
  let pos = 0;
  for (const a of achados) {
    if (a.inicio > pos) trechos.push({ texto: texto.slice(pos, a.inicio) });
    trechos.push({ texto: texto.slice(a.inicio, a.fim), pessoa: a.pessoa });
    pos = a.fim;
  }
  if (pos < texto.length) trechos.push({ texto: texto.slice(pos) });
  return trechos;
}

/**
 * Quem sugerir enquanto se escreve um @: as pessoas no chat cujo nome começa
 * com o que já foi digitado depois do último @ — sem acento, sem maiúscula,
 * e nunca a própria pessoa. `fragmento` é o "@Bi" que a escolha substitui.
 */
export function sugestoesDeMencao<P extends Pessoa>(
  antesDoCursor: string,
  pessoas: readonly P[],
  meuId: string,
  limite = 5,
): { fragmento: string; pessoas: P[] } | null {
  const achou = /@([^@\n]{0,24})$/.exec(antesDoCursor);
  if (!achou) return null;
  const digitado = dobrarComOrigem(achou[1]).alvo;
  const lista = pessoas
    .filter((p) => p.id !== meuId && dobrarComOrigem(p.nome).alvo.startsWith(digitado))
    .slice(0, limite);
  return lista.length > 0 ? { fragmento: achou[0], pessoas: lista } : null;
}

/** Troca o "@Bi" digitado por "@Bia " e diz onde o cursor fica. */
export function completarMencao(
  texto: string,
  cursor: number,
  fragmento: string,
  nome: string,
): { texto: string; cursor: number } {
  const inicio = Math.max(0, cursor - fragmento.length);
  return {
    texto: `${texto.slice(0, inicio)}@${nome} ${texto.slice(cursor)}`,
    cursor: inicio + nome.length + 2,
  };
}
