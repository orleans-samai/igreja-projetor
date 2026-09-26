import type { DragEvent } from "react";
import { toast } from "sonner";
import { nid } from "@/lib/fold";
import {
  avisarMidiaMudou,
  importarParaAPasta,
  mediaKindLabel,
  tipoDoArquivo,
  type MediaKind,
} from "@/lib/media-library";
import type { PlaylistItem } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Arrastar para a Biblioteca e para a Programação do culto.
 *
 * Duas coisas chegam num soltar: arquivos do Explorer (vídeo, música, foto) e
 * itens da própria Biblioteca. Os dois caminhos passam por aqui para que o
 * mesmo arquivo solto em lugares diferentes vire a mesma mídia, com o mesmo
 * id — e o celular a veja do mesmo jeito.
 */

/** Uma mídia pronta para projetar: está na pasta (ou na sessão) e na store. */
export interface MidiaTrazida {
  id: string;
  kind: MediaKind;
  title: string;
  path: string;
}

export interface Trazidos {
  itens: MidiaTrazida[];
  recusados: { nome: string; erro: string }[];
  /** Sem pasta (navegador): a mídia só vale até fechar o Lúmen. */
  soNaSessao: boolean;
}

/** A projeção acha a mídia pelo id na store; a pasta sozinha não basta. */
export function garantirNaStore(m: MidiaTrazida) {
  const st = useLumenStore.getState();
  if (!st.media.some((x) => x.id === m.id)) {
    st.addMedia({ id: m.id, type: m.kind, title: m.title, path: m.path });
  }
}

/**
 * Arquivos soltos ou escolhidos no "Importar".
 *
 * No app do Windows vão para a pasta de mídia — é o que os faz sobreviver ao
 * fechar o app e aparecer no celular. No navegador, que não tem pasta, ficam
 * na sessão como antes.
 *
 * `mostrar`: a lista de mídia abre no tipo do arquivo. Só para quem soltou na
 * própria Biblioteca — soltar no culto não pode trocar a coluna ao lado.
 */
export async function trazerArquivos(
  files: File[],
  { mostrar = false }: { mostrar?: boolean } = {},
): Promise<Trazidos> {
  // Copiar um vídeo de culto leva alguns segundos: sem recado, parecia que
  // soltar o arquivo não tinha feito nada.
  const avisoDeCopia = window.setTimeout(
    () => toast.loading("Copiando para a pasta de mídia…", { id: "copiando-midia" }),
    400,
  );
  const naPasta = await importarParaAPasta(files).finally(() => {
    window.clearTimeout(avisoDeCopia);
    toast.dismiss("copiando-midia");
  });
  if (naPasta) {
    const itens = naPasta.importados.map((f) => ({
      id: f.id,
      kind: f.kind,
      title: f.title,
      path: f.url,
    }));
    itens.forEach(garantirNaStore);
    if (itens.length) avisarMidiaMudou(mostrar ? itens[0].kind : undefined);
    return { itens, recusados: naPasta.recusados, soNaSessao: false };
  }

  const st = useLumenStore.getState();
  const itens: MidiaTrazida[] = [];
  const recusados: Trazidos["recusados"] = [];
  for (const file of files) {
    const kind = tipoDoArquivo(file.name, file.type);
    if (!kind) {
      recusados.push({ nome: file.name, erro: "não é vídeo, áudio nem imagem" });
      continue;
    }
    const item = {
      id: nid(),
      kind,
      title: file.name.replace(/\.[^.]+$/, ""),
      path: URL.createObjectURL(file),
    };
    st.addMedia({ id: item.id, type: kind, title: item.title, path: item.path, sessionOnly: true });
    itens.push(item);
  }
  if (itens.length) avisarMidiaMudou(mostrar ? itens[0].kind : undefined);
  return { itens, recusados, soNaSessao: true };
}

/** O recado depois de soltar: o que entrou, onde, e o que ficou de fora e por quê. */
export function contarTrazidos(r: Trazidos, destino: "biblioteca" | "culto") {
  const n = r.itens.length;
  if (n > 0) {
    const onde =
      destino === "culto"
        ? "na programação do culto"
        : r.soNaSessao
          ? "na mídia, só nesta sessão"
          : "na mídia";
    toast(n === 1 ? `“${r.itens[0].title}” entrou ${onde}.` : `${n} arquivos entraram ${onde}.`);
  }
  if (r.recusados.length > 0) {
    const lista = r.recusados
      .slice(0, 3)
      .map((x) => (x.nome ? `${x.nome} (${x.erro})` : x.erro))
      .join("; ");
    const resto = r.recusados.length > 3 ? ` e mais ${r.recusados.length - 3}` : "";
    toast.error(`Ficou de fora: ${lista}${resto}.`, { duration: 8000 });
  }
}

/** O item que vai para o culto quando a mídia chega nele. */
export function itemDoCulto(m: MidiaTrazida): Omit<PlaylistItem, "id"> {
  return { type: "media", refId: m.id, notes: "", title: m.title, subtitle: mediaKindLabel(m.kind) };
}

/* -- itens da própria Biblioteca --------------------------------------- */

const TIPO_ITEM = "application/x-lumen-item";

/** Uma linha da Biblioteca a caminho do culto. */
export interface ItemArrastado {
  item: Omit<PlaylistItem, "id">;
  /** Mídia de disco ainda não tocada nesta sessão precisa entrar na store. */
  midia?: MidiaTrazida;
}

export function comecarArraste(e: DragEvent, dado: ItemArrastado) {
  e.dataTransfer.setData(TIPO_ITEM, JSON.stringify(dado));
  e.dataTransfer.effectAllowed = "copy";
}

export function temArquivos(dt: DataTransfer) {
  return Array.from(dt.types).includes("Files");
}

export function temItem(dt: DataTransfer) {
  return Array.from(dt.types).includes(TIPO_ITEM);
}

/** Só aceita o formato que a própria Biblioteca escreve. */
export function lerItem(dt: DataTransfer): ItemArrastado | null {
  try {
    const bruto = dt.getData(TIPO_ITEM);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as ItemArrastado;
    const it = dado?.item;
    if (!it || typeof it.refId !== "string" || typeof it.title !== "string" || typeof it.type !== "string") {
      return null;
    }
    return dado;
  } catch {
    return null;
  }
}
