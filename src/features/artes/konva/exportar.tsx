import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { todasAsCamadas, type DocumentoDeArte } from "../documento.ts";
import { ArteKonva, type AlcaDaArte } from "./desenho.tsx";
import { carregarImagensDe, garantirFontesDe } from "./recursos.ts";

/**
 * Do documento ao arquivo — pelo mesmo componente da prévia.
 *
 * Monta o `ArteKonva` fora da tela, no tamanho exato do formato, espera
 * fontes e imagens, e pede o canvas. Não há controles de seleção nem borda
 * de edição: o componente é montado sem modo de edição. O JPEG ganha fundo
 * opaco da cor da arte — canvas transparente viraria preto no JPEG.
 */

export interface Arquivo {
  ok: boolean;
  blob?: Blob;
  largura?: number;
  altura?: number;
  erro?: string;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O canvas da arte, com `pixelRatio` px por px do formato. */
export async function rasterizar(doc: DocumentoDeArte, pixelRatio = 1): Promise<HTMLCanvasElement> {
  await Promise.all([garantirFontesDe(doc.camadas), carregarImagensDe(doc.camadas)]);
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(div);
  const root = createRoot(div);
  const alca: { atual: AlcaDaArte | null } = { atual: null };
  try {
    flushSync(() =>
      root.render(
        <ArteKonva
          ref={(a) => {
            alca.atual = a;
          }}
          doc={doc}
          escala={1}
        />,
      ),
    );
    // O react-konva monta os nós num efeito; espera até a camada ter
    // todos os filhos antes de desenhar.
    for (let i = 0; i < 60; i++) {
      const s = alca.atual?.stage();
      const layer = s?.getLayers()[0];
      if (layer && layer.getChildren().length >= doc.camadas.length) break;
      await esperar(16);
    }
    const stage = alca.atual?.stage();
    if (!stage) throw new Error("O desenho não montou.");
    stage.draw();
    return stage.toCanvas({ pixelRatio });
  } finally {
    root.unmount();
    div.remove();
  }
}

function corDeFundo(doc: DocumentoDeArte): string {
  const f = doc.camadas.find((c) => c.tipo === "fundo");
  if (f?.tipo === "fundo") return f.preenchimento.tipo === "solido" ? f.preenchimento.cor : f.preenchimento.cores[0] ?? "#ffffff";
  return "#ffffff";
}

export async function exportarArte(doc: DocumentoDeArte, formato: "png" | "jpeg", qualidade = 0.92): Promise<Arquivo> {
  try {
    const canvas = await rasterizar(doc, 1);
    let alvo = canvas;
    if (formato === "jpeg") {
      alvo = document.createElement("canvas");
      alvo.width = canvas.width;
      alvo.height = canvas.height;
      const ctx = alvo.getContext("2d")!;
      ctx.fillStyle = corDeFundo(doc);
      ctx.fillRect(0, 0, alvo.width, alvo.height);
      ctx.drawImage(canvas, 0, 0);
    }
    if (alvo.width !== doc.largura || alvo.height !== doc.altura) {
      return { ok: false, erro: `O arquivo saiu com ${alvo.width}×${alvo.height} em vez de ${doc.largura}×${doc.altura}.` };
    }
    const blob = await new Promise<Blob | null>((r) => alvo.toBlob(r, formato === "png" ? "image/png" : "image/jpeg", qualidade));
    if (!blob) return { ok: false, erro: "O navegador não gerou o arquivo." };
    return { ok: true, blob, largura: alvo.width, altura: alvo.height };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falhou ao exportar." };
  }
}

const miniaturas = new Map<string, Promise<string>>();

/**
 * A miniatura: a composição real, reduzida — não um desenho à parte.
 *
 * Vira uma imagem (JPEG pequeno) e fica em memória, para a galeria mostrar
 * oito opções sem manter oito editores vivos.
 */
export function miniatura(doc: DocumentoDeArte, largura = 360): Promise<string> {
  const chave = `${doc.id}:${doc.atualizadoEm}:${doc.formatoId}:${largura}:${doc.camadas.length}:${assinaturaRapida(doc)}`;
  let p = miniaturas.get(chave);
  if (!p) {
    p = rasterizar(doc, largura / doc.largura).then((c) => c.toDataURL("image/jpeg", 0.86));
    miniaturas.set(chave, p);
    if (miniaturas.size > 120) miniaturas.delete(miniaturas.keys().next().value!);
  }
  return p;
}

function assinaturaRapida(doc: DocumentoDeArte): number {
  let h = 0;
  for (const { camada } of todasAsCamadas(doc.camadas)) {
    const s = `${camada.id}${camada.x}${camada.y}${camada.largura}${camada.altura}${camada.oculta ? 1 : 0}${camada.tipo === "texto" ? camada.texto + camada.cor + camada.tamanho : ""}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Nome de arquivo que o Windows aceita e a pessoa reconhece. */
export function nomeDoArquivo(doc: DocumentoDeArte, extensao: string): string {
  const limpo = doc.nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${limpo || "arte"}-${doc.largura}x${doc.altura}.${extensao}`;
}
