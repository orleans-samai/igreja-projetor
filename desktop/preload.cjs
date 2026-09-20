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
  remoteControlDisconnectAll: () => ipcRenderer.invoke("lumen:remote-control-disconnect-all"),
  remoteControlPushState: (payload) => ipcRenderer.send("lumen:remote-control-state", payload),
  onRemoteCommand: (cb) => {
    const listener = (_event, acao) => cb(acao);
    ipcRenderer.on("lumen:remote-command", listener);
    return () => ipcRenderer.removeListener("lumen:remote-command", listener);
  },
  remoteControlPushRepertoire: (lista) => ipcRenderer.send("lumen:remote-control-repertoire", lista),
  remoteControlPushMedia: (lista) => ipcRenderer.send("lumen:remote-control-media", lista),
  remoteControlPushChurch: (dados) => ipcRenderer.send("lumen:remote-control-church", dados),
  remoteControlPushThemes: (lista) => ipcRenderer.send("lumen:remote-control-themes", lista),
  remoteControlSetDirigentePassword: (senha) =>
    ipcRenderer.invoke("lumen:remote-control-dirigente-password", senha),
  remoteControlAnswer: (pedido, resposta) =>
    ipcRenderer.send("lumen:remote-control-answer", pedido, resposta),
  iaEstado: () => ipcRenderer.invoke("lumen:ia-estado"),
  iaConfigurar: (patch) => ipcRenderer.invoke("lumen:ia-configurar", patch),
  iaModelos: () => ipcRenderer.invoke("lumen:ia-modelos"),
  iaEscolherModelo: (caminho) => ipcRenderer.invoke("lumen:ia-escolher-modelo", caminho),
  iaLigar: () => ipcRenderer.invoke("lumen:ia-ligar"),
  iaDesligar: () => ipcRenderer.invoke("lumen:ia-desligar"),
  iaPerguntar: (mensagens) => ipcRenderer.invoke("lumen:ia-perguntar", mensagens),
  iaCancelar: () => ipcRenderer.invoke("lumen:ia-cancelar"),
  iaImportarModelo: () => ipcRenderer.invoke("lumen:ia-importar-modelo"),
  iaAbrirPasta: () => ipcRenderer.invoke("lumen:ia-abrir-pasta"),
  remoteControlDevices: () => ipcRenderer.invoke("lumen:remote-control-devices"),
  remoteControlSetPermission: (id, permissao) =>
    ipcRenderer.invoke("lumen:remote-control-permission", id, permissao),
  remoteControlSetDefaultPermission: (permissao) =>
    ipcRenderer.invoke("lumen:remote-control-default-permission", permissao),
  remoteControlDisconnect: (id) => ipcRenderer.invoke("lumen:remote-control-disconnect", id),
  remoteControlChat: (texto, autor) => ipcRenderer.invoke("lumen:remote-control-chat", texto, autor),
  onRemoteEvent: (cb) => {
    const listener = (_event, evento) => cb(evento);
    ipcRenderer.on("lumen:remote-event", listener);
    return () => ipcRenderer.removeListener("lumen:remote-event", listener);
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
  mediaSave: (nome, dados) => ipcRenderer.invoke("lumen:media-save", nome, dados),
  mediaRename: (kind, nome, novo) => ipcRenderer.invoke("lumen:media-rename", kind, nome, novo),
  mediaDuplicate: (kind, nome) => ipcRenderer.invoke("lumen:media-duplicate", kind, nome),
  mediaDelete: (kind, nome) => ipcRenderer.invoke("lumen:media-delete", kind, nome),
  storageGet: (key) => ipcRenderer.invoke("lumen:storage-get", key),
  storageSet: (key, value) => ipcRenderer.invoke("lumen:storage-set", key, value),
  openProjector: () => ipcRenderer.invoke("lumen:open-projector"),
  openStage: () => ipcRenderer.invoke("lumen:open-stage"),
  openPedido: () => ipcRenderer.invoke("lumen:open-pedido"),
  displays: () => ipcRenderer.invoke("lumen:displays"),
});
