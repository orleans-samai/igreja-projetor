import { searchSongs, useLumenStore } from "@/store/lumen-store";
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
  };
}
