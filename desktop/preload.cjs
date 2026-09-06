const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumenDesktop", {
  isDesktop: true,
  openProjector: () => ipcRenderer.invoke("lumen:open-projector"),
  openStage: () => ipcRenderer.invoke("lumen:open-stage"),
  openPedido: () => ipcRenderer.invoke("lumen:open-pedido"),
  displays: () => ipcRenderer.invoke("lumen:displays"),
});
