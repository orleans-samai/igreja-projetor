/**
 * O ponto de partida e os seis modelos prontos.
 *
 * Um modelo não é "um efeito bonito": é um conjunto de números que já passa
 * no teto de desempenho e serve a um momento do culto. Quem abre a área
 * pela primeira vez não deveria precisar entender separação de RGB para ter
 * um fundo que presta.
 */
import type { VfxComposicao } from "./tipos.ts";

export const PADRAO: VfxComposicao = {
  brilho: 100,
  glow: 20,
  particulas: 25,
  particulaTamanho: 30,
  ritmo: "normal",
  velocidade: 1,
  pulsacao: 0,
  zoom: 15,
  movimentoFundo: 20,
  corPrimaria: "#1b2740",
  corSecundaria: "#0a0d14",
  vinheta: 35,
  granulacao: 8,
  ondulacao: 0,
  glitch: 0,
  separacaoRgb: 0,
  desfoque: 0,
  texto: "",
  textoEntrada: "surgir",
  textoSaida: "surgir",
  opacidade: 100,
  intensidade: 70,
  duracao: 15,
  repetir: true,
  entrada: 1,
  saida: 1,
};

export interface VfxModelo {
  id: string;
  nome: string;
  descricao: string;
  comp: VfxComposicao;
}

function modelo(id: string, nome: string, descricao: string, patch: Partial<VfxComposicao>): VfxModelo {
  return { id, nome, descricao, comp: { ...PADRAO, ...patch } };
}

export const MODELOS: VfxModelo[] = [
  modelo("adoracao", "Adoração suave", "Partículas discretas, brilho baixo e movimento lento.", {
    brilho: 88,
    glow: 14,
    particulas: 18,
    particulaTamanho: 24,
    ritmo: "lenta",
    pulsacao: 6,
    zoom: 10,
    movimentoFundo: 12,
    corPrimaria: "#20304f",
    corSecundaria: "#070a11",
    vinheta: 42,
    granulacao: 6,
    intensidade: 55,
    duracao: 20,
  }),
  modelo("bencao", "Culto da bênção", "Brilho dourado, partículas leves e pulsação suave.", {
    brilho: 112,
    glow: 46,
    particulas: 30,
    particulaTamanho: 34,
    ritmo: "normal",
    pulsacao: 26,
    zoom: 16,
    movimentoFundo: 18,
    corPrimaria: "#8a5c16",
    corSecundaria: "#120c04",
    vinheta: 34,
    granulacao: 8,
    intensidade: 72,
    duracao: 16,
  }),
  modelo("oracao", "Oração", "Fundo azul escuro, névoa leve e animações lentas.", {
    brilho: 78,
    glow: 18,
    particulas: 10,
    particulaTamanho: 62,
    ritmo: "lenta",
    pulsacao: 4,
    zoom: 8,
    movimentoFundo: 9,
    corPrimaria: "#12203c",
    corSecundaria: "#05070d",
    vinheta: 52,
    granulacao: 10,
    desfoque: 16,
    intensidade: 50,
    duracao: 24,
  }),
  modelo("jovens", "Jovens", "Cores vivas, movimento moderado e transições modernas.", {
    brilho: 118,
    glow: 58,
    particulas: 46,
    particulaTamanho: 28,
    ritmo: "rapida",
    pulsacao: 44,
    zoom: 26,
    movimentoFundo: 38,
    corPrimaria: "#6d2bd6",
    corSecundaria: "#0c1130",
    vinheta: 26,
    granulacao: 6,
    glitch: 14,
    separacaoRgb: 18,
    intensidade: 85,
    duracao: 12,
    entrada: 0.6,
    saida: 0.6,
  }),
  modelo("ceia", "Ceia", "Tons dourados e vinho, brilho suave e movimento elegante.", {
    brilho: 92,
    glow: 30,
    particulas: 16,
    particulaTamanho: 38,
    ritmo: "lenta",
    pulsacao: 12,
    zoom: 14,
    movimentoFundo: 14,
    corPrimaria: "#6b1f2a",
    corSecundaria: "#170c06",
    vinheta: 46,
    granulacao: 9,
    intensidade: 60,
    duracao: 20,
  }),
  modelo("minimalista", "Minimalista", "Animações leves, sem partículas e baixo consumo.", {
    brilho: 100,
    glow: 6,
    particulas: 0,
    ritmo: "lenta",
    pulsacao: 0,
    zoom: 6,
    movimentoFundo: 8,
    // Cinza que se enxerga. O par anterior era escuro demais para ler
    // como fundo: a composição existia e a tela parecia desligada.
    corPrimaria: "#2b313a",
    corSecundaria: "#12151a",
    vinheta: 30,
    granulacao: 4,
    intensidade: 40,
    duracao: 18,
  }),
];

export function acharModelo(id: string): VfxModelo | undefined {
  return MODELOS.find((m) => m.id === id);
}
