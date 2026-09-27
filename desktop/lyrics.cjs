const cache = new Map();
/**
 * Cabeçalhos de um navegador comum. Sem eles o pedido sai como "node", e os
 * sites de letra passaram a recusar (403) quem não parece navegador — no
 * culto isso virava "Fonte indisponível" ao trazer a letra pelo celular.
 */
const NAVEGADOR = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
  accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
};
/** @param {string} url */
async function request(url) {
  const res = await fetch(url, { headers: NAVEGADOR, signal: AbortSignal.timeout(6000), redirect: 'error' });
  if (!res.ok) {
    const erro = /** @type {Error & { status?: number }} */ (new Error(`Fonte indisponível (${res.status})`));
    erro.status = res.status;
    throw erro;
  }
  return res.text();
}
/** Parse JSONP as data, never executable JavaScript. @param {string} text */
function parseJson(text) {
  return JSON.parse(text.replace(/^\s*[\w.]+\s*\(/, '').replace(/\);?\s*$/, ''));
}
/** @param {string} title @param {string} artist @param {string} sourceUrl @param {string} sourceName */
function hit(title, artist, sourceUrl, sourceName) {
  return { title, artist, sourceUrl, sourceName, lyrics: '', copyright: '', publicDomain: false };
}
/** @param {{query?: string, artist?: string}} input */
async function suggest(input = {}) {
  const query = String(input.query || '').trim().slice(0, 180);
  const artist = String(input.artist || '').trim().slice(0, 80);
  if (query.length < 2) return { ok: true, hits: [] };
  const q = [query, artist].filter(Boolean).join(' ');
  const cached = cache.get(q);
  if (cached && Date.now() - cached.at < 300000) return cached.result;
  const results = await Promise.allSettled([
    request(`https://solr.sscdn.co/letras/m1/?q=${encodeURIComponent(q)}&wt=json`).then(text => {
      const docs = parseJson(text)?.response?.docs || [];
      return docs.filter((/** @type {any} */ r) => String(r.t) === '2' && r.dns && r.url)
        .slice(0, 8).map((/** @type {any} */ r) => hit(r.txt, r.art, `https://www.letras.mus.br/${encodeURIComponent(r.dns)}/${encodeURIComponent(r.url)}/`, 'Letras'));
    }),
    request(`https://api.vagalume.com.br/search.excerpt?q=${encodeURIComponent(q)}&limit=8`).then(text => {
      const docs = parseJson(text)?.response?.docs || [];
      return docs.filter((/** @type {any} */ r) => r.title && r.url)
        .slice(0, 8).map((/** @type {any} */ r) => hit(r.title, r.band || '', new URL(r.url, 'https://www.vagalume.com.br').href, 'Vagalume'));
    }),
  ]);
  const hits = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const failed = results.flatMap((r, i) => r.status === 'rejected' ? [i === 0 ? 'Letras' : 'Vagalume'] : []);
  if (failed.length === 2) return { ok: false, error: 'Não foi possível consultar Letras e Vagalume. Verifique a conexão e tente novamente.' };
  const result = { ok: true, hits, warning: failed.length ? `${failed.join(' e ')} indisponível no momento. Exibindo a outra fonte.` : undefined };
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(q, { at: Date.now(), result });
  return result;
}
/** @param {string} text */
function decode(text) {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return code <= 0x10ffff ? String.fromCodePoint(code) : ''; })
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, name) => (/** @type {Record<string, string>} */ ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[name] || '')).trim();
}
const FONTES = { 'www.letras.mus.br': 'Letras', 'www.vagalume.com.br': 'Vagalume' };
/** @param {URL} url */
function fonteValida(url) {
  return url.protocol === 'https:' && !url.port && !url.username && !url.password && Object.hasOwn(FONTES, url.hostname);
}
/**
 * A letra dentro da página. O Vagalume passou a escrever o HTML sem aspas
 * (`id=lyrics`), e a procura por `id="lyrics"` não achava nada.
 * @param {URL} url @param {string} html
 */
function extrair(url, html) {
  return url.hostname === 'www.letras.mus.br'
    ? html.match(/<div\b[^>]*\bclass=["']?lyric-original\b[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    : html.match(/<div\b[^>]*\bid=["']?lyrics\b[^>]*>([\s\S]*?)<\/div>/i)?.[1];
}
/**
 * A mesma música na outra fonte. Letras e Vagalume usam o mesmo
 * "artista/musica" no endereço, então quando uma recusa ou não traz a letra,
 * vale tentar a outra antes de desistir.
 * @param {URL} url
 */
function naOutraFonte(url) {
  const [artista, musica] = url.pathname.split('/').filter(Boolean);
  if (!artista || !musica) return null;
  return url.hostname === 'www.letras.mus.br'
    ? `https://www.vagalume.com.br/${artista}/${musica}.html`
    : `https://www.letras.mus.br/${artista}/${musica.replace(/\.html$/i, '')}/`;
}
/**
 * Traz a letra de uma página do Letras ou do Vagalume.
 *
 * Nunca estoura: site fora do ar, recusa (403), tempo esgotado ou página sem
 * letra voltam como `{ ok: false, error }`. Antes, o erro subia até o
 * processo principal, que abria uma janela de "Lúmen — atenção" no meio do
 * culto por uma falha de um site de terceiros — e o celular ficava parado
 * em "Trazendo a letra…".
 * @param {string} sourceUrl
 */
async function load(sourceUrl) {
  /** @type {URL} */
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return { ok: false, error: 'Fonte inválida.' };
  }
  if (!fonteValida(url)) return { ok: false, error: 'Fonte inválida.' };
  const outra = naOutraFonte(url);
  const tentativas = [url.href, ...(outra ? [outra] : [])];
  let motivo = '';
  for (const alvo of tentativas) {
    const onde = new URL(alvo);
    const nome = FONTES[/** @type {keyof typeof FONTES} */ (onde.hostname)];
    try {
      const block = extrair(onde, await request(alvo));
      if (block) return { ok: true, lyrics: decode(block) };
      motivo ||= `O ${nome} não trouxe a letra dessa música.`;
    } catch (error) {
      const status = /** @type {{ status?: number }} */ (error).status;
      motivo ||= status === 403
        ? `O ${nome} recusou o pedido agora (403).`
        : status
          ? `O ${nome} está indisponível (${status}).`
          : `Sem resposta do ${nome}. Verifique a internet do computador.`;
    }
  }
  return { ok: false, error: `${motivo} Tente outra opção da lista ou cole a letra.` };
}
module.exports = { suggest, load, parseJson, decode };
