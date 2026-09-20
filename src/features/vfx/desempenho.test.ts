import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FPS_BOM,
  FPS_RUIM,
  FPS_RUIM_AO_VIVO,
  MedidorDeFps,
  PACIENCIA_PARA_DESCER,
  PACIENCIA_PARA_SUBIR,
  estadoInicial,
  passoAutomatico,
  type EstadoAuto,
} from "./desempenho.ts";
import type { VfxQualidade } from "./tipos.ts";

/** Roda `n` medidas do mesmo FPS e devolve onde parou. */
function medindo(
  inicio: EstadoAuto,
  fps: number,
  n: number,
  aoVivo = false,
  teto: VfxQualidade = "alta",
): EstadoAuto {
  let e = inicio;
  for (let i = 0; i < n; i += 1) e = passoAutomatico(e, fps, aoVivo, teto);
  return e;
}

describe("passoAutomatico", () => {
  it("um segundo ruim não derruba nada — engasgo acontece", () => {
    const e = passoAutomatico(estadoInicial("alta"), 20, false);
    assert.equal(e.qualidade, "alta");
  });

  it("dois seguidos derrubam um degrau", () => {
    const e = medindo(estadoInicial("alta"), 20, PACIENCIA_PARA_DESCER);
    assert.equal(e.qualidade, "equilibrado");
  });

  it("continua descendo enquanto continuar ruim, e para no chão", () => {
    const e = medindo(estadoInicial("alta"), 10, 30);
    assert.equal(e.qualidade, "leve");
  });

  it("ao vivo desce antes: o limite é mais alto", () => {
    // Um FPS entre os dois limites: ruim ao vivo, aceitável fora dele.
    const meio = (FPS_RUIM + FPS_RUIM_AO_VIVO) / 2;
    assert.ok(meio > FPS_RUIM && meio < FPS_RUIM_AO_VIVO);
    const n = PACIENCIA_PARA_DESCER;
    assert.equal(medindo(estadoInicial("alta"), meio, n, false).qualidade, "alta");
    assert.equal(medindo(estadoInicial("alta"), meio, n, true).qualidade, "equilibrado");
    // E continuar ruim continua descendo: dois degraus em quatro medidas.
    assert.equal(medindo(estadoInicial("alta"), meio, n * 2, true).qualidade, "leve");
  });

  it("sobe só depois de muita paz, e nunca acima do teto do operador", () => {
    const quaseLa = medindo(estadoInicial("leve"), FPS_BOM, PACIENCIA_PARA_SUBIR - 1);
    assert.equal(quaseLa.qualidade, "leve");
    const subiu = medindo(estadoInicial("leve"), FPS_BOM, PACIENCIA_PARA_SUBIR);
    assert.equal(subiu.qualidade, "equilibrado");
    // Com teto "equilibrado", dez minutos de paz não passam dali.
    const preso = medindo(estadoInicial("leve"), FPS_BOM, 200, false, "equilibrado");
    assert.equal(preso.qualidade, "equilibrado");
  });

  it("um segundo bom no meio de uma sequência ruim zera a contagem", () => {
    let e = passoAutomatico(estadoInicial("alta"), 20, false);
    e = passoAutomatico(e, 50, false); // nem ruim nem bom: acalma
    e = passoAutomatico(e, 20, false); // volta a ser ruim, mas é o primeiro
    assert.equal(e.qualidade, "alta");
  });

  it("baixar o teto no meio do caminho vale na hora", () => {
    const alto = medindo(estadoInicial("alta"), 60, 3);
    assert.equal(alto.qualidade, "alta");
    const apertado = passoAutomatico(alto, 60, false, "leve");
    assert.equal(apertado.qualidade, "leve");
  });

  it("não oscila entre dois degraus com o FPS parado no limite", () => {
    let e = estadoInicial("equilibrado");
    const visto = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      e = passoAutomatico(e, (FPS_RUIM + FPS_BOM) / 2, false);
      visto.add(e.qualidade);
    }
    assert.deepEqual([...visto], ["equilibrado"]);
  });
});

describe("MedidorDeFps", () => {
  it("só devolve número quando a janela fecha", () => {
    const m = new MedidorDeFps(1000);
    assert.equal(m.quadro(0), null);
    assert.equal(m.quadro(500), null);
    const fps = m.quadro(1000);
    assert.ok(fps !== null);
    assert.equal(Math.round(fps), 2);
  });

  it("conta quadros, não média de intervalos — um engasgo derruba o número", () => {
    const m = new MedidorDeFps(1000);
    m.quadro(0);
    // Cinquenta e nove quadros rápidos e um travado de 500ms.
    for (let i = 1; i <= 59; i += 1) m.quadro(i * 8.4);
    const fps = m.quadro(1000);
    assert.ok(fps !== null && fps < 61 && fps > 55);
  });

  it("reiniciar esquece a janela pela metade", () => {
    const m = new MedidorDeFps(1000);
    m.quadro(0);
    m.quadro(400);
    m.reiniciar();
    assert.equal(m.quadro(1000), null);
  });
});
