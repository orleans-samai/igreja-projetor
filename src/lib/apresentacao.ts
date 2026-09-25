import type { Apresentacao } from "./types";

/**
 * Transformar o arquivo que o dirigente mandou em slides do Lúmen.
 *
 * Dois caminhos, porque são dois formatos de natureza diferente:
 *
 * - **PowerPoint** é lido no processo principal, sem Office: texto e
 *   imagem de cada slide. Perde animação, transição e posição exata.
 * - **PDF** é desenhado aqui, página por página, pelo pdf.js — o mesmo
 *   motor do Firefox. Sai idêntico ao original. É o caminho a recomendar
 *   a quem precisa do slide perfeito: no PowerPoint, "Salvar como → PDF".
 *
 * O que não dá, diz por quê. `.ppt` antigo e `.odp` são formatos que só
 * um Office abre, e fingir que abriu seria pior que avisar.
 */

/** Largura em que cada página de PDF é desenhada: Full HD, a do telão. */
const LARGURA_DA_PAGINA = 1920;
/** O mesmo teto do processo principal. */
const MAX_PAGINAS = 300;

export type ResultadoDaImportacao =
  | { ok: true; apresentacao: Apresentacao }
  | { ok: false; erro: string };

export function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i).toLowerCase() : "";
}

/** Se é um formato que o Lúmen sabe transformar em slides. */
export function sabeImportar(nome: string): boolean {
  const ext = extensao(nome);
  return ext === ".pptx" || ext === ".pdf";
}

/** A frase para o formato que não dá, dizendo o que fazer em vez disso. */
export function motivoDeNaoImportar(nome: string): string {
  const ext = extensao(nome);
  if (ext === ".ppt") {
    return "É o formato antigo do PowerPoint (.ppt). Abra no PowerPoint e salve como .pptx ou PDF.";
  }
  if (ext === ".odp") {
    return "É uma apresentação do LibreOffice (.odp). Exporte como PDF para projetar.";
  }
  return "O Lúmen projeta PowerPoint (.pptx) e PDF.";
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
  if (extensao(nome) === ".pptx") {
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
    };
  }

  const lido = await d.apresentacaoPdf(nome);
  if (!lido.ok) return { ok: false, erro: lido.error };
  let paginas: Uint8Array[];
  try {
    paginas = await paginasDoPdf(lido.bytes);
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
      titulo: base,
      origem: "pdf",
      slides: salvo.urls.map((imagem) => ({ texto: "", imagem })),
      de,
      criadoEm: Date.now(),
    },
  };
}
