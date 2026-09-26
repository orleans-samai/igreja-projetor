import type { Briefing } from "./briefing.ts";
import type { AjustesDeCategoria } from "./catalogo/categorias.ts";
import { VERSAO_ESQUEMA, type Assinatura, type DocumentoDeArte } from "./documento.ts";
import { ehDocumentoV1, migrarV1 } from "./migracao-v1.ts";

/**
 * O que vai para o disco, e como o que já estava lá é lido de novo.
 *
 * Separado do store para ser testado sem o app: é aqui que uma atualização
 * poderia apagar as artes de alguém, e isso não pode depender de abrir a
 * janela para descobrir.
 */

export interface ArtesGuardadas {
  projetos: DocumentoDeArte[];
  /** Assinaturas dos lotes recentes, por projeto (categoria + título). */
  historico: Record<string, Assinatura[]>;
  ajustes: AjustesDeCategoria;
  ultimoBriefing: Briefing | null;
}

/** Quantas assinaturas cada projeto guarda, e quantos projetos. */
export const HISTORICO_POR_PROJETO = 40;
export const PROJETOS_NO_HISTORICO = 30;

export function vazio(): ArtesGuardadas {
  return { projetos: [], historico: {}, ajustes: {}, ultimoBriefing: null };
}

function documentoValido(p: unknown): p is DocumentoDeArte {
  return !!p && typeof p === "object" && (p as { v?: unknown }).v === VERSAO_ESQUEMA && Array.isArray((p as { camadas?: unknown }).camadas);
}

/**
 * Lê o que estava guardado, de qualquer versão.
 *
 * Arte v1 é convertida; arte de versão futura ou corrompida fica de fora
 * sem derrubar a leitura das outras. Uma arte ruim não pode custar a
 * biblioteca inteira.
 */
export function lerGuardado(guardado: unknown): ArtesGuardadas {
  const g = (guardado ?? {}) as Partial<ArtesGuardadas> & { projetos?: unknown[] };
  const projetos: DocumentoDeArte[] = [];
  for (const p of Array.isArray(g.projetos) ? g.projetos : []) {
    try {
      if (documentoValido(p)) projetos.push(p);
      else if (ehDocumentoV1(p)) projetos.push(migrarV1(p));
    } catch {
      /* arte ilegível fica de fora; as outras seguem */
    }
  }
  const historico: Record<string, Assinatura[]> = {};
  if (g.historico && typeof g.historico === "object") {
    for (const [k, v] of Object.entries(g.historico)) if (Array.isArray(v)) historico[k] = v.slice(-HISTORICO_POR_PROJETO);
  }
  return {
    projetos,
    historico,
    ajustes: g.ajustes && typeof g.ajustes === "object" ? g.ajustes : {},
    ultimoBriefing: g.ultimoBriefing ?? null,
  };
}

/** Acrescenta as assinaturas de um lote ao histórico do projeto, com teto. */
export function registrarNoHistorico(h: Record<string, Assinatura[]>, chave: string, novas: Assinatura[]): Record<string, Assinatura[]> {
  const saida: Record<string, Assinatura[]> = {};
  const chaves = Object.keys(h).filter((k) => k !== chave);
  // O projeto que acabou de gerar vai para o fim; os mais antigos saem.
  for (const k of chaves.slice(-(PROJETOS_NO_HISTORICO - 1))) saida[k] = h[k];
  saida[chave] = [...(h[chave] ?? []), ...novas].slice(-HISTORICO_POR_PROJETO);
  return saida;
}
