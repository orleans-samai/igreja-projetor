import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const profile = await mkdtemp(path.join(os.tmpdir(), 'lumen-lyrics-electron-'));
const app = await electron.launch({ args: [root], env: { ...process.env, LUMEN_TEST_DATA: profile } });
try {
 const page = await app.firstWindow();
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 await page.waitForFunction(() => document.querySelectorAll('button').length > 10);
 assert.match(await page.evaluate(() => navigator.userAgent), /^[\x20-\x7e]+$/);
 await page.keyboard.press('Control+Shift+f');
 await page.locator('#lyrics-a').fill('fernandinho');
 await page.locator('#lyrics-q').fill('castelo forte');
 const option = page.getByRole('option').filter({ hasText: 'Castelo Forte' }).filter({ hasText: 'Fernandinho' }).first();
 await option.waitFor({ timeout: 20000 });
 await option.click();
 await page.waitForFunction(() => !document.querySelector('[name="import-lyrics"]')?.disabled);
 await page.screenshot({ path: path.join(root, 'artifacts/lyrics-electron.png') });
 await page.locator('#lyrics-q').fill('c');
 await page.waitForTimeout(400);
 assert.equal(await page.getByRole('option').count(), 0);
 assert.deepEqual(errors, []);
 console.log('PASS: Windows Electron UI, ASCII User-Agent, real IPC suggestions, lyric loading, stale result clearing.');
} finally { await app.close(); }
