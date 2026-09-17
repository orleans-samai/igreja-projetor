/**
 * O relato do vídeo dentro da própria janela da cabine.
 *
 * O telão conta o que está tocando pelo canal de operação, mas o
 * BroadcastChannel não entrega mensagem para quem a publicou: o preview da
 * cabine, que é outro `<video>` do mesmo arquivo na mesma janela, não
 * consegue se anunciar por lá.
 *
 * Isso importa porque a janela de projeção pode estar fechada — e aí não há
 * relato nenhum, a barra fica sem duração e o operador vê um controle morto.
 * Com este canal interno, a cabine sempre tem de onde tirar duração e
 * posição; quando o telão está aberto, o relato dele tem preferência, porque
 * é o que a igreja está de fato vendo.
 */

export interface RelatoLocal {
  estado: "tocando" | "pausado" | "fim";
  tempo: number;
  duracao: number;
  carregado: number;
}

const ouvintes = new Set<(r: RelatoLocal) => void>();

export function relatarLocal(r: RelatoLocal): void {
  for (const ouvinte of [...ouvintes]) {
    try {
      ouvinte(r);
    } catch {
      /* um ouvinte quebrado não cala os outros */
    }
  }
}

export function assinarLocal(cb: (r: RelatoLocal) => void): () => void {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}
