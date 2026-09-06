const { app, BrowserWindow, Menu, screen, ipcMain, shell, powerSaveBlocker } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

let cabine = null;
let projetor = null;
let palco = null;
let pedido = null;
let origin = "";
let blockerId = null;

function wwwRoot() {
  const bundled = path.join(__dirname, "www");
  if (fs.existsSync(path.join(bundled, "index.html"))) return bundled;
  const extra = path.join(process.resourcesPath, "www");
  if (fs.existsSync(path.join(extra, "index.html"))) return extra;
  return bundled;
}

function startServer() {
  const root = wwwRoot();
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || "/").split("?")[0]);
    const safe = path.normalize(raw).replace(/^(\.\.[/\\])+/, "");
    let file = path.join(root, safe);
    const ext = path.extname(file);
    const isAsset =
      safe.startsWith("/assets") ||
      safe.startsWith("/bible") ||
      safe.startsWith("/themes") ||
      safe.startsWith("/__grok") ||
      ext === ".svg" ||
      ext === ".json" ||
      ext === ".png" ||
      ext === ".jpg" ||
      ext === ".ico";
    if (!isAsset || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (!isAsset) file = path.join(root, "index.html");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Não encontrado");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-cache",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

function externalDisplay() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().find((d) => d.id !== primary.id) || null;
}

function placeOnExternal(win) {
  const ext = externalDisplay();
  if (!ext) {
    win.setFullScreen(true);
    return;
  }
  const { x, y, width, height } = ext.bounds;
  win.setBounds({ x, y, width, height });
  win.setFullScreen(true);
}

function createWindow(route, opts = {}) {
  const win = new BrowserWindow({
    width: opts.width || 1280,
    height: opts.height || 800,
    minWidth: 900,
    minHeight: 600,
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
    },
  });
  win.loadURL(origin + route);
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
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
    return { action: "allow" };
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
    openCabine();
  });

  app.whenReady().then(async () => {
    origin = await startServer();
    blockerId = powerSaveBlocker.start("prevent-display-sleep");
    buildMenu();
    openCabine();
    const ext = externalDisplay();
    if (ext) openProjector();
  });
}

ipcMain.handle("lumen:open-projector", () => {
  openProjector();
  return true;
});
ipcMain.handle("lumen:open-stage", () => {
  openStage();
  return true;
});
ipcMain.handle("lumen:open-pedido", () => {
  openPedido();
  return true;
});
ipcMain.handle("lumen:displays", () =>
  screen.getAllDisplays().map((d) => ({
    id: d.id,
    bounds: d.bounds,
    primary: d.id === screen.getPrimaryDisplay().id,
  })),
);

app.on("window-all-closed", () => {
  if (blockerId != null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
  app.quit();
});

void pathToFileURL;
