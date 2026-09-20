/**
 * O teto de custo de uma composição.
 *
 * Nem todo efeito custa igual. Desfoque e ondulação redesenham a tela
 * inteira a cada quadro; partícula custa por partícula; vinheta é um
 * degradê e custa quase nada. Este arquivo é o único lugar que sabe disso,
 * e é o que segura o culto quando alguém arrasta tudo para o máximo.
 *
 * A conta é grosseira de propósito. Não é medição, é orçamento: serve para
 * recusar antes de travar, e para dizer ao operador, em português, qual
 * controle é o caro.
 */
import type { VfxComposicao, VfxQualidade } from "./tipos.ts";

/** Quanto cada efeito pesa quando está no máximo. Soma 100 no pior caso. */
const CUSTO = {
  desfoque: 26,
  ondulacao: 22,
  particulas: 18,
  separacaoRgb: 12,
  glitch: 9,
  glow: 8,
  granulacao: 5,
} as const;

/** Acima disto, o quadro começa a atrasar em PC de igreja. */
export const TETO: Record<VfxQualidade, number> = {
  leve: 22,
  equilibrado: 55,
  alta: 100,
};

/** O que cada modo de qualidade não deixa passar, por controle. */
const LIMITES: Record<VfxQualidade, Partial<Record<keyof VfxComposicao, number>>> = {
  leve: {
    // Zero, não "pouco": desfoque de 5% custa quase o mesmo que o de 40%,
    // porque o caro é redesenhar a tela, não o raio.
    desfoque: 0,
    ondulacao: 0,
    separacaoRgb: 0,
    glitch: 0,
    particulas: 12,
    glow: 25,
    granulacao: 20,
  },
  equilibrado: {
    desfoque: 30,
    ondulacao: 45,
    separacaoRgb: 45,
    glitch: 40,
    particulas: 55,
    glow: 70,
    granulacao: 60,
  },
  alta: {},
};

export const ROTULO_QUALIDADE: Record<VfxQualidade, string> = {
  leve: "Leve",
  equilibrado: "Equilibrado",
  alta: "Alta qualidade",
};

export const AJUDA_QUALIDADE: Record<VfxQualidade, string> = {
  leve: "Sem desfoque nem distorção, poucas partículas. Para PC modesto.",
  equilibrado: "Todos os efeitos, com teto. É o que serve à maioria das igrejas.",
  alta: "Sem teto. Use quando o computador da cabine aguenta.",
};

function n(v: unknown, padrao = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : padrao;
}

/**
 * Quanto esta composição custa por quadro, de 0 a 100.
 *
 * A intensidade entra na conta porque ela multiplica tudo na hora de
 * desenhar: metade da intensidade é, de verdade, metade do trabalho.
 */
export function pesoDa(comp: VfxComposicao): number {
  const forca = Math.min(1, Math.max(0, n(comp.intensidade, 100) / 100));
  let total = 0;
  for (const [campo, custo] of Object.entries(CUSTO)) {
    const valor = Math.min(100, Math.max(0, n(comp[campo as keyof VfxComposicao])));
    total += (valor / 100) * custo * forca;
  }
  return Math.round(total);
}

/** O modo de qualidade que esta composição já cabe, sem precisar de corte. */
export function qualidadeDoPeso(peso: number): VfxQualidade {
  if (peso <= TETO.leve) return "leve";
  if (peso <= TETO.equilibrado) return "equilibrado";
  return "alta";
}

/**
 * A mesma composição, aparada para caber no modo de qualidade.
 *
 * Apara em vez de recusar: o operador que escolheu "Leve" quer projetar,
 * não quer um erro. O que ele perde é o efeito caro, não a composição.
 */
export function limitarPorQualidade(comp: VfxComposicao, q: VfxQualidade): VfxComposicao {
  const limites = LIMITES[q] ?? {};
  const saida = { ...comp };
  for (const [campo, teto] of Object.entries(limites)) {
    const chave = campo as keyof VfxComposicao;
    const valor = n(saida[chave]);
    if (valor > teto) (saida[chave] as number) = teto;
  }
  return saida;
}

/** Se a composição perde alguma coisa ao entrar neste modo. */
export function foiAparada(comp: VfxComposicao, q: VfxQualidade): boolean {
  const limites = LIMITES[q] ?? {};
  return Object.entries(limites).some(
    ([campo, teto]) => n(comp[campo as keyof VfxComposicao]) > teto,
  );
}

/** Quais controles a composição teria de baixar para caber no modo. */
export function oQuePesa(comp: VfxComposicao): { campo: keyof VfxComposicao; rotulo: string }[] {
  const nomes: Partial<Record<keyof VfxComposicao, string>> = {
    desfoque: "Desfoque",
    ondulacao: "Ondulação",
    particulas: "Partículas",
    separacaoRgb: "Separação RGB",
    glitch: "Glitch",
    glow: "Glow",
    granulacao: "Granulação",
  };
  return (Object.keys(CUSTO) as (keyof typeof CUSTO)[])
    .map((campo) => ({
      campo: campo as keyof VfxComposicao,
      rotulo: nomes[campo] ?? campo,
      peso: (Math.min(100, Math.max(0, n(comp[campo as keyof VfxComposicao]))) / 100) * CUSTO[campo],
    }))
    .filter((x) => x.peso >= 3)
    .sort((a, b) => b.peso - a.peso)
    .map(({ campo, rotulo }) => ({ campo, rotulo }));
}

/**
 * O aviso amigável, ou nada quando não há o que avisar.
 *
 * Fala do que o operador vai sentir — o telão engasgando no meio do louvor
 * — e nomeia o controle que ele pode baixar. "Alto uso de GPU" não ajuda
 * ninguém a decidir nada.
 */
export function avisoDePeso(comp: VfxComposicao, q: VfxQualidade): string | null {
  const peso = pesoDa(comp);
  if (peso <= TETO[q]) return null;
  const caros = oQuePesa(comp).slice(0, 2).map((x) => x.rotulo);
  const lista = caros.length === 2 ? `${caros[0]} e ${caros[1]}` : caros[0] || "os efeitos";
  return (
    `Esta composição pesa mais do que o modo ${ROTULO_QUALIDADE[q]} aguenta. ` +
    `Baixe ${lista}, ou salve como vídeo — vídeo pronto não custa nada no culto.`
  );
}
