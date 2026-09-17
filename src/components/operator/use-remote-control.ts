import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { nid } from "@/lib/fold";
import { parseLyrics } from "@/lib/lyrics";
import { loadSong, suggestSongs } from "@/lib/lyrics-suggestions";
import { MEDIA_KINDS, listMedia, mediaKindLabel } from "@/lib/media-library";
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

  /**
   * A pasta de mídia do PC, espelhada para o celular.
   *
   * Lê o disco, não a store: a store só conhece o que já foi tocado nesta
   * sessão, e o pedido era ver tudo o que está na pasta. Atualiza quando o
   * culto muda de item — é quando alguém acabou de largar um arquivo novo lá.
   */
  const espelharMidia = useCallback(async () => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    const listas = await Promise.all(MEDIA_KINDS.map((k) => listMedia(k.value)));
    const midia = listas.flatMap((lista, i) =>
      (lista.items ?? []).map((item) => ({
        id: item.id,
        tipo: MEDIA_KINDS[i].value,
        titulo: item.title,
        detalhe: mediaKindLabel(MEDIA_KINDS[i].value),
      })),
    );
    d.remoteControlPushMedia(midia);
  }, []);

  useEffect(() => {
    void espelharMidia();
  }, [espelharMidia, live?.refId]);

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
      if (evento.tipo === "projetar") {
        const st = useLumenStore.getState();
        // Mídia de disco precisa existir na store antes de ser projetada —
        // o mesmo cuidado que a biblioteca da cabine toma ao clicar.
        if (evento.kind === "media" && !st.media.some((m) => m.id === evento.refId)) {
          void (async () => {
            for (const k of MEDIA_KINDS) {
              const lista = await listMedia(k.value);
              const achado = (lista.items ?? []).find((m) => m.id === evento.refId);
              if (!achado) continue;
              st.addMedia({ id: achado.id, type: k.value, title: achado.title, path: achado.url });
              useLumenStore.getState().projetarDaBiblioteca("media", evento.refId);
              return;
            }
            toast(`${evento.de} pediu um arquivo que não está mais na pasta.`);
          })();
          return;
        }
        st.projetarDaBiblioteca(evento.kind, evento.refId);
        return;
      }
      if (evento.tipo === "buscar-musica") {
        // A busca roda aqui, com o mesmo provedor da cabine: o celular pode
        // estar sem internet, e dois provedores dariam dois resultados para a
        // mesma busca.
        void (async () => {
          const r = await suggestSongs(evento.termo, "");
          const d2 = window.lumenDesktop;
          d2?.remoteControlAnswer(evento.pedido, {
            achados: r.ok
              ? r.hits.slice(0, 12).map((h) => ({
                  titulo: h.title,
                  artista: h.artist,
                  fonte: h.sourceUrl,
                }))
              : [],
            erro: r.ok ? null : r.error,
          });
        })();
        return;
      }
      if (evento.tipo === "letra-musica") {
        void (async () => {
          const r = await loadSong(evento.fonte);
          const d2 = window.lumenDesktop;
          d2?.remoteControlAnswer(evento.pedido, { letra: r.lyrics ?? "", erro: r.error ?? null });
        })();
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
