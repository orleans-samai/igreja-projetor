import { searchSongs, useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";
import type { AcoesIA } from "./ferramentas.ts";

/**
 * A ponte entre o catálogo e a cabine de verdade.
 *
 * Tudo aqui passa por ação pública da store — nada escreve no estado direto.
 * É o que garante que um pedido da IA percorre exatamente o mesmo caminho de
 * um clique do operador: as mesmas validações, o mesmo broadcast para o
 * telão, o mesmo registro no histórico.
 *
 * Quando a operação não existia, ela nasceu como ação de domínio tipada
 * (ver `criarServicoRecorrente`), e não como um atalho para dentro da store.
 */
export function acoesReais(): AcoesIA {
  const st = () => useLumenStore.getState();

  return {
    buscarMusicas(termo) {
      return searchSongs(st().songs, termo, "all")
        .slice(0, 8)
        .map((m) => ({ id: m.id, titulo: m.title, artista: m.artist }));
    },

    projetarMusica(id) {
      const s = st();
      if (!s.songs.some((m) => m.id === id)) return false;
      s.selectSong(id);
      // Microtarefa: `selectSong` publica o preview, e apresentar antes disso
      // mandaria o quadro anterior para o telão.
      queueMicrotask(() => useLumenStore.getState().presentPreview());
      return true;
    },

    prepararMusica(id) {
      const s = st();
      if (!s.songs.some((m) => m.id === id)) return false;
      s.selectSong(id);
      return true;
    },

    versiculo(referencia, projetar) {
      return st().jumpRef(referencia, projetar);
    },

    proximoSlide: () => st().next(),
    slideAnterior: () => st().prev(),
    telaPreta: () => st().goBlack(),
    mostrarLogo: () => st().goLogo(),
    ocultarTexto: () => st().goClear(),
    pararProjecao: () => st().stop(),

    criarAviso(texto, segundos) {
      st().setAlert(texto, segundos, "bottom");
    },

    contagemRegressiva(rotulo, segundos) {
      st().startCountdown(rotulo, segundos);
    },

    linhasPorSlide(quantas) {
      st().updateSettings({ maxLines: quantas });
    },

    historicoDeHoje() {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      return st()
        .logs.filter((l) => l.playedAt >= inicio.getTime())
        .slice(-20)
        .map((l) => ({
          titulo: l.title,
          hora: new Date(l.playedAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
    },

    criarCultoRecorrente(nome, diaDaSemana) {
      return st().criarServicoRecorrente(nome, diaDaSemana);
    },

    listarTemas() {
      return st().themes.map((t) => ({ id: t.id, nome: t.name }));
    },

    aplicarTema(id) {
      const s = st();
      if (!s.themes.some((t) => t.id === id)) return false;
      s.setThemeForKind("songs", id);
      return true;
    },

    ajustarTema(patch) {
      const s = st();
      const tema = s.themes.find((t) => t.id === s.songThemeId) ?? s.themes[0];
      if (!tema) return false;
      // Só os campos que a ferramenta declara; o resto do tema fica como está.
      const limpo = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(limpo).length === 0) return false;
      s.updateTheme({ ...tema, ...limpo });
      return true;
    },

    listarCulto() {
      const s = st();
      const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
      return (pl?.items ?? []).map((item, i) => ({
        indice: i + 1,
        titulo: item.title,
        tipo: item.type,
      }));
    },

    adicionarAoCulto(tipo, refId) {
      const s = st();
      const titulo =
        tipo === "song"
          ? s.songs.find((m) => m.id === refId)?.title
          : tipo === "text"
            ? s.texts.find((t) => t.id === refId)?.title
            : s.media.find((m) => m.id === refId)?.title;
      if (!titulo) return false;
      s.addToPlaylist({ type: tipo, refId, notes: "", title: titulo });
      return true;
    },

    removerDoCulto(indice) {
      const s = st();
      const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
      const item = pl?.items[indice];
      if (!item) return { ok: false };
      s.removePlaylistItem(item.id);
      return { ok: true, titulo: item.title };
    },

    moverItemDoCulto(de, para) {
      const s = st();
      const pl = s.playlists.find((p) => p.id === s.activePlaylistId);
      const total = pl?.items.length ?? 0;
      if (de < 0 || para < 0 || de >= total || para >= total) return false;
      s.movePlaylistItem(de, para);
      return true;
    },

    criarPlaylist(nome) {
      st().savePlaylist(nome);
      return true;
    },

    letraDoPreview() {
      const p = st().preview;
      if (!p || p.slides.length === 0) return null;
      return p.slides.map((sl) => ({ slideId: sl.id, rotulo: sl.label, texto: sl.text }));
    },

    editarSlide(slideId, texto) {
      const s = st();
      if (!s.preview?.slides.some((sl) => sl.id === slideId)) return false;
      s.updatePreviewSlide(slideId, { text: texto });
      return true;
    },

    dividirSlide(slideId, naLinha) {
      return st().dividirSlideDoPreview(slideId, naLinha);
    },

    abrirProjecao() {
      void window.lumenDesktop?.openProjector();
    },

    desfazer() {
      return useOpsStore.getState().undoCulto();
    },
  };
}
