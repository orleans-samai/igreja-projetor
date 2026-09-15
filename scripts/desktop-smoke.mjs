import { _electron as electron } from "playwright";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { exportPackage, importPackage } from "../desktop/service-package.cjs";
const root = path.resolve(import.meta.dirname, "..");
const profile = await mkdtemp(path.join(os.tmpdir(), "lumen-smoke-"));
const evidence = path.join(root, "artifacts", "desktop-smoke");
await mkdir(evidence, { recursive: true });
let app;
const errors = [];
try {
  const launch = async () => {
    const executablePath = process.env.LUMEN_SMOKE_EXE;
    app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [ ...(executablePath ? ["--smoke-test"] : [root]), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], env: { ...process.env, LUMEN_TEST_DATA: profile }, timeout: 60000 });
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
  // Exercise packaged media through the actual Electron protocol, including seeking.
  const bytes = Buffer.alloc(32044);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(32000, 40);
  const packageFile = path.join(profile, "smoke.lumen");
  await exportPackage(packageFile, { format: "lumen-service-v1", media: [{ type: "audio", path: "data:audio/wav;base64," + bytes.toString("base64") }] }, async () => null);
  const imported = await importPackage(packageFile, path.join(profile, "packages"));
  const mediaUrl = imported.media[0].path;
  const range = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=0-43" } });
    return { status: response.status, length: (await response.arrayBuffer()).byteLength };
  }, mediaUrl);
  assert.deepEqual(range, { status: 206, length: 44 });
  const preflight = await page.evaluate((url) => window.lumenDesktop.preflight([url, "/missing.mp4"]), mediaUrl);
  assert.deepEqual(preflight.missing, ["/missing.mp4"]);
  assert.equal((await page.evaluate(() => window.lumenDesktop.autoSlideStatus())).pronto, false);
  // Auto-Slide e YouTube não são mais botões soltos na barra — moraram para
  // dentro de "Mais", que só os revela com um clique.
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("menuitem", { name: "Auto-Slide", exact: true }).click();
  const autoDialog = page.getByRole("dialog", { name: "Reconhecimento de canto" });
  await autoDialog.waitFor();
  await autoDialog.getByRole("button", { name: "Instalar reconhecimento local", exact: true }).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "auto-slide.png") });
  await autoDialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await autoDialog.waitFor({ state: "hidden" });

  // Controle remoto: liga o servidor de verdade, pareia como um celular de
  // fora pareia (fetch deste processo Node, não de dentro da página — é o
  // único jeito de provar que a porta está realmente aberta na rede), manda
  // um comando e confirma que a cabine mudou pelo canal ao vivo, não só que
  // o comando foi aceito.
  const remoteStatus = await page.evaluate(() => window.lumenDesktop.remoteControlStart());
  assert.equal(remoteStatus.ligado, true);
  assert.match(remoteStatus.pin, /^\d{6}$/);
  const remoteBase = `http://127.0.0.1:${remoteStatus.porta}`;
  const pinErrado = await fetch(`${remoteBase}/parear`, { method: "POST", body: JSON.stringify({ pin: "000001" }) });
  assert.equal(pinErrado.status, 401);
  const pareado = await fetch(`${remoteBase}/parear`, { method: "POST", body: JSON.stringify({ pin: remoteStatus.pin }) }).then((r) => r.json());
  assert.equal(pareado.ok, true);
  const statusAtual = () => page.evaluate(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status);
  assert.notEqual(await statusAtual(), "black");
  const comando = await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "preto" }) }).then((r) => r.json());
  assert.equal(comando.ok, true);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "black");
  // "preto" alterna, e alternar de novo pousaria em "presenting" — não em
  // "idle". Só "parar" devolve o estado exato que o resto do smoke espera,
  // e é o que evita a guarda de beforeunload (que trava em qualquer status
  // diferente de idle) atrapalhar o relançamento do Electron mais abaixo.
  await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "parar" }) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "idle");
  const semSessao = await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: "invalido", acao: "preto" }) });
  assert.equal(semSessao.status, 401);
  await page.evaluate(() => window.lumenDesktop.remoteControlStop());
  await assert.rejects(fetch(remoteBase + "/"));

  // Verificar atualizações sob pedido: não afirma um resultado — o repositório
  // pode ou não ter uma Release publicada no instante em que este teste roda
  // — só que pedir a verificação pelo menu não derruba a cabine. O status
  // final por IPC precisa ser um dos que o updater sabe relatar.
  const statusAtualizacao = await page.evaluate(async () => {
    await window.lumenDesktop.updateCheck();
    return window.lumenDesktop.updateStatus();
  });
  assert.ok(
    ["atualizado", "disponivel", "erro", "sem-verificacao"].includes(statusAtualizacao.fase),
    `fase inesperada: ${statusAtualizacao.fase}`,
  );

  await page.keyboard.press("Control+Shift+H");
  const checkup = page.getByRole("dialog", { name: "Check-up pré-culto" });
  await checkup.waitFor();
  await checkup.getByRole("button", { name: "Verificar reprodução", exact: true }).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "preflight.png") });
  await checkup.getByRole("button", { name: "Fechar", exact: true }).click();
  await checkup.waitFor({ state: "hidden" });
  // Review uses a fixture in this isolated profile, never the church library.
  const reviewText = "Deus é o nosso refúgio e fortaleza e está sempre presente para nos ajudar nas dificuldades. Cantamos juntos com alegria e gratidão por todo o seu amor e por sua presença em cada momento da nossa vida.";
  await page.evaluate(async (text) => {
    const api = window.lumenDesktop;
    const data = JSON.parse(await api.storageGet("lumen-v2"));
    const slides = [{ id: "review-slide", label: "Verso", text, sortOrder: 0 }];
    data.state.songs.push({ id: "review-song", title: "Teste de leitura", artist: "", groupId: data.state.groups[0]?.id ?? "", key: "", copyright: "", lyricsRaw: text, slides, createdAt: 0, updatedAt: 0 });
    data.state.preview = { kind: "song", refId: "review-song", title: "Teste de leitura", subtitle: "", slides };
    data.state.previewIndex = 0;
    data.state.status = "idle";
    await api.storageSet("lumen-v2", JSON.stringify(data));
  }, reviewText);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
  await page.keyboard.press("Control+Shift+O");
  const review = page.getByRole("dialog", { name: "Revisar leitura no telão" });
  await review.waitFor();
  await review.getByLabel("Resolução para revisar").selectOption("1024x768");
  await review.getByLabel("Enquadramento da sugestão").selectOption("cover");
  await review.getByText(/O preenchimento corta/).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "readability-review.png") });
  assert.equal(await page.evaluate(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state.songs.find((s) => s.id === "review-song").lyricsRaw), reviewText);
  await review.getByLabel("Enquadramento da sugestão").selectOption("contain");
  await review.getByRole("button", { name: "Aplicar correções", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await page.waitForFunction(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state.songs.find((s) => s.id === "review-song").slides.length > 1);
  // Effective CSS viewport at 125%/150% matches Windows display scaling pressure.
  for (const [width, height, zoom] of [[1366, 768, 1], [1366, 768, 1.25], [1366, 768, 1.5], [800, 600, 1]]) {
    await app.evaluate(({ BrowserWindow }, args) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === "lumen://app/");
      win.setSize(args.width, args.height); win.webContents.setZoomFactor(args.zoom);
    }, { width, height, zoom });
    const assertWithin = async (locator) => {
      await locator.waitFor({ state: "visible" });
      assert.ok(await locator.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }), `Control outside viewport: ${width}x${height}@${zoom}`);
    };
    // Na cabine, o gatilho persistente agora é "Mais" — Auto-Slide só aparece
    // dentro do menu que ele abre. No Modo operador (F8) não existe "Mais",
    // então o botão Auto-Slide continua direto na barra.
    await assertWithin(page.getByRole("button", { name: "Mais", exact: true }));
    await page.screenshot({ animations: "disabled", path: path.join(evidence, `cabine-${width}-${zoom}.png`) });
    await page.keyboard.press("F8");
    await assertWithin(page.getByRole("button", { name: "Auto-Slide", exact: true }));
    await assertWithin(page.getByRole("button", { name: "Próximo", exact: true }));
    await assertWithin(page.getByRole("button", { name: "Preto", exact: true }));
    await page.screenshot({ animations: "disabled", path: path.join(evidence, `operador-${width}-${zoom}.png`) });
    await page.keyboard.press("F8");
  }
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
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator.png") });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === "lumen://app/")?.setSize(800, 600));
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator-800x600.png") });
  assert.deepEqual(errors, []);
  const disk = JSON.parse(await readFile(path.join(profile, "data", "library.json"), "utf8"));
  assert.ok(disk.values["lumen-v2"]);
  console.log(`PASS: offline, fonts, Bible, restart persistence, projector, media ranges, preflight, Auto-Slide, remote control (LAN + PIN), update check, review before apply, 1366×768 at 100/125/150% and 800×600. Evidence: ${evidence}`);
} finally {
  if (app) await app.close();
  console.log(`Isolated test profile: ${profile}`);
}
