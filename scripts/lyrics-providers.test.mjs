import { test } from 'node:test';
import assert from 'node:assert/strict';
import providers from '../desktop/lyrics.cjs';
test('rejects URLs outside the two lyric sources before fetching', async () => {
 await assert.rejects(() => providers.load('https://127.0.0.1/secret'), /Fonte inválida/);
 await assert.rejects(() => providers.load('http://www.letras.mus.br/artist/song/'), /Fonte inválida/);
 await assert.rejects(() => providers.load('https://www.letras.mus.br@evil.example/'), /Fonte inválida/);
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
