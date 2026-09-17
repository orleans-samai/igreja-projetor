/**
 * As contas do player de mídia, fora da tela.
 *
 * Tempo e porcentagem parecem triviais até o arquivo chegar sem duração —
 * e ele chega: antes dos metadados carregarem, `duration` é NaN; numa
 * transmissão contínua, é Infinity. Os dois viram barra quebrada, "NaN:aN"
 * no relógio e ponto fora da trilha. Aqui esses casos têm resposta em vez
 * de acidente.
 */

/** mm:ss, virando h:mm:ss quando passa da hora. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(r)}` : `${m}:${dois(r)}`;
}

/** Uma duração serve para desenhar barra e relógio? */
export function duracaoUtil(duracao: number | undefined): boolean {
  return typeof duracao === "number" && Number.isFinite(duracao) && duracao > 0;
}

/**
 * O que falta, escrito como o operador lê: "-30:13".
 *
 * Sem duração conhecida não há restante nenhum — e inventar "-0:00" seria
 * dizer que o arquivo acabou.
 */
export function restante(tempo: number, duracao: number | undefined): string {
  if (!duracaoUtil(duracao)) return "--:--";
  return `-${relogio(Math.max(0, duracao! - tempo))}`;
}

/** De 0 a 100, preso nas pontas. Sem duração, nada preenchido. */
export function porcento(parte: number, duracao: number | undefined): number {
  if (!duracaoUtil(duracao)) return 0;
  if (!Number.isFinite(parte) || parte <= 0) return 0;
  return Math.min(100, Math.max(0, (parte / duracao!) * 100));
}

/** Quanto do arquivo já está em disco, em segundos. */
export function carregadoAte(buffered: TimeRanges | undefined, tempo: number): number {
  if (!buffered || buffered.length === 0) return 0;
  // O trecho que interessa é o que contém o ponto atual: um arquivo buscado
  // várias vezes tem vários pedaços soltos, e o último não é o daqui.
  for (let i = 0; i < buffered.length; i += 1) {
    if (tempo >= buffered.start(i) - 0.5 && tempo <= buffered.end(i) + 0.5) return buffered.end(i);
  }
  return buffered.end(buffered.length - 1);
}

/** Onde o clique caiu na barra, em segundos. */
export function tempoDoPonto(
  clientX: number,
  caixa: { left: number; width: number },
  duracao: number | undefined,
): number {
  if (!duracaoUtil(duracao) || caixa.width <= 0) return 0;
  const fracao = (clientX - caixa.left) / caixa.width;
  return Math.min(duracao!, Math.max(0, fracao * duracao!));
}

export const VELOCIDADES = [1, 1.25, 1.5, 2] as const;

/** Próxima velocidade do rodízio; valor estranho volta para 1×. */
export function proximaVelocidade(atual: number | undefined): number {
  const i = VELOCIDADES.indexOf((atual ?? 1) as (typeof VELOCIDADES)[number]);
  return i < 0 ? VELOCIDADES[0] : VELOCIDADES[(i + 1) % VELOCIDADES.length];
}

/** "1×", "1.25×" — sem zero sobrando. */
export function rotuloVelocidade(v: number | undefined): string {
  const n = v ?? 1;
  return `${Number.isInteger(n) ? n : n.toString()}×`;
}
