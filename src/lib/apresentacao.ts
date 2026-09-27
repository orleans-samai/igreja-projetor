import type { Apresentacao } from "./types";

/**
 * Transformar o arquivo que o dirigente mandou em slides do Lúmen.
 *
 * - **PDF** é desenhado aqui, página por página, pelo pdf.js — o mesmo
 *   motor do Firefox. Sai idêntico ao original.
 * - **PowerPoint** (.pptx, .ppsx, .ppt, .pps) e **OpenDocument** (.odp) são
 *   desenhados pelo PowerPoint do computador; sem ele, pelo LibreOffice. Os
 *   dois devolvem um PDF — e dali é o caminho do PDF: o slide sai como no
 *   PowerPoint, com posição, fonte, cor e fundo. A igreja via o .pptx
 *   "totalmente desconfigurado" quando só o leitor próprio o lia.
 * - Sem PowerPoint nem LibreOffice (ou quando os dois recusam o arquivo), o
 *   .pptx/.ppsx é desenhado pelo próprio Lúmen (`./pptx/`): posição, fonte,
 *   cor, fundo, formas e imagens, em Full HD. Se até esse desenho falhar, o
 *   leitor simplificado tira o texto e a imagem de cada slide.
 *   .ppt e .odp não têm desenho próprio: sem conversor, diz o que fazer.
 */

/** Largura em que cada página de PDF é desenhada: Full HD, a do telão. */
const LARGURA_DA_PAGINA = 1920;
/** O mesmo teto do processo principal. */
const MAX_PAGINAS = 300;

/** Quem desenhou os slides: a cabine diz, para a igreja saber o que esperar. */
export type QuemDesenhou = "PowerPoint" | "LibreOffice" | "Lúmen";

export type ResultadoDaImportacao =
  /** `aviso`: entrou, mas com uma ressalva que o operador precisa ler. */
  | { ok: true; apresentacao: Apresentacao; aviso?: string; desenhadaPor?: QuemDesenhou }
  | { ok: false; erro: string };

/** O que o PowerPoint ou o LibreOffice desenham para o Lúmen. */
const DE_APRESENTACAO = [".pptx", ".ppsx", ".ppt", ".pps", ".odp"];
/** O que o leitor próprio abre quando não há quem desenhe. */
const LEITOR_PROPRIO = [".pptx", ".ppsx"];

export function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i).toLowerCase() : "";
}

/** Se é um formato que o Lúmen sabe transformar em slides. */
export function sabeImportar(nome: string): boolean {
  const ext = extensao(nome);
  return ext === ".pdf" || DE_APRESENTACAO.includes(ext);
}

/** A frase para o formato que não dá, dizendo o que fazer em vez disso. */
export function motivoDeNaoImportar(nome: string): string {
  const ext = extensao(nome);
  if (ext === ".ppt" || ext === ".pps" || ext === ".odp") {
    return "Para abrir .ppt e .odp, instale o LibreOffice (gratuito) ou o PowerPoint neste computador.";
  }
  return "O Lúmen projeta PowerPoint (.pptx, .ppsx, .ppt), OpenDocument (.odp) e PDF.";
}

/** O aviso de quando a apresentação entrou pelo leitor simplificado. */
export function avisoDoLeitorProprio(motivo: { semConversor?: boolean; error: string }): string {
  return motivo.semConversor
    ? "Entrou simplificada (texto e imagem de cada slide): este computador não tem PowerPoint nem LibreOffice. Instale o LibreOffice, gratuito, para ficar igual ao PowerPoint."
    : `Entrou simplificada (texto e imagem de cada slide): ${motivo.error}`;
}

/**
 * O aviso do desenho do próprio Lúmen, ou nada quando não há o que dizer.
 *
 * Fala só do que a igreja vai notar: a fonte que o autor usou e este
 * computador não tem (foi trocada por uma parecida) e o que o desenho não
 * sabe fazer (gráfico, SmartArt sem desenho, imagem EMF). Sem nada disso,
 * basta o "desenhados pelo Lúmen" do aviso de sucesso.
 */
export function avisoDoDesenhoProprio(
  motivo: { semConversor?: boolean; error: string },
  fontesTrocadas: string[],
  faltas: string[],
): string | undefined {
  const partes: string[] = [];
  if (!motivo.semConversor && motivo.error) partes.push(`${motivo.error} O Lúmen desenhou do jeito dele.`);
  if (fontesTrocadas.length) {
    const lista = fontesTrocadas.slice(0, 4).join(", ") + (fontesTrocadas.length > 4 ? "…" : "");
    partes.push(`Fontes que este computador não tem foram trocadas por parecidas: ${lista}.`);
  }
  if (faltas.length) partes.push(`Ficou de fora: ${faltas.join(", ")}.`);
  if (!partes.length) return undefined;
  if (motivo.semConversor) partes.push("Para ficar idêntica ao PowerPoint, instale o LibreOffice (gratuito).");
  return partes.join(" ");
}

/**
 * As páginas de um PDF, como PNG.
 *
 * pdf.js é carregado só aqui, na primeira vez que alguém importa um PDF:
 * são alguns megabytes, e a cabine que nunca recebe PDF não paga por eles
 * no começo do culto.
 */
export async function paginasDoPdf(bytes: Uint8Array): Promise<Uint8Array[]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: urlDoTrabalhador } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = urlDoTrabalhador;

  // pdf.js assume o buffer para si: uma cópia evita que ele esvazie o que
  // o chamador ainda pode querer.
  // No pdf.js 6 quem se desfaz é a tarefa de carregamento, não o
  // documento: é ela que segura o worker e a memória das páginas.
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  const paginas: Uint8Array[] = [];
  try {
    const total = Math.min(doc.numPages, MAX_PAGINAS);
    for (let n = 1; n <= total; n += 1) {
      const pagina = await doc.getPage(n);
      const natural = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: LARGURA_DA_PAGINA / natural.width });
      const tela = document.createElement("canvas");
      tela.width = Math.round(vista.width);
      tela.height = Math.round(vista.height);
      const ctx = tela.getContext("2d");
      if (!ctx) throw new Error("Não consegui abrir a tela de desenho.");
      // Fundo branco: PDF sem fundo desenhado é papel, e papel é branco. Sem
      // isto a página transparente sairia preta no telão escuro.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tela.width, tela.height);
      await pagina.render({ canvasContext: ctx, viewport: vista, canvas: tela }).promise;
      const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, "image/png"));
      if (!blob) throw new Error(`Não consegui desenhar a página ${n}.`);
      paginas.push(new Uint8Array(await blob.arrayBuffer()));
      pagina.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
  return paginas;
}

/**
 * Importa um arquivo que já está na pasta de recebidos.
 *
 * É o mesmo caminho para o que veio do dirigente e para o que o operador
 * escolheu na cabine: um lugar só decide o que é aceito.
 */
export async function importarRecebido(nome: string, de?: string): Promise<ResultadoDaImportacao> {
  const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (!d?.isDesktop) return { ok: false, erro: "Importar apresentação é do app do Windows." };
  if (!sabeImportar(nome)) return { ok: false, erro: motivoDeNaoImportar(nome) };

  const base = nome.replace(/\.[^.]+$/, "");
  const ext = extensao(nome);
  if (DE_APRESENTACAO.includes(ext)) {
    const convertido = await d.apresentacaoConverter(nome);
    if (convertido.ok) {
      const r = await apresentacaoDoPdf(convertido.bytes, base, de, "pptx");
      return r.ok ? { ...r, desenhadaPor: convertido.com } : r;
    }
    // Com senha, ninguém abre: nem o desenho do Lúmen, nem o leitor simples.
    if (convertido.comSenha) return { ok: false, erro: convertido.error };
    if (!LEITOR_PROPRIO.includes(ext)) {
      return { ok: false, erro: convertido.semConversor ? motivoDeNaoImportar(nome) : convertido.error };
    }
    const desenhada = await desenharPeloLumen(nome, base, de, convertido);
    if (desenhada.ok) return desenhada;
    const r = await d.apresentacaoPptx(nome);
    if (!r.ok) return { ok: false, erro: r.error };
    return {
      ok: true,
      apresentacao: {
        id: r.id,
        titulo: r.titulo || base,
        origem: "pptx",
        slides: r.slides,
        de,
        criadoEm: Date.now(),
      },
      aviso: avisoDoLeitorProprio(convertido),
    };
  }

  const lido = await d.apresentacaoPdf(nome);
  if (!lido.ok) return { ok: false, erro: lido.error };
  return apresentacaoDoPdf(lido.bytes, base, de, "pdf");
}

/**
 * O .pptx/.ppsx desenhado pelo próprio Lúmen, slide a slide, em Full HD.
 *
 * O desenho é carregado só aqui, na primeira apresentação que precisa dele:
 * a cabine que sempre tem PowerPoint não paga por ele no começo do culto.
 */
async function desenharPeloLumen(
  nome: string,
  titulo: string,
  de: string | undefined,
  motivo: { semConversor?: boolean; error: string },
): Promise<ResultadoDaImportacao> {
  const d = window.lumenDesktop;
  if (!d?.apresentacaoBruto) return { ok: false, erro: "Este Lúmen não lê a apresentação por conta própria." };
  const bruto = await d.apresentacaoBruto(nome);
  if (!bruto.ok) return { ok: false, erro: bruto.error };
  try {
    const { desenharPptx } = await import("./pptx/desenho");
    const desenho = await desenharPptx(bruto.bytes);
    if (desenho.paginas.length === 0) return { ok: false, erro: "A apresentação não tem slides." };
    const salvo = await d.apresentacaoPaginas(desenho.paginas);
    if (!salvo.ok) return { ok: false, erro: salvo.error };
    return {
      ok: true,
      apresentacao: {
        id: salvo.id,
        titulo: desenho.titulo || titulo,
        origem: "pptx",
        slides: salvo.urls.map((imagem) => ({ texto: "", imagem })),
        de,
        criadoEm: Date.now(),
      },
      desenhadaPor: "Lúmen",
      aviso: avisoDoDesenhoProprio(motivo, desenho.fontesTrocadas, desenho.faltas),
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** As páginas de um PDF viram os slides da apresentação, uma imagem por página. */
async function apresentacaoDoPdf(
  bytes: Uint8Array,
  titulo: string,
  de: string | undefined,
  origem: Apresentacao["origem"],
): Promise<ResultadoDaImportacao> {
  const d = window.lumenDesktop;
  if (!d) return { ok: false, erro: "Importar apresentação é do app do Windows." };
  let paginas: Uint8Array[];
  try {
    paginas = await paginasDoPdf(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: /password/i.test(msg) ? "O PDF tem senha. Envie uma cópia sem senha." : `Não consegui abrir o PDF: ${msg}` };
  }
  if (paginas.length === 0) return { ok: false, erro: "O PDF não tem páginas." };
  const salvo = await d.apresentacaoPaginas(paginas);
  if (!salvo.ok) return { ok: false, erro: salvo.error };
  return {
    ok: true,
    apresentacao: {
      id: salvo.id,
      titulo,
      origem,
      slides: salvo.urls.map((imagem) => ({ texto: "", imagem })),
      de,
      criadoEm: Date.now(),
    },
  };
}
