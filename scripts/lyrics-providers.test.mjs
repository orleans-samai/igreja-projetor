import { test } from 'node:test';
import assert from 'node:assert/strict';
import providers from '../desktop/lyrics.cjs';
test('rejects URLs outside the two lyric sources before fetching', async () => {
 const original = global.fetch;
 let buscou = false;
 global.fetch = async () => { buscou = true; return new Response(''); };
 try {
  for (const url of ['https://127.0.0.1/secret', 'http://www.letras.mus.br/artist/song/', 'https://www.letras.mus.br@evil.example/', 'não é endereço']) {
   const r = await providers.load(url);
   assert.equal(r.ok, false, url);
   assert.match(r.error, /Fonte inválida/, url);
  }
  assert.equal(buscou, false, 'buscou fora das duas fontes');
 } finally { global.fetch = original; }
});
test('a refused source (403) falls back to the same song on the other one, as a browser', async () => {
 const original = global.fetch;
 const pedidos = [];
 global.fetch = async (url, init) => {
  pedidos.push({ url: String(url), ua: init?.headers?.['user-agent'] || '' });
  if (String(url).includes('letras.mus.br')) return new Response('Forbidden', { status: 403 });
  // O Vagalume escreve o HTML sem aspas.
  return new Response('<h2>Artista</h2><div id=lyrics data-plugin=googleTranslate>Linha um<br>Linha dois</div>');
 };
 try {
  const r = await providers.load('https://www.letras.mus.br/artista/musica/');
  assert.equal(r.ok, true);
  assert.equal(r.lyrics, 'Linha um' + String.fromCharCode(10) + 'Linha dois');
  assert.deepEqual(pedidos.map((p) => p.url), [
   'https://www.letras.mus.br/artista/musica/',
   'https://www.vagalume.com.br/artista/musica.html',
  ]);
  assert.ok(pedidos.every((p) => /Mozilla/.test(p.ua)), 'o pedido não se apresentou como navegador');
 } finally { global.fetch = original; }
});
test('when both sources fail, load answers with a message instead of throwing', async () => {
 const original = global.fetch;
 global.fetch = async () => new Response('Forbidden', { status: 403 });
 try {
  const r = await providers.load('https://www.vagalume.com.br/artista/musica.html');
  assert.equal(r.ok, false);
  assert.match(r.error, /recusou o pedido agora \(403\)/);
  assert.match(r.error, /cole a letra/);
 } finally { global.fetch = original; }
 global.fetch = async () => { throw new TypeError('fetch failed'); };
 try {
  const r = await providers.load('https://www.letras.mus.br/artista/musica/');
  assert.equal(r.ok, false);
  assert.match(r.error, /Sem resposta do Letras/);
 } finally { global.fetch = original; }
});
test('handles a failed source without discarding valid suggestions', async () => {
 const original = global.fetch;
 global.fetch = async url => {
  if (String(url).includes('vagalume')) return new Response('', { status: 503 });
  return new Response('LetrasSug({"response":{"docs":[{"t":"2","txt":"Song","art":"Artist","dns":"artist","url":"song"},{"t":"3","txt":"Album"}]}});');
 };
 try {
  const result = await providers.suggest({ query: 'fixture-partial' });
  assert.equal(result.ok, true);
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].sourceUrl, 'https://www.letras.mus.br/artist/song/');
  assert.match(result.warning, /Vagalume/);
 } finally { global.fetch = original; }
});
test('parses JSONP without evaluating source scripts', () => {
 assert.throws(() => providers.parseJson('LetrasSug({});process.exit()'));
});
test('the request goes through the network the app hands over (Chromium, inside Electron)', async () => {
 // Inside Electron, Node's fetch got 403 from Letras where the browser got the page.
 const pedidos = [];
 providers.usarRede(async (url) => { pedidos.push(String(url)); return new Response('<div class="lyric-original">Linha</div>'); });
 try {
  const r = await providers.load('https://www.letras.mus.br/artista/musica/');
  assert.equal(r.ok, true);
  assert.equal(r.lyrics, 'Linha');
  assert.deepEqual(pedidos, ['https://www.letras.mus.br/artista/musica/']);
 } finally { providers.usarRede(null); }
});
