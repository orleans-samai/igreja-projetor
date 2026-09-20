/** Os três modos de ativação do assistente local. */
export type ModoIA = "desativado" | "sob-demanda" | "sempre";

export const MODOS_IA: { value: ModoIA; label: string; ajuda: string }[] = [
  {
    value: "desativado",
    label: "Desativado",
    ajuda: "Nenhum modelo carregado. O Lúmen funciona igual, e os comandos simples continuam.",
  },
  {
    value: "sob-demanda",
    label: "Sob demanda",
    ajuda: "Carrega ao abrir o assistente e descarrega sozinho. É o recomendado.",
  },
  {
    value: "sempre",
    label: "Sempre ativo",
    ajuda: "Fica carregado e responde mais rápido. Come memória o culto inteiro.",
  },
];

export type SituacaoIA = "desativada" | "carregando" | "pronta" | "erro";

export type VereditoIA = "otimo" | "adequado" | "pode-travar" | "nao-recomendado" | "desconhecido";

export interface ModeloIA {
  ok: true;
  nome: string;
  caminho: string;
  bytes: number;
  versao: number;
  quantizacao: string;
  ramEstimadaGB: number;
  veredito?: VereditoIA;
}

export interface EstadoIA {
  modo: ModoIA;
  situacao: SituacaoIA;
  erro: string | null;
  runtime: { achado: boolean; caminho: string | null; pasta: string };
  modelo: ModeloIA | null;
  pastaModelos: string;
  memoriaLivreGB: number;
  veredito: VereditoIA;
  minutosOciosoAteDescarregar: number;
}
