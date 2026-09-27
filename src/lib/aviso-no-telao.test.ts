import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TAMANHOS_DO_AVISO,
  TAMANHO_PADRAO_DO_AVISO,
  avisoPisca,
  corpoDoAviso,
  tamanhoDoAvisoValido,
} from "./aviso-no-telao.ts";

/** O corpo que o aviso tinha: `text-3xl`, 30 px num telão de 1920. */
const CORPO_ANTIGO = 30;

describe("o aviso no telão", () => {
  it("nasce grande: três vezes o de antes, que ninguém via do fundo da igreja", () => {
    assert.equal(TAMANHO_PADRAO_DO_AVISO, "grande");
    assert.ok(corpoDoAviso(undefined) >= CORPO_ANTIGO * 3, `${corpoDoAviso(undefined)} px`);
  });

  it("pisca por padrão, e só para quando alguém desliga", () => {
    assert.equal(avisoPisca(undefined), true);
    assert.equal(avisoPisca(true), true);
    assert.equal(avisoPisca(false), false);
  });

  it("até o menor tamanho é maior que o aviso antigo", () => {
    assert.ok(corpoDoAviso("pequeno") > CORPO_ANTIGO);
  });

  it("cresce na ordem que o nome promete, sem passar de um oitavo da altura do telão", () => {
    const corpos = TAMANHOS_DO_AVISO.map(corpoDoAviso);
    for (let i = 1; i < corpos.length; i += 1) assert.ok(corpos[i] > corpos[i - 1]);
    assert.ok(corpos[corpos.length - 1] <= 1080 / 7);
  });

  it("tamanho desconhecido vira o padrão, não some", () => {
    assert.equal(tamanhoDoAvisoValido("gigante"), "grande");
    assert.equal(tamanhoDoAvisoValido(null), "grande");
    assert.equal(tamanhoDoAvisoValido("medio"), "medio");
  });
});
