const { autoUpdater } = require("electron-updater");

/**
 * Verifica, baixa e aplica atualizações publicadas no GitHub Releases.
 *
 * Cada push para o GitHub agora publica uma versão nova sozinho — veja
 * .github/workflows/release.yml. Este módulo fecha o ciclo do outro lado:
 * o app aberto na cabine descobre essa versão sozinho, sem ninguém precisar
 * compilar ou instalar nada na mão.
 *
 * Nunca baixa nem reinicia sem avisar: o app roda durante o culto, e um
 * reinício de surpresa no meio do serviço é pior do que só avisar e esperar.
 * Quem decide baixar e quando reiniciar é o operador, pela faixa de
 * atualização ou por Arquivo → Verificar atualizações.
 */

let estado = { fase: "sem-verificacao", versao: null, progresso: 0, erro: null };
const ouvintes = new Set();
let logRef = () => {};

function relatar(patch) {
  estado = { ...estado, ...patch };
  for (const fn of ouvintes) {
    try {
      fn(estado);
    } catch {
      /* um ouvinte quebrado não pode derrubar o updater */
    }
  }
}

/** Chamado uma vez, na abertura do app. */
function iniciar({ log, isPackaged }) {
  logRef = log;
  if (!isPackaged) {
    relatar({ fase: "sem-verificacao" });
    return; // build de desenvolvimento: nada publicado para verificar.
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => relatar({ fase: "verificando", erro: null }));
  autoUpdater.on("update-not-available", () => relatar({ fase: "atualizado", versao: null, progresso: 0 }));
  autoUpdater.on("update-available", (info) => {
    log("Atualização disponível: " + info.version);
    relatar({ fase: "disponivel", versao: info.version, progresso: 0 });
  });
  autoUpdater.on("download-progress", (p) => {
    relatar({ fase: "baixando", progresso: Math.round(p.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    log("Atualização baixada: " + info.version);
    relatar({ fase: "pronto", versao: info.version, progresso: 100 });
  });
  autoUpdater.on("error", (err) => {
    const msg = String(err?.message || err);
    log("Atualização: " + msg);
    relatar({ fase: "erro", erro: msg });
  });

  void verificar();
}

/** Verifica agora — na abertura, e sob pedido (menu, ou a faixa). */
async function verificar() {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    const msg = String(err?.message || err);
    logRef("Atualização: falha ao verificar — " + msg);
    relatar({ fase: "erro", erro: msg });
    return { ok: false, erro: msg };
  }
}

function baixar() {
  if (estado.fase !== "disponivel") return;
  autoUpdater.downloadUpdate().catch((err) => {
    const msg = String(err?.message || err);
    logRef("Atualização: falha ao baixar — " + msg);
    relatar({ fase: "erro", erro: msg });
  });
}

/** Fecha o app e instala — só depois de "pronto", nunca antes. */
function instalarAgora() {
  if (estado.fase !== "pronto") return;
  autoUpdater.quitAndInstall();
}

function status() {
  return estado;
}

/** A cabine assina para saber de cada mudança de fase, em tempo real. */
function assinar(fn) {
  ouvintes.add(fn);
  fn(estado);
  return () => ouvintes.delete(fn);
}

module.exports = { iniciar, verificar, baixar, instalarAgora, status, assinar };
