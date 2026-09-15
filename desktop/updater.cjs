const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");

/**
 * Verifica se há uma versão nova no GitHub Releases quando o Lúmen abre.
 *
 * Nunca baixa nem reinicia sozinho: o app fica aberto durante o culto, e um
 * reinício sem aviso no meio do serviço é pior do que simplesmente não
 * avisar. Quem opera a cabine decide quando baixar e quando reiniciar —
 * as duas perguntas abaixo sempre têm "Depois" como resposta padrão.
 *
 * Se o PC da igreja estiver offline, `checkForUpdates` só falha em silêncio
 * (vai para o log, não interrompe o app).
 */
function checkForUpdates({ log, isPackaged }) {
  if (!isPackaged) return; // build de desenvolvimento: sem verificação.

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("error", (err) => {
    log("Atualização: " + (err?.message || err));
  });

  autoUpdater.on("update-available", (info) => {
    log("Atualização disponível: " + info.version);
    dialog
      .showMessageBox({
        type: "info",
        title: "Lúmen — atualização disponível",
        message: `Versão ${info.version} disponível (esta é a ${autoUpdater.currentVersion}).`,
        detail: "O Lúmen continua funcionando normalmente enquanto baixa em segundo plano.",
        buttons: ["Baixar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log("Atualização baixada: " + info.version);
    dialog
      .showMessageBox({
        type: "info",
        title: "Lúmen — pronto para atualizar",
        message: `Versão ${info.version} baixada.`,
        detail: "Reiniciar agora aplica a atualização. Se o culto está no ar, escolha Depois e reinicie quando puder — a atualização fica pronta esperando.",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 1,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater
    .checkForUpdates()
    .catch((err) => log("Atualização: falha ao verificar — " + (err?.message || err)));
}

module.exports = { checkForUpdates };
