import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import providers from '../desktop/lyrics.cjs';
const root = path.resolve('desktop/www');
const server = createServer(async (req, res) => {
 try {
  const name = req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name);
  const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json' };
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(await readFile(file));
 } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
 const page = await browser.newPage();
 await page.exposeFunction('suggestLyricsTest', providers.suggest);
 await page.exposeFunction('loadLyricsTest', providers.load);
 await page.addInitScript(() => { window.lumenDesktop = { isDesktop: true, storageGet: async k => localStorage.getItem(k), storageSet: async (k,v) => localStorage.setItem(k,v), suggestLyrics: window.suggestLyricsTest, loadLyrics: window.loadLyricsTest }; });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(() => document.querySelectorAll('button').length > 10);
 await page.keyboard.press('Control+Shift+f');
 await page.locator('#lyrics-a').fill('fernandinho');
 await page.locator('#lyrics-q').fill('castelo forte');
 const option = page.getByRole('option').filter({ hasText: 'Castelo Forte' }).filter({ hasText: 'Fernandinho' }).first();
 await option.waitFor({ timeout: 20000 });
 await option.click();
 await page.waitForFunction(() => !document.querySelector('[name="import-lyrics"]')?.disabled);
 await page.screenshot({ path: 'artifacts/lyrics-suggestions.png' });
 await page.locator('#lyrics-q').fill('c');
 await page.waitForTimeout(400);
 assert.equal(await page.getByRole('option').count(), 0);
 console.log('PASS: automatic suggestions, real Letras result, lyric loading, clearing short query.');
} finally { await browser.close(); server.close(); }

