import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TAMANHOS_DA_LOGO,
  TAMANHO_PADRAO,
  alturaDaLogo,
  corpoDoNome,
  tamanhoValido,
} from "./logo-no-telao.ts";

describe("a logo no telão", () => {
  it("nasce pequena para quem nunca escolheu", () => {
    // Era a queixa: sem escolha, a logo ocupava a tela de parede a parede.
    assert.equal(TAMANHO_PADRAO, "pequeno");
    assert.equal(tamanhoValido(undefined), "pequeno");
    assert.equal(tamanhoValido(null), "pequeno");
    assert.equal(tamanhoValido("gigante"), "pequeno");
  });

  it("nenhum tamanho ocupa a tela inteira", () => {
    for (const t of TAMANHOS_DA_LOGO) {
      const v = Number.parseFloat(alturaDaLogo(t));
      assert.ok(v > 0 && v <= 60, `${t}: ${v}vmin`);
    }
  });

  it("cresce na ordem que o nome promete", () => {
    const [p, m, g] = TAMANHOS_DA_LOGO.map((t) => Number.parseFloat(alturaDaLogo(t)));
    assert.ok(p < m && m < g);
  });

  it("o nome fica menor que a logo, senão a legenda vira o título", () => {
    for (const t of TAMANHOS_DA_LOGO) {
      assert.ok(Number.parseFloat(corpoDoNome(t)) < Number.parseFloat(alturaDaLogo(t)) / 3);
    }
  });

  it("a prévia mede pela caixa, o telão pela tela", () => {
    assert.match(alturaDaLogo("pequeno"), /vmin$/);
    assert.match(alturaDaLogo("pequeno", "cqmin"), /cqmin$/);
    assert.match(corpoDoNome("medio", "cqmin"), /cqmin$/);
  });
});
