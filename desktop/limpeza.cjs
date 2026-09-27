const fsp = require("node:fs/promises");
const path = require("node:path");

/**
 * O que recursos que saíram do app deixaram no disco.
 *
 * O Auto-Slide baixava o motor do whisper.cpp e um modelo de voz (uns
 * 150 MB) para <dados>/recognition. O recurso saiu a pedido da igreja, e o
 * que ele baixou não serve a mais nada: sai na abertura do app. Só as
 * pastas desta lista, montadas aqui dentro da pasta de dados — nunca um
 * caminho que venha de fora.
 */
const PASTAS_APOSENTADAS = ["recognition"];

/** Apaga o que sobrou; devolve o nome do que saiu. Nunca derruba a abertura. */
async function apagarRestos(dataDir) {
  const apagadas = [];
  for (const nome of PASTAS_APOSENTADAS) {
    const alvo = path.join(dataDir, nome);
    try {
      await fsp.lstat(alvo);
    } catch {
      continue;
    }
    try {
      await fsp.rm(alvo, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      apagadas.push(nome);
    } catch {
      // Arquivo preso (o antivírus lendo, por exemplo): fica para a próxima
      // abertura, que tenta de novo.
    }
  }
  return apagadas;
}

module.exports = { apagarRestos, PASTAS_APOSENTADAS };
