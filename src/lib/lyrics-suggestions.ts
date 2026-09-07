import { createServerFn } from '@tanstack/react-start';
import type { LyricsSearchResult } from './lyrics-web';
interface LyricsProvider {
  suggest: (input: { query: string; artist?: string }) => Promise<LyricsSearchResult>;
  load: (url: string) => Promise<{ ok: boolean; lyrics?: string; error?: string }>;
}

/**
 * Carrega o provedor no servidor.
 *
 * O app Windows nem passa por aqui — lá o renderer fala com o processo
 * principal por IPC. Este caminho é o da versão web, e usa `require` em vez
 * de `import()` de propósito: `desktop/lyrics.cjs` é CommonJS e mora fora de
 * `src/`, então o SSR do Vite tentava transformá-lo e o handler estourava
 * antes de responder (a falha chegava ao navegador como "Seroval Error").
 * `createRequire` resolve em tempo de execução, sem passar pelo empacotador.
 */
async function provider(): Promise<LyricsProvider> {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const mod = require('../../desktop/lyrics.cjs') as LyricsProvider & { default?: LyricsProvider };
  return mod.default ?? mod;
}
const suggestServer = createServerFn({ method: 'POST' })
  .validator((input: { query: string; artist?: string }) => input)
  .handler(async ({ data }) => (await provider()).suggest(data));
const loadServer = createServerFn({ method: 'POST' })
  .validator((input: { sourceUrl: string }) => input)
  .handler(async ({ data }) => (await provider()).load(data.sourceUrl));
export async function suggestSongs(query: string, artist: string): Promise<LyricsSearchResult> {
  const desktop = typeof window !== 'undefined' ? window.lumenDesktop : undefined;
  return (desktop?.isDesktop ? desktop.suggestLyrics({ query, artist }) : suggestServer({ data: { query, artist } })) as Promise<LyricsSearchResult>;
}
export async function loadSong(sourceUrl: string): Promise<{ ok: boolean; lyrics?: string; error?: string }> {
  const desktop = typeof window !== 'undefined' ? window.lumenDesktop : undefined;
  return desktop?.isDesktop ? desktop.loadLyrics(sourceUrl) : loadServer({ data: { sourceUrl } });
}
