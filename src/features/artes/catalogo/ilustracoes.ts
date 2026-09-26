import type { PublicoId } from "../briefing.ts";
import type { CaixaRelativa, Densidade, Ponto } from "../documento.ts";

/**
 * A biblioteca de ilustrações, desenhada aqui mesmo, em SVG.
 *
 * Nenhuma imagem foi copiada de lugar nenhum: cada desenho é um punhado de
 * formas escritas à mão neste arquivo, e por isso a licença é a do projeto.
 * O desenho não tem cor própria — recebe cinco cores da paleta da arte, e o
 * mesmo livro sai terracota numa opção e azul na outra, sempre combinando.
 *
 * Os metadados são o que o gerador usa para escolher: assunto (livro,
 * estudo, colheita), público, orientação, ponto focal e onde há espaço
 * livre para texto. Símbolo religioso tem assunto próprio e só entra onde a
 * categoria pede — pomba no batismo, cálice na ceia — nunca "em qualquer
 * evento de igreja".
 */

export interface CoresDoDesenho {
  /** Cor principal do objeto. */
  a: string;
  /** Segunda cor. */
  b: string;
  /** Papel: páginas, luz, fundo de objeto. */
  p: string;
  /** Tinta escura: detalhe, linha, sombra. */
  e: string;
  /** Terceira cor, suave. */
  t: string;
}

export type TipoDeIlustracao = "ilustracao" | "icone" | "cena";

export interface Ilustracao {
  id: string;
  nome: string;
  tipo: TipoDeIlustracao;
  assuntos: string[];
  publico: readonly PublicoId[];
  largura: number;
  altura: number;
  pontoFocal: Ponto;
  /** Parte do desenho vazia o bastante para receber texto, se houver. */
  areaTexto: CaixaRelativa | null;
  densidade: Densidade;
  transparente: true;
  origem: string;
  licenca: string;
  desenhar: (c: CoresDoDesenho) => string;
}

const ORIGEM = "Desenhada por código no Lúmen (src/features/artes/catalogo/ilustracoes.ts)";
const LICENCA = "Mesma licença do projeto Lúmen";
const TODOS: readonly PublicoId[] = ["todos", "adultos", "jovens", "adolescentes", "criancas", "familias", "mulheres", "homens", "lideranca"];

function svg(l: number, a: number, corpo: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${a}" width="${l}" height="${a}">${corpo}</svg>`;
}

/** Linhas de texto num papel, curvadas como página de livro aberto. */
function linhasDePagina(x1: number, x2: number, y0: number, n: number, passo: number, curva: number, cor: string): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const y = y0 + i * passo;
    const fim = i === n - 1 ? x1 + (x2 - x1) * 0.6 : x2;
    s += `<path d="M${x1} ${y} Q${(x1 + fim) / 2} ${y - curva} ${fim} ${y + curva * 0.2}" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" opacity=".32"/>`;
  }
  return s;
}

function estrela(cx: number, cy: number, r: number, cor: string, giro = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2 + giro;
    const raio = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(ang) * raio).toFixed(1)},${(cy + Math.sin(ang) * raio).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${cor}"/>`;
}

function pessoa(x: number, y: number, escala: number, corpo: string, cabeca: string, cabelo: string, cabeloTipo: 0 | 1 | 2): string {
  const s = escala;
  const cab =
    cabeloTipo === 0
      ? `<path d="M${x - 15 * s} ${y - 40 * s} Q${x} ${y - 66 * s} ${x + 15 * s} ${y - 40 * s} Q${x + 12 * s} ${y - 52 * s} ${x} ${y - 54 * s} Q${x - 12 * s} ${y - 52 * s} ${x - 15 * s} ${y - 40 * s}Z" fill="${cabelo}"/>`
      : cabeloTipo === 1
        ? `<path d="M${x - 16 * s} ${y - 38 * s} Q${x - 18 * s} ${y - 62 * s} ${x} ${y - 60 * s} Q${x + 18 * s} ${y - 62 * s} ${x + 16 * s} ${y - 38 * s} L${x + 17 * s} ${y - 22 * s} L${x + 10 * s} ${y - 30 * s} L${x - 10 * s} ${y - 30 * s} L${x - 17 * s} ${y - 22 * s}Z" fill="${cabelo}"/>`
        : `<circle cx="${x}" cy="${y - 52 * s}" r="${11 * s}" fill="${cabelo}"/>`;
  return (
    `<path d="M${x - 30 * s} ${y + 30 * s} Q${x - 30 * s} ${y - 18 * s} ${x} ${y - 18 * s} Q${x + 30 * s} ${y - 18 * s} ${x + 30 * s} ${y + 30 * s}Z" fill="${corpo}"/>` +
    `<circle cx="${x}" cy="${y - 38 * s}" r="${15 * s}" fill="${cabeca}"/>` +
    cab
  );
}

// ─────────────────────────────────────────────── estudo e leitura

const livroAberto: Ilustracao = {
  id: "livro-aberto",
  nome: "Livro aberto",
  tipo: "ilustracao",
  assuntos: ["livro", "biblia", "estudo", "leitura", "conhecimento", "aprendizado"],
  publico: TODOS,
  largura: 240,
  altura: 170,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      240,
      170,
      `<ellipse cx="120" cy="156" rx="104" ry="9" fill="${c.e}" opacity=".12"/>` +
        `<path d="M14 44 Q68 26 120 48 Q172 26 226 44 L226 148 Q172 132 120 152 Q68 132 14 148Z" fill="${c.b}"/>` +
        `<path d="M24 38 Q70 20 118 42 V142 Q70 122 24 136Z" fill="${c.p}"/>` +
        `<path d="M216 38 Q170 20 122 42 V142 Q170 122 216 136Z" fill="${c.p}"/>` +
        `<path d="M118 42 V142 L122 142 V42Z" fill="${c.e}" opacity=".18"/>` +
        linhasDePagina(38, 106, 58, 7, 11, 9, c.e) +
        linhasDePagina(134, 202, 50, 7, 11, -9, c.e) +
        `<path d="M150 30 H162 V104 L156 96 L150 104Z" fill="${c.a}"/>`,
    ),
};

const pilhaDeLivros: Ilustracao = {
  id: "pilha-de-livros",
  nome: "Pilha de livros",
  tipo: "ilustracao",
  assuntos: ["livro", "estudo", "conhecimento", "biblia", "aprendizado"],
  publico: TODOS,
  largura: 200,
  altura: 190,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      200,
      190,
      `<ellipse cx="100" cy="180" rx="86" ry="7" fill="${c.e}" opacity=".12"/>` +
        `<rect x="20" y="140" width="160" height="34" rx="4" fill="${c.a}"/>` +
        `<rect x="26" y="146" width="148" height="4" fill="${c.p}" opacity=".5"/>` +
        `<rect x="26" y="164" width="148" height="4" fill="${c.p}" opacity=".5"/>` +
        `<rect x="34" y="108" width="136" height="32" rx="4" fill="${c.b}"/>` +
        `<rect x="150" y="108" width="12" height="32" fill="${c.t}"/>` +
        `<rect x="26" y="80" width="150" height="28" rx="4" fill="${c.e}"/>` +
        `<rect x="40" y="90" width="60" height="4" rx="2" fill="${c.p}" opacity=".7"/>` +
        `<g transform="rotate(-8 100 60)"><rect x="42" y="50" width="120" height="30" rx="4" fill="${c.t}"/>` +
        `<rect x="48" y="50" width="6" height="30" fill="${c.a}"/><rect x="146" y="50" width="6" height="30" fill="${c.a}"/></g>`,
    ),
};

const caderno: Ilustracao = {
  id: "caderno",
  nome: "Caderno e lápis",
  tipo: "ilustracao",
  assuntos: ["anotacao", "estudo", "aprendizado", "caderno", "conhecimento"],
  publico: TODOS,
  largura: 190,
  altura: 220,
  pontoFocal: { x: 0.5, y: 0.45 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    let aneis = "";
    for (let y = 30; y <= 190; y += 20) aneis += `<rect x="16" y="${y}" width="20" height="7" rx="3.5" fill="${c.e}" opacity=".75"/>`;
    let linhas = "";
    for (let y = 60; y <= 190; y += 16) linhas += `<line x1="40" y1="${y}" x2="166" y2="${y}" stroke="${c.b}" stroke-width="1.6" opacity=".45"/>`;
    return svg(
      190,
      220,
      `<rect x="30" y="18" width="146" height="190" rx="8" fill="${c.e}" opacity=".12" transform="translate(6 6)"/>` +
        `<rect x="26" y="14" width="146" height="190" rx="8" fill="${c.p}"/>` +
        `<line x1="60" y1="14" x2="60" y2="204" stroke="${c.a}" stroke-width="2" opacity=".7"/>` +
        linhas +
        aneis +
        `<path d="M72 80 Q92 70 112 82 T150 80" fill="none" stroke="${c.e}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>` +
        `<path d="M72 112 Q100 104 130 114" fill="none" stroke="${c.e}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>` +
        `<g transform="rotate(38 130 150)"><rect x="80" y="142" width="96" height="16" rx="2" fill="${c.a}"/>` +
        `<rect x="170" y="142" width="14" height="16" fill="${c.t}"/><path d="M80 142 L62 150 L80 158Z" fill="${c.p}"/>` +
        `<path d="M68 147 L62 150 L68 153Z" fill="${c.e}"/></g>`,
    );
  },
};

const oculos: Ilustracao = {
  id: "oculos",
  nome: "Óculos de leitura",
  tipo: "icone",
  assuntos: ["leitura", "estudo", "conhecimento", "livro"],
  publico: ["todos", "adultos", "lideranca", "familias", "mulheres", "homens"],
  largura: 200,
  altura: 90,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      200,
      90,
      `<rect x="18" y="26" width="70" height="48" rx="22" fill="${c.p}" opacity=".35" stroke="${c.e}" stroke-width="7"/>` +
        `<rect x="112" y="26" width="70" height="48" rx="22" fill="${c.p}" opacity=".35" stroke="${c.e}" stroke-width="7"/>` +
        `<path d="M88 44 Q100 32 112 44" fill="none" stroke="${c.e}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M18 42 L4 30" stroke="${c.e}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M182 42 L196 30" stroke="${c.e}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M34 40 L46 34" stroke="${c.p}" stroke-width="4" stroke-linecap="round" opacity=".8"/>` +
        `<path d="M128 40 L140 34" stroke="${c.p}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
    ),
};

const luminaria: Ilustracao = {
  id: "luminaria",
  nome: "Luminária de mesa",
  tipo: "ilustracao",
  assuntos: ["estudo", "conhecimento", "leitura"],
  publico: TODOS,
  largura: 180,
  altura: 220,
  pontoFocal: { x: 0.55, y: 0.35 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      180,
      220,
      `<path d="M112 72 L170 196 L54 196 Z" fill="${c.p}" opacity=".28"/>` +
        `<ellipse cx="60" cy="204" rx="44" ry="10" fill="${c.a}"/>` +
        `<path d="M60 200 L44 118 L100 60" fill="none" stroke="${c.e}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<circle cx="44" cy="118" r="8" fill="${c.a}"/><circle cx="100" cy="60" r="7" fill="${c.a}"/>` +
        `<path d="M88 44 L136 30 L152 82 L100 92 Z" fill="${c.a}"/>` +
        `<path d="M100 92 L152 82" stroke="${c.e}" stroke-width="3" opacity=".3"/>`,
    ),
};

const xicara: Ilustracao = {
  id: "xicara",
  nome: "Xícara",
  tipo: "ilustracao",
  assuntos: ["cafe", "conversa", "casa", "comunhao", "estudo"],
  publico: ["todos", "adultos", "jovens", "familias", "mulheres", "homens", "lideranca"],
  largura: 160,
  altura: 170,
  pontoFocal: { x: 0.45, y: 0.6 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      160,
      170,
      `<path d="M52 18 Q42 34 54 48 Q66 62 56 76" fill="none" stroke="${c.e}" stroke-width="4" stroke-linecap="round" opacity=".35"/>` +
        `<path d="M78 12 Q68 30 80 44 Q92 58 82 72" fill="none" stroke="${c.e}" stroke-width="4" stroke-linecap="round" opacity=".35"/>` +
        `<ellipse cx="72" cy="156" rx="62" ry="9" fill="${c.b}"/>` +
        `<path d="M22 84 H122 L114 138 Q110 152 94 152 H50 Q34 152 30 138Z" fill="${c.a}"/>` +
        `<path d="M120 96 Q146 96 144 114 Q142 132 114 130" fill="none" stroke="${c.a}" stroke-width="10"/>` +
        `<ellipse cx="72" cy="84" rx="50" ry="8" fill="${c.e}" opacity=".35"/>` +
        `<path d="M40 104 H104" stroke="${c.p}" stroke-width="5" stroke-linecap="round" opacity=".5"/>`,
    ),
};

const grupoDeEstudo: Ilustracao = {
  id: "grupo-de-estudo",
  nome: "Grupo de estudo",
  tipo: "cena",
  assuntos: ["grupo", "estudo", "conversa", "comunhao", "aprendizado", "celula"],
  publico: ["todos", "adultos", "jovens", "adolescentes", "familias", "mulheres", "homens", "lideranca"],
  largura: 300,
  altura: 190,
  pontoFocal: { x: 0.5, y: 0.55 },
  areaTexto: { x: 0.08, y: 0, largura: 0.84, altura: 0.18 },
  densidade: "alta",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      300,
      190,
      pessoa(62, 110, 1.05, c.b, c.t, c.e, 1) +
        pessoa(150, 92, 1.1, c.a, c.t, c.e, 0) +
        pessoa(238, 110, 1.05, c.e, c.t, c.b, 2) +
        `<rect x="18" y="138" width="264" height="14" rx="4" fill="${c.e}" opacity=".85"/>` +
        `<rect x="34" y="152" width="10" height="34" fill="${c.e}" opacity=".7"/><rect x="256" y="152" width="10" height="34" fill="${c.e}" opacity=".7"/>` +
        `<path d="M110 132 Q130 124 150 132 Q170 124 190 132 L190 140 L110 140Z" fill="${c.p}"/>` +
        `<path d="M150 132 V140" stroke="${c.e}" stroke-width="2" opacity=".3"/>` +
        `<rect x="44" y="126" width="36" height="12" rx="2" fill="${c.a}"/>` +
        `<path d="M214 128 h28 l-4 10 h-20z" fill="${c.p}"/>`,
    ),
};

const baloesDeConversa: Ilustracao = {
  id: "baloes-de-conversa",
  nome: "Balões de conversa",
  tipo: "icone",
  assuntos: ["conversa", "grupo", "comunhao", "celula", "aprendizado"],
  publico: TODOS,
  largura: 200,
  altura: 170,
  pontoFocal: { x: 0.5, y: 0.45 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      200,
      170,
      `<path d="M14 20 H122 Q134 20 134 32 V86 Q134 98 122 98 H56 L32 118 L36 98 H26 Q14 98 14 86Z" fill="${c.a}"/>` +
        `<circle cx="50" cy="60" r="7" fill="${c.p}"/><circle cx="74" cy="60" r="7" fill="${c.p}"/><circle cx="98" cy="60" r="7" fill="${c.p}"/>` +
        `<path d="M72 74 H180 Q190 74 190 84 V134 Q190 144 180 144 H170 L172 162 L150 144 H82 Q72 144 72 134Z" fill="${c.b}"/>` +
        `<rect x="92" y="96" width="78" height="7" rx="3.5" fill="${c.p}" opacity=".85"/>` +
        `<rect x="92" y="114" width="52" height="7" rx="3.5" fill="${c.p}" opacity=".85"/>`,
    ),
};

const lousa: Ilustracao = {
  id: "lousa",
  nome: "Lousa",
  tipo: "ilustracao",
  assuntos: ["aprendizado", "estudo", "conhecimento", "crianca"],
  publico: TODOS,
  largura: 240,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.45 },
  areaTexto: { x: 0.14, y: 0.16, largura: 0.72, altura: 0.5 },
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      240,
      180,
      `<rect x="10" y="10" width="220" height="140" rx="6" fill="${c.b}"/>` +
        `<rect x="22" y="22" width="196" height="116" rx="3" fill="${c.e}"/>` +
        `<path d="M44 58 Q70 44 96 60 T150 56" fill="none" stroke="${c.p}" stroke-width="3" stroke-linecap="round" opacity=".65"/>` +
        `<path d="M44 84 Q86 76 124 86" fill="none" stroke="${c.p}" stroke-width="3" stroke-linecap="round" opacity=".5"/>` +
        `<circle cx="178" cy="88" r="16" fill="none" stroke="${c.a}" stroke-width="3"/>` +
        `<path d="M160 118 L196 118" stroke="${c.a}" stroke-width="3" stroke-linecap="round"/>` +
        `<rect x="150" y="140" width="40" height="8" rx="2" fill="${c.p}"/>` +
        `<rect x="40" y="150" width="10" height="26" fill="${c.b}"/><rect x="190" y="150" width="10" height="26" fill="${c.b}"/>`,
    ),
};

const calendario: Ilustracao = {
  id: "calendario",
  nome: "Calendário",
  tipo: "icone",
  assuntos: ["calendario", "institucional", "agenda"],
  publico: TODOS,
  largura: 160,
  altura: 160,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    let grade = "";
    for (let l = 0; l < 3; l++) for (let k = 0; k < 4; k++) grade += `<rect x="${30 + k * 26}" y="${74 + l * 22}" width="18" height="14" rx="3" fill="${l === 1 && k === 2 ? c.a : c.e}" opacity="${l === 1 && k === 2 ? 1 : 0.2}"/>`;
    return svg(
      160,
      160,
      `<rect x="16" y="26" width="128" height="120" rx="12" fill="${c.p}"/>` +
        `<path d="M16 38 Q16 26 28 26 H132 Q144 26 144 38 V60 H16Z" fill="${c.a}"/>` +
        `<rect x="44" y="12" width="10" height="28" rx="5" fill="${c.e}"/><rect x="106" y="12" width="10" height="28" rx="5" fill="${c.e}"/>` +
        grade,
    );
  },
};

// ─────────────────────────────────────────────── natureza e gratidão

const planta: Ilustracao = {
  id: "planta",
  nome: "Planta no vaso",
  tipo: "ilustracao",
  assuntos: ["natureza", "gratidao", "casa", "crescimento", "estudo"],
  publico: TODOS,
  largura: 160,
  altura: 230,
  pontoFocal: { x: 0.5, y: 0.4 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const folha = (x: number, y: number, ang: number, cor: string, t = 1) =>
      `<path transform="translate(${x} ${y}) rotate(${ang}) scale(${t})" d="M0 0 Q18 -34 0 -74 Q-18 -34 0 0Z" fill="${cor}"/>` +
      `<path transform="translate(${x} ${y}) rotate(${ang}) scale(${t})" d="M0 -4 L0 -66" stroke="${c.e}" stroke-width="1.6" opacity=".25"/>`;
    return svg(
      160,
      230,
      folha(80, 150, -34, c.b, 1.1) + folha(80, 150, 30, c.b, 1.05) + folha(80, 150, -8, c.t, 1.3) + folha(80, 150, -62, c.t, 0.8) + folha(80, 150, 58, c.t, 0.8) +
        `<path d="M40 148 H120 L110 216 Q108 224 100 224 H60 Q52 224 50 216Z" fill="${c.a}"/>` +
        `<rect x="34" y="140" width="92" height="16" rx="4" fill="${c.a}"/>` +
        `<rect x="34" y="150" width="92" height="6" fill="${c.e}" opacity=".18"/>`,
    );
  },
};

const ramo: Ilustracao = {
  id: "ramo",
  nome: "Ramo de folhas",
  tipo: "ilustracao",
  assuntos: ["natureza", "gratidao", "casal", "celebracao", "paz"],
  publico: TODOS,
  largura: 240,
  altura: 120,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    let folhas = "";
    for (let i = 0; i < 7; i++) {
      const x = 34 + i * 26;
      const y = 70 - Math.sin((i / 6) * Math.PI) * 26;
      folhas += `<ellipse cx="${x + 6}" cy="${y - 14}" rx="7" ry="16" transform="rotate(${-40 + i * 3} ${x + 6} ${y - 14})" fill="${i % 2 ? c.a : c.b}"/>`;
      folhas += `<ellipse cx="${x + 10}" cy="${y + 12}" rx="7" ry="16" transform="rotate(${220 - i * 3} ${x + 10} ${y + 12})" fill="${i % 2 ? c.b : c.t}"/>`;
    }
    return svg(240, 120, `<path d="M18 80 Q120 20 226 70" fill="none" stroke="${c.e}" stroke-width="3" stroke-linecap="round" opacity=".6"/>` + folhas);
  },
};

const trigo: Ilustracao = {
  id: "trigo",
  nome: "Trigo",
  tipo: "ilustracao",
  assuntos: ["colheita", "gratidao", "pao", "ceia", "natureza"],
  publico: TODOS,
  largura: 150,
  altura: 240,
  pontoFocal: { x: 0.5, y: 0.3 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const espiga = (x: number, inclina: number, cor: string) => {
      let graos = "";
      for (let i = 0; i < 7; i++) {
        const y = 40 + i * 13;
        graos += `<ellipse cx="${x - 7}" cy="${y}" rx="6" ry="11" transform="rotate(-28 ${x - 7} ${y})" fill="${cor}"/>`;
        graos += `<ellipse cx="${x + 7}" cy="${y}" rx="6" ry="11" transform="rotate(28 ${x + 7} ${y})" fill="${cor}"/>`;
      }
      return `<g transform="rotate(${inclina} ${x} 230)"><path d="M${x} 230 V34" stroke="${c.e}" stroke-width="3" opacity=".55"/>${graos}<ellipse cx="${x}" cy="30" rx="6" ry="12" fill="${cor}"/></g>`;
    };
    return svg(150, 240, espiga(50, -14, c.b) + espiga(100, 12, c.b) + espiga(75, 0, c.a));
  },
};

const solEMontes: Ilustracao = {
  id: "sol-e-montes",
  nome: "Montes ao amanhecer",
  tipo: "cena",
  assuntos: ["natureza", "gratidao", "pascoa", "luz", "familia"],
  publico: TODOS,
  largura: 320,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0.05, y: 0, largura: 0.9, altura: 0.34 },
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      320,
      180,
      `<circle cx="200" cy="104" r="40" fill="${c.a}"/>` +
        `<path d="M0 132 Q70 76 150 118 Q210 88 320 124 V180 H0Z" fill="${c.b}"/>` +
        `<path d="M0 150 Q90 112 180 150 Q250 128 320 148 V180 H0Z" fill="${c.t}"/>` +
        `<path d="M0 166 Q120 146 320 168 V180 H0Z" fill="${c.e}" opacity=".45"/>`,
    ),
};

const arvores: Ilustracao = {
  id: "arvores",
  nome: "Árvores",
  tipo: "ilustracao",
  assuntos: ["natureza", "familia", "crescimento", "gratidao"],
  publico: TODOS,
  largura: 260,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      260,
      180,
      `<rect x="54" y="110" width="10" height="60" fill="${c.e}" opacity=".7"/><circle cx="59" cy="92" r="42" fill="${c.b}"/>` +
        `<rect x="136" y="84" width="12" height="86" fill="${c.e}" opacity=".7"/><path d="M142 10 L196 104 H88Z" fill="${c.a}"/><path d="M142 44 L186 124 H98Z" fill="${c.a}"/>` +
        `<rect x="206" y="120" width="8" height="50" fill="${c.e}" opacity=".7"/><circle cx="210" cy="108" r="28" fill="${c.t}"/>` +
        `<rect x="10" y="168" width="240" height="6" rx="3" fill="${c.e}" opacity=".35"/>`,
    ),
};

const folhasSoltas: Ilustracao = {
  id: "folhas-soltas",
  nome: "Folhas soltas",
  tipo: "icone",
  assuntos: ["natureza", "gratidao", "decoracao", "suave"],
  publico: TODOS,
  largura: 200,
  altura: 200,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const f = (x: number, y: number, r: number, ang: number, cor: string) =>
      `<path transform="translate(${x} ${y}) rotate(${ang})" d="M0 ${-r} Q${r * 0.6} 0 0 ${r} Q${-r * 0.6} 0 0 ${-r}Z" fill="${cor}"/><path transform="translate(${x} ${y}) rotate(${ang})" d="M0 ${-r * 0.8} V${r * 0.8}" stroke="${c.e}" stroke-width="1.5" opacity=".25"/>`;
    return svg(200, 200, f(56, 60, 34, -30, c.a) + f(140, 52, 26, 40, c.b) + f(110, 128, 40, 10, c.t) + f(40, 150, 22, -70, c.b) + f(166, 150, 20, 70, c.a));
  },
};

// ─────────────────────────────────────────────── celebração, música, juventude

const notasMusicais: Ilustracao = {
  id: "notas-musicais",
  nome: "Notas musicais",
  tipo: "icone",
  assuntos: ["musica", "celebracao", "louvor"],
  publico: TODOS,
  largura: 200,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      200,
      180,
      `<ellipse cx="48" cy="140" rx="22" ry="16" transform="rotate(-20 48 140)" fill="${c.a}"/>` +
        `<ellipse cx="128" cy="124" rx="22" ry="16" transform="rotate(-20 128 124)" fill="${c.a}"/>` +
        `<rect x="64" y="40" width="8" height="100" fill="${c.a}"/><rect x="144" y="24" width="8" height="100" fill="${c.a}"/>` +
        `<path d="M64 40 L152 24 V44 L64 60Z" fill="${c.b}"/>` +
        `<ellipse cx="176" cy="70" rx="12" ry="9" transform="rotate(-20 176 70)" fill="${c.t}"/><rect x="185" y="18" width="5" height="52" fill="${c.t}"/>`,
    ),
};

const microfone: Ilustracao = {
  id: "microfone",
  nome: "Microfone",
  tipo: "ilustracao",
  assuntos: ["musica", "louvor", "energia", "juventude"],
  publico: TODOS,
  largura: 140,
  altura: 240,
  pontoFocal: { x: 0.5, y: 0.25 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    let grade = "";
    for (let i = 0; i < 5; i++) grade += `<line x1="46" y1="${34 + i * 12}" x2="94" y2="${34 + i * 12}" stroke="${c.e}" stroke-width="2" opacity=".3"/>`;
    return svg(
      140,
      240,
      `<rect x="40" y="16" width="60" height="90" rx="30" fill="${c.a}"/>` + grade +
        `<path d="M28 80 Q28 132 70 132 Q112 132 112 80" fill="none" stroke="${c.e}" stroke-width="7" stroke-linecap="round"/>` +
        `<rect x="66" y="132" width="8" height="76" fill="${c.e}"/><rect x="34" y="206" width="72" height="12" rx="6" fill="${c.b}"/>`,
    );
  },
};

const estrelasEConfete: Ilustracao = {
  id: "estrelas-e-confete",
  nome: "Estrelas e confete",
  tipo: "icone",
  assuntos: ["celebracao", "juventude", "energia", "festa", "crianca", "natal"],
  publico: TODOS,
  largura: 240,
  altura: 200,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: { x: 0.25, y: 0.3, largura: 0.5, altura: 0.4 },
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      240,
      200,
      estrela(40, 40, 22, c.a, 0.2) + estrela(200, 60, 16, c.b, -0.3) + estrela(180, 170, 24, c.a, 0.1) + estrela(56, 160, 12, c.t) +
        `<rect x="100" y="20" width="14" height="6" rx="3" transform="rotate(30 107 23)" fill="${c.b}"/>` +
        `<rect x="140" y="110" width="14" height="6" rx="3" transform="rotate(-40 147 113)" fill="${c.t}"/>` +
        `<rect x="18" y="100" width="14" height="6" rx="3" transform="rotate(60 25 103)" fill="${c.a}"/>` +
        `<circle cx="126" cy="180" r="5" fill="${c.b}"/><circle cx="220" cy="120" r="4" fill="${c.a}"/><circle cx="90" cy="90" r="3" fill="${c.t}"/>`,
    ),
};

const cidade: Ilustracao = {
  id: "cidade",
  nome: "Cidade",
  tipo: "cena",
  assuntos: ["cidade", "juventude", "noite", "missao", "energia"],
  publico: ["todos", "jovens", "adolescentes", "adultos", "lideranca", "homens", "mulheres"],
  largura: 320,
  altura: 160,
  pontoFocal: { x: 0.5, y: 0.7 },
  areaTexto: { x: 0, y: 0, largura: 1, altura: 0.3 },
  densidade: "alta",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const predios: [number, number, number, string][] = [
      [0, 70, 40, c.b], [40, 40, 34, c.a], [74, 86, 44, c.e], [118, 24, 38, c.b], [156, 60, 46, c.a],
      [202, 36, 30, c.e], [232, 80, 42, c.b], [274, 50, 46, c.a],
    ];
    let s = "";
    for (const [x, y, l, cor] of predios) {
      s += `<rect x="${x}" y="${y}" width="${l}" height="${160 - y}" fill="${cor}"/>`;
      for (let yy = y + 12; yy < 150; yy += 16) for (let xx = x + 7; xx < x + l - 8; xx += 11) s += `<rect x="${xx}" y="${yy}" width="5" height="7" fill="${c.p}" opacity="${(xx + yy) % 3 === 0 ? 0.8 : 0.25}"/>`;
    }
    return svg(320, 160, s);
  },
};

const baloesDeFesta: Ilustracao = {
  id: "baloes-de-festa",
  nome: "Balões",
  tipo: "ilustracao",
  assuntos: ["celebracao", "crianca", "festa", "aniversario", "brincar"],
  publico: TODOS,
  largura: 190,
  altura: 240,
  pontoFocal: { x: 0.5, y: 0.3 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const balao = (x: number, y: number, cor: string, fio: string) =>
      `<path d="${fio}" fill="none" stroke="${c.e}" stroke-width="2" opacity=".5"/>` +
      `<ellipse cx="${x}" cy="${y}" rx="34" ry="42" fill="${cor}"/><path d="M${x - 5} ${y + 42} L${x + 5} ${y + 42} L${x} ${y + 50}Z" fill="${cor}"/>` +
      `<ellipse cx="${x - 12}" cy="${y - 16}" rx="7" ry="12" fill="${c.p}" opacity=".45"/>`;
    return svg(
      190,
      240,
      balao(56, 70, c.b, "M56 118 Q70 170 94 232") + balao(134, 60, c.t, "M134 108 Q120 170 96 232") + balao(96, 110, c.a, "M96 158 Q90 200 96 232"),
    );
  },
};

const lapisDeCor: Ilustracao = {
  id: "lapis-de-cor",
  nome: "Lápis de cor",
  tipo: "ilustracao",
  assuntos: ["crianca", "aprendizado", "brincar", "estudo"],
  publico: ["todos", "criancas", "familias", "adolescentes"],
  largura: 220,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const lapis = (ang: number, cor: string) =>
      `<g transform="rotate(${ang} 110 170)"><rect x="100" y="40" width="20" height="120" fill="${cor}"/>` +
      `<path d="M100 40 L110 12 L120 40Z" fill="${c.p}"/><path d="M106 22 L110 12 L114 22Z" fill="${cor}"/>` +
      `<rect x="100" y="150" width="20" height="10" fill="${c.e}" opacity=".3"/></g>`;
    return svg(220, 180, lapis(-36, c.a) + lapis(-12, c.b) + lapis(12, c.t) + lapis(36, c.e));
  },
};

const blocos: Ilustracao = {
  id: "blocos",
  nome: "Blocos de brinquedo",
  tipo: "ilustracao",
  assuntos: ["crianca", "brincar", "aprendizado"],
  publico: ["todos", "criancas", "familias"],
  largura: 220,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.55 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const cubo = (x: number, y: number, s: number, cor: string, simbolo: string) =>
      `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="8" fill="${cor}"/><rect x="${x + 8}" y="${y + 8}" width="${s - 16}" height="${s - 16}" rx="5" fill="${c.p}" opacity=".85"/>${simbolo}`;
    return svg(
      220,
      180,
      cubo(18, 96, 76, c.a, `<circle cx="56" cy="134" r="18" fill="${c.b}"/>`) +
        cubo(100, 96, 76, c.b, `<path d="M138 116 L158 152 H118Z" fill="${c.a}"/>`) +
        cubo(58, 16, 76, c.t, `<rect x="80" y="38" width="32" height="32" rx="4" fill="${c.e}" opacity=".8"/>`),
    );
  },
};

// ─────────────────────────────────────────────── símbolos de ocasião

const paoECalice: Ilustracao = {
  id: "pao-e-calice",
  nome: "Pão e cálice",
  tipo: "ilustracao",
  assuntos: ["ceia", "pao", "calice", "comunhao"],
  publico: TODOS,
  largura: 260,
  altura: 200,
  pontoFocal: { x: 0.5, y: 0.55 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      260,
      200,
      `<ellipse cx="130" cy="188" rx="118" ry="9" fill="${c.e}" opacity=".15"/>` +
        `<path d="M150 40 H222 Q222 100 186 110 V160 Q186 168 200 172 Q214 176 214 184 H158 Q158 176 172 172 Q186 168 186 160" fill="${c.a}"/>` +
        `<path d="M150 40 H222 Q222 100 186 110 Q150 100 150 40Z" fill="${c.a}"/>` +
        `<path d="M156 52 H216 Q214 80 196 92" fill="none" stroke="${c.p}" stroke-width="4" opacity=".4"/>` +
        `<path d="M18 176 Q10 118 70 110 Q130 102 136 150 Q140 184 100 184 H40 Q22 184 18 176Z" fill="${c.b}"/>` +
        `<path d="M48 128 Q58 146 54 164 M78 122 Q90 142 86 164 M106 126 Q116 142 114 160" fill="none" stroke="${c.p}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
    ),
};

const aliancas: Ilustracao = {
  id: "aliancas",
  nome: "Alianças",
  tipo: "icone",
  assuntos: ["casal", "casamento", "familia"],
  publico: ["todos", "adultos", "familias"],
  largura: 200,
  altura: 150,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      200,
      150,
      `<ellipse cx="78" cy="82" rx="46" ry="44" fill="none" stroke="${c.a}" stroke-width="12"/>` +
        `<ellipse cx="122" cy="68" rx="46" ry="44" fill="none" stroke="${c.b}" stroke-width="12"/>` +
        `<path d="M40 60 Q52 40 74 36" fill="none" stroke="${c.p}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
    ),
};

const coracao: Ilustracao = {
  id: "coracao",
  nome: "Coração",
  tipo: "icone",
  assuntos: ["casal", "familia", "comunhao", "celebracao", "gratidao"],
  publico: TODOS,
  largura: 180,
  altura: 160,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      180,
      160,
      `<path d="M90 148 C30 110 8 78 12 50 C16 20 50 8 72 22 Q84 30 90 42 Q96 30 108 22 C130 8 164 20 168 50 C172 78 150 110 90 148Z" fill="${c.a}"/>` +
        `<path d="M44 44 Q36 56 40 72" fill="none" stroke="${c.p}" stroke-width="6" stroke-linecap="round" opacity=".5"/>`,
    ),
};

const ondas: Ilustracao = {
  id: "ondas",
  nome: "Ondas",
  tipo: "cena",
  assuntos: ["agua", "batismo", "natureza"],
  publico: TODOS,
  largura: 320,
  altura: 140,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0, y: 0, largura: 1, altura: 0.25 },
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) => {
    const onda = (y: number, amp: number, cor: string, op = 1) => {
      let d = `M0 ${y}`;
      for (let x = 0; x < 320; x += 40) d += ` Q${x + 10} ${y - amp} ${x + 20} ${y} T${x + 40} ${y}`;
      return `<path d="${d} V140 H0Z" fill="${cor}" opacity="${op}"/>`;
    };
    return svg(320, 140, onda(46, 12, c.t, 0.8) + onda(74, 14, c.b) + onda(104, 12, c.a));
  },
};

const pomba: Ilustracao = {
  id: "pomba",
  nome: "Pomba",
  tipo: "ilustracao",
  assuntos: ["batismo", "paz"],
  publico: TODOS,
  largura: 220,
  altura: 170,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      220,
      170,
      `<path d="M26 104 Q60 80 104 92 Q140 100 172 84 L206 70 L184 96 Q170 124 128 130 Q84 136 58 124 L22 136 Z" fill="${c.a}"/>` +
        `<path d="M92 94 Q110 30 176 14 Q156 50 150 92 Z" fill="${c.b}"/>` +
        `<path d="M104 94 Q96 52 58 36 Q66 70 80 96 Z" fill="${c.t}"/>` +
        `<circle cx="178" cy="84" r="3" fill="${c.e}"/>`,
    ),
};

const presente: Ilustracao = {
  id: "presente",
  nome: "Presente",
  tipo: "icone",
  assuntos: ["natal", "celebracao", "aniversario", "festa"],
  publico: TODOS,
  largura: 180,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.55 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      180,
      180,
      `<rect x="26" y="72" width="128" height="96" rx="6" fill="${c.a}"/>` +
        `<rect x="18" y="52" width="144" height="30" rx="6" fill="${c.a}"/><rect x="18" y="72" width="144" height="10" fill="${c.e}" opacity=".15"/>` +
        `<rect x="80" y="52" width="20" height="116" fill="${c.b}"/>` +
        `<path d="M90 52 Q58 16 46 34 Q38 52 90 52 Q122 16 134 34 Q142 52 90 52Z" fill="${c.b}"/>`,
    ),
};

const predioDeIgreja: Ilustracao = {
  id: "predio-de-igreja",
  nome: "Prédio da igreja",
  tipo: "ilustracao",
  assuntos: ["igreja", "institucional", "comunhao", "aniversario"],
  publico: TODOS,
  largura: 220,
  altura: 220,
  pontoFocal: { x: 0.5, y: 0.55 },
  areaTexto: null,
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      220,
      220,
      `<rect x="12" y="206" width="196" height="8" rx="4" fill="${c.e}" opacity=".3"/>` +
        `<path d="M20 120 L90 72 L160 120 V206 H20Z" fill="${c.a}"/>` +
        `<path d="M10 124 L90 66 L170 124" fill="none" stroke="${c.e}" stroke-width="8" stroke-linejoin="round" opacity=".6"/>` +
        `<rect x="130" y="64" width="56" height="142" fill="${c.b}"/><path d="M122 68 L158 18 L194 68Z" fill="${c.e}" opacity=".75"/>` +
        `<circle cx="158" cy="96" r="12" fill="${c.p}" opacity=".85"/>` +
        `<path d="M72 206 V160 Q90 138 108 160 V206Z" fill="${c.e}" opacity=".7"/>` +
        `<rect x="36" y="140" width="22" height="30" rx="11" fill="${c.p}" opacity=".7"/><rect x="146" y="140" width="24" height="34" rx="12" fill="${c.p}" opacity=".7"/>`,
    ),
};

const globo: Ilustracao = {
  id: "globo",
  nome: "Globo",
  tipo: "icone",
  assuntos: ["missao", "mundo", "cidade"],
  publico: TODOS,
  largura: 180,
  altura: 180,
  pontoFocal: { x: 0.5, y: 0.5 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      180,
      180,
      `<circle cx="90" cy="90" r="74" fill="${c.a}"/>` +
        `<path d="M40 50 Q64 40 80 58 Q92 72 76 88 Q64 98 70 116 Q56 120 44 104 Q30 84 40 50Z" fill="${c.b}"/>` +
        `<path d="M108 30 Q134 36 146 60 Q128 70 116 62 Q100 54 108 30Z M112 104 Q138 96 152 112 Q140 140 118 150 Q104 128 112 104Z" fill="${c.b}"/>` +
        `<ellipse cx="90" cy="90" rx="74" ry="30" fill="none" stroke="${c.p}" stroke-width="2" opacity=".4"/>` +
        `<ellipse cx="90" cy="90" rx="30" ry="74" fill="none" stroke="${c.p}" stroke-width="2" opacity=".4"/>`,
    ),
};

const maos: Ilustracao = {
  id: "maos-em-oracao",
  nome: "Mãos em oração",
  tipo: "ilustracao",
  assuntos: ["oracao", "vigilia", "comunhao"],
  publico: TODOS,
  largura: 180,
  altura: 220,
  pontoFocal: { x: 0.5, y: 0.45 },
  areaTexto: null,
  densidade: "baixa",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      180,
      220,
      `<path d="M88 18 Q80 18 76 34 L58 118 Q52 146 62 172 L70 210 H90 V40 Q90 18 88 18Z" fill="${c.a}"/>` +
        `<path d="M92 18 Q100 18 104 34 L122 118 Q128 146 118 172 L110 210 H90 V40 Q90 18 92 18Z" fill="${c.b}"/>` +
        `<path d="M70 210 H110 V220 H70Z" fill="${c.e}" opacity=".5"/>` +
        `<path d="M84 60 L84 150" stroke="${c.p}" stroke-width="3" opacity=".35" stroke-linecap="round"/>`,
    ),
};

// ─────────────────────────────────────────────── cenas compostas

/** Uma ilustração dentro de outra, no lugar e no tamanho pedidos. */
function encaixar(il: Ilustracao, c: CoresDoDesenho, x: number, y: number, largura: number): string {
  const altura = (largura * il.altura) / il.largura;
  const dentro = il.desenhar(c).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg x="${x}" y="${y}" width="${largura}" height="${altura}" viewBox="0 0 ${il.largura} ${il.altura}">${dentro}</svg>`;
}

const mesaDeEstudo: Ilustracao = {
  id: "mesa-de-estudo",
  nome: "Mesa de estudo",
  tipo: "cena",
  assuntos: ["estudo", "livro", "biblia", "anotacao", "conhecimento", "aprendizado", "leitura"],
  publico: ["todos", "adultos", "jovens", "adolescentes", "lideranca", "mulheres", "homens", "familias"],
  largura: 360,
  altura: 220,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0.05, y: 0, largura: 0.5, altura: 0.3 },
  densidade: "alta",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      360,
      220,
      encaixar(luminaria, c, 238, 18, 110) +
        encaixar(pilhaDeLivros, c, 20, 92, 120) +
        encaixar(livroAberto, c, 130, 104, 120) +
        encaixar(xicara, c, 262, 132, 58) +
        `<rect x="0" y="194" width="360" height="12" rx="3" fill="${c.e}" opacity=".85"/>` +
        `<rect x="20" y="206" width="12" height="14" fill="${c.e}" opacity=".6"/><rect x="328" y="206" width="12" height="14" fill="${c.e}" opacity=".6"/>`,
    ),
};

const cantinhoInfantil: Ilustracao = {
  id: "cantinho-infantil",
  nome: "Cantinho das crianças",
  tipo: "cena",
  assuntos: ["crianca", "brincar", "aprendizado", "celebracao", "estudo"],
  publico: ["todos", "criancas", "familias"],
  largura: 360,
  altura: 220,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0.2, y: 0, largura: 0.6, altura: 0.25 },
  densidade: "alta",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      360,
      220,
      encaixar(baloesDeFesta, c, 262, 0, 92) +
        encaixar(blocos, c, 12, 96, 130) +
        encaixar(livroAberto, c, 150, 128, 110) +
        encaixar(lapisDeCor, c, 228, 126, 100) +
        estrela(40, 40, 14, c.a) + estrela(170, 60, 10, c.b) +
        `<rect x="0" y="206" width="360" height="10" rx="5" fill="${c.e}" opacity=".3"/>`,
    ),
};

const colheita: Ilustracao = {
  id: "colheita",
  nome: "Colheita",
  tipo: "cena",
  assuntos: ["gratidao", "colheita", "natureza", "familia", "ceia"],
  publico: TODOS,
  largura: 340,
  altura: 200,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0.1, y: 0, largura: 0.8, altura: 0.25 },
  densidade: "media",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      340,
      200,
      encaixar(trigo, c, 10, 40, 90) +
        encaixar(trigo, c, 240, 40, 90) +
        `<path d="M110 150 Q170 110 230 150 L222 190 H118Z" fill="${c.a}"/>` +
        `<circle cx="140" cy="140" r="18" fill="${c.b}"/><circle cx="170" cy="130" r="20" fill="${c.t}"/><circle cx="200" cy="140" r="17" fill="${c.b}"/>` +
        `<path d="M112 152 H228" stroke="${c.e}" stroke-width="3" opacity=".3"/>` +
        `<rect x="0" y="190" width="340" height="8" rx="4" fill="${c.e}" opacity=".3"/>`,
    ),
};

const palcoMusical: Ilustracao = {
  id: "palco-musical",
  nome: "Palco",
  tipo: "cena",
  assuntos: ["musica", "louvor", "juventude", "energia", "celebracao"],
  publico: TODOS,
  largura: 340,
  altura: 200,
  pontoFocal: { x: 0.5, y: 0.6 },
  areaTexto: { x: 0, y: 0, largura: 1, altura: 0.3 },
  densidade: "alta",
  transparente: true,
  origem: ORIGEM,
  licenca: LICENCA,
  desenhar: (c) =>
    svg(
      340,
      200,
      encaixar(microfone, c, 140, 40, 60) +
        encaixar(notasMusicais, c, 20, 60, 100) +
        encaixar(notasMusicais, c, 230, 40, 90) +
        `<rect x="0" y="176" width="340" height="24" fill="${c.e}" opacity=".7"/>` +
        `<rect x="0" y="170" width="340" height="8" fill="${c.a}"/>`,
    ),
};

export const ILUSTRACOES: readonly Ilustracao[] = [
  livroAberto, pilhaDeLivros, caderno, oculos, luminaria, xicara, grupoDeEstudo, baloesDeConversa, lousa, calendario,
  planta, ramo, trigo, solEMontes, arvores, folhasSoltas,
  notasMusicais, microfone, estrelasEConfete, cidade, baloesDeFesta, lapisDeCor, blocos,
  paoECalice, aliancas, coracao, ondas, pomba, presente, predioDeIgreja, globo, maos,
  mesaDeEstudo, cantinhoInfantil, colheita, palcoMusical,
];

export function acharIlustracao(id: string): Ilustracao | null {
  return ILUSTRACOES.find((i) => i.id === id) ?? null;
}

/** O SVG pronto como endereço — é o que entra na camada e fica guardado. */
export function ilustracaoComoUrl(il: Ilustracao, c: CoresDoDesenho): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(il.desenhar(c))}`;
}
