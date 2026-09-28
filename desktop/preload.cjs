const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("lumenDesktop", {
  isDesktop: true,
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
  /** Onde está o vídeo do telão, para a barra de tempo do celular. */
  remoteControlPushMediaTime: (payload) => ipcRenderer.send("lumen:remote-control-media-time", payload),
  onRemoteCommand: (cb) => {
    const listener = (_event, acao) => cb(acao);
    ipcRenderer.on("lumen:remote-command", listener);
    return () => ipcRenderer.removeListener("lumen:remote-command", listener);
  },
  remoteControlPushRepertoire: (lista) => ipcRenderer.send("lumen:remote-control-repertoire", lista),
  remoteControlPushMedia: (lista) => ipcRenderer.send("lumen:remote-control-media", lista),
  remoteControlPushCulto: (dados) => ipcRenderer.send("lumen:remote-control-culto", dados),
  remoteControlPushChurch: (dados) => ipcRenderer.send("lumen:remote-control-church", dados),
  remoteControlPushThemes: (lista) => ipcRenderer.send("lumen:remote-control-themes", lista),
  remoteControlSetDirigentePassword: (senha) =>
    ipcRenderer.invoke("lumen:remote-control-dirigente-password", senha),
  remoteControlAnswer: (pedido, resposta) =>
    ipcRenderer.send("lumen:remote-control-answer", pedido, resposta),
  remoteControlDevices: () => ipcRenderer.invoke("lumen:remote-control-devices"),
  remoteControlSetPermission: (id, permissao) =>
    ipcRenderer.invoke("lumen:remote-control-permission", id, permissao),
  remoteControlSetDefaultPermission: (permissao) =>
    ipcRenderer.invoke("lumen:remote-control-default-permission", permissao),
  remoteControlDisconnect: (id) => ipcRenderer.invoke("lumen:remote-control-disconnect", id),
  remoteControlSalvarConta: (dados) => ipcRenderer.invoke("lumen:remote-control-conta-salvar", dados),
  remoteControlApagarConta: (id) => ipcRenderer.invoke("lumen:remote-control-conta-apagar", id),
  remoteControlChat: (texto, autor, para) => ipcRenderer.invoke("lumen:remote-control-chat", texto, autor, para),
  remoteControlChatFoto: (dados, texto, autor, para) =>
    ipcRenderer.invoke("lumen:remote-control-chat-foto", dados, texto, autor, para),
  remoteControlChatApagar: (id) => ipcRenderer.invoke("lumen:remote-control-chat-apagar", id),
  remoteControlSilenciar: (id, minutos) => ipcRenderer.invoke("lumen:remote-control-silenciar", id, minutos),
  remoteControlPresenca: () => ipcRenderer.invoke("lumen:remote-control-presenca"),
  remoteControlDigitando: (para) => ipcRenderer.send("lumen:remote-control-digitando", para),
  onRemoteEvent: (cb) => {
    const listener = (_event, evento) => cb(evento);
    ipcRenderer.on("lumen:remote-event", listener);
    return () => ipcRenderer.removeListener("lumen:remote-event", listener);
  },
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
  /**
   * Copia para a pasta de mídia os arquivos soltos na janela ou escolhidos no
   * "Importar". O caminho sai do próprio File, aqui no preload: a página
   * entrega arquivos, nunca um caminho escrito por ela.
   */
  mediaImportFiles: (files) => {
    const caminhos = [];
    for (const file of Array.from(files || [])) {
      try {
        const caminho = webUtils.getPathForFile(file);
        if (caminho) caminhos.push(caminho);
      } catch {
        /* não é um arquivo do disco */
      }
    }
    return ipcRenderer.invoke("lumen:media-import-paths", caminhos);
  },
  /** Mídia › Arquivos: o que a igreja trouxe e o Lúmen não projeta. */
  arquivosListar: () => ipcRenderer.invoke("lumen:arquivos-listar"),
  arquivosMostrar: (nome) => ipcRenderer.invoke("lumen:arquivos-mostrar", nome),
  arquivosExcluir: (nome) => ipcRenderer.invoke("lumen:arquivos-excluir", nome),
  arquivosAbrirPasta: () => ipcRenderer.invoke("lumen:arquivos-pasta"),
  onMediaChanged: (cb) => {
    const listener = (_event, kinds) => cb(Array.isArray(kinds) ? kinds : []);
    ipcRenderer.on("lumen:media-changed", listener);
    return () => ipcRenderer.removeListener("lumen:media-changed", listener);
  },
  mediaRename: (kind, nome, novo) => ipcRenderer.invoke("lumen:media-rename", kind, nome, novo),
  mediaDuplicate: (kind, nome) => ipcRenderer.invoke("lumen:media-duplicate", kind, nome),
  mediaDelete: (kind, nome) => ipcRenderer.invoke("lumen:media-delete", kind, nome),
  apresentacaoPptx: (nome) => ipcRenderer.invoke("lumen:apresentacao-pptx", nome),
  apresentacaoConverter: (nome, primeiro) => ipcRenderer.invoke("lumen:apresentacao-converter", nome, primeiro),
  apresentacaoConversor: () => ipcRenderer.invoke("lumen:apresentacao-conversor"),
  apresentacaoProgramas: () => ipcRenderer.invoke("lumen:apresentacao-programas"),
  apresentacaoPdf: (nome) => ipcRenderer.invoke("lumen:apresentacao-pdf", nome),
  apresentacaoBruto: (nome) => ipcRenderer.invoke("lumen:apresentacao-bruto", nome),
  apresentacaoPaginas: (paginas) => ipcRenderer.invoke("lumen:apresentacao-paginas", paginas),
  artesImagemSalvar: (dados) => ipcRenderer.invoke("lumen:artes-imagem-salvar", dados),
  artesExportar: (nome, dados) => ipcRenderer.invoke("lumen:artes-exportar", nome, dados),
  artesMostrar: (caminho) => ipcRenderer.invoke("lumen:artes-mostrar", caminho),
  apresentacaoRemover: (id) => ipcRenderer.invoke("lumen:apresentacao-remover", id),
  apresentacaoEscolher: () => ipcRenderer.invoke("lumen:apresentacao-escolher"),
  storageGet: (key) => ipcRenderer.invoke("lumen:storage-get", key),
  storageSet: (key, value) => ipcRenderer.invoke("lumen:storage-set", key, value),
  openProjector: () => ipcRenderer.invoke("lumen:open-projector"),
  openStage: () => ipcRenderer.invoke("lumen:open-stage"),
  openPedido: () => ipcRenderer.invoke("lumen:open-pedido"),
  displays: () => ipcRenderer.invoke("lumen:displays"),
});
