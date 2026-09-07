import { _electron as electron } from "playwright";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const profile = await mkdtemp(path.join(os.tmpdir(), "lumen-smoke-"));
const evidence = path.join(root, "artifacts", "desktop-smoke");
await mkdir(evidence, { recursive: true });
let app;
const errors = [];
try {
  const launch = async () => {
    app = await electron.launch({ args: [root], env: { ...process.env, LUMEN_TEST_DATA: profile }, timeout: 60000 });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
    await page.waitForFunction(async () => !!(await window.lumenDesktop.storageGet("lumen-v2")));
    return page;
  };
  let page = await launch();
  assert.equal(new URL(page.url()).protocol, "lumen:");
  // Block all network URLs, including cached Google Fonts, while checking assets.
  await app.context().route(/^https?:/, (route) => route.abort());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
  const bible = await page.evaluate(async () => (await fetch("/bible/almeida-1819.json")).json());
  assert.ok(bible.books.length >= 66);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('500 24px "Fraunces Variable"');
    return document.fonts.check('500 24px "Fraunces Variable"');
  });
  assert.ok(fonts);
  assert.equal(await page.evaluate(async () => (await fetch("/missing.js")).status), 404);
  const saved = await page.evaluate(async () => {
    const api = window.lumenDesktop;
    const data = JSON.parse(await api.storageGet("lumen-v2"));
    data.state.settings.churchName = "Persistência Windows";
    data.state.settings.lowPerformance = true;
    await api.storageSet("lumen-v2", JSON.stringify(data));
    return data.state.songs.length;
  });
  await app.close(); app = null;
  page = await launch();
  await page.waitForFunction(() => document.documentElement.dataset.lowPerformance === "true");
  const restored = await page.evaluate(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")));
  assert.equal(restored.state.settings.churchName, "Persistência Windows");
  assert.equal(restored.state.songs.length, saved);
  const windowEvent = app.waitForEvent("window");
  await page.evaluate(() => window.lumenDesktop.openProjector());
  const projector = await windowEvent;
  await projector.waitForLoadState("domcontentloaded");
  assert.ok(projector.url().includes("/projetor"));
  const received = projector.evaluate(() => new Promise((resolve) => {
    const ch = new BroadcastChannel("lumen-smoke");
    const timer = setTimeout(() => { ch.close(); resolve(false); }, 5000);
    ch.onmessage = (event) => { clearTimeout(timer); ch.close(); resolve(event.data === "ok"); };
    localStorage.setItem("lumen-smoke-ready", "yes");
  }));
  await page.waitForFunction(() => localStorage.getItem("lumen-smoke-ready") === "yes");
  await page.evaluate(() => { const channel = new BroadcastChannel("lumen-smoke"); channel.postMessage("ok"); channel.close(); });
  assert.equal(await received, true);
  await page.screenshot({ path: path.join(evidence, "operator.png") });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle().includes("cabine"))?.setSize(800, 600));
  await page.screenshot({ path: path.join(evidence, "operator-800x600.png") });
  assert.deepEqual(errors, []);
  const disk = JSON.parse(await readFile(path.join(profile, "data", "library.json"), "utf8"));
  assert.ok(disk.values["lumen-v2"]);
  console.log(`PASS: offline, fonts, Bible, restart persistence, projector, 800×600. Evidence: ${evidence}`);
} finally {
  if (app) await app.close();
  console.log(`Isolated test profile: ${profile}`);
}
