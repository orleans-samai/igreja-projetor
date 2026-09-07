const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumenDesktop", {
  isDesktop: true,
  suggestLyrics: (input) => ipcRenderer.invoke("lumen:lyrics-suggest", input),
  loadLyrics: (url) => ipcRenderer.invoke("lumen:lyrics-load", url),
  mediaList: (kind) => ipcRenderer.invoke("lumen:media-list", kind),
  mediaFolders: () => ipcRenderer.invoke("lumen:media-folders"),
  mediaOpenFolder: (kind) => ipcRenderer.invoke("lumen:media-open", kind),
  mediaChooseFolder: (kind) => ipcRenderer.invoke("lumen:media-choose", kind),
  mediaResetFolder: (kind) => ipcRenderer.invoke("lumen:media-reset", kind),
  storageGet: (key) => ipcRenderer.invoke("lumen:storage-get", key),
  storageSet: (key, value) => ipcRenderer.invoke("lumen:storage-set", key, value),
  openProjector: () => ipcRenderer.invoke("lumen:open-projector"),
  openStage: () => ipcRenderer.invoke("lumen:open-stage"),
  openPedido: () => ipcRenderer.invoke("lumen:open-pedido"),
  displays: () => ipcRenderer.invoke("lumen:displays"),
});
