import { paraSvg } from "./render.ts";
import type { Documento } from "./types.ts";

/**
 * Do documento ao arquivo.
 *
 * O SVG é o mesmo que a prévia desenha — a exportação não é um segundo
 * caminho, é o mesmo caminho rasterizado. Se fossem dois, o que a pessoa
 * aprova e o que ela recebe iam divergir, e ela só descobriria depois de
 * imprimir.
 *
 * Rasteriza com o canvas do próprio navegador, sem biblioteca: `<img>` lê o
 * SVG, o canvas desenha, `toBlob` entrega o PNG. Uma dependência de
 * exportação aqui pesaria mais que o recurso inteiro.
 */

/** O SVG como endereço `data:`, pronto para virar imagem. */
export function svgComoUrl(doc: Documento, escala = 1): string {
  const svg = paraSvg(doc, escala);
  // encodeURIComponent em vez de base64: mantém o texto legível para
  // depuração e evita o custo de converter um arquivo grande duas vezes.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface Exportacao {
  ok: boolean;
  blob?: Blob;
  erro?: string;
}

/**
 * Rasteriza a arte.
 *
 * `escala` multiplica o tamanho do formato: 1 é o tamanho nominal, 2 dobra.
 * Para o cartaz A4, que já nasce em 300 dpi, 1 basta e 2 faria um arquivo
 * que nenhuma gráfica pediu.
 */
export async function paraPng(
  doc: Documento,
  opcoes: { escala?: number; qualidade?: number; tipo?: "image/png" | "image/jpeg" } = {},
): Promise<Exportacao> {
  const escala = Math.min(4, Math.max(0.1, opcoes.escala ?? 1));
  const tipo = opcoes.tipo ?? "image/png";
  const largura = Math.round(doc.largura * escala);
  const altura = Math.round(doc.altura * escala);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("não consegui desenhar o SVG"));
      el.src = svgComoUrl(doc);
    });

    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext("2d");
    if (!pincel) return { ok: false, erro: "O navegador não deu o canvas." };
    // JPEG não tem transparência: sem o fundo branco, o que for transparente
    // sai preto — e ninguém quer um cartaz com fundo preto por acidente.
    if (tipo === "image/jpeg") {
      pincel.fillStyle = "#ffffff";
      pincel.fillRect(0, 0, largura, altura);
    }
    pincel.drawImage(img, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, tipo, opcoes.qualidade ?? 0.92),
    );
    if (!blob) return { ok: false, erro: "Não consegui gerar o arquivo." };
    return { ok: true, blob };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falhou ao exportar." };
  }
}

/** Nome de arquivo que o Windows aceita e a pessoa reconhece. */
export function nomeDeArquivo(doc: Documento, extensao: string): string {
  const limpo = doc.nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${limpo || "arte"}-${doc.formatoId}.${extensao}`;
}
