/**
 * As permissões do celular, do lado da cabine.
 *
 * As mesmas regras de `desktop/permissoes.cjs`, que é quem decide de
 * verdade — os testes conferem que as duas dizem a mesma coisa. Aqui mora o
 * que a tela de Permissões precisa: os nomes, o que cada uma libera e o
 * clique que liga e desliga.
 */

export type CapacidadeRemota = "culto" | "midia" | "letras" | "controle";
export type PermissoesRemotas = (CapacidadeRemota | "completo")[];

export const CAPACIDADES: readonly CapacidadeRemota[] = ["culto", "midia", "letras", "controle"];

export const ROTULO_CAPACIDADE: Record<CapacidadeRemota, string> = {
  culto: "Culto",
  midia: "Mídia",
  letras: "Letras",
  controle: "Controle",
};

export const AJUDA_CAPACIDADE: Record<CapacidadeRemota, string> = {
  culto: "Vê a programação do culto, projeta e tira itens dela",
  midia: "Vê a pasta de mídia, projeta, toca, pausa e muda o volume",
  letras: "Busca e salva letras, projeta estrofes",
  controle: "Avança, volta, preto, logo e parar: o telão inteiro",
};

const DOS_DEGRAUS: Record<string, PermissoesRemotas> = {
  chat: [],
  editor: ["culto", "midia", "letras"],
  controle: ["completo"],
};

export function normalizarPermissoes(bruto: unknown): PermissoesRemotas {
  if (typeof bruto === "string") return [...(DOS_DEGRAUS[bruto] ?? [])];
  if (!Array.isArray(bruto)) return [];
  if (bruto.includes("completo")) return ["completo"];
  return CAPACIDADES.filter((c) => bruto.includes(c));
}

export function pode(permissoes: unknown, capacidade: CapacidadeRemota): boolean {
  const lista = normalizarPermissoes(permissoes);
  return lista.includes("completo") || lista.includes(capacidade);
}

export function acessoCompleto(permissoes: unknown): boolean {
  return normalizarPermissoes(permissoes).includes("completo");
}

/**
 * Liga ou desliga uma parte. Desligar uma parte do acesso completo deixa
 * as outras três ligadas, uma a uma: quem tira "Controle" de quem tinha
 * tudo quer tirar só o controle.
 */
export function alternarCapacidade(permissoes: unknown, capacidade: CapacidadeRemota): PermissoesRemotas {
  const lista = normalizarPermissoes(permissoes);
  const partes: CapacidadeRemota[] = lista.includes("completo")
    ? [...CAPACIDADES]
    : (lista as CapacidadeRemota[]);
  const nova = partes.includes(capacidade) ? partes.filter((c) => c !== capacidade) : [...partes, capacidade];
  return normalizarPermissoes(nova);
}

/** "Só chat", "Acesso completo" ou "Culto · Mídia": para a lista de aparelhos. */
export function resumoDasPermissoes(permissoes: unknown): string {
  const lista = normalizarPermissoes(permissoes);
  if (lista.length === 0) return "Só chat";
  if (lista.includes("completo")) return "Acesso completo";
  return (lista as CapacidadeRemota[]).map((c) => ROTULO_CAPACIDADE[c]).join(" · ");
}
