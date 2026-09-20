import { pintarAtmosfera } from "./atmosfera.ts";
import { LARGURA_MEDIA_PADRAO, larguraMediaDoCaractere } from "./largura-do-texto.ts";
import type { Documento, Elemento, ElementoTexto } from "./types.ts";

/**
 * O documento vira SVG — e é este SVG que a pessoa vê e que ela recebe.
 *
 * Um renderizador só, não dois. Se a prévia fosse desenhada de um jeito e o
 * arquivo de outro, os dois divergiriam com o tempo, e a pessoa só
 * descobriria depois de imprimir cem folhetos.
 *
 * SVG, e não canvas, porque texto em SVG continua sendo texto: seleciona,
 * escala sem borrar, e sai nítido tanto na miniatura de 160px quanto no
 * cartaz A4 de 300 dpi. O canvas só entra no fim, para virar PNG.
 *
 * A quebra de linha é feita aqui, à mão. SVG não quebra texto sozinho, e
 * fazer isso explicitamente tem uma vantagem: a mesma conta que a validação
 * usa para dizer "não cabe" é a que desenha — não há como a tela discordar
 * do aviso.
 */

/**
 * Escapa o que vai para dentro do SVG.
 *
 * O texto vem de um formulário que qualquer pessoa da igreja preenche. Sem
 * isto, um "&" no nome do evento quebraria o arquivo, e um "<script>" seria
 * bem pior do que quebrar.
 */
export function escapar(bruto: string): string {
  return String(bruto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A mesma largura média de caractere que a validação usa. */
const LARGURA_MEDIA_DO_CARACTERE = LARGURA_MEDIA_PADRAO;

/**
 * Parte o texto em linhas que cabem na largura dada.
 *
 * Respeita a quebra que a pessoa digitou — um endereço em duas linhas foi
 * escrito assim de propósito.
 */
export function quebrarTexto(
  texto: string,
  larguraPx: number,
  corpoPx: number,
  /** Largura média do caractere, em fração do corpo. Ver largura-do-texto. */
  larguraDoCaractere = LARGURA_MEDIA_DO_CARACTERE,
): string[] {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return [];
  const cabem = Math.max(1, Math.floor(larguraPx / (corpoPx * larguraDoCaractere)));
  const saida: string[] = [];
  for (const paragrafo of limpo.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.trim().split(/\s+/)) {
      if (!palavra) continue;
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (tentativa.length > cabem && atual) {
        saida.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    saida.push(atual);
  }
  return saida.filter((l) => l.length > 0);
}

const FONTES: Record<string, string> = {
  display: "'Fraunces Variable', Georgia, serif",
  sans: "'Instrument Sans Variable', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

function ancoraDe(alinhamento: string): { anchor: string; dx: number } {
  if (alinhamento === "left") return { anchor: "start", dx: 0 };
  if (alinhamento === "right") return { anchor: "end", dx: 1 };
  return { anchor: "middle", dx: 0.5 };
}

function desenharTexto(el: ElementoTexto, L: number, A: number): string {
  const texto = el.maiuscula ? el.texto.toLocaleUpperCase("pt-BR") : el.texto;
  const corpo = el.tamanho * A;
  const larguraPx = el.caixa.largura * L;
  const linhas = quebrarTexto(
    texto,
    larguraPx,
    corpo,
    larguraMediaDoCaractere(el.fonte, el.peso, el.maiuscula, el.espacamento),
  );
  if (linhas.length === 0) return "";

  const { anchor, dx } = ancoraDe(el.alinhamento);
  const x = (el.caixa.x + el.caixa.largura * dx) * L;
  const alturaLinha = corpo * el.entrelinha;
  // Centraliza o bloco de linhas na caixa: sem isto, um título de duas
  // linhas desceria e encostaria no que vem abaixo.
  const alturaBloco = alturaLinha * linhas.length;
  const topo = (el.caixa.y + el.caixa.altura / 2) * A - alturaBloco / 2;
  const primeiraBase = topo + corpo * 0.82;

  const sombra = el.sombra
    ? ' style="paint-order:stroke;stroke:rgba(0,0,0,.55);stroke-width:' +
      (corpo * 0.06).toFixed(2) +
      ';stroke-linejoin:round"'
    : "";

  const tspans = linhas
    .map(
      (linha, i) =>
        `<tspan x="${x.toFixed(2)}" y="${(primeiraBase + i * alturaLinha).toFixed(2)}">${escapar(linha)}</tspan>`,
    )
    .join("");

  return (
    `<text text-anchor="${anchor}" fill="${escapar(el.cor)}" ` +
    `font-family="${escapar(FONTES[el.fonte] ?? FONTES.sans)}" ` +
    `font-size="${corpo.toFixed(2)}" font-weight="${el.peso}" ` +
    `letter-spacing="${(el.espacamento * corpo).toFixed(2)}"${sombra}>${tspans}</text>`
  );
}

function desenharElemento(el: Elemento, L: number, A: number): string {
  if (el.tipo !== "fundo" && el.oculto) return "";
  switch (el.tipo) {
    case "fundo": {
      const [a, b] = [el.cores[0] ?? "#000000", el.cores[1] ?? el.cores[0] ?? "#000000"];
      if (el.estilo === "foto" && el.src) {
        return (
          `<image href="${escapar(el.src)}" x="0" y="0" width="${L}" height="${A}" ` +
          `preserveAspectRatio="xMidYMid slice"/>` +
          `<rect x="0" y="0" width="${L}" height="${A}" fill="#000000" opacity="${el.veu}"/>`
        );
      }
      if (el.estilo === "gradiente") {
        return (
          `<defs><linearGradient id="g" gradientTransform="rotate(${el.angulo})">` +
          `<stop offset="0%" stop-color="${escapar(a)}"/><stop offset="100%" stop-color="${escapar(b)}"/>` +
          `</linearGradient></defs><rect x="0" y="0" width="${L}" height="${A}" fill="url(#g)"/>`
        );
      }
      if (el.estilo === "radial") {
        return (
          `<defs><radialGradient id="g" cx="50%" cy="38%" r="78%">` +
          `<stop offset="0%" stop-color="${escapar(b)}"/><stop offset="100%" stop-color="${escapar(a)}"/>` +
          `</radialGradient></defs><rect x="0" y="0" width="${L}" height="${A}" fill="url(#g)"/>`
        );
      }
      return `<rect x="0" y="0" width="${L}" height="${A}" fill="${escapar(a)}"/>`;
    }
    case "forma": {
      const { x, y, largura, altura } = el.caixa;
      if (el.forma === "circulo") {
        const r = (Math.min(largura * L, altura * A) / 2).toFixed(2);
        return (
          `<circle cx="${((x + largura / 2) * L).toFixed(2)}" cy="${((y + altura / 2) * A).toFixed(2)}" ` +
          `r="${r}" fill="${escapar(el.cor)}" opacity="${el.opacidade}"/>`
        );
      }
      const rx = (el.raio * Math.min(largura * L, altura * A)) / 2;
      return (
        `<rect x="${(x * L).toFixed(2)}" y="${(y * A).toFixed(2)}" ` +
        `width="${(largura * L).toFixed(2)}" height="${(altura * A).toFixed(2)}" ` +
        `rx="${rx.toFixed(2)}" fill="${escapar(el.cor)}" opacity="${el.opacidade}"/>`
      );
    }
    case "imagem": {
      const { x, y, largura, altura } = el.caixa;
      const modo = el.ajuste === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      return (
        `<image href="${escapar(el.src)}" x="${(x * L).toFixed(2)}" y="${(y * A).toFixed(2)}" ` +
        `width="${(largura * L).toFixed(2)}" height="${(altura * A).toFixed(2)}" ` +
        `preserveAspectRatio="${modo}" opacity="${el.opacidade}"/>`
      );
    }
    case "atmosfera": {
      // Os ids de gradiente e filtro levam o id do elemento: duas camadas
      // na mesma arte disputariam o mesmo nome, e a segunda venceria.
      const marca = el.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "atm";
      const p = pintarAtmosfera(el.atmosfera, L, A, el.cor, el.semente, `a${marca}`, el.clara);
      if (!p.corpo) return "";
      return `${p.defs ? `<defs>${p.defs}</defs>` : ""}${p.corpo}`;
    }
    case "texto":
      return desenharTexto(el, L, A);
  }
}

/**
 * O SVG da arte, em pixels do formato escolhido.
 *
 * `escala` existe só para a miniatura: o desenho é o mesmo, num quadro menor.
 * Nada de reposicionar nem simplificar — miniatura que mente é pior que
 * miniatura feia.
 */
export function paraSvg(doc: Documento, escala = 1): string {
  const L = doc.largura;
  const A = doc.altura;
  const corpo = doc.elementos.map((el) => desenharElemento(el, L, A)).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(L * escala)}" ` +
    `height="${Math.round(A * escala)}" viewBox="0 0 ${L} ${A}">${corpo}</svg>`
  );
}
