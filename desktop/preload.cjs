const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumenDesktop", {
  isDesktop: true,
  youtubeHost: () => ipcRenderer.invoke("lumen:youtube-host"),
  updateCheck: () => ipcRenderer.invoke("lumen:update-check"),
  updateDownload: () => ipcRenderer.invoke("lumen:update-download"),
  updateInstall: () => ipcRenderer.invoke("lumen:update-install"),
  updateStatus: () => ipcRenderer.invoke("lumen:update-status"),
  onUpdateStatus: (cb) => {
    const listener = (_event, estado) => cb(estado);
    ipcRenderer.on("lumen:update-status", listener);
    return () => ipcRenderer.removeListener("lumen:update-status", listener);
  },
  remoteControlStart: () => ipcRenderer.invoke("lumen:remote-control-start"),
  remoteControlStop: () => ipcRenderer.invoke("lumen:remote-control-stop"),
  remoteControlStatus: () => ipcRenderer.invoke("lumen:remote-control-status"),
  remoteControlRegeneratePin: () => ipcRenderer.invoke("lumen:remote-control-regenerate-pin"),
  remoteControlPushState: (payload) => ipcRenderer.send("lumen:remote-control-state", payload),
  onRemoteCommand: (cb) => {
    const listener = (_event, acao) => cb(acao);
    ipcRenderer.on("lumen:remote-command", listener);
    return () => ipcRenderer.removeListener("lumen:remote-command", listener);
  },
  autoSlideStatus: () => ipcRenderer.invoke("lumen:auto-slide-status"),
  autoSlideInstall: () => ipcRenderer.invoke("lumen:auto-slide-install"),
  autoSlideTranscrever: (wav) => ipcRenderer.invoke("lumen:auto-slide-transcribe", wav),
  autoSlideCancel: () => ipcRenderer.invoke("lumen:auto-slide-cancel"),
  preflight: (urls) => ipcRenderer.invoke("lumen:preflight", urls),
  selectDisplay: (id) => ipcRenderer.invoke("lumen:select-display", id),
  testDisplay: (on) => ipcRenderer.invoke("lumen:test-display", on),
  exportService: (data) => ipcRenderer.invoke("lumen:export-service", data),
  importService: () => ipcRenderer.invoke("lumen:import-service"),
  suggestLyrics: (input) => ipcRenderer.invoke("lumen:lyrics-suggest", input),
  loadLyrics: (url) => ipcRenderer.invoke("lumen:lyrics-load", url),
  mediaList: (kind) => ipcRenderer.invoke("lumen:media-list", kind),
  mediaFolders: () => ipcRenderer.invoke("lumen:media-folders"),
  mediaOpenFolder: (kind) => ipcRenderer.invoke("lumen:media-open", kind),
  mediaChooseFolder: (kind) => ipcRenderer.invoke("lumen:media-choose", kind),
  mediaApplyFolder: (kind, dir, mover) => ipcRenderer.invoke("lumen:media-apply", kind, dir, mover),
  mediaResetFolder: (kind) => ipcRenderer.invoke("lumen:media-reset", kind),
  storageGet: (key) => ipcRenderer.invoke("lumen:storage-get", key),
  storageSet: (key, value) => ipcRenderer.invoke("lumen:storage-set", key, value),
  openProjector: () => ipcRenderer.invoke("lumen:open-projector"),
  openStage: () => ipcRenderer.invoke("lumen:open-stage"),
  openPedido: () => ipcRenderer.invoke("lumen:open-pedido"),
  displays: () => ipcRenderer.invoke("lumen:displays"),
});
