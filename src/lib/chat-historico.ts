import { fold } from "./fold.ts";
import { NOME_DA_EQUIPE, type MensagemChat, type ParaChat } from "./remote-control.ts";

/**
 * O chat de cada culto, guardado.
 *
 * O chat vivia só na memória da sessão: fechou o app, sumiu. A igreja pediu
 * o histórico de cada culto, com busca e exportação ao final. Um "culto" é
 * a programação aberta na cabine naquele dia — o recado das 19h de domingo
 * fica junto dos outros recados daquele culto, não num mural sem fim.
 *
 * O recado falado não entra no histórico: o áudio pesaria no arquivo
 * gravado a cada mensagem. Fica a marca de que houve um recado de voz.
 * A foto entra pelo nome do arquivo, que mora no disco da cabine.
 */

export interface RecadoGuardado extends Omit<MensagemChat, "audio"> {
  /** Houve um recado de voz aqui; o áudio não foi guardado. */
  voz?: boolean;
}

export interface CultoDoChat {
  /** Programação + dia: o mesmo culto repetido na semana seguinte é outro. */
  id: string;
  nome: string;
  /** AAAA-MM-DD, no fuso da cabine. */
  dia: string;
  recados: RecadoGuardado[];
}

export interface HistoricoDoChat {
  cultos: CultoDoChat[];
}

export const MAX_CULTOS = 60;
export const MAX_RECADOS_POR_CULTO = 800;

/** O dia local de um instante, como AAAA-MM-DD. */
export function diaDe(em: number): string {
  const d = new Date(em);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Sem o áudio (pesado) e com a marca de que ele existiu. */
export function paraGuardar(m: MensagemChat): RecadoGuardado {
  const { audio, ...resto } = m;
  return audio ? { ...resto, voz: true } : resto;
}

/**
 * Guarda um recado no culto em que ele aconteceu. O mesmo recado chegando
 * de novo (reconexão) atualiza em vez de duplicar.
 */
export function guardarRecado(
  h: HistoricoDoChat,
  programacao: { id: string; nome: string },
  m: MensagemChat,
): HistoricoDoChat {
  const dia = diaDe(m.em);
  const id = `${programacao.id}|${dia}`;
  const recado = paraGuardar(m);
  const existente = h.cultos.find((c) => c.id === id);
  let cultos: CultoDoChat[];
  if (existente) {
    const ja = existente.recados.findIndex((r) => r.id === m.id);
    const recados =
      ja >= 0
        ? existente.recados.map((r, i) => (i === ja ? recado : r))
        : [...existente.recados, recado].slice(-MAX_RECADOS_POR_CULTO);
    cultos = h.cultos.map((c) => (c.id === id ? { ...c, nome: programacao.nome || c.nome, recados } : c));
  } else {
    cultos = [...h.cultos, { id, nome: programacao.nome || "Culto", dia, recados: [recado] }];
  }
  // Os mais antigos saem primeiro.
  cultos.sort((a, b) => a.dia.localeCompare(b.dia));
  return { cultos: cultos.slice(-MAX_CULTOS) };
}

/** A cabine apagou o recado: some o conteúdo em todo o histórico. */
export function apagarRecado(h: HistoricoDoChat, id: string): HistoricoDoChat {
  let mudou = false;
  const cultos = h.cultos.map((c) => {
    if (!c.recados.some((r) => r.id === id)) return c;
    mudou = true;
    return {
      ...c,
      recados: c.recados.map((r) =>
        r.id === id ? { ...r, texto: "", foto: undefined, voz: undefined, mencoes: [], apagada: true } : r,
      ),
    };
  });
  return mudou ? { cultos } : h;
}

/** Recados que batem com a busca, dos cultos mais novos para os mais velhos. */
export function buscarNoHistorico(
  h: HistoricoDoChat,
  termo: string,
): { culto: CultoDoChat; recado: RecadoGuardado }[] {
  const alvo = fold(termo);
  if (!alvo) return [];
  const achados: { culto: CultoDoChat; recado: RecadoGuardado }[] = [];
  for (const culto of [...h.cultos].reverse()) {
    for (const recado of culto.recados) {
      if (recado.apagada) continue;
      if (fold(recado.texto).includes(alvo) || fold(recado.de).includes(alvo)) {
        achados.push({ culto, recado });
      }
    }
  }
  return achados;
}

/** "Todos", "Som", "Bia" — para quem foi o recado, em palavras. */
export function destinoEmPalavras(para?: ParaChat): string {
  if (!para || para.tipo === "todos") return "Todos";
  if (para.tipo === "equipe") return NOME_DA_EQUIPE[para.equipe] ?? para.equipe;
  return para.nome || "uma pessoa";
}

function hora(em: number): string {
  const d = new Date(em);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "chat-domingo-19h-2026-09-27.txt": dá para achar na pasta de downloads. */
export function arquivoDoCulto(c: { nome: string; dia: string }): string {
  const nome = fold(c.nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "culto";
  return `chat-${nome}-${c.dia}.txt`;
}

/** O culto inteiro em texto, para guardar ou mandar depois do culto. */
export function exportarCulto(c: CultoDoChat): string {
  const [ano, mes, dia] = c.dia.split("-");
  const linhas = [`Chat — ${c.nome} — ${dia}/${mes}/${ano}`, ""];
  for (const r of c.recados) {
    const destino = destinoEmPalavras(r.para);
    const conteudo = r.apagada
      ? "(recado apagado pela cabine)"
      : [r.texto, r.foto ? "(foto)" : "", r.voz ? "(recado de voz)" : ""].filter(Boolean).join(" ");
    linhas.push(`[${hora(r.em)}] ${r.de} → ${destino}: ${conteudo}`);
  }
  return linhas.join("\n") + "\n";
}
