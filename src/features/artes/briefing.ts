/**
 * O briefing: o que a pessoa diz sobre o evento, e só isso.
 *
 * Tudo que aparece na arte sai daqui, com as palavras de quem escreveu.
 * Nada é inventado, abreviado nem reescrito: campo vazio some da arte, e a
 * composição se reorganiza sem deixar buraco — não há "Local: a definir".
 *
 * A análise no fim é contagem, não interpretação: tamanho do título, quantas
 * informações, se a data tem dia e mês. É o que o gerador precisa para
 * escolher layouts em que o conteúdo cabe, sem adivinhar nada.
 */

export type PublicoId =
  | ""
  | "todos"
  | "adultos"
  | "jovens"
  | "adolescentes"
  | "criancas"
  | "familias"
  | "mulheres"
  | "homens"
  | "lideranca";

export const PUBLICOS: readonly { id: Exclude<PublicoId, "">; nome: string }[] = [
  { id: "todos", nome: "Todas as idades" },
  { id: "adultos", nome: "Adultos" },
  { id: "jovens", nome: "Jovens" },
  { id: "adolescentes", nome: "Adolescentes" },
  { id: "criancas", nome: "Crianças" },
  { id: "familias", nome: "Famílias" },
  { id: "mulheres", nome: "Mulheres" },
  { id: "homens", nome: "Homens" },
  { id: "lideranca", nome: "Liderança" },
];

export type PreferenciaDeLuz = "claro" | "escuro" | "misto";
export type PreferenciaDeLinguagem = "fotografico" | "ilustrado" | "tipografico" | "misto";
export type PreferenciaDeIntensidade = "discreto" | "equilibrado" | "expressivo";
export type PreferenciaDeIdentidade = "seguir" | "explorar";

export interface Preferencias {
  luz: PreferenciaDeLuz;
  linguagem: PreferenciaDeLinguagem;
  intensidade: PreferenciaDeIntensidade;
  identidade: PreferenciaDeIdentidade;
}

/**
 * Uma imagem que a pessoa trouxe.
 *
 * `src` é um endereço que sobrevive ao app fechar (lumen://…/__artes/… no
 * desktop). `mapaDeLuz` é a luminância média numa grade 8×8, medida quando a
 * foto entra: é com ela que o gerador decide se o texto pode ir por cima e
 * quanta proteção a foto pede — sem abrir a imagem de novo.
 */
export interface ImagemDoUsuario {
  src: string;
  nome: string;
  largura: number;
  altura: number;
  tipo: "foto" | "ilustracao";
  /** Onde está o assunto, em fração. Padrão: o centro. */
  pontoFocal: { x: number; y: number };
  /** 64 valores de 0 a 1, linha a linha. */
  mapaDeLuz: number[];
  /** Tem transparência (PNG recortado). */
  transparente: boolean;
}

export interface LogoDoBriefing {
  src: string;
  largura: number;
  altura: number;
  /** Luminância média dos pixels visíveis, 0 a 1: logo clara ou escura. */
  luz: number;
  transparente: boolean;
}

export interface Briefing {
  categoria: string;
  titulo: string;
  subtitulo: string;
  /** Mensagem ou chamada: "Venha e traga sua família". */
  mensagem: string;
  data: string;
  horario: string;
  local: string;
  endereco: string;
  publico: PublicoId;
  organizacao: string;
  // Os campos que a v1 já tinha continuam valendo.
  tema: string;
  palavraBase: string;
  referencia: string;
  textoBiblico: string;
  pregador: string;
  ministerio: string;
  informacoes: string;
  contato: string;
  redes: string;
  logo: LogoDoBriefing | null;
  fotos: ImagemDoUsuario[];
  formatos: string[];
  quantidade: number;
  preferencias: Preferencias;
  /** Hex. Obrigatórias entram na paleta; proibidas não aparecem. */
  coresObrigatorias: string[];
  coresProibidas: string[];
}

export const CAMPOS_DE_TEXTO = [
  "titulo",
  "subtitulo",
  "mensagem",
  "data",
  "horario",
  "local",
  "endereco",
  "organizacao",
  "tema",
  "palavraBase",
  "referencia",
  "textoBiblico",
  "pregador",
  "ministerio",
  "informacoes",
  "contato",
  "redes",
] as const;

export type CampoDeTexto = (typeof CAMPOS_DE_TEXTO)[number];

/**
 * O que o formulário pede: o título e a referência bíblica, nada mais.
 *
 * A igreja pediu artes com só isso escrito. O modelo continua com os outros
 * campos — artes antigas e as já salvas os usam —, mas o que se gera agora
 * passa por `soOQueOFormularioPede`: um valor antigo guardado no último
 * briefing, ou a organização que vinha preenchida com o nome da igreja, não
 * pode aparecer na arte sem estar na tela.
 */
export const CAMPOS_DO_FORMULARIO = ["titulo", "referencia"] as const satisfies readonly CampoDeTexto[];

export function soOQueOFormularioPede(b: Briefing): Briefing {
  const saida: Briefing = { ...b };
  for (const campo of CAMPOS_DE_TEXTO) {
    if (!(CAMPOS_DO_FORMULARIO as readonly CampoDeTexto[]).includes(campo)) saida[campo] = "";
  }
  return saida;
}

export const QUANTIDADE_PADRAO = 8;
export const QUANTIDADE_MAXIMA = 16;

export function briefingVazio(): Briefing {
  return {
    categoria: "culto",
    titulo: "",
    subtitulo: "",
    mensagem: "",
    data: "",
    horario: "",
    local: "",
    endereco: "",
    publico: "",
    organizacao: "",
    tema: "",
    palavraBase: "",
    referencia: "",
    textoBiblico: "",
    pregador: "",
    ministerio: "",
    informacoes: "",
    contato: "",
    redes: "",
    logo: null,
    fotos: [],
    formatos: ["quadrado"],
    quantidade: QUANTIDADE_PADRAO,
    preferencias: { luz: "misto", linguagem: "misto", intensidade: "equilibrado", identidade: "explorar" },
    coresObrigatorias: [],
    coresProibidas: [],
  };
}

/** Campos de várias linhas: a quebra que a pessoa deu é dela. */
const MULTILINHA = new Set<CampoDeTexto>(["textoBiblico", "informacoes"]);

function limpar(texto: unknown, multilinha: boolean): string {
  const s = String(texto ?? "").replace(/\r\n?/g, "\n");
  if (multilinha) {
    return s
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return s.replace(/\s+/g, " ").trim();
}

function hexValido(c: string): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return `#${h.toLowerCase()}`;
}

/**
 * O briefing arrumado: espaços sobrando saem, cores viram hex minúsculo,
 * quantidade fica dentro do limite. É o briefing normalizado que entra na
 * reprodutibilidade — "Culto " e "Culto" têm de dar a mesma arte.
 */
export function normalizar(b: Briefing): Briefing {
  const saida = { ...briefingVazio(), ...b };
  for (const campo of CAMPOS_DE_TEXTO) saida[campo] = limpar(b[campo], MULTILINHA.has(campo));
  saida.categoria = String(b.categoria || "culto").trim();
  saida.quantidade = Math.max(1, Math.min(QUANTIDADE_MAXIMA, Math.round(Number(b.quantidade) || QUANTIDADE_PADRAO)));
  saida.formatos = [...new Set((b.formatos ?? []).filter(Boolean))];
  if (saida.formatos.length === 0) saida.formatos = ["quadrado"];
  saida.coresObrigatorias = [...new Set((b.coresObrigatorias ?? []).map(hexValido).filter((c): c is string => !!c))];
  saida.coresProibidas = [...new Set((b.coresProibidas ?? []).map(hexValido).filter((c): c is string => !!c))];
  saida.fotos = (b.fotos ?? []).filter((f) => f && f.src && f.largura > 0 && f.altura > 0);
  saida.preferencias = { ...briefingVazio().preferencias, ...(b.preferencias ?? {}) };
  return saida;
}

// ─────────────────────────────────────────────── análise do conteúdo

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Dia e mês, quando a data escrita tem os dois.
 *
 * Só para o layout de "marcador de data": o número grande é o que a pessoa
 * digitou, recortado — nunca calculado. "Todo sábado" não tem dia, e aí o
 * layout que precisa de dia simplesmente não entra no lote.
 */
export function diaEMes(data: string): { dia: string; mes: string } | null {
  const texto = data.trim();
  if (!texto) return null;
  const numerica = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?$/.exec(texto);
  if (numerica) {
    const mes = Number(numerica[2]);
    const dia = Number(numerica[1]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) return { dia: numerica[1], mes: numerica[2] };
    return null;
  }
  const porExtenso = new RegExp(`(\\d{1,2})\\s*(?:de\\s+)?(${MESES.join("|")})`, "i").exec(texto);
  if (porExtenso) {
    const dia = Number(porExtenso[1]);
    if (dia >= 1 && dia <= 31) return { dia: porExtenso[1], mes: porExtenso[2] };
  }
  return null;
}

export type ClasseDeTitulo = "curto" | "medio" | "longo" | "muito-longo";

export interface Analise {
  caracteresDoTitulo: number;
  palavrasDoTitulo: number;
  maiorPalavra: string;
  classeDoTitulo: ClasseDeTitulo;
  /** Informações de rodapé: data, horário, local, pregador… */
  quantidadeDeInfo: number;
  /** Texto de apoio: subtítulo, mensagem, tema, versículo. */
  quantidadeDeApoio: number;
  dataMarcavel: boolean;
  fotos: number;
  fotosVerticais: number;
  fotosHorizontais: number;
  temLogo: boolean;
  temVersiculo: boolean;
  /** Muito texto para uma arte só: pede layouts de alta densidade. */
  carregado: boolean;
}

/** Palavras que não sustentam um título sozinhas. */
const MIUDAS = new Set([
  "a", "à", "ao", "as", "às", "aos", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "na", "nas",
  "no", "nos", "um", "uma", "para", "pra", "por", "com", "sem", "que", "se",
]);

export function palavraPrincipal(titulo: string): string {
  const palavras = titulo.split(/\s+/).filter(Boolean);
  const fortes = palavras.filter((p) => !MIUDAS.has(p.toLocaleLowerCase("pt-BR")));
  const lista = fortes.length ? fortes : palavras;
  return lista.reduce((a, b) => (b.length > a.length ? b : a), "");
}

export function analisar(b: Briefing): Analise {
  const titulo = b.titulo;
  const palavras = titulo.split(/\s+/).filter(Boolean);
  const chars = titulo.length;
  const classe: ClasseDeTitulo =
    chars <= 16 ? "curto" : chars <= 34 ? "medio" : chars <= 64 ? "longo" : "muito-longo";
  const info = [b.data, b.horario, b.local, b.endereco, b.pregador, b.ministerio, b.contato, b.redes].filter(Boolean);
  const apoio = [b.subtitulo, b.mensagem, b.tema, b.palavraBase, b.textoBiblico, b.informacoes].filter(Boolean);
  const fotos = b.fotos.filter((f) => f.tipo === "foto");
  const caracteresDeApoio = apoio.join(" ").length;
  return {
    caracteresDoTitulo: chars,
    palavrasDoTitulo: palavras.length,
    maiorPalavra: palavras.reduce((a, p) => (p.length > a.length ? p : a), ""),
    classeDoTitulo: classe,
    quantidadeDeInfo: info.length + (b.informacoes ? 1 : 0),
    quantidadeDeApoio: apoio.length,
    dataMarcavel: diaEMes(b.data) !== null,
    fotos: fotos.length,
    fotosVerticais: fotos.filter((f) => f.altura > f.largura * 1.1).length,
    fotosHorizontais: fotos.filter((f) => f.largura > f.altura * 1.1).length,
    temLogo: !!b.logo,
    temVersiculo: !!b.textoBiblico,
    carregado: info.length >= 6 || caracteresDeApoio > 220,
  };
}

// ─────────────────────────────────────────────── identidade do briefing

/** FNV-1a de 32 bits: pequeno, estável e igual em qualquer máquina. */
export function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * O briefing como texto estável: mesmas chaves, mesma ordem. As fotos
 * entram pelo endereço e pelo ponto focal — trocar a foto é outro briefing.
 */
export function assinaturaDoBriefing(b: Briefing): string {
  const n = normalizar(b);
  const campos = CAMPOS_DE_TEXTO.map((c) => `${c}=${n[c]}`).join("|");
  const fotos = n.fotos.map((f) => `${f.src}@${f.pontoFocal.x.toFixed(3)},${f.pontoFocal.y.toFixed(3)}`).join(";");
  return [
    n.categoria,
    n.publico,
    campos,
    fotos,
    n.logo?.src ?? "",
    JSON.stringify(n.preferencias),
    n.coresObrigatorias.join(","),
    n.coresProibidas.join(","),
  ].join("#");
}

/**
 * O projeto a que o briefing pertence: categoria e título.
 *
 * É a chave do histórico que evita repetir composição de um lote para o
 * outro. Mudar a data não é outro projeto; mudar o título é.
 */
export function chaveDoProjeto(b: Briefing): string {
  const t = b.titulo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${b.categoria}:${t}`;
}
