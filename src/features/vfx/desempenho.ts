/**
 * O modo automático: medir antes de cortar.
 *
 * "Automático" não pode ser um palpite sobre o hardware. O mesmo PC roda
 * liso com o projetor fechado e engasga com dois monitores e um vídeo
 * tocando — o que importa é o que está acontecendo agora, não a ficha
 * técnica da máquina.
 *
 * Então a regra é: mede quadros por segundo, e desce um degrau quando
 * atrasa. Ao vivo desce mais cedo, porque um efeito a menos ninguém nota e
 * um engasgo no meio do louvor a igreja inteira nota.
 */
import type { VfxQualidade } from "./tipos.ts";

export const DEGRAUS: VfxQualidade[] = ["leve", "equilibrado", "alta"];

/** Abaixo disto o quadro já está atrasando o suficiente para se ver. */
export const FPS_RUIM = 45;
/** Ao vivo o limite é mais alto: cai antes de a igreja perceber. */
export const FPS_RUIM_AO_VIVO = 52;
/** Acima disto, e só depois de um tempo em paz, pode subir de novo. */
export const FPS_BOM = 57;

/**
 * Quantas medidas seguidas na mesma direção antes de mexer.
 *
 * Descer é rápido — dois segundos ruins já são dois segundos ruins. Subir
 * é lento de propósito: ficar oscilando entre dois níveis é pior para o
 * olho do que ficar no nível de baixo.
 */
export const PACIENCIA_PARA_DESCER = 2;
export const PACIENCIA_PARA_SUBIR = 8;

export interface EstadoAuto {
  qualidade: VfxQualidade;
  /** Medidas seguidas ruins, ou boas quando negativo. */
  seguidas: number;
}

export function estadoInicial(qualidade: VfxQualidade = "equilibrado"): EstadoAuto {
  return { qualidade, seguidas: 0 };
}

function desce(q: VfxQualidade): VfxQualidade {
  const i = DEGRAUS.indexOf(q);
  return DEGRAUS[Math.max(0, i - 1)];
}

function sobe(q: VfxQualidade, teto: VfxQualidade): VfxQualidade {
  const i = DEGRAUS.indexOf(q);
  const limite = DEGRAUS.indexOf(teto);
  return DEGRAUS[Math.min(limite, i + 1)];
}

/**
 * Um passo do automático, dado o que se mediu.
 *
 * Pura de propósito: a decisão inteira cabe num teste, sem precisar de um
 * navegador que engasgue de verdade para provar que ela funciona.
 *
 * @param teto até onde pode subir — a escolha do operador continua valendo
 *             como limite, o automático só desce dentro dela.
 */
export function passoAutomatico(
  estado: EstadoAuto,
  fps: number,
  aoVivo: boolean,
  teto: VfxQualidade = "alta",
): EstadoAuto {
  const ruim = aoVivo ? FPS_RUIM_AO_VIVO : FPS_RUIM;
  // O teto pode ter baixado enquanto isto rodava; nunca fique acima dele.
  const atual = DEGRAUS[Math.min(DEGRAUS.indexOf(estado.qualidade), DEGRAUS.indexOf(teto))];
  const mudouDeTeto = atual !== estado.qualidade;

  if (fps < ruim) {
    const seguidas = Math.max(1, mudouDeTeto ? 1 : estado.seguidas + 1);
    if (seguidas < PACIENCIA_PARA_DESCER) return { qualidade: atual, seguidas };
    const abaixo = desce(atual);
    return { qualidade: abaixo, seguidas: abaixo === atual ? seguidas : 0 };
  }

  if (fps >= FPS_BOM) {
    const seguidas = Math.min(-1, mudouDeTeto ? -1 : estado.seguidas - 1);
    if (-seguidas < PACIENCIA_PARA_SUBIR) return { qualidade: atual, seguidas };
    const acima = sobe(atual, teto);
    return { qualidade: acima, seguidas: acima === atual ? seguidas : 0 };
  }

  // Entre os dois limites está bom assim: nem desce nem sobe, e zera a
  // contagem para não somar um segundo ruim de dez minutos atrás.
  return { qualidade: atual, seguidas: 0 };
}

/**
 * Mede quadros por segundo por uma janela de tempo.
 *
 * Conta quadros e divide pelo tempo real decorrido, em vez de fazer média
 * do intervalo entre quadros: um único quadro perdido de 200ms estraga a
 * média de intervalos, e é justamente o engasgo que se quer detectar.
 */
export class MedidorDeFps {
  // Um sinalizador em vez de "inicio === 0": o primeiro quadro pode chegar
  // exatamente no instante zero, e aí a janela nunca fechava — o medidor
  // ficava dizendo "ainda não sei" para sempre.
  private comecou = false;
  private inicio = 0;
  private quadros = 0;
  /** Janela de medição em milissegundos. */
  private readonly janela: number;

  // Campo declarado e atribuído à mão em vez de propriedade de parâmetro:
  // o Node roda estes testes só apagando os tipos, e propriedade de
  // parâmetro precisa de um compilador de verdade.
  constructor(janela = 1000) {
    this.janela = janela;
  }

  /** Conta um quadro. Devolve o FPS da janela quando ela fecha, senão null. */
  quadro(agora: number): number | null {
    if (!this.comecou) {
      this.comecou = true;
      this.inicio = agora;
      this.quadros = 0;
      return null;
    }
    this.quadros += 1;
    const decorrido = agora - this.inicio;
    if (decorrido < this.janela) return null;
    const fps = (this.quadros * 1000) / decorrido;
    this.inicio = agora;
    this.quadros = 0;
    return fps;
  }

  reiniciar(): void {
    this.comecou = false;
    this.inicio = 0;
    this.quadros = 0;
  }
}
