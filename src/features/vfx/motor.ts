/**
 * O motor que desenha a composição.
 *
 * Um único desenhista para os dois usos: a pré-visualização na tela e o
 * quadro que vai para o arquivo de vídeo. Se fossem dois, o vídeo salvo
 * seria diferente do que o operador aprovou — e ele só descobriria no
 * domingo.
 *
 * Tudo é função do tempo, e o tempo é o único estado. Nenhuma partícula
 * guarda posição de um quadro para o outro: no segundo 7,5 a cena é a
 * mesma, tenha ela sido desenhada agora ou daqui a uma hora. É isso que
 * deixa renderizar, cancelar e renderizar de novo dar o mesmo vídeo.
 */
import type { VfxComposicao } from "./tipos.ts";

/** Multiplicador do tempo por ritmo escolhido. */
export const RITMOS = { lenta: 0.5, normal: 1, rapida: 1.9, manual: 1 } as const;

export function fatorDeVelocidade(comp: VfxComposicao): number {
  if (comp.ritmo === "manual") {
    const v = Number(comp.velocidade);
    return Number.isFinite(v) ? Math.min(3, Math.max(0.1, v)) : 1;
  }
  return RITMOS[comp.ritmo] ?? 1;
}

/** Onde estamos dentro do ciclo, de 0 a 1. */
export function faseDe(comp: VfxComposicao, t: number): number {
  const dur = Math.max(0.5, Number(comp.duracao) || 1);
  if (!comp.repetir) return Math.min(1, Math.max(0, t / dur));
  return ((t % dur) + dur) % dur / dur;
}

/**
 * A opacidade da cena naquele instante, já com entrada e saída.
 *
 * Fora do ciclo, quando não repete, é zero: a composição acabou, e mostrar
 * o último quadro congelado seria dizer que ainda está rodando.
 */
export function opacidadeNoTempo(comp: VfxComposicao, t: number): number {
  const base = Math.min(1, Math.max(0, (Number(comp.opacidade) || 0) / 100));
  const dur = Math.max(0.5, Number(comp.duracao) || 1);
  const dentro = comp.repetir ? ((t % dur) + dur) % dur : t;
  if (!comp.repetir && (t < 0 || t > dur)) return 0;
  const ent = Math.max(0, Math.min(dur / 2, Number(comp.entrada) || 0));
  const sai = Math.max(0, Math.min(dur / 2, Number(comp.saida) || 0));
  let f = 1;
  if (ent > 0 && dentro < ent) f = dentro / ent;
  if (sai > 0 && dentro > dur - sai) f = Math.min(f, (dur - dentro) / sai);
  return base * Math.max(0, Math.min(1, f));
}

/** 0 a 1: o quanto os efeitos valem, pela intensidade do operador. */
export function forcaDe(comp: VfxComposicao): number {
  // Number(undefined) é NaN, não null: quem cuida do campo ausente é o
  // isFinite, não um `??` que nunca dispara.
  const n = Number(comp.intensidade);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : 1;
}

/** Um número entre 0 e 1, sempre o mesmo para a mesma semente. */
export function sorteio(semente: number): number {
  const x = Math.sin(semente * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface Particula {
  x: number;
  y: number;
  raio: number;
  alfa: number;
}

/**
 * Onde a partícula de índice `i` está no instante `t`.
 *
 * Sobe devagar e volta por baixo quando sai em cima, como fumaça. A
 * posição sai de uma conta, não de um passo a passo: é o que garante que
 * o quadro 300 seja igual no preview e no arquivo.
 */
export function particulaEm(
  i: number,
  t: number,
  largura: number,
  altura: number,
  tamanho: number,
): Particula {
  const a = sorteio(i + 1);
  const b = sorteio(i + 101);
  const c = sorteio(i + 211);
  const d = sorteio(i + 307);
  const subida = 0.02 + c * 0.05;
  const y = altura - (((b + t * subida) % 1) * (altura * 1.15));
  const balanco = Math.sin(t * (0.3 + d * 0.5) + i) * largura * 0.02;
  return {
    x: a * largura + balanco,
    y,
    raio: Math.max(0.6, (0.7 + c * 2.4) * (tamanho / 100) * (largura / 320)),
    alfa: 0.18 + d * 0.5,
  };
}

/** Quantas partículas a densidade pede numa tela deste tamanho. */
export function quantasParticulas(densidade: number, largura: number): number {
  const d = Math.min(100, Math.max(0, Number(densidade) || 0));
  if (d === 0) return 0;
  // Proporcional à largura: 120 pontinhos numa miniatura de 300px é uma
  // sopa, e numa tela de 1920 é um céu vazio.
  return Math.round((d / 100) * 90 * Math.min(2, Math.max(0.4, largura / 960)));
}

function corComAlfa(cor: string, alfa: number): string {
  const c = /^#([0-9a-f]{6})$/i.exec(String(cor || ""));
  if (!c) return `rgba(255,255,255,${alfa})`;
  const n = parseInt(c[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

/**
 * O desenhista.
 *
 * Guarda as telas auxiliares porque criar canvas a cada quadro é o jeito
 * mais rápido de fazer um PC de igreja engasgar. Uma instância serve a uma
 * superfície; o editor tem a sua, o exportador tem a dele.
 */
export class MotorVfx {
  private buffer: HTMLCanvasElement | null = null;
  private ruido: HTMLCanvasElement | null = null;

  private telaAuxiliar(largura: number, altura: number): HTMLCanvasElement {
    if (!this.buffer) this.buffer = document.createElement("canvas");
    if (this.buffer.width !== largura || this.buffer.height !== altura) {
      this.buffer.width = largura;
      this.buffer.height = altura;
    }
    return this.buffer;
  }

  /**
   * Um azulejo de grão, feito uma vez só.
   *
   * Grão de verdade é ruído por pixel a cada quadro. Numa tela de 1920 são
   * dois milhões de sorteios sessenta vezes por segundo, o que sozinho
   * derruba a projeção. Um azulejo de 128px repetido e deslocado a cada
   * quadro é indistinguível a olho e custa um desenho.
   */
  private azulejoDeRuido(): HTMLCanvasElement {
    if (this.ruido) return this.ruido;
    const lado = 128;
    const tela = document.createElement("canvas");
    tela.width = lado;
    tela.height = lado;
    const ctx = tela.getContext("2d");
    if (ctx) {
      const dados = ctx.createImageData(lado, lado);
      for (let i = 0; i < dados.data.length; i += 4) {
        const v = 110 + Math.round(sorteio(i) * 90);
        dados.data[i] = v;
        dados.data[i + 1] = v;
        dados.data[i + 2] = v;
        dados.data[i + 3] = 255;
      }
      ctx.putImageData(dados, 0, 0);
    }
    this.ruido = tela;
    return tela;
  }

  /** Solta as telas auxiliares. */
  descartar(): void {
    this.buffer = null;
    this.ruido = null;
  }

  /**
   * Desenha um quadro da composição em `ctx`.
   *
   * `t` é o tempo em segundos desde o começo, já sem o fator de
   * velocidade: quem multiplica é esta função, para o exportador e o
   * editor não precisarem concordar sobre isso.
   */
  desenhar(
    ctx: CanvasRenderingContext2D,
    comp: VfxComposicao,
    t: number,
    largura: number,
    altura: number,
  ): void {
    const opac = opacidadeNoTempo(comp, t);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, largura, altura);
    if (opac <= 0) {
      ctx.restore();
      return;
    }

    const forca = forcaDe(comp);
    const tt = t * fatorDeVelocidade(comp);
    const precisaBuffer =
      comp.separacaoRgb * forca > 1 || comp.ondulacao * forca > 1 || comp.desfoque * forca > 1;
    const alvo = precisaBuffer ? this.telaAuxiliar(largura, altura) : null;
    const pintor = alvo ? alvo.getContext("2d") : ctx;
    if (!pintor) {
      ctx.restore();
      return;
    }
    if (alvo) {
      pintor.setTransform(1, 0, 0, 1, 0, 0);
      pintor.globalAlpha = 1;
      pintor.filter = "none";
      pintor.clearRect(0, 0, largura, altura);
    }

    this.cena(pintor, comp, tt, largura, altura, forca);

    if (alvo) {
      this.compor(ctx, alvo, comp, tt, largura, altura, forca);
    }

    // Vinheta, grão e texto por cima de tudo: eles não devem ser
    // desfocados nem separados em RGB, senão o texto fica ilegível.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    this.vinheta(ctx, comp, largura, altura, forca);
    this.grao(ctx, comp, tt, largura, altura, forca);
    this.texto(ctx, comp, t, largura, altura);

    // A opacidade da composição inteira é um véu preto por cima: mexer no
    // globalAlpha de cada camada daria somas diferentes conforme a ordem.
    if (opac < 1) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(0,0,0,${1 - opac})`;
      ctx.fillRect(0, 0, largura, altura);
    }
    ctx.restore();
  }

  /** Fundo, brilho e partículas — a cena antes das distorções. */
  private cena(
    ctx: CanvasRenderingContext2D,
    comp: VfxComposicao,
    tt: number,
    largura: number,
    altura: number,
    forca: number,
  ): void {
    const pulso = 1 + Math.sin(tt * 1.6) * ((Number(comp.pulsacao) || 0) / 100) * 0.16 * forca;
    const zoom = 1 + ((Number(comp.zoom) || 0) / 100) * 0.14 * forca * (0.5 + 0.5 * Math.sin(tt * 0.25));
    const desliza = ((Number(comp.movimentoFundo) || 0) / 100) * forca;

    ctx.save();
    ctx.translate(largura / 2, altura / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-largura / 2, -altura / 2);

    const dx = Math.sin(tt * 0.18) * largura * 0.06 * desliza;
    const dy = Math.cos(tt * 0.13) * altura * 0.06 * desliza;
    const fundo = ctx.createLinearGradient(dx, dy, largura + dx, altura + dy);
    fundo.addColorStop(0, comp.corSecundaria || "#000");
    fundo.addColorStop(0.55, comp.corPrimaria || "#111");
    fundo.addColorStop(1, comp.corSecundaria || "#000");
    ctx.fillStyle = fundo;
    ctx.fillRect(-largura, -altura, largura * 3, altura * 3);

    const glow = ((Number(comp.glow) || 0) / 100) * forca;
    if (glow > 0.01) {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i += 1) {
        const px = largura * (0.3 + 0.2 * i) + Math.sin(tt * (0.2 + i * 0.11)) * largura * 0.12;
        const py = altura * (0.35 + 0.15 * ((i + 1) % 3)) + Math.cos(tt * (0.17 + i * 0.09)) * altura * 0.1;
        const raio = Math.min(largura, altura) * (0.22 + 0.1 * i) * pulso;
        const halo = ctx.createRadialGradient(px, py, 0, px, py, raio);
        halo.addColorStop(0, corComAlfa(i === 1 ? comp.corSecundaria : comp.corPrimaria, 0.5 * glow));
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(px - raio, py - raio, raio * 2, raio * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();

    const quantas = quantasParticulas((Number(comp.particulas) || 0) * forca, largura);
    if (quantas > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < quantas; i += 1) {
        const p = particulaEm(i, tt, largura, altura, Number(comp.particulaTamanho) || 30);
        ctx.fillStyle = corComAlfa("#ffffff", p.alfa * forca * 0.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio * pulso, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const brilho = Number(comp.brilho);
    if (Number.isFinite(brilho) && Math.abs(brilho - 100) > 1) {
      // Clarear é um véu branco; escurecer é um véu preto. Mais barato e
      // mais previsível que um filtro de brilho na tela inteira.
      const d = (brilho - 100) / 100;
      ctx.fillStyle = d > 0 ? `rgba(255,255,255,${Math.min(0.6, d * 0.45)})` : `rgba(0,0,0,${Math.min(0.85, -d)})`;
      ctx.fillRect(0, 0, largura, altura);
    }
  }

  /** Ondulação, desfoque e separação de RGB, do buffer para a tela. */
  private compor(
    ctx: CanvasRenderingContext2D,
    buffer: HTMLCanvasElement,
    comp: VfxComposicao,
    tt: number,
    largura: number,
    altura: number,
    forca: number,
  ): void {
    const desfoque = ((Number(comp.desfoque) || 0) / 100) * forca;
    const onda = ((Number(comp.ondulacao) || 0) / 100) * forca;
    const rgb = ((Number(comp.separacaoRgb) || 0) / 100) * forca;

    ctx.save();
    ctx.filter = desfoque > 0.01 ? `blur(${(desfoque * 14).toFixed(2)}px)` : "none";

    const desenhar = (deslocX: number, modo: GlobalCompositeOperation, alfa: number) => {
      ctx.globalCompositeOperation = modo;
      ctx.globalAlpha = alfa;
      if (onda > 0.01) {
        // Fatias horizontais empurradas por um seno: é a ondulação que se
        // consegue num canvas 2D sem shader, e a olho é a mesma coisa.
        const fatias = 36;
        const alturaFatia = Math.ceil(altura / fatias);
        for (let i = 0; i < fatias; i += 1) {
          const y = i * alturaFatia;
          const empurra = Math.sin(tt * 2.2 + i * 0.42) * largura * 0.03 * onda;
          ctx.drawImage(
            buffer,
            0, y, largura, alturaFatia,
            deslocX + empurra, y, largura, alturaFatia,
          );
        }
      } else {
        ctx.drawImage(buffer, deslocX, 0);
      }
    };

    if (rgb > 0.01) {
      const d = rgb * largura * 0.012;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, largura, altura);
      desenhar(0, "source-over", 1);
      // Duas cópias deslocadas em "screen" dão a franja vermelha de um
      // lado e azul do outro, que é o que "separação de RGB" quer dizer.
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.5;
      desenhar(-d, "screen", 0.5);
      desenhar(d, "screen", 0.5);
    } else {
      desenhar(0, "source-over", 1);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    const glitch = ((Number(comp.glitch) || 0) / 100) * forca;
    if (glitch > 0.01) {
      // Em lampejos, não o tempo todo: falha de sinal contínua vira
      // textura, e o que assusta (no bom sentido) é ela aparecer e sumir.
      const janela = Math.floor(tt * 3);
      if (sorteio(janela) < glitch * 0.6) {
        const faixas = 1 + Math.floor(sorteio(janela + 7) * 4);
        for (let i = 0; i < faixas; i += 1) {
          const y = Math.floor(sorteio(janela * 13 + i) * altura);
          const h = 4 + Math.floor(sorteio(janela * 29 + i) * altura * 0.06);
          const dx = (sorteio(janela * 53 + i) - 0.5) * largura * 0.12 * glitch;
          ctx.drawImage(buffer, 0, y, largura, h, dx, y, largura, h);
        }
      }
    }
    ctx.restore();
  }

  private vinheta(
    ctx: CanvasRenderingContext2D,
    comp: VfxComposicao,
    largura: number,
    altura: number,
    forca: number,
  ): void {
    const v = ((Number(comp.vinheta) || 0) / 100) * forca;
    if (v <= 0.01) return;
    const g = ctx.createRadialGradient(
      largura / 2, altura / 2, Math.min(largura, altura) * 0.25,
      largura / 2, altura / 2, Math.max(largura, altura) * 0.72,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, v)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, largura, altura);
  }

  private grao(
    ctx: CanvasRenderingContext2D,
    comp: VfxComposicao,
    tt: number,
    largura: number,
    altura: number,
    forca: number,
  ): void {
    const g = ((Number(comp.granulacao) || 0) / 100) * forca;
    if (g <= 0.01) return;
    const azulejo = this.azulejoDeRuido();
    const passo = Math.floor(tt * 24);
    ctx.save();
    ctx.globalAlpha = Math.min(0.28, g * 0.3);
    ctx.globalCompositeOperation = "overlay";
    const padrao = ctx.createPattern(azulejo, "repeat");
    if (padrao) {
      ctx.translate(-(sorteio(passo) * 128), -(sorteio(passo + 61) * 128));
      ctx.fillStyle = padrao;
      ctx.fillRect(0, 0, largura + 128, altura + 128);
    }
    ctx.restore();
  }

  private texto(
    ctx: CanvasRenderingContext2D,
    comp: VfxComposicao,
    t: number,
    largura: number,
    altura: number,
  ): void {
    const frase = String(comp.texto || "").trim();
    if (!frase) return;
    const dur = Math.max(0.5, Number(comp.duracao) || 1);
    const dentro = comp.repetir ? ((t % dur) + dur) % dur : Math.min(t, dur);
    const ent = Math.max(0.01, Math.min(dur / 2, Number(comp.entrada) || 0.6));
    const sai = Math.max(0.01, Math.min(dur / 2, Number(comp.saida) || 0.6));
    const entrando = Math.min(1, dentro / ent);
    const saindo = Math.min(1, (dur - dentro) / sai);

    const anima = (modo: string, f: number) => {
      if (modo === "subir") return { alfa: f, dy: (1 - f) * altura * 0.06, escala: 1 };
      if (modo === "escala") return { alfa: f, dy: 0, escala: 0.88 + f * 0.12 };
      if (modo === "nenhuma") return { alfa: 1, dy: 0, escala: 1 };
      return { alfa: f, dy: 0, escala: 1 };
    };
    const a = anima(comp.textoEntrada, entrando);
    const b = anima(comp.textoSaida, saindo);
    const alfa = Math.min(a.alfa, b.alfa);
    if (alfa <= 0.01) return;

    const corpo = Math.max(14, Math.round(altura * 0.085));
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(largura / 2, altura / 2 + a.dy + b.dy);
    ctx.scale(Math.min(a.escala, b.escala), Math.min(a.escala, b.escala));
    ctx.font = `600 ${corpo}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.65)";
    ctx.shadowBlur = corpo * 0.22;
    ctx.fillStyle = "#ffffff";
    frase.split("\n").slice(0, 6).forEach((linha, i, todas) => {
      const y = (i - (todas.length - 1) / 2) * corpo * 1.24;
      ctx.fillText(linha, 0, y);
    });
    ctx.restore();
  }
}
