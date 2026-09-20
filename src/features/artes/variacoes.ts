import { ATMOSFERAS, type Atmosfera } from "./atmosfera.ts";
import { larguraMediaDoCaractere } from "./largura-do-texto.ts";
import { feitioDe, margemSegura, type Feitio } from "./formatos.ts";
import { consertar, ehClara, linhasEstimadas, textoLegivelSobre } from "./validacao.ts";
import {
  VERSAO_DOCUMENTO,
  type Alinhamento,
  type CampoDeTexto,
  type DadosDoEvento,
  type Documento,
  type Elemento,
  type ElementoTexto,
} from "./types.ts";

/**
 * Centenas de artes a partir de poucas peças.
 *
 * Fazer cinquenta templates à mão daria cinquenta artes e um arquivo enorme
 * para manter. Aqui existem seis ingredientes independentes — disposição,
 * paleta, par tipográfico, fundo, enfeite e densidade — e a variação é a
 * combinação deles. Seis listas curtas dão mais resultado do que cinquenta
 * arquivos, e cada ingredinte novo multiplica em vez de somar.
 *
 * A semente é o que torna isso utilizável: a mesma semente dá exatamente a
 * mesma arte, hoje e no ano que vem. Sem isso, "gerar mais opções" perderia
 * a que a pessoa tinha gostado.
 *
 * E nenhuma combinação sai ilegível. As paletas carregam a própria cor de
 * texto, e no fim tudo passa pelo conserto automático — que encolhe o que
 * não cabe e troca o que não lê. O teste percorre todas as sementes em todos
 * os formatos e exige zero erros.
 */

/** Gerador determinístico: mesma semente, mesma sequência, sempre. */
export function sorteio(semente: number): () => number {
  let a = (Math.floor(semente) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escolher<T>(lista: readonly T[], r: () => number): T {
  return lista[Math.floor(r() * lista.length) % lista.length];
}

// ─────────────────────────────────────────────── ingredientes

export interface Paleta {
  id: string;
  nome: string;
  /** Uma ou duas cores de fundo; duas viram gradiente. */
  fundo: string[];
  texto: string;
  /** Para o tema, a data, o que precisa saltar. */
  destaque: string;
  /** Cor da faixa ou do cartão, quando a disposição usa. */
  painel: string;
}

export const PALETAS: readonly Paleta[] = [
  { id: "noite", nome: "Noite", fundo: ["#0d1017", "#1b2432"], texto: "#f2f4f8", destaque: "#eba63f", painel: "#161c26" },
  { id: "brasa", nome: "Brasa", fundo: ["#2a0f0c", "#5c1f14"], texto: "#fdf2e9", destaque: "#f0a04b", painel: "#3a1610" },
  { id: "oliveira", nome: "Oliveira", fundo: ["#101a14", "#1f3327"], texto: "#eef5ef", destaque: "#9dc08b", painel: "#17251c" },
  { id: "indigo", nome: "Índigo", fundo: ["#0b1030", "#1d2a63"], texto: "#eef1ff", destaque: "#8fb8ff", painel: "#121a45" },
  { id: "papel", nome: "Papel", fundo: ["#f5f1e8", "#e7e0d1"], texto: "#1f1b16", destaque: "#9a6b3f", painel: "#efe9dc" },
  { id: "alva", nome: "Alva", fundo: ["#ffffff", "#eef1f5"], texto: "#12161c", destaque: "#2f6fa8", painel: "#f6f8fa" },
  { id: "vinho", nome: "Vinho", fundo: ["#1d0a14", "#43142a"], texto: "#fbeef4", destaque: "#d98cae", painel: "#290e1c" },
  { id: "areia", nome: "Areia", fundo: ["#f3e7d3", "#e2cfae"], texto: "#2a2015", destaque: "#8a5a2b", painel: "#eaddc3" },
  { id: "tinta", nome: "Tinta", fundo: ["#111111", "#242424"], texto: "#fafafa", destaque: "#c9a227", painel: "#1a1a1a" },
  { id: "mar", nome: "Maré", fundo: ["#07222b", "#0f3b49"], texto: "#eafaff", destaque: "#5fd0d8", painel: "#0b2e3a" },

  // As do calendário da igreja. Sem elas, "Natal" e "Congresso de jovens"
  // saíam com a mesma cara — que era a queixa, e com razão: cor é a
  // primeira coisa que diz de que culto a arte é.
  { id: "natal", nome: "Natal", fundo: ["#0a1f18", "#12402c"], texto: "#f4fbf6", destaque: "#e0b352", painel: "#0e2a1f" },
  { id: "natal-noite", nome: "Noite de Natal", fundo: ["#0a1128", "#17265c"], texto: "#eef2ff", destaque: "#e8c979", painel: "#0e1838" },
  { id: "pascoa", nome: "Páscoa", fundo: ["#1b0f1f", "#4a2350"], texto: "#faf3fb", destaque: "#f2d08a", painel: "#271431" },
  // O tom de amanhecer entrou claro demais e o texto dava 2,7:1 — o teste
  // de contraste pegou antes de virar cartaz ilegível. Escurecido até
  // 5,6:1, e o dourado do destaque devolve o calor que se perdeu.
  { id: "manha", nome: "Manhã de Páscoa", fundo: ["#2b1830", "#96512f"], texto: "#fff6ec", destaque: "#ffd79a", painel: "#3a2038" },
  { id: "ceia", nome: "Santa Ceia", fundo: ["#1a0b10", "#4d1822"], texto: "#fbf0ef", destaque: "#d9a441", painel: "#260f16" },
  { id: "trigo", nome: "Pão e trigo", fundo: ["#2a1e0f", "#6b4a1f"], texto: "#fdf6e6", destaque: "#efc677", painel: "#38280f" },
  { id: "jovens", nome: "Jovens", fundo: ["#16062e", "#4a17a8"], texto: "#f6f0ff", destaque: "#57e6c3", painel: "#210a40" },
  { id: "neon", nome: "Neon", fundo: ["#07030f", "#22104d"], texto: "#f3efff", destaque: "#ff5fa2", painel: "#120724" },
  { id: "missoes", nome: "Missões", fundo: ["#0b1a1c", "#1c4038"], texto: "#effaf4", destaque: "#e8a33d", painel: "#102526" },
  { id: "sertao", nome: "Sertão", fundo: ["#2b1c10", "#7a4a22"], texto: "#fdf3e5", destaque: "#f0b95f", painel: "#38240f" },
  { id: "familia", nome: "Família", fundo: ["#1b1410", "#4a3524"], texto: "#fbf4ec", destaque: "#e7a765", painel: "#261b14" },
  { id: "aurora", nome: "Aurora", fundo: ["#0d1030", "#5b2a6e"], texto: "#f5f0ff", destaque: "#ffb3c7", painel: "#161038" },
  { id: "cedro", nome: "Cedro", fundo: ["#0e1512", "#2b4034"], texto: "#eef4ef", destaque: "#c7a86a", painel: "#141d18" },
  { id: "ardosia", nome: "Ardósia", fundo: ["#12151a", "#2c333d"], texto: "#f1f4f8", destaque: "#9bb4cc", painel: "#1a1f26" },
  { id: "campanha", nome: "Campanha", fundo: ["#1a0505", "#6e1111"], texto: "#fff0ee", destaque: "#ffc75a", painel: "#280808" },
  { id: "vigilia", nome: "Vigília", fundo: ["#05060d", "#141a33"], texto: "#eaeeff", destaque: "#7f9cff", painel: "#0a0d1a" },
] as const;

export interface Tipografia {
  id: string;
  /** A do título: pesada, para ser vista de longe. */
  titulo: string;
  /** A do resto: legível em corpo pequeno. */
  corpo: string;
  pesoTitulo: number;
  /** Espaçamento entre letras do título, em fração do corpo. */
  espacamento: number;
  maiuscula: boolean;
}

export const TIPOGRAFIAS: readonly Tipografia[] = [
  { id: "classica", titulo: "display", corpo: "sans", pesoTitulo: 700, espacamento: 0, maiuscula: false },
  { id: "monumental", titulo: "display", corpo: "sans", pesoTitulo: 800, espacamento: 0.02, maiuscula: true },
  { id: "limpa", titulo: "sans", corpo: "sans", pesoTitulo: 700, espacamento: -0.01, maiuscula: false },
  { id: "editorial", titulo: "display", corpo: "sans", pesoTitulo: 600, espacamento: 0.01, maiuscula: false },
  { id: "cartaz", titulo: "sans", corpo: "sans", pesoTitulo: 900, espacamento: 0.04, maiuscula: true },
  // A terceira família estava instalada e não era usada por ninguém. Mono
  // no corpo dá o ar técnico de cartaz de congresso, e mono no título dá
  // o de contagem regressiva.
  { id: "tecnica", titulo: "sans", corpo: "mono", pesoTitulo: 800, espacamento: 0.01, maiuscula: true },
  { id: "manifesto", titulo: "display", corpo: "mono", pesoTitulo: 700, espacamento: 0, maiuscula: false },
  { id: "cronometro", titulo: "mono", corpo: "sans", pesoTitulo: 700, espacamento: 0.06, maiuscula: true },
  { id: "serena", titulo: "display", corpo: "display", pesoTitulo: 500, espacamento: 0.02, maiuscula: false },
  { id: "compacta", titulo: "sans", corpo: "sans", pesoTitulo: 800, espacamento: -0.02, maiuscula: false },
] as const;

export type Disposicao = "centro" | "alto" | "baixo" | "faixa" | "lateral";
export const DISPOSICOES: readonly Disposicao[] = ["centro", "alto", "baixo", "faixa", "lateral"];

export type EstiloDeFundo = "solido" | "gradiente" | "radial";
export const FUNDOS: readonly EstiloDeFundo[] = ["solido", "gradiente", "radial"];

export type Enfeite =
  | "nenhum"
  | "linha"
  | "cantos"
  | "circulo"
  | "barra"
  | "moldura"
  | "rodape"
  | "coluna"
  | "selo";
export const ENFEITES: readonly Enfeite[] = [
  "nenhum",
  "linha",
  "cantos",
  "circulo",
  "barra",
  "moldura",
  "rodape",
  "coluna",
  "selo",
];

/** Quanto texto secundário a arte mostra. */
export type Densidade = "enxuta" | "media" | "cheia";
export const DENSIDADES: readonly Densidade[] = ["enxuta", "media", "cheia"];

export interface Receita {
  semente: number;
  paleta: Paleta;
  tipografia: Tipografia;
  disposicao: Disposicao;
  fundo: EstiloDeFundo;
  enfeite: Enfeite;
  densidade: Densidade;
  /** A camada de luz. É ela que separa uma arte de um retângulo colorido. */
  atmosfera: Atmosfera;
}

/** Quantas combinações diferentes existem, de verdade. */
export const COMBINACOES =
  PALETAS.length *
  TIPOGRAFIAS.length *
  DISPOSICOES.length *
  FUNDOS.length *
  ENFEITES.length *
  DENSIDADES.length *
  ATMOSFERAS.length;

export function receitaDe(semente: number): Receita {
  const r = sorteio(semente);
  return {
    semente,
    paleta: escolher(PALETAS, r),
    tipografia: escolher(TIPOGRAFIAS, r),
    disposicao: escolher(DISPOSICOES, r),
    fundo: escolher(FUNDOS, r),
    enfeite: escolher(ENFEITES, r),
    densidade: escolher(DENSIDADES, r),
    atmosfera: escolher(ATMOSFERAS, r),
  };
}

// ─────────────────────────────────────────────── montagem

interface Linha {
  campo: CampoDeTexto;
  /** Peso visual: 3 é título, 1 é rodapé. */
  nivel: 3 | 2 | 1;
  destaque?: boolean;
}

/**
 * O que entra na arte, e em que ordem.
 *
 * Campo vazio não vira caixa vazia — some da composição, e o que sobra se
 * redistribui. É o que faz a mesma arte funcionar com três informações e
 * com dez.
 */
function linhasDe(dados: DadosDoEvento, densidade: Densidade): Linha[] {
  const tudo: Linha[] = [
    { campo: "tema", nivel: 1, destaque: true },
    { campo: "titulo", nivel: 3 },
    { campo: "subtitulo", nivel: 2 },
    { campo: "palavraBase", nivel: 2, destaque: true },
    { campo: "referencia", nivel: 1, destaque: true },
    { campo: "textoBiblico", nivel: 1 },
    { campo: "pregador", nivel: 1 },
    { campo: "ministerio", nivel: 1 },
    { campo: "data", nivel: 2, destaque: true },
    { campo: "horario", nivel: 2, destaque: true },
    { campo: "local", nivel: 1 },
    { campo: "endereco", nivel: 1 },
    { campo: "chamada", nivel: 1 },
    { campo: "informacoes", nivel: 1 },
    { campo: "contato", nivel: 1 },
    { campo: "redes", nivel: 1 },
    { campo: "igreja", nivel: 1 },
  ];
  const teto = densidade === "enxuta" ? 4 : densidade === "media" ? 7 : 11;
  const comConteudo = tudo.filter((l) => String(dados[l.campo] ?? "").trim());
  // O título e o que tem mais peso ficam; o excesso sai do fim, que é onde
  // mora a informação de apoio.
  const principais = comConteudo.filter((l) => l.nivel === 3);
  const resto = comConteudo.filter((l) => l.nivel !== 3);
  return [...principais, ...resto.slice(0, Math.max(0, teto - principais.length))].sort(
    (a, b) => comConteudo.indexOf(a) - comConteudo.indexOf(b),
  );
}

/** Corpo de letra por nível, já ajustado ao feitio do quadro. */
/**
 * O corpo do título sai do tamanho do título.
 *
 * Era um número fixo — 8,2% da altura do quadro, fosse "Páscoa" ou fosse
 * "Conferência de Jovens da Região Metropolitana". Oito por cento é corpo
 * de legenda: por isso as artes pareciam slide, e não cartaz.
 *
 * Num cartaz, o tamanho do título é consequência de quanto ele tem a
 * dizer. Duas palavras ocupam a folha; uma frase longa se comporta. É a
 * conta que um diagramador faz sem pensar, e que aqui precisava estar
 * escrita.
 *
 * A escada também abriu. Antes o título era 3,4 vezes o rodapé — perto
 * demais para mandar em alguma coisa. Agora vai de 4 a 9 vezes, conforme
 * ele possa crescer.
 */
export function corpoDoTitulo(texto: string, feitio: Feitio): number {
  const n = String(texto ?? "").trim().length;
  const base =
    n === 0 ? 0.082
    : n <= 12 ? 0.185
    : n <= 20 ? 0.150
    : n <= 32 ? 0.120
    : n <= 50 ? 0.098
    : 0.082;
  return base * fatorDoFeitio(feitio);
}

/** Em quadro deitado falta altura; em pé sobra. */
function fatorDoFeitio(feitio: Feitio): number {
  return feitio === "deitado" ? 0.82 : feitio === "empe" ? 1.05 : 1;
}

function corpoDe(nivel: 1 | 2 | 3, feitio: Feitio, titulo = ""): number {
  if (nivel === 3) return corpoDoTitulo(titulo, feitio);
  // Apoio um pouco menor que antes, de propósito: a escada precisa de
  // degrau, e quem sobe é o título.
  const base = nivel === 2 ? 0.034 : 0.021;
  return base * fatorDoFeitio(feitio);
}

function alinhamentoDe(d: Disposicao): Alinhamento {
  return d === "lateral" ? "left" : "center";
}

function montarTextos(
  linhas: Linha[],
  dados: DadosDoEvento,
  receita: Receita,
  feitio: Feitio,
): ElementoTexto[] {
  const margem = margemSegura(feitio);
  const util = 1 - 2 * margem;
  const { paleta, tipografia, disposicao } = receita;
  const alinhamento = alinhamentoDe(disposicao);

  const larguraCaixa = disposicao === "lateral" ? util * 0.78 : util;
  const proporcao = feitio === "deitado" ? 16 / 9 : feitio === "empe" ? 9 / 16 : 1;

  /**
   * A altura de cada bloco sai do texto, não do nível.
   *
   * Reservar altura fixa por nível funcionava até alguém escrever um
   * versículo inteiro: a caixa tinha espaço para uma linha e o texto pedia
   * três, e o remendo depois só encolhia a letra até ela ficar ilegível. A
   * composição precisa saber quanto texto há.
   */
  const titulo = String(dados.titulo ?? "").trim();

  /**
   * O estilo de cada nível, num lugar só.
   *
   * A estimativa de linhas e o desenho têm que usar exatamente o mesmo
   * peso, a mesma caixa e a mesma fonte. Quando divergiam, o título saía
   * cortado pelos dois lados: a conta dizia que cabia numa linha e a
   * letra, em caixa alta e peso 800, ocupava vinte por cento a mais.
   */
  const estiloDe = (nivel: 1 | 2 | 3) => ({
    fonte: nivel === 3 ? tipografia.titulo : tipografia.corpo,
    peso: nivel === 3 ? tipografia.pesoTitulo : nivel === 2 ? 600 : 500,
    maiuscula: nivel === 3 ? tipografia.maiuscula : nivel === 1,
    espacamento: nivel === 3 ? tipografia.espacamento : nivel === 1 ? 0.06 : 0,
  });

  const larguraDo = (nivel: 1 | 2 | 3) => {
    const e = estiloDe(nivel);
    return larguraMediaDoCaractere(e.fonte, e.peso, e.maiuscula, e.espacamento);
  };

  /**
   * O título encolhe menos que o resto.
   *
   * Antes tudo encolhia junto, na mesma proporção. Parece justo e é
   * errado: quando a arte fica cheia, quem tem que ceder é a informação
   * de apoio — o endereço, o contato — e não a manchete. Um diagramador
   * aperta o rodapé e protege o título; era isso que faltava.
   *
   * A raiz é o quanto ele cede: com o apoio em 50%, o título ainda está
   * em 73%. Nunca abaixo de um piso, senão a escada se desfaz.
   */
  const PISO_DO_TITULO = 0.62;
  const escalaDoTitulo = (apoio: number) => Math.max(PISO_DO_TITULO, Math.pow(apoio, 0.45));

  const alturaDe = (l: Linha, apoio: number) => {
    const escala = l.nivel === 3 ? escalaDoTitulo(apoio) : apoio;
    const corpo = corpoDe(l.nivel, feitio, titulo) * escala;
    const entrelinha = l.nivel === 3 ? 1.08 : 1.35;
    const n = linhasEstimadas(String(dados[l.campo] ?? ""), larguraCaixa, corpo, proporcao, larguraDo(l.nivel));
    const folga = l.nivel === 3 ? 0.55 : 0.35;
    return corpo * entrelinha * Math.max(1, n) + corpo * folga;
  };

  const somaCom = (apoio: number) => linhas.reduce((a, l) => a + alturaDe(l, apoio), 0);

  // Cada volta reestima depois de o texto reflowar no tamanho novo: mudar
  // o corpo muda quantas linhas o título ocupa, e isso muda a soma.
  let apoio = 1;
  for (let volta = 0; volta < 5; volta += 1) {
    const soma = somaCom(apoio);
    if (soma <= util) break;
    apoio = Math.max(0.34, apoio * (util / soma) * 0.98);
  }

  /**
   * Sobrou folga? O título cresce e ocupa.
   *
   * Um cartaz com três informações e um título pequeno no meio de muito
   * branco é um cartaz mal resolvido. O espaço que sobra pertence à
   * manchete — até um teto, porque título que toma o quadro inteiro
   * também não é cartaz.
   */
  let crescimento = 1;
  if (titulo && somaCom(apoio) < util * 0.82) {
    for (let volta = 0; volta < 6; volta += 1) {
      const tentativa = crescimento * 1.12;
      const soma = linhas.reduce((a, l) => {
        const escala = l.nivel === 3 ? escalaDoTitulo(apoio) * tentativa : apoio;
        const corpo = corpoDe(l.nivel, feitio, titulo) * escala;
        const entrelinha = l.nivel === 3 ? 1.08 : 1.35;
        const n = linhasEstimadas(String(dados[l.campo] ?? ""), larguraCaixa, corpo, proporcao, larguraDo(l.nivel));
        return a + corpo * entrelinha * Math.max(1, n) + corpo * (l.nivel === 3 ? 0.55 : 0.35);
      }, 0);
      if (soma > util * 0.94 || tentativa > 1.6) break;
      crescimento = tentativa;
    }
  }

  /**
   * O teto imposto pela maior palavra.
   *
   * Quebrar linha resolve frase comprida; não resolve palavra comprida.
   * "Páscoa" é uma palavra só: se o corpo pedir mais largura do que o
   * quadro tem, ela sai cortada pelos dois lados, e foi exatamente isso
   * que apareceu quando o título cresceu. A saída é a mesma do
   * diagramador — diminuir até a maior palavra caber.
   */
  const corpoQueCabe = (l: Linha, corpo: number) => {
    const palavras = String(dados[l.campo] ?? "").trim().split(/\s+/);
    const maior = palavras.reduce((m, p) => Math.max(m, p.length), 0);
    if (maior <= 0) return corpo;
    const teto = (larguraCaixa * proporcao) / (maior * larguraDo(l.nivel));
    return Math.min(corpo, teto);
  };

  const corpoFinal = (l: Linha) =>
    corpoQueCabe(
      l,
      corpoDe(l.nivel, feitio, titulo) *
        (l.nivel === 3 ? escalaDoTitulo(apoio) * crescimento : apoio),
    );

  const alturaFinal = (l: Linha) => {
    const corpo = corpoFinal(l);
    const entrelinha = l.nivel === 3 ? 1.08 : 1.35;
    const n = linhasEstimadas(String(dados[l.campo] ?? ""), larguraCaixa, corpo, proporcao, larguraDo(l.nivel));
    return corpo * entrelinha * Math.max(1, n) + corpo * (l.nivel === 3 ? 0.55 : 0.35);
  };

  const alturas = linhas.map(alturaFinal);
  const total = alturas.reduce((a, b) => a + b, 0);
  const respiro = Math.max(0, util - total);
  const inicio =
    disposicao === "alto"
      ? margem
      : disposicao === "baixo"
        ? margem + respiro
        : margem + respiro / 2;

  const x = margem;

  let y = inicio;
  return linhas.map((l, i) => {
    const tamanho = corpoFinal(l);
    const altura = alturas[i];
    const el: ElementoTexto = {
      tipo: "texto",
      id: `txt-${l.campo}`,
      campo: l.campo,
      texto: String(dados[l.campo] ?? "").trim(),
      caixa: { x, y, largura: larguraCaixa, altura },
      tamanho,
      peso: estiloDe(l.nivel).peso,
      cor: l.destaque ? paleta.destaque : paleta.texto,
      alinhamento,
      entrelinha: l.nivel === 3 ? 1.08 : 1.35,
      // Título grande com a mesma entreletra de título pequeno fica solto:
      // quanto maior o corpo, mais fechado o espaçamento precisa ser. Só
      // aperta, nunca abre — abrir mudaria a largura para mais do que a
      // estimativa contou, e a palavra sairia cortada.
      espacamento:
        l.nivel === 3
          ? estiloDe(3).espacamento - (tamanho > 0.12 ? 0.015 : 0)
          : estiloDe(l.nivel).espacamento,
      maiuscula: estiloDe(l.nivel).maiuscula,
      fonte: estiloDe(l.nivel).fonte,
      sombra: receita.fundo === "radial" ? false : false,
    };
    y += altura;
    return el;
  });
}

function montarEnfeite(receita: Receita, feitio: Feitio): Elemento[] {
  const margem = margemSegura(feitio);
  const { enfeite, paleta } = receita;
  const cor = paleta.destaque;
  switch (enfeite) {
    case "linha":
      return [
        {
          tipo: "forma",
          id: "enf-linha",
          forma: "retangulo",
          caixa: { x: 0.5 - 0.06, y: margem * 0.62, largura: 0.12, altura: 0.005 },
          cor,
          opacidade: 1,
          raio: 1,
        },
      ];
    case "barra":
      return [
        {
          tipo: "forma",
          id: "enf-barra",
          forma: "retangulo",
          caixa: { x: 0, y: 0, largura: 0.018, altura: 1 },
          cor,
          opacidade: 1,
          raio: 0,
        },
      ];
    case "circulo":
      return [
        {
          tipo: "forma",
          id: "enf-circulo",
          forma: "circulo",
          caixa: { x: 0.62, y: -0.18, largura: 0.62, altura: 0.62 },
          cor,
          opacidade: 0.14,
          raio: 1,
        },
      ];
    case "cantos":
      return [
        {
          tipo: "forma",
          id: "enf-canto-a",
          forma: "retangulo",
          caixa: { x: margem * 0.5, y: margem * 0.5, largura: 0.09, altura: 0.004 },
          cor,
          opacidade: 1,
          raio: 1,
        },
        {
          tipo: "forma",
          id: "enf-canto-b",
          forma: "retangulo",
          caixa: { x: 1 - margem * 0.5 - 0.09, y: 1 - margem * 0.5 - 0.004, largura: 0.09, altura: 0.004 },
          cor,
          opacidade: 1,
          raio: 1,
        },
      ];
    case "moldura":
      // Quatro filetes finos encostando na margem segura. Emoldura sem
      // roubar área: o texto continua com o quadro inteiro por dentro.
      return [
        { lado: "topo", caixa: { x: margem * 0.5, y: margem * 0.5, largura: 1 - margem, altura: 0.0035 } },
        { lado: "base", caixa: { x: margem * 0.5, y: 1 - margem * 0.5, largura: 1 - margem, altura: 0.0035 } },
        { lado: "esq", caixa: { x: margem * 0.5, y: margem * 0.5, largura: 0.0035, altura: 1 - margem } },
        { lado: "dir", caixa: { x: 1 - margem * 0.5, y: margem * 0.5, largura: 0.0035, altura: 1 - margem } },
      ].map(({ lado, caixa }) => ({
        tipo: "forma" as const,
        id: `enf-moldura-${lado}`,
        forma: "retangulo" as const,
        caixa,
        cor,
        opacidade: 0.6,
        raio: 0,
      }));
    case "rodape":
      // Uma faixa cheia no pé. É onde a data e o endereço pousam em
      // cartaz de congresso, e dá peso à base sem encostar no título.
      return [
        {
          tipo: "forma",
          id: "enf-rodape",
          forma: "retangulo",
          caixa: { x: 0, y: 1 - 0.085, largura: 1, altura: 0.085 },
          cor,
          opacidade: 0.92,
          raio: 0,
        },
      ];
    case "coluna":
      // Um bloco vertical na lateral, translúcido: dá onde o texto pousar
      // quando a disposição é lateral, e vira textura quando não é.
      return [
        {
          tipo: "forma",
          id: "enf-coluna",
          forma: "retangulo",
          caixa: { x: 0, y: 0, largura: 0.34, altura: 1 },
          cor: paleta.painel,
          opacidade: 0.72,
          raio: 0,
        },
      ];
    case "selo":
      // Um disco no canto de cima, como carimbo de série de sermão.
      return [
        {
          tipo: "forma",
          id: "enf-selo",
          forma: "circulo",
          caixa: { x: 1 - margem - 0.14, y: margem, largura: 0.14, altura: 0.14 },
          cor,
          opacidade: 0.85,
          raio: 1,
        },
      ];
    default:
      return [];
  }
}

/**
 * Do formulário a um documento pronto para desenhar.
 *
 * O último passo é o conserto automático: encolhe o que não cabe e troca a
 * cor do que não lê. Sem ele, uma combinação boa no papel sairia com o
 * título cortado num formato e ilegível em outro.
 */
export function montar(opcoes: {
  id: string;
  nome: string;
  dados: DadosDoEvento;
  semente: number;
  formatoId: string;
  largura: number;
  altura: number;
  templateId?: string;
}): Documento {
  const { largura, altura } = opcoes;
  const feitio = feitioDe(largura, altura);
  const receita = receitaDe(opcoes.semente);
  const { paleta, fundo } = receita;

  const temFoto = Boolean(opcoes.dados.imagem);
  const elementoFundo: Elemento = {
    tipo: "fundo",
    id: "fundo",
    estilo: temFoto ? "foto" : fundo,
    // Sobre foto, a cor de texto é sempre a clara, e o véu garante o resto.
    cores: fundo === "solido" ? [paleta.fundo[0]] : paleta.fundo,
    angulo: receita.disposicao === "lateral" ? 90 : 160,
    src: temFoto ? opcoes.dados.imagem : undefined,
    veu: temFoto ? 0.45 : 0,
  };

  // A atmosfera vem logo acima do fundo e abaixo de todo o resto: ela é
  // luz sobre a cor, nunca por cima do texto. Sobre foto ela não entra —
  // a fotografia já traz a própria luz, e somar as duas vira sujeira.
  const clara = ehClara(paleta.fundo[0]);
  const atmosfera: Elemento[] =
    temFoto || receita.atmosfera === "nenhuma"
      ? []
      : [
          {
            tipo: "atmosfera",
            id: "atmosfera",
            atmosfera: receita.atmosfera,
            cor: paleta.destaque,
            semente: opcoes.semente,
            clara,
          },
        ];

  const linhas = linhasDe(opcoes.dados, receita.densidade);
  const textos = montarTextos(linhas, opcoes.dados, receita, feitio);
  if (temFoto) {
    for (const t of textos) {
      t.cor = t.cor === paleta.destaque ? paleta.destaque : "#ffffff";
      t.sombra = true;
    }
  }

  const logo: Elemento[] = opcoes.dados.logo
    ? [
        {
          tipo: "imagem",
          id: "logo",
          src: opcoes.dados.logo,
          caixa: {
            x: 0.5 - 0.09,
            y: 1 - margemSegura(feitio) - 0.1,
            largura: 0.18,
            altura: 0.08,
          },
          ajuste: "contain",
          opacidade: 1,
          raio: 0,
        },
      ]
    : [];

  const doc: Documento = {
    v: VERSAO_DOCUMENTO,
    id: opcoes.id,
    nome: opcoes.nome,
    formatoId: opcoes.formatoId,
    largura,
    altura,
    templateId: opcoes.templateId ?? receita.disposicao,
    semente: opcoes.semente,
    dados: opcoes.dados,
    elementos: [elementoFundo, ...atmosfera, ...montarEnfeite(receita, feitio), ...textos, ...logo],
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  };

  return consertar(doc);
}

/** Sementes para a grade de opções — sempre as mesmas, para a mesma base. */
export function sementesPara(base: number, quantas: number): number[] {
  const r = sorteio(base);
  return Array.from({ length: quantas }, () => Math.floor(r() * 1_000_000) + 1);
}

/** A cor que lê melhor sobre o fundo desta receita — usada pela prévia. */
export function corDeTextoDa(receita: Receita): string {
  return textoLegivelSobre(receita.paleta.fundo[0]);
}
