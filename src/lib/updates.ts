/**
 * Atualização automática — tipos.
 *
 * Cada push para o GitHub publica uma versão nova sozinho (veja
 * .github/workflows/release.yml); estes tipos descrevem o que o processo
 * principal (desktop/updater.cjs) relata enquanto o app aberto na cabine
 * descobre essa versão e decide o que fazer com ela.
 */
export type FaseAtualizacao =
  | "sem-verificacao"
  | "verificando"
  | "atualizado"
  | "disponivel"
  | "baixando"
  | "pronto"
  | "erro";

export interface EstadoAtualizacao {
  fase: FaseAtualizacao;
  versao: string | null;
  /** De 0 a 100, só relevante durante "baixando". */
  progresso: number;
  erro: string | null;
}
