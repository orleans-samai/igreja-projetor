import type { CorpoDeTexto, Espaco, Paragrafo, Trecho } from "./cena.ts";

/**
 * Onde cada palavra de uma caixa de texto do PowerPoint cai.
 *
 * Quebra de linha, alinhamento, recuo, marcador, espaço entre linhas e
 * parágrafos, e o "ajustar texto à forma" que encolhe a letra. Tudo aqui é
 * conta: quem mede a largura de uma palavra é o `Medidor`, que no Lúmen é o
 * canvas e nos testes é uma régua de mentira — assim as regras se provam
 * sem navegador.
 *
 * O PowerPoint guarda a escala que calculou para a letra caber. Com a fonte
 * do autor ausente e trocada por outra, a mesma escala pode não bastar: aí
 * se encolhe mais, até caber — o "algo interno para ajustar" que a igreja
 * pediu para quando não há PowerPoint nem LibreOffice.
 */

export interface FonteCss {
  familia: string;
  tamanhoPx: number;
  negrito: boolean;
  italico: boolean;
}

export interface Medidor {
  largura(texto: string, fonte: FonteCss, espacamentoPx: number): number;
  /** Quanto a fonte sobe e desce da linha de base, em pixels. */
  metricas(fonte: FonteCss): { ascendente: number; descendente: number };
}

export interface PedacoDiagramado {
  texto: string;
  x: number;
  largura: number;
  trecho: Trecho;
  fonte: FonteCss;
  /** Deslocamento da linha de base: negativo sobe (sobrescrito). */
  deslocamento: number;
  espacamentoPx: number;
  /** Espaço em branco: conta na largura, não se desenha. */
  branco: boolean;
}

export interface LinhaDiagramada {
  /** Linha de base, a partir do topo da área de texto. */
  base: number;
  topo: number;
  altura: number;
  pedacos: PedacoDiagramado[];
}

export interface Diagramacao {
  linhas: LinhaDiagramada[];
  altura: number;
  /** A escala de letra que coube (1 = tamanho do arquivo). */
  escala: number;
}

/** 1 ponto tipográfico em EMU. */
const EMU_POR_PONTO = 12700;
/** A parada de tabulação padrão do PowerPoint: 2,54 cm. */
const TABULACAO_EMU = 914400;
/** Menor letra a que o ajuste encolhe: abaixo disso ninguém lê do fundo da igreja. */
const MENOR_ESCALA = 0.25;

interface Atomo {
  texto: string;
  trecho: Trecho;
  tipo: "palavra" | "branco" | "tab" | "quebra";
}

function atomosDe(trechos: Trecho[]): Atomo[] {
  const atomos: Atomo[] = [];
  for (const t of trechos) {
    if (t.quebra) {
      atomos.push({ texto: "", trecho: t, tipo: "quebra" });
      continue;
    }
    for (const parte of t.texto.split(/(\t|[ \u00a0\u2000-\u200b\u3000]+)/)) {
      if (!parte) continue;
      if (parte === "\t") atomos.push({ texto: "", trecho: t, tipo: "tab" });
      else if (/^[ \u00a0\u2000-\u200b\u3000]+$/.test(parte)) atomos.push({ texto: parte, trecho: t, tipo: "branco" });
      else atomos.push({ texto: parte, trecho: t, tipo: "palavra" });
    }
  }
  return atomos;
}

function textoVisivel(t: Trecho, texto: string): string {
  return t.caixaAlta === "none" ? texto : texto.toLocaleUpperCase("pt-BR");
}

function espacoPx(e: Espaco, corpoPx: number, pxPorPt: number): number {
  return "pct" in e ? e.pct * corpoPx * 1.2 : e.pts * pxPorPt;
}

/**
 * Diagrama um corpo de texto numa área de `larguraPx` × `alturaPx` (já sem
 * as margens internas da caixa).
 */
export function diagramar(
  corpo: CorpoDeTexto,
  larguraPx: number,
  alturaPx: number,
  pxPorEmu: number,
  medidor: Medidor,
): Diagramacao {
  const pxPorPt = EMU_POR_PONTO * pxPorEmu;

  const com = (escala: number, reducao: number): Diagramacao => {
    const fonteDe = (t: Trecho, fator = 1): FonteCss => ({
      familia: t.fonte,
      tamanhoPx: t.tamanho * escala * pxPorPt * fator * (t.base ? 2 / 3 : 1) * (t.caixaAlta === "small" ? 0.8 : 1),
      negrito: t.negrito,
      italico: t.italico,
    });
    const linhas: LinhaDiagramada[] = [];
    let y = 0;
    corpo.paragrafos.forEach((p: Paragrafo) => {
      const primeiro = p.trechos.find((t) => !t.quebra && t.texto) ?? p.vazio;
      const corpoPx = primeiro.tamanho * escala * pxPorPt;
      // O PowerPoint soma o "antes" até no primeiro parágrafo: o texto de
      // cima desce junto, e é assim que ele aparece no slide.
      y += espacoPx(p.antes, corpoPx, pxPorPt);
      const esquerda = p.margemEsq * pxPorEmu;
      const direita = Math.max(esquerda + 1, larguraPx - p.margemDir * pxPorEmu);
      const recuo = p.recuo * pxPorEmu;

      // O marcador vai no recuo da primeira linha; o texto começa na
      // margem (recuo negativo, o "deslocamento" do PowerPoint) ou logo
      // depois do marcador.
      let marcador: PedacoDiagramado | null = null;
      let inicioDaPrimeira = esquerda + recuo;
      if (p.marcador) {
        const base = p.marcador.fonte ? { ...primeiro, fonte: p.marcador.fonte } : primeiro;
        const fonte = fonteDe(base, p.marcador.tamanhoPct);
        const largura = medidor.largura(p.marcador.texto, fonte, 0);
        const x = esquerda + recuo;
        marcador = {
          texto: p.marcador.texto,
          x,
          largura,
          trecho: p.marcador.cor ? { ...base, cor: { tipo: "solido", cor: p.marcador.cor } } : base,
          fonte,
          deslocamento: 0,
          espacamentoPx: 0,
          branco: false,
        };
        const vao = fonte.tamanhoPx * 0.3;
        inicioDaPrimeira = recuo < 0 ? Math.max(esquerda, x + largura + vao * 0.5) : x + largura + vao;
      }

      const atomos = atomosDe(p.trechos);
      let pedacos: PedacoDiagramado[] = [];
      let x = inicioDaPrimeira;
      let primeiraLinha = true;
      let porQuebra = false;

      const medir = (a: Atomo): PedacoDiagramado => {
        const fonte = fonteDe(a.trecho);
        const espacamentoPx = a.trecho.espacamento * pxPorPt * escala;
        const texto = textoVisivel(a.trecho, a.texto);
        return {
          texto,
          x: 0,
          largura: medidor.largura(texto, fonte, espacamentoPx),
          trecho: a.trecho,
          fonte,
          deslocamento: -a.trecho.base * a.trecho.tamanho * escala * pxPorPt,
          espacamentoPx,
          branco: a.tipo === "branco",
        };
      };

      const fechar = (ultimaDoParagrafo: boolean) => {
        const inicio = primeiraLinha ? inicioDaPrimeira : esquerda;
        const conteudo = [...pedacos];
        while (conteudo.length && conteudo[conteudo.length - 1].branco) conteudo.pop();
        const fim = conteudo.length ? conteudo[conteudo.length - 1].x + conteudo[conteudo.length - 1].largura : inicio;
        const livre = Math.max(0, direita - inicio - (fim - inicio));
        const alinhamento = p.alinhamento;
        const justificar =
          (alinhamento === "just" && !ultimaDoParagrafo && !porQuebra) || alinhamento === "dist";
        let desloca = 0;
        if (alinhamento === "ctr") desloca = livre / 2;
        else if (alinhamento === "r") desloca = livre;
        if (justificar) {
          const brancos = conteudo.filter((q) => q.branco).length;
          if (brancos > 0) {
            const extra = livre / brancos;
            let soma = 0;
            for (const q of conteudo) {
              q.x += soma;
              if (q.branco) {
                q.largura += extra;
                soma += extra;
              }
            }
          }
        } else if (desloca) for (const q of conteudo) q.x += desloca;

        // Marcador acompanha o texto quando o parágrafo é centralizado ou à
        // direita, como no PowerPoint.
        let doMarcador: PedacoDiagramado | null = null;
        if (primeiraLinha && marcador) {
          doMarcador = { ...marcador, x: marcador.x + (alinhamento === "ctr" || alinhamento === "r" ? desloca : 0) };
        }
        const medidas = (conteudo.length ? conteudo : [medir({ texto: "", trecho: p.vazio, tipo: "palavra" })]).map((q) =>
          medidor.metricas(q.fonte),
        );
        if (doMarcador) medidas.push(medidor.metricas(doMarcador.fonte));
        const asc = Math.max(...medidas.map((m) => m.ascendente));
        const desc = Math.max(...medidas.map((m) => m.descendente));
        let altura: number;
        let base: number;
        if ("pct" in p.linha) {
          const f = p.linha.pct * (1 - reducao);
          altura = (asc + desc) * f;
          base = y + asc * f;
        } else {
          altura = p.linha.pts * pxPorPt;
          base = y + (altura * asc) / Math.max(1e-6, asc + desc);
        }
        linhas.push({ base, topo: y, altura, pedacos: doMarcador ? [doMarcador, ...conteudo] : conteudo });
        y += altura;
        pedacos = [];
        primeiraLinha = false;
        x = esquerda;
      };

      for (let i = 0; i < atomos.length; i += 1) {
        const a = atomos[i];
        if (a.tipo === "quebra") {
          porQuebra = true;
          fechar(false);
          porQuebra = false;
          continue;
        }
        if (a.tipo === "tab") {
          const passo = TABULACAO_EMU * pxPorEmu;
          const proxima = esquerda + Math.floor((x - esquerda) / passo + 1) * passo;
          pedacos.push({ ...medir({ texto: "", trecho: a.trecho, tipo: "branco" }), x, largura: proxima - x, branco: true });
          x = proxima;
          continue;
        }
        if (a.tipo === "branco") {
          // Espaço no começo de linha quebrada some; no começo do parágrafo, fica.
          if (!pedacos.length && !primeiraLinha) continue;
          const q = medir(a);
          q.x = x;
          pedacos.push(q);
          x += q.largura;
          continue;
        }
        // Uma palavra pode vir em vários trechos (negrito no meio dela): é
        // uma unidade só para quebrar.
        const unidade: Atomo[] = [a];
        while (i + 1 < atomos.length && atomos[i + 1].tipo === "palavra") unidade.push(atomos[++i]);
        const medidos = unidade.map(medir);
        const larguraDaUnidade = medidos.reduce((s, q) => s + q.largura, 0);
        const temConteudo = pedacos.some((q) => !q.branco);
        if (corpo.quebrar && temConteudo && x + larguraDaUnidade > direita + 0.5) fechar(false);
        if (corpo.quebrar && larguraDaUnidade > direita - (primeiraLinha ? inicioDaPrimeira : esquerda) + 0.5) {
          // Palavra maior que a linha inteira: parte por letra.
          for (const q of medidos) {
            for (const ch of Array.from(q.texto)) {
              const l = medidor.largura(ch, q.fonte, q.espacamentoPx);
              if (pedacos.some((z) => !z.branco) && x + l > direita + 0.5) fechar(false);
              pedacos.push({ ...q, texto: ch, x, largura: l });
              x += l;
            }
          }
          continue;
        }
        for (const q of medidos) {
          q.x = x;
          pedacos.push(q);
          x += q.largura;
        }
      }
      fechar(true);
      y += espacoPx(p.depois, corpoPx, pxPorPt);
    });
    return { linhas, altura: y, escala };
  };

  if (corpo.autoajuste.tipo === "encolher") {
    const { escala, reducao } = corpo.autoajuste;
    const salva = com(escala, reducao);
    if (salva.altura <= alturaPx + 0.5 || alturaPx <= 0) return salva;
    let baixo = MENOR_ESCALA;
    let alto = escala;
    for (let i = 0; i < 9; i += 1) {
      const meio = (baixo + alto) / 2;
      if (com(meio, Math.max(reducao, 0.1)).altura <= alturaPx + 0.5) baixo = meio;
      else alto = meio;
    }
    return com(baixo, Math.max(reducao, 0.1));
  }
  return com(1, 0);
}

/** Onde o bloco de texto começa, na vertical, dentro da área. */
export function topoDoBloco(ancora: CorpoDeTexto["ancora"], alturaDoBloco: number, alturaPx: number): number {
  if (ancora === "ctr") return (alturaPx - alturaDoBloco) / 2;
  if (ancora === "b") return alturaPx - alturaDoBloco;
  return 0;
}
