import { useEffect } from "react";
import { toast } from "sonner";
import { nid } from "@/lib/fold";
import { parseLyrics } from "@/lib/lyrics";
import { estadoRemoto, type AcaoRemota } from "@/lib/remote-control";
import { useChatStore } from "@/store/chat-store";
import { useLumenStore, type LumenState } from "@/store/lumen-store";

/**
 * Ponte entre o celular e a cabine.
 *
 * Publica o estado a cada troca de slide — o processo principal repassa por
 * SSE para quem estiver conectado — e escuta os comandos que o processo
 * principal manda de volta, aprovados pelo servidor (PIN certo, sessão
 * válida, permissão suficiente, ação da lista). O celular nunca fala com a
 * cabine direto; tudo passa pelo mesmo canal de IPC que qualquer outro
 * recurso do app Windows, e fora do app Windows este hook não faz nada.
 *
 * O que chega do celular é sempre pedido, nunca escrita: quem guarda o
 * repertório é esta janela, e é aqui que a letra vinda de fora vira música de
 * verdade, com slides montados pelo mesmo caminho do editor da cabine.
 */
const ACOES: Record<AcaoRemota, (s: LumenState) => void> = {
  proximo: (s) => s.next(),
  anterior: (s) => s.prev(),
  preto: (s) => s.goBlack(),
  logo: (s) => s.goLogo(),
  "ocultar-letra": (s) => s.goClear(),
  parar: (s) => s.stop(),
  "proximo-item": (s) => s.nextPlaylistItem(),
  // O vídeo local no telão: os mesmos três botões da cabine.
  tocar: (s) => s.comandarMedia({ mediaAcao: "tocar" }),
  pausar: (s) => s.comandarMedia({ mediaAcao: "pausar" }),
  "parar-midia": (s) => s.comandarMedia({ mediaAcao: "parar" }),
};

export function useRemoteControl() {
  const status = useLumenStore((s) => s.status);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const songs = useLumenStore((s) => s.songs);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    d.remoteControlPushState(estadoRemoto(status, live, liveIndex));
  }, [status, live, liveIndex]);

  // O repertório que o celular enxerga para editar. Vai inteiro a cada
  // mudança: são títulos e letras, não mídia, e um hinário inteiro de texto
  // ainda é menor que um slide de fundo.
  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    d.remoteControlPushRepertoire(
      songs.map((s) => ({ id: s.id, titulo: s.title, artista: s.artist, letra: s.lyricsRaw })),
    );
  }, [songs]);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    return d.onRemoteCommand((acao) => {
      const aplicar = (ACOES as Record<string, (s: LumenState) => void>)[acao];
      aplicar?.(useLumenStore.getState());
    });
  }, []);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    return d.onRemoteEvent((evento) => {
      if (evento.tipo === "chat") {
        useChatStore.getState().receber(evento.mensagem);
        return;
      }
      if (evento.tipo === "dispositivos") {
        if (evento.novo) toast(`${evento.novo} entrou pelo celular.`);
        return;
      }
      if (evento.tipo === "musica") {
        const st = useLumenStore.getState();
        const existente = evento.musica.id
          ? st.songs.find((s) => s.id === evento.musica.id)
          : undefined;
        st.saveSong({
          id: existente?.id ?? nid(),
          title: evento.musica.titulo,
          artist: evento.musica.artista || existente?.artist || "",
          groupId: existente?.groupId ?? "g-louvor",
          key: existente?.key ?? "",
          copyright: existente?.copyright ?? "",
          lyricsRaw: evento.musica.letra,
          slides: parseLyrics(evento.musica.letra),
          createdAt: existente?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        });
        toast(
          existente
            ? `${evento.de} editou “${evento.musica.titulo}”.`
            : `${evento.de} criou “${evento.musica.titulo}”.`,
        );
      }
    });
  }, []);
}
