import { margemSegura, type Feitio } from "./formatos.ts";
import { LARGURA_MEDIA_PADRAO } from "./largura-do-texto.ts";
import { temCaixa, type Documento, type Elemento } from "./types.ts";

/**
 * O que impede uma arte de sair feia ou ilegível.
 *
 * Existe porque quem usa isto não é designer: a pessoa escolhe uma variação
 * bonita na miniatura e só descobre no telão que o texto sumiu no fundo, ou
 * na gráfica que o título foi cortado. Estas contas veem isso antes.
 *
 * Nenhuma delas opina sobre gosto. Todas respondem a perguntas com resposta
 * certa: dá para ler? cabe? está dentro da margem?
 */

/** Luminância relativa, como o WCAG define. */
function luminancia(hex: string): number {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x) : [c.slice(0, 2), c.slice(2, 4), c.slice(4, 6)];
  const [r, g, b] = n.map((p) => {
    const v = parseInt(p, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ehHex(cor: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(cor ?? ""));
}

/**
 * A razão de contraste entre duas cores, de 1 a 21.
 *
 * 4,5 é o mínimo do WCAG para texto normal; 3 basta para texto grande, que é
 * o caso de quase tudo numa arte de evento. Devolve 0 para cor inválida, em
 * vez de fingir que mediu.
 */
export function contraste(a: string, b: string): number {
  if (!ehHex(a) || !ehHex(b)) return 0;
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return Math.round(((claro + 0.05) / (escuro + 0.05)) * 100) / 100;
}

/** Texto grande aguenta 3:1; o resto precisa de 4,5:1. */
export function contrasteSuficiente(cor: string, fundo: string, tamanho: number): boolean {
  const minimo = tamanho >= 0.05 ? 3 : 4.5;
  return contraste(cor, fundo) >= minimo;
}

/** Preto ou branco — o que ler melhor sobre esta cor. */
/**
 * Se o fundo é claro.
 *
 * A atmosfera precisa saber: sobre fundo escuro a luz clareia, sobre
 * fundo claro ela tem que escurecer — branco sobre branco não é luz,
 * é nada.
 */
export function ehClara(fundo: string): boolean {
  return textoLegivelSobre(fundo) !== "#ffffff";
}

export function textoLegivelSobre(fundo: string): string {
  return contraste("#ffffff", fundo) >= contraste("#111111", fundo) ? "#ffffff" : "#111111";
}

export type Gravidade = "erro" | "aviso";

export interface Achado {
  gravidade: Gravidade;
  elementoId?: string;
  texto: string;
  /** Se a cabine sabe consertar sozinha, e como dizer isso. */
  conserto?: string;
}

/**
 * Quantas linhas o texto vai ocupar, e se cabe.
 *
 * Estimativa, e declarada como tal: medir de verdade exige o navegador, e
 * este módulo roda em teste sem navegador nenhum. A conta usa a largura
 * média de um caractere em fonte de display — erra para mais, que é o lado
 * seguro: avisa de aperto que talvez não aconteça, em vez de deixar passar
 * um corte que vai acontecer.
 */
const LARGURA_MEDIA_DO_CARACTERE = LARGURA_MEDIA_PADRAO;

export function linhasEstimadas(
  texto: string,
  larguraDaCaixa: number,
  tamanho: number,
  proporcao: number,
  /** Largura média do caractere. Tem que ser a mesma que a do desenho. */
  larguraDoCaractere = LARGURA_MEDIA_DO_CARACTERE,
): number {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return 0;
  const larguraEmCaracteres = Math.max(
    1,
    (larguraDaCaixa * proporcao) / (tamanho * larguraDoCaractere),
  );
  // Quebra por palavra, como o navegador faz — contar caracteres direto
  // partiria palavra no meio e daria menos linhas do que a realidade.
  let linhas = 1;
  let atual = 0;
  for (const palavra of limpo.split(/\s+/)) {
    const custo = palavra.length + (atual === 0 ? 0 : 1);
    if (atual + custo > larguraEmCaracteres && atual > 0) {
      linhas += 1;
      atual = palavra.length;
    } else {
      atual += custo;
    }
  }
  return linhas;
}

/** Confere uma arte inteira antes de ela virar arquivo. */
export function conferir(doc: Documento): Achado[] {
  const achados: Achado[] = [];
  const fundo = doc.elementos.find((e) => e.tipo === "fundo");
  const corDeFundo = fundo?.tipo === "fundo" ? (fundo.cores[0] ?? "#000000") : "#000000";
  const temFoto = fundo?.tipo === "fundo" && fundo.estilo === "foto";
  const proporcao = doc.largura / doc.altura;
  const margem = margemSegura(feitioDoDoc(doc));

  for (const el of doc.elementos) {
    if (!temCaixa(el) || el.oculto) continue;

    const { x, y, largura, altura } = el.caixa;
    if (x < margem - 0.001 || y < margem - 0.001 || x + largura > 1 - margem + 0.001 || y + altura > 1 - margem + 0.001) {
      achados.push({
        gravidade: "aviso",
        elementoId: el.id,
        texto: "Encosta na borda — pode ser cortado na impressão ou no corte do feed.",
        conserto: "Trazer para dentro da margem",
      });
    }

    if (el.tipo !== "texto") continue;

    if (!temFoto && !contrasteSuficiente(el.cor, corDeFundo, el.tamanho)) {
      achados.push({
        gravidade: "erro",
        elementoId: el.id,
        texto: `Texto quase não aparece no fundo (contraste ${contraste(el.cor, corDeFundo)}:1).`,
        conserto: "Trocar para a cor que lê melhor",
      });
    }

    // Abaixo disto, num story de 1080, a letra sai com menos de 20px.
    if (el.texto.trim() && el.tamanho < 0.018) {
      achados.push({
        gravidade: "aviso",
        elementoId: el.id,
        texto: "Letra pequena demais para ler no celular.",
      });
    }

    const linhas = linhasEstimadas(el.texto, el.caixa.largura, el.tamanho, proporcao);
    const cabem = Math.floor(el.caixa.altura / (el.tamanho * el.entrelinha));
    if (linhas > cabem && cabem > 0) {
      achados.push({
        gravidade: "erro",
        elementoId: el.id,
        texto: `O texto não cabe: precisa de ${linhas} linhas e há espaço para ${cabem}.`,
        conserto: "Diminuir a letra até caber",
      });
    }
  }

  return achados;
}

function feitioDoDoc(doc: Documento): Feitio {
  const razao = doc.largura / doc.altura;
  return razao > 1.2 ? "deitado" : razao < 0.85 ? "empe" : "quadrado";
}

/**
 * Conserta o que dá para consertar sem inventar gosto.
 *
 * Só mexe no que tem resposta certa: cor que não lê vira a que lê, texto que
 * não cabe encolhe até caber, elemento fora da margem volta para dentro.
 * Nada aqui muda disposição nem paleta — isso é escolha de quem fez a arte.
 */
export function consertar(doc: Documento): Documento {
  const fundo = doc.elementos.find((e) => e.tipo === "fundo");
  const corDeFundo = fundo?.tipo === "fundo" ? (fundo.cores[0] ?? "#000000") : "#000000";
  const temFoto = fundo?.tipo === "fundo" && fundo.estilo === "foto";
  const proporcao = doc.largura / doc.altura;
  const margem = margemSegura(feitioDoDoc(doc));

  const elementos = doc.elementos.map((el): Elemento => {
    if (!temCaixa(el) || el.oculto || el.travado) return el;

    let caixa = { ...el.caixa };
    caixa.x = Math.min(Math.max(caixa.x, margem), 1 - margem - caixa.largura);
    caixa.y = Math.min(Math.max(caixa.y, margem), 1 - margem - caixa.altura);
    if (caixa.largura > 1 - 2 * margem) {
      caixa = { ...caixa, x: margem, largura: 1 - 2 * margem };
    }

    if (el.tipo !== "texto") return { ...el, caixa };

    const cor = !temFoto && !contrasteSuficiente(el.cor, corDeFundo, el.tamanho)
      ? textoLegivelSobre(corDeFundo)
      : el.cor;

    // Encolhe até caber, com piso: letra minúscula é tão ruim quanto
    // cortada, e a essa altura é melhor avisar do que disfarçar.
    let tamanho = el.tamanho;
    const cabem = () => Math.floor(caixa.altura / (tamanho * el.entrelinha));
    let voltas = 0;
    while (
      voltas < 12 &&
      tamanho > 0.018 &&
      linhasEstimadas(el.texto, caixa.largura, tamanho, proporcao) > cabem()
    ) {
      tamanho = Math.round(tamanho * 0.92 * 10000) / 10000;
      voltas += 1;
    }

    return { ...el, caixa, cor, tamanho };
  });

  return { ...doc, elementos, atualizadoEm: Date.now() };
}
