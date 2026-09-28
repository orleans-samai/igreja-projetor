import { toast } from "sonner";
import { quemAbreValido } from "@/lib/abrir-slides";
import { importarRecebido } from "@/lib/apresentacao";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Uma apresentação que já está em "recebidos" vira slides na programação.
 *
 * É o caminho do menu Slides e também o do .pptx solto na Mídia ou no Culto
 * — antes recusado com "não é vídeo, áudio nem imagem". Um lugar só decide
 * o que acontece com a apresentação, e os avisos são os mesmos em qualquer
 * porta por onde ela entre.
 */
export async function abrirApresentacaoRecebida(nome: string): Promise<boolean> {
  const id = `apres-${nome}`;
  toast(`Abrindo “${nome}”…`, { id });
  const quem = quemAbreValido(useLumenStore.getState().settings.abrirSlidesCom);
  const r = await importarRecebido(nome, undefined, quem);
  if (!r.ok) {
    toast.error(`“${nome}” não virou slides: ${r.erro}`, { id, duration: 12000 });
    return false;
  }
  const st = useLumenStore.getState();
  const n = r.apresentacao.slides.length;
  st.adicionarApresentacao(r.apresentacao);
  st.addToPlaylist({
    type: "apresentacao",
    refId: r.apresentacao.id,
    notes: "",
    title: r.apresentacao.titulo,
    subtitle: `${n} slides`,
  });
  st.selectApresentacao(r.apresentacao.id);
  const desenhou = r.desenhadaPor ? `, desenhados pelo ${r.desenhadaPor}` : "";
  toast.success(`“${r.apresentacao.titulo}” entrou na programação — ${n} slides${desenhou}.`, { id });
  if (r.aviso) toast.warning(r.aviso, { duration: 15000 });
  return true;
}
