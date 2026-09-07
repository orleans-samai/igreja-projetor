const { app, BrowserWindow, Menu, screen, ipcMain, shell, powerSaveBlocker, protocol, dialog } = require("electron");
const { Storage } = require("./storage.cjs");
const { resolveAsset } = require("./assets.cjs");
const media = require("./media.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { mediaResponse } = require("./media-response.cjs");
const { Recognition } = require("./recognition.cjs");
const packages = require("./service-package.cjs");


const ORIGIN = "lumen://app";
protocol.registerSchemesAsPrivileged([{ scheme: "lumen", privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
// Keep the historical profile name so upgrades do not discard existing profiles.
if (process.env.LUMEN_TEST_DATA && !app.isPackaged) app.setPath("userData", process.env.LUMEN_TEST_DATA);
const dataDir = app.getPath("userData");
const recognition = new Recognition(dataDir);
const packageRoot = path.join(dataDir, "packages");
let testWindow = null;
async function localMedia(url) {
  const parsed = new URL(url, ORIGIN);
  if (parsed.protocol !== "lumen:" || parsed.hostname !== "app") return null;
  if (parsed.pathname.startsWith("/__pacotes/")) return packages.resolvePackage(url, packageRoot);
  if (parsed.pathname.startsWith("/__midia/")) return media.resolveMedia(decodeURIComponent(parsed.pathname));
  return resolveAsset(wwwRoot(), parsed.href);
}
const settingsFile = path.join(dataDir, "desktop-settings.json");
let desktopSettings = {};
try { desktopSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8")); } catch { /* first run */ }
if (desktopSettings.softwareGraphics || process.argv.includes("--compatibility")) app.disableHardwareAcceleration();
let cabine = null;
let projetor = null;
let palco = null;
let pedido = null;
let origin = ORIGIN;
let blockerId = null;
let quitting = false;
let storage;
let noticeShown = false;
function log(message) {
  try {
    fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
    const file = path.join(dataDir, "logs", "desktop.log");
    if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) fs.renameSync(file, file + ".old");
    fs.appendFileSync(file, new Date().toISOString() + " " + message + "\n");
  } catch { /* logging cannot block recovery */ }
}
function reportError(error) {
  log(error?.stack || String(error));
  if (!noticeShown) {
    noticeShown = true;
    dialog.showErrorBox("Lúmen — atenção", String(error?.message || error) + "\nConsulte Lúmen → Abrir pasta de dados e logs.");
  }
}
function wwwRoot() { return path.join(__dirname, "www"); }
async function startServer() {
  if (!fs.existsSync(path.join(wwwRoot(), "index.html"))) throw new Error("Interface ausente. Reinstale o Lúmen.");
  protocol.handle("lumen", async (request) => {
    // Mídia da igreja mora fora do www; resolveMedia prende o caminho dentro
    // da pasta configurada para o tipo e recusa qualquer outra coisa.
    let file = null;
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      if (pathname.startsWith("/__midia/")) file = await media.resolveMedia(pathname);
      if (pathname.startsWith("/__pacotes/")) file = await packages.resolvePackage(request.url, packageRoot);
    } catch { /* url malformada cai no 404 */ }
    if (!file) file = await resolveAsset(wwwRoot(), request.url);
    if (!file) return new Response("Arquivo não encontrado", { status: 404 });
    // Stream media without buffering whole videos in the main process.
    if (/\.(mp4|webm|m4v|ogv|mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(file)) {
      const types = { ".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4", ".ogv": "video/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac" };
      return mediaResponse(file, request, types[path.extname(file).toLowerCase()]);
    }
    const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4", ".ogv": "video/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac", ".gif": "image/gif", ".avif": "image/avif", ".bmp": "image/bmp" };
    return new Response(await fs.promises.readFile(file), { headers: { "content-type": mime[path.extname(file)] || "application/octet-stream", "x-content-type-options": "nosniff" } });
  });
  return ORIGIN;
}
function authorized(event) {
  const url = event.senderFrame?.url || "";
  if (!url.startsWith(ORIGIN + "/") || event.senderFrame !== event.sender.mainFrame) throw new Error("Origem não autorizada.");
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    authorized(event);
    try { return await fn(...args); } catch (error) { reportError(error); throw error; }
  });
}
function fitCabine() {
  if (!cabine || cabine.isDestroyed()) return;
  const area = screen.getDisplayMatching(cabine.getBounds()).workArea;
  const bounds = cabine.getBounds();
  const width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height);
  cabine.setBounds({ width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) });
}
function displaysChanged() {
  if (testWindow && !testWindow.isDestroyed()) testWindow.close();
  if (projetor && !projetor.isDestroyed()) {
    if (externalDisplay()) { projetor.showInactive(); placeOnExternal(projetor); }
    else { projetor.hide(); openCabine(); }
  }
  fitCabine();
  buildMenu();
}

function externalDisplay() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().find((d) => d.id === desktopSettings.displayId && d.id !== primary.id) || screen.getAllDisplays().find((d) => d.id !== primary.id) || null;
}

function placeOnExternal(win) {
  const ext = externalDisplay();
  if (!ext) {
    win.setFullScreen(false);
    return;
  }
  const { x, y, width, height } = ext.bounds;
  win.setFullScreen(false);
  win.setBounds({ x, y, width, height });
  win.setFullScreen(true);
}

function createWindow(route, opts = {}) {
  const area = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    show: !(process.env.LUMEN_TEST_DATA && !app.isPackaged),
    width: Math.min(opts.width || 1280, area.width),
    height: Math.min(opts.height || 800, area.height),
    minWidth: Math.min(opts.kiosk ? 320 : 480, area.width),
    minHeight: Math.min(360, area.height),
    backgroundColor: "#0b0c10",
    autoHideMenuBar: !!opts.kiosk,
    frame: opts.frame !== false,
    fullscreen: !!opts.fullscreen,
    title: opts.title || "Lúmen",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !opts.kiosk,
      // Ninguém clica na janela do telão, e sem isto o Chromium recusa dar
      // play num vídeo com som.
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  win.loadURL(origin + route).catch(reportError);
  win.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) reportError(new Error("Não foi possível abrir a interface: " + description));
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    if (quitting || details.reason === "clean-exit") return;
    log("render-process-gone: " + details.reason);
    dialog.showMessageBox({ type: "error", title: "Lúmen", message: "Uma janela parou de responder.", detail: "Reabra a janela. Se o problema persistir, ative Compatibilidade gráfica no menu Lúmen.", buttons: ["Reabrir janela", "Fechar"] }).then(({ response }) => {
      if (!win.isDestroyed()) { if (response === 0) win.reload(); else win.close(); }
    }).catch(reportError);
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGIN + "/")) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol !== "lumen:" || u.hostname !== "app") {
        if (["https:", "http:"].includes(u.protocol)) void shell.openExternal(url);
        return { action: "deny" };
      }
      if (u.pathname.startsWith("/projetor")) {
        openProjector();
        return { action: "deny" };
      }
      if (u.pathname.startsWith("/palco")) {
        openStage();
        return { action: "deny" };
      }
      if (u.pathname.startsWith("/pedido")) {
        openPedido();
        return { action: "deny" };
      }
      if (u.origin !== new URL(origin).origin) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch {
      /* ignore */
    }
    return { action: "deny" };
  });
  return win;
}

function openCabine() {
  if (cabine && !cabine.isDestroyed()) {
    cabine.focus();
    return cabine;
  }
  cabine = createWindow("/", { title: "Lúmen — cabine" });
  cabine.on("closed", () => {
    cabine = null;
  });
  return cabine;
}

function openProjector() {
  if (projetor && !projetor.isDestroyed()) {
    placeOnExternal(projetor);
    projetor.focus();
    return projetor;
  }
  projetor = createWindow("/projetor?tela=1", {
    title: "Lúmen — telão",
    kiosk: true,
    frame: false,
    width: 1920,
    height: 1080,
  });
  placeOnExternal(projetor);
  projetor.on("closed", () => {
    projetor = null;
  });
  return projetor;
}

function openStage() {
  if (palco && !palco.isDestroyed()) {
    palco.focus();
    return palco;
  }
  palco = createWindow("/palco", { title: "Lúmen — palco", width: 1280, height: 720 });
  palco.on("closed", () => {
    palco = null;
  });
  return palco;
}

function openPedido() {
  if (pedido && !pedido.isDestroyed()) {
    pedido.focus();
    return pedido;
  }
  pedido = createWindow("/pedido", { title: "Lúmen — pedido do pastor", width: 480, height: 720 });
  pedido.on("closed", () => {
    pedido = null;
  });
  return pedido;
}

function buildMenu() {
  const template = [
    {
      label: "Lúmen",
      submenu: [
        { label: "Cabine", click: () => openCabine() },
        { label: "Abrir projetor (2º monitor)", click: () => openProjector() },
        { label: "Abrir palco", click: () => openStage() },
        { label: "Pedido do pastor", click: () => openPedido() },
        { type: "separator" },
        { label: "Monitor do projetor", submenu: screen.getAllDisplays().filter((d) => d.id !== screen.getPrimaryDisplay().id).map((d, index) => ({ label: (d.label || "Monitor " + (index + 1)) + " · " + d.size.width + "×" + d.size.height, type: "radio", checked: externalDisplay()?.id === d.id, click: () => { desktopSettings.displayId = d.id; saveDesktopSettings(); displaysChanged(); } })) },
        { label: "Compatibilidade gráfica (reiniciar)", type: "checkbox", checked: !!desktopSettings.softwareGraphics, click: (item) => { desktopSettings.softwareGraphics = item.checked; saveDesktopSettings(); dialog.showMessageBox({ message: "A configuração gráfica será aplicada na próxima abertura do Lúmen." }); } },
        { label: "Exportar backup completo…", click: () => exportBackup().catch(reportError) },
        { label: "Restaurar backup completo…", click: () => restoreBackup().catch(reportError) },
        { label: "Abrir pasta de dados e logs", click: () => shell.openPath(dataDir) },
        { type: "separator" },
        { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
      ],
    },
    {
      label: "Exibir",
      submenu: [
        { role: "togglefullscreen", label: "Tela cheia" },
        { role: "zoomIn", label: "Aumentar" },
        { role: "zoomOut", label: "Diminuir" },
        { role: "resetZoom", label: "Zoom padrão" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName("Lúmen");
app.setAppUserModelId("br.igreja.lumen");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (app.isReady() && storage) openCabine();
  });

  app.whenReady().then(async () => {
    // HTTP header values must be ASCII: the accented app name otherwise breaks
    // Electron protocol.handle when Chromium sends its User-Agent.
    app.userAgentFallback = app.userAgentFallback.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
    storage = new Storage(path.join(dataDir, "data"), (message) => dialog.showMessageBox({ message }));
    await storage.init();
    media.init(dataDir);
    await media.ensure();
    origin = await startServer();
    screen.on("display-added", displaysChanged);
    screen.on("display-removed", displaysChanged);
    screen.on("display-metrics-changed", displaysChanged);
    blockerId = powerSaveBlocker.start("prevent-display-sleep");
    buildMenu();
    openCabine();
    const ext = externalDisplay();
    if (ext && !process.env.LUMEN_TEST_DATA) openProjector();
    log("Started " + app.getVersion() + " Electron " + process.versions.electron + " " + process.arch);
  }).catch((error) => { reportError(error); app.quit(); });
}

handle("lumen:open-projector", () => {
  openProjector();
  return true;
});
handle("lumen:open-stage", () => {
  openStage();
  return true;
});
handle("lumen:open-pedido", () => {
  openPedido();
  return true;
});
handle("lumen:displays", () =>
  screen.getAllDisplays().map((d) => ({
    id: d.id,
    bounds: d.bounds,
    primary: d.id === screen.getPrimaryDisplay().id,
    label: d.label || `Monitor ${d.id}`,
  })),
);

app.on("window-all-closed", () => {
  if (blockerId != null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
  app.quit();
});

function saveDesktopSettings() {
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(desktopSettings)); } catch (error) { reportError(error); }
}
handle("lumen:storage-get", (key) => storage.get(key));
handle("lumen:storage-set", (key, value) => storage.set(key, value));
async function exportBackup() {
  const { filePath } = await dialog.showSaveDialog({ title: "Exportar backup completo", defaultPath: "Lumen-backup.json", filters: [{ name: "Backup Lúmen", extensions: ["json"] }] });
  if (filePath) await fs.promises.writeFile(filePath, await storage.export());
}
async function restoreBackup() {
  const { canceled, filePaths } = await dialog.showOpenDialog({ title: "Restaurar backup completo", filters: [{ name: "Backup Lúmen", extensions: ["json"] }], properties: ["openFile"] });
  if (canceled) return;
  const { response } = await dialog.showMessageBox({ type: "warning", message: "Substituir o repertório, configurações e Bíblias pelo backup?", detail: "O estado atual será arquivado antes da restauração. As janelas serão reabertas.", buttons: ["Cancelar", "Restaurar"], defaultId: 0, cancelId: 0 });
  if (response !== 1) return;
  if ((await fs.promises.stat(filePaths[0])).size > 100 * 1024 * 1024) throw new Error("Backup acima de 100 MB.");
  const raw = await fs.promises.readFile(filePaths[0], "utf8");
  // Freeze renderers before replacing state, preventing stale writes during reload.
  for (const win of BrowserWindow.getAllWindows()) win.webContents.setIgnoreMenuShortcuts(true);
  for (const win of BrowserWindow.getAllWindows()) await win.loadURL("about:blank");
  try { await storage.restore(raw); }
  finally {
    if (cabine && !cabine.isDestroyed()) await cabine.loadURL(ORIGIN + "/");
    if (projetor && !projetor.isDestroyed()) await projetor.loadURL(ORIGIN + "/projetor?tela=1");
    if (palco && !palco.isDestroyed()) await palco.loadURL(ORIGIN + "/palco");
    if (pedido && !pedido.isDestroyed()) await pedido.loadURL(ORIGIN + "/pedido");
    for (const win of BrowserWindow.getAllWindows()) win.webContents.setIgnoreMenuShortcuts(false);
  }
}
app.on("before-quit", (event) => {
  recognition.cancel();
  if (quitting || !storage) return;
  event.preventDefault();
  quitting = true;
  storage.queue.finally(() => app.quit());
});
process.on("uncaughtException", reportError);
process.on("unhandledRejection", reportError);

handle("lumen:media-list", (kind) => media.list(kind));
handle("lumen:media-folders", () => media.folders());
handle("lumen:media-open", (kind) => media.open(kind));
handle("lumen:media-choose", (kind) => media.choose(kind));
handle("lumen:media-reset", (kind) => media.reset(kind));
handle("lumen:lyrics-suggest", (input) => require("./lyrics.cjs").suggest(input));
handle("lumen:lyrics-load", (url) => require("./lyrics.cjs").load(url));
handle("lumen:auto-slide-status", () => recognition.status());
handle("lumen:auto-slide-install", () => recognition.install());
handle("lumen:auto-slide-transcribe", (wav) => recognition.transcribe(wav));
handle("lumen:auto-slide-cancel", () => recognition.cancel());
handle("lumen:preflight", async (urls = []) => {
  if (!Array.isArray(urls) || urls.length > 2048 || urls.some((u) => typeof u !== "string" || u.length > 4096)) throw new Error("Lista de mídias inválida.");
  const displays = screen.getAllDisplays();
  const selected = externalDisplay();
  const projector = projetor && !projetor.isDestroyed() ? screen.getDisplayMatching(projetor.getBounds()) : null;
  const missing = [];
  for (const url of urls) if ((url.startsWith("lumen:") || url.startsWith("/")) && !await localMedia(url)) missing.push(url);
  return {
    displays: displays.map((d) => ({ id: d.id, label: d.label || `Monitor ${d.id}`, width: d.bounds.width, height: d.bounds.height, scaleFactor: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id })),
    selectedId: selected?.id ?? null,
    projectorReady: !!selected && projector?.id === selected.id && projetor.isVisible(),
    missing,
    external: urls.filter((u) => /^https?:|^blob:/.test(u)),
  };
});
handle("lumen:select-display", (id) => {
  if (!screen.getAllDisplays().some((d) => d.id === id && d.id !== screen.getPrimaryDisplay().id)) throw new Error("Escolha um monitor externo conectado.");
  desktopSettings.displayId = id; saveDesktopSettings(); displaysChanged();
});
handle("lumen:test-display", (on) => {
  if (testWindow && !testWindow.isDestroyed()) testWindow.close();
  if (!on) return;
  if (!externalDisplay()) throw new Error("Conecte um segundo monitor e escolha Estender no Windows.");
  testWindow = createWindow("/projector-test.html", { title: "Lúmen — teste do telão", kiosk: true, frame: false });
  placeOnExternal(testWindow);
  const current = testWindow;
  setTimeout(() => { if (!current.isDestroyed()) current.close(); }, 15000);
});
handle("lumen:export-service", async (data) => {
  const { filePath } = await dialog.showSaveDialog({ title: "Exportar culto com mídias", defaultPath: "Culto.lumen", filters: [{ name: "Culto Lúmen", extensions: ["lumen"] }] });
  if (!filePath) return { canceled: true };
  return { ...await packages.exportPackage(filePath, data, localMedia), path: filePath };
});
handle("lumen:import-service", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ title: "Importar culto com mídias", filters: [{ name: "Culto Lúmen", extensions: ["lumen"] }], properties: ["openFile"] });
  if (canceled) return null;
  return packages.importPackage(filePaths[0], packageRoot);
});
