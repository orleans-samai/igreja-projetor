import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { nid } from "@/lib/fold";
import { parseLyrics } from "@/lib/lyrics";
import { loadSong, suggestSongs } from "@/lib/lyrics-suggestions";
import { avisarMensagem } from "@/components/operator/aviso-de-mensagem";
import { importarRecebido } from "@/lib/apresentacao";
import { MEDIA_KINDS, listMedia, mediaKindLabel, useMidiaMudou } from "@/lib/media-library";
import { TETO_DE_CAPAS, capaDe } from "@/lib/midia-capa";
import {
  estadoRemoto,
  volumeDePorcento,
  type AcaoRemota,
  type CultoRemoto,
  type TemaRemoto,
} from "@/lib/remote-control";
import { temaDaMusica, temasUsados } from "@/lib/tema-remoto";
import { enviadoPor, etapaDoItem } from "@/lib/culto-etapas";
import { useChatStore } from "@/store/chat-store";
import { chegouRecado, recadoApagado } from "@/store/chat-historico-store";
import { useLumenStore, type LumenState } from "@/store/lumen-store";
import type { Theme } from "@/lib/types";

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
  // "Sair do vídeo": para e tira o vídeo do telão, que fica só com o fundo.
  // Antes só parava — o primeiro quadro continuava na tela. Com outra coisa
  // no ar (uma letra, um versículo), não faz nada: o botão mora sempre na
  // tela do celular, e um toque sem querer não pode apagar a letra do culto.
  "parar-midia": (s) => {
    // Com o som de um vídeo tocando sem imagem, sair do vídeo é calar o som.
    if (s.trilha) {
      s.pararTrilha();
      return;
    }
    if (s.status === "idle" || s.live?.kind !== "media") return;
    s.comandarMedia({ mediaAcao: "parar" });
    if (s.status !== "clear") s.goClear();
  },
};

/**
 * O fundo de um tema reduzido ao que cabe numa miniatura de celular.
 *
 * Cor e degradê viajam como CSS, que o aparelho desenha igual ao telão.
 * Imagem e vídeo viram um JPEG pequeno, pelo mesmo caminho da capa de mídia:
 * o celular não alcança o disco do PC. Fundo animado é uma classe da folha
 * de estilo da cabine — o aparelho não a tem, e a miniatura fica só escura.
 */
async function capaDoTema(t: Theme): Promise<TemaRemoto> {
  const base = { id: t.id, cor: t.textColor, maiusculas: t.uppercase };
  if (t.backgroundType === "color") return { ...base, fundo: t.backgroundValue, imagem: "" };
  if (t.backgroundType === "image" || t.backgroundType === "video") {
    const { capa } = await capaDe(t.backgroundValue, t.backgroundType);
    return { ...base, fundo: "", imagem: capa };
  }
  return { ...base, fundo: "", imagem: "" };
}

/**
 * Um slide específico no telão, pedido da grade do celular.
 *
 * Seleciona antes de apresentar quando o baralho não está no preview —
 * `presentSlide` trabalha em cima do preview, e sem isso o toque mandaria
 * para o telão o que estivesse selecionado na cabine, que é outra música.
 */
function projetarSlide(kind: "song" | "text" | "media", refId: string, i: number): void {
  const st = useLumenStore.getState();
  if (st.preview?.refId !== refId) {
    if (kind === "song") st.selectSong(refId);
    else if (kind === "text") st.selectText(refId);
    else return;
  }
  useLumenStore.getState().presentSlide(i);
}

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
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);

  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    d.remoteControlPushRepertoire(
      songs.map((s) => ({
        id: s.id,
        titulo: s.title,
        artista: s.artist,
        letra: s.lyricsRaw,
        tema: temaDaMusica(s, songThemeId),
        // Os slides vão prontos, não a letra para o celular repartir: quem
        // decide onde a estrofe quebra é a cabine, e duas contas diferentes
        // dariam "19 de 32" no telão e "19 de 30" na mão de quem projeta.
        slides: s.slides.map((sl) => ({ rotulo: sl.label, texto: sl.text })),
      })),
    );
  }, [songs, songThemeId]);

  /**
   * A cara dos temas, para a grade de slides do celular não ser cinza.
   *
   * Só os temas que alguma música usa, e com capa feita uma vez por sessão:
   * o cache de `capaDe` é por endereço, então salvar uma música não
   * redecodifica fundo nenhum.
   */
  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    let vivo = true;
    void (async () => {
      const lista = await Promise.all(temasUsados(themes, songs, songThemeId).map(capaDoTema));
      if (vivo) window.lumenDesktop?.remoteControlPushThemes(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [themes, songs, songThemeId]);

  /**
   * A pasta de mídia do PC, espelhada para o celular.
   *
   * Lê o disco, não a store: a store só conhece o que já foi tocado nesta
   * sessão, e o pedido era ver tudo o que está na pasta.
   *
   * Atualiza na hora em que a pasta muda — importar, arrastar, arquivo do
   * dirigente, cópia pelo Explorer (o processo principal vigia as pastas).
   * Antes só relia ao trocar o item no ar, e a mídia nova ficava invisível
   * no celular até lá.
   */
  // Avisos seguidos disparam leituras seguidas; só a mais nova publica. Uma
  // antiga, atrasada pelas capas, mandaria ao celular uma lista velha.
  const rodadaDaMidia = useRef(0);
  const espelharMidia = useCallback(async () => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    const rodada = ++rodadaDaMidia.current;
    const listas = await Promise.all(MEDIA_KINDS.map((k) => listMedia(k.value)));
    if (rodada !== rodadaDaMidia.current) return;
    const midia = listas.flatMap((lista, i) =>
      (lista.items ?? []).map((item) => ({
        id: item.id,
        tipo: MEDIA_KINDS[i].value,
        titulo: item.title,
        detalhe: mediaKindLabel(MEDIA_KINDS[i].value),
        url: item.url,
      })),
    );
    // A lista vai primeiro, sem capa: o celular mostra os nomes na hora, e a
    // capa chega depois. Esperar quarenta arquivos decodificarem antes de
    // mostrar qualquer coisa seria uma tela em branco no meio do culto.
    d.remoteControlPushMedia(midia.map(({ url: _url, ...m }) => m));

    const comCapa = await Promise.all(
      midia.slice(0, TETO_DE_CAPAS).map(async ({ url, ...m }) => ({
        ...m,
        ...(await capaDe(url, m.tipo)),
      })),
    );
    const semCapa = midia.slice(TETO_DE_CAPAS).map(({ url: _url, ...m }) => m);
    if (rodada !== rodadaDaMidia.current) return;
    window.lumenDesktop?.remoteControlPushMedia([...comCapa, ...semCapa]);
  }, []);

  /**
   * A programação do culto aberta aqui, espelhada na aba Culto do celular.
   *
   * Lida da store na hora de mandar, não do render: a mesma função serve
   * para quando o celular pede para tirar um item que a cabine já não tinha
   * — aí nada mudou aqui, e é preciso reenviar a verdade assim mesmo.
   */
  const espelharCulto = useCallback(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    const st = useLumenStore.getState();
    const pl = st.playlists.find((p) => p.id === st.activePlaylistId) ?? st.playlists[0];
    const itens = pl?.items ?? [];
    const noAr =
      st.status !== "idle" && st.live ? itens.findIndex((it) => it.refId === st.live?.refId) : -1;
    const culto: CultoRemoto = {
      nome: pl?.name ?? "",
      itens: itens.map((it, i) => ({
        id: it.id,
        titulo: it.title,
        tipo: it.type as CultoRemoto["itens"][number]["tipo"],
        detalhe: enviadoPor(it.enviadoPor) ?? it.subtitle ?? "",
        etapa: etapaDoItem(i, noAr),
      })),
    };
    d.remoteControlPushCulto(culto);
  }, []);
  const playlists = useLumenStore((s) => s.playlists);
  const activePlaylistId = useLumenStore((s) => s.activePlaylistId);
  useEffect(() => {
    espelharCulto();
  }, [espelharCulto, playlists, activePlaylistId, live?.refId, status]);

  const avisoDeMidia = useMidiaMudou();
  useEffect(() => {
    void espelharMidia();
  }, [espelharMidia, live?.refId, avisoDeMidia.versao]);

  // A página do dirigente abre com a cara da casa: logo e nome vêm daqui,
  // porque é a cabine quem guarda as configurações da igreja.
  const churchName = useLumenStore((s) => s.settings.churchName);
  const logoUrl = useLumenStore((s) => s.settings.logoUrl);
  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    d.remoteControlPushChurch({ nome: churchName, logo: logoUrl });
  }, [churchName, logoUrl]);

  // Quem já estava no chat quando a cabine abriu: a lista chega pelo
  // evento "presenca" só quando alguém entra ou sai.
  useEffect(() => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop || !d.remoteControlPresenca) return;
    void d.remoteControlPresenca().then((pessoas) => useChatStore.getState().setPessoas(pessoas));
  }, []);

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
        const m = evento.mensagem;
        // Nova de verdade: o celular que reconecta reenvia o histórico, e o
        // aviso dourado não pode repetir recado de meia hora atrás.
        const nova = !useChatStore.getState().mensagens.some((x) => x.id === m.id);
        chegouRecado(m);
        // O que a própria cabine escreveu não vira aviso para ela mesma.
        if (nova && !m.daCabine) avisarMensagem(m);
        return;
      }
      if (evento.tipo === "presenca") {
        useChatStore.getState().setPessoas(evento.pessoas);
        return;
      }
      if (evento.tipo === "digitando") {
        useChatStore.getState().marcarDigitando(evento.deId, evento.de);
        return;
      }
      if (evento.tipo === "chat-apagada") {
        recadoApagado(evento.id);
        return;
      }
      if (evento.tipo === "dispositivos") {
        if (evento.novo) toast(`${evento.novo} entrou pelo celular.`);
        return;
      }
      if (evento.tipo === "culto-remover" || evento.tipo === "culto-projetar") {
        const st = useLumenStore.getState();
        const pl = st.playlists.find((p) => p.id === st.activePlaylistId);
        const indice = pl?.items.findIndex((it) => it.id === evento.id) ?? -1;
        if (indice < 0) {
          // O celular viu uma programação que já mudou aqui: manda a atual.
          espelharCulto();
          return;
        }
        if (evento.tipo === "culto-remover") {
          st.removePlaylistItem(evento.id);
          toast(`${evento.de} tirou “${evento.titulo}” do culto.`);
        } else {
          st.presentPlaylistItem(indice);
        }
        return;
      }
      if (evento.tipo === "culto-adicionar") {
        const st = useLumenStore.getState();
        const porNoCulto = (titulo: string) => {
          useLumenStore.getState().addToPlaylist({
            type: evento.kind,
            refId: evento.refId,
            notes: "",
            title: titulo,
            enviadoPor: evento.de || undefined,
          });
          toast(`${evento.de} pôs “${titulo}” no culto.`);
        };
        // Mídia da pasta que a biblioteca ainda não conhece entra nela antes,
        // como no projetar: item da programação sem mídia não teria o que tocar.
        if (evento.kind === "media" && !st.media.some((m) => m.id === evento.refId)) {
          void (async () => {
            for (const k of MEDIA_KINDS) {
              const lista = await listMedia(k.value);
              const achado = (lista.items ?? []).find((m) => m.id === evento.refId);
              if (!achado) continue;
              useLumenStore.getState().addMedia({ id: achado.id, type: k.value, title: achado.title, path: achado.url });
              porNoCulto(achado.title);
              return;
            }
            toast(`${evento.de} pediu um arquivo que não está mais na pasta.`);
          })();
          return;
        }
        const titulo =
          evento.kind === "song"
            ? st.songs.find((s) => s.id === evento.refId)?.title
            : st.media.find((m) => m.id === evento.refId)?.title;
        if (!titulo) {
          toast(`${evento.de} pediu um item que não está mais na biblioteca.`);
          return;
        }
        porNoCulto(titulo);
        return;
      }
      if (evento.tipo === "arquivo") {
        const st = useLumenStore.getState();
        if (evento.projetavel && evento.kind && evento.id) {
          // Vídeo, áudio e imagem já servem para projetar, então entram na
          // programação do culto de hoje — que é o que o dirigente pediu ao
          // apertar "enviar para o culto".
          //
          // A mídia entra na biblioteca antes do item: o item da programação
          // aponta para ela, e sem ela o clique não tinha o que tocar — o
          // "não está abrindo" do que o dirigente mandava.
          const titulo = evento.nome.replace(/\.[^.]+$/, "") || evento.nome;
          const url = evento.url || `lumen://app/__midia/${evento.kind}/${encodeURIComponent(evento.nome)}`;
          if (!st.media.some((m) => m.id === evento.id)) {
            st.addMedia({ id: evento.id, type: evento.kind, title: titulo, path: url });
          }
          useLumenStore.getState().addToPlaylist({
            type: "media",
            refId: evento.id,
            notes: "",
            title: titulo,
            subtitle: "Recebido",
            enviadoPor: evento.de || undefined,
          });
          toast(
            evento.de
              ? `“${evento.nome}”, de ${evento.de}, entrou na programação do culto.`
              : `“${evento.nome}” entrou na programação do culto.`,
          );
        } else {
          // PowerPoint e PDF viram slides e entram na programação, como o
          // dirigente pediu ao apertar "enviar para o culto".
          //
          // Antes ficavam só guardados, com o argumento de que o Lúmen não
          // os desenhava. O argumento era verdade; a conclusão, errada: o
          // que o dirigente espera é ver a apresentação no culto, e agora o
          // Lúmen sabe mostrá-la.
          const quem = evento.de ? `, de ${evento.de},` : "";
          toast(`Abrindo “${evento.nome}”${quem}…`, { id: `apres-${evento.nome}` });
          void importarRecebido(evento.nome, evento.de || undefined).then((r) => {
            if (!r.ok) {
              // O arquivo continua guardado; o que falhou foi transformá-lo
              // em slides — e isso se diz com o motivo, não com silêncio.
              toast.error(`“${evento.nome}” chegou, mas não virou slides: ${r.erro}`, {
                id: `apres-${evento.nome}`,
                duration: 12000,
              });
              return;
            }
            const st2 = useLumenStore.getState();
            st2.adicionarApresentacao(r.apresentacao);
            st2.addToPlaylist({
              type: "apresentacao",
              refId: r.apresentacao.id,
              notes: "",
              title: r.apresentacao.titulo,
              subtitle: `${r.apresentacao.slides.length} slides · Recebido`,
              enviadoPor: evento.de || undefined,
            });
            const desenhados = r.desenhadaPor ? `, desenhados pelo ${r.desenhadaPor}` : "";
            toast.success(
              `“${r.apresentacao.titulo}”${quem} entrou na programação do culto — ${r.apresentacao.slides.length} slides${desenhados}.`,
              { id: `apres-${evento.nome}` },
            );
            if (r.aviso) toast.warning(r.aviso, { duration: 15000 });
          });
        }
        return;
      }
      if (evento.tipo === "aviso") {
        // Vai para a biblioteca de textos, não para a programação: um aviso
        // escrito lá de fora entrando sozinho no culto mudaria a ordem do
        // domingo sem ninguém na cabine ter visto o que estava escrito.
        useLumenStore.getState().saveText({
          id: nid(),
          title: evento.titulo,
          body: evento.texto,
          updatedAt: Date.now(),
        });
        toast(`Aviso de ${evento.de} guardado em Textos: “${evento.titulo}”.`);
        return;
      }
      if (evento.tipo === "volume") {
        useLumenStore.getState().comandarMedia({
          mediaVolume: volumeDePorcento(evento.valor),
          mediaMudo: evento.valor === 0,
        });
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
        if (typeof evento.slide === "number") {
          projetarSlide(evento.kind, evento.refId, evento.slide);
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
          // O celular fica em "Trazendo a letra…" até a cabine responder:
          // qualquer falha vira resposta, nunca silêncio.
          let resposta: { letra: string; erro: string | null };
          try {
            const r = await loadSong(evento.fonte);
            resposta = { letra: r.lyrics ?? "", erro: r.error ?? null };
          } catch {
            resposta = { letra: "", erro: "A cabine não conseguiu trazer essa letra. Tente outra opção ou cole a letra." };
          }
          window.lumenDesktop?.remoteControlAnswer(evento.pedido, resposta);
        })();
        return;
      }
      if (evento.tipo === "musica") {
        const st = useLumenStore.getState();
        const existente = evento.musica.id
          ? st.songs.find((s) => s.id === evento.musica.id)
          : undefined;
        const id = existente?.id ?? nid();
        st.saveSong({
          id,
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
        if (evento.noCulto) {
          useLumenStore.getState().addToPlaylist({
            type: "song",
            refId: id,
            notes: "",
            title: evento.musica.titulo,
          });
        }
        toast(
          existente
            ? `${evento.de} editou “${evento.musica.titulo}”.`
            : evento.noCulto
              ? `${evento.de} trouxe “${evento.musica.titulo}” e pôs no culto.`
              : `${evento.de} criou “${evento.musica.titulo}”.`,
        );
      }
    });
  }, [espelharCulto]);
}
