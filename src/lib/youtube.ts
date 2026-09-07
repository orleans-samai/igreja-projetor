/**
 * YouTube na projeção, pelo caminho oficial.
 *
 * Só incorporação: a IFrame Player API do próprio YouTube, dentro de um
 * iframe. Nada de baixar vídeo, extrair arquivo ou contornar restrição — além
 * de proibido pelos termos, quebraria no primeiro domingo em que o YouTube
 * mudasse alguma coisa.
 *
 * Este módulo é a parte que não depende de tela nem de rede para ser testada:
 * ler o endereço que o operador colou e traduzir os erros do player para uma
 * frase que a pessoa na cabine entenda.
 */

/** O id de vídeo do YouTube tem sempre 11 caracteres desta família. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/** Caminhos que carregam o id logo depois de um prefixo conhecido. */
const CAMINHOS = ["live", "embed", "shorts", "v", "e"];

/**
 * Extrai o id de vídeo de um endereço colado.
 *
 * Aceita o que as pessoas realmente colam: o link da barra de endereço, o do
 * botão compartilhar, o de transmissão ao vivo, com ou sem "https", com ou
 * sem "www", com marcação de tempo, dentro de playlist, e o id sozinho.
 * Devolve null quando não há id — nunca lança, porque um endereço torto não
 * pode derrubar a cabine.
 */
export function idDoVideo(entrada: string): string | null {
  const bruto = (entrada ?? "").trim();
  if (!bruto) return null;
  if (ID.test(bruto)) return bruto;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const partes = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = partes[0] ?? "";
    return ID.test(id) ? id : null;
  }

  if (!/(^|\.)youtube(-nocookie)?\.com$/i.test(host)) return null;

  const v = url.searchParams.get("v");
  if (v && ID.test(v)) return v;

  const [primeiro, segundo] = partes;
  if (primeiro && CAMINHOS.includes(primeiro.toLowerCase()) && segundo && ID.test(segundo)) {
    return segundo;
  }
  return null;
}

/** Capa do vídeo, servida pelo próprio YouTube. */
export function capaDoVideo(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/** Endereço para o operador conferir a fonte, quando quiser. */
export function enderecoDoVideo(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Erros do player, em português de cabine.
 *
 * Os códigos vêm da IFrame Player API. O operador não precisa saber que
 * "150" existe; precisa saber que este vídeo não vai passar e que outro
 * resolve.
 */
export function mensagemDeErro(codigo: number): string {
  if (codigo === 2) return "O endereço deste vídeo é inválido.";
  if (codigo === 5) return "Este vídeo não pode ser exibido neste player.";
  if (codigo === 100) return "Vídeo não encontrado — pode ter sido removido ou estar privado.";
  if (codigo === 101 || codigo === 150) {
    return "O dono deste vídeo não permite exibi-lo fora do YouTube. Escolha outro.";
  }
  return "Não foi possível reproduzir este vídeo.";
}

/** Tempo em mm:ss, ou h:mm:ss quando passa da hora. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(r)}` : `${m}:${dois(r)}`;
}

export interface DadosDoVideo {
  titulo: string;
  autor: string;
}

/**
 * Título e canal, pelo oEmbed público do YouTube.
 *
 * Não precisa de chave nem de conta, e é endereço oficial. Falhando — sem
 * internet, vídeo privado, incorporação bloqueada — devolve null e a cabine
 * segue mostrando a capa e o id: informação a menos não pode virar erro.
 */
export async function dadosDoVideo(id: string, sinal?: AbortSignal): Promise<DadosDoVideo | null> {
  try {
    const alvo = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      enderecoDoVideo(id),
    )}&format=json`;
    const r = await fetch(alvo, { signal: sinal });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; author_name?: string };
    if (!j.title) return null;
    return { titulo: j.title, autor: j.author_name ?? "" };
  } catch {
    return null;
  }
}
