const cache = new Map();
/** @param {string} url */
async function request(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
  if (!res.ok) throw new Error(`Fonte indisponível (${res.status})`);
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
/** @param {string} sourceUrl */
async function load(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !['www.letras.mus.br', 'www.vagalume.com.br'].includes(url.hostname)) throw new Error('Fonte inválida.');
  const html = await request(url.href);
  const block = url.hostname === 'www.letras.mus.br'
    ? html.match(/<div\b[^>]*class="lyric-original"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    : html.match(/<div\b[^>]*id="lyrics"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!block) return { ok: false, error: 'A fonte não disponibilizou a letra. Abra o link ou cole o texto abaixo.' };
  return { ok: true, lyrics: decode(block) };
}
module.exports = { suggest, load, parseJson, decode };
