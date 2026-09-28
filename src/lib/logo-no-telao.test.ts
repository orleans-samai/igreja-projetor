import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TAMANHOS_DA_LOGO,
  TAMANHO_PADRAO,
  alturaDaLogo,
  corDoNomeValida,
  corpoDoNome,
  fundoDaLogoValido,
  sombraDaLogo,
  sombraDoNome,
  sombraValida,
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

describe("o fundo atrás da logo", () => {
  it("aceita vídeo e imagem da pasta de mídia", () => {
    const video = { tipo: "video", url: "lumen://app/__midia/video/Abertura.mp4", titulo: "Abertura" };
    assert.deepEqual(fundoDaLogoValido(video), video);
    const imagem = { tipo: "imagem", url: "lumen://app/__midia/image/Cruz.jpg", titulo: "Cruz" };
    assert.deepEqual(fundoDaLogoValido(imagem), imagem);
  });

  it("sem escolha, ou com escolha estragada, fica o fundo do tema", () => {
    assert.equal(fundoDaLogoValido(undefined), null);
    assert.equal(fundoDaLogoValido(null), null);
    assert.equal(fundoDaLogoValido({ tipo: "audio", url: "lumen://app/__midia/audio/a.mp3" }), null);
  });

  it("vídeo embutido no quadro não entra: engasgaria a projeção a cada verso", () => {
    assert.equal(fundoDaLogoValido({ tipo: "video", url: "data:video/mp4;base64,AAAA", titulo: "x" }), null);
    assert.equal(fundoDaLogoValido({ tipo: "imagem", url: "https://exemplo.com/foto.jpg", titulo: "x" }), null);
    // O tipo tem de bater com a pasta: imagem na pasta de vídeo é engano.
    assert.equal(fundoDaLogoValido({ tipo: "imagem", url: "lumen://app/__midia/video/a.mp4", titulo: "x" }), null);
  });
});

describe("cor do nome e sombras da logo", () => {
  it("a cor do nome só vale em #rrggbb; o resto é a cor do palco", () => {
    assert.equal(corDoNomeValida("#F2C94C"), "#f2c94c");
    assert.equal(corDoNomeValida("amarelo"), undefined);
    assert.equal(corDoNomeValida("#fff"), undefined);
    assert.equal(corDoNomeValida("url(javascript:1)"), undefined);
    assert.equal(corDoNomeValida(undefined), undefined);
  });

  it("a força da sombra fica entre 0 e 100", () => {
    assert.equal(sombraValida(55.4), 55);
    assert.equal(sombraValida(-3), 0);
    assert.equal(sombraValida(300), 100);
    assert.equal(sombraValida("x"), 0);
    assert.equal(sombraValida(undefined), 0);
  });

  it("sem força, nenhuma sombra; com força, mais escura e mais aberta", () => {
    assert.equal(sombraDaLogo(0), undefined);
    assert.equal(sombraDoNome(0), undefined);
    const fraca = sombraDaLogo(20, "cqmin") ?? "";
    const forte = sombraDaLogo(100, "cqmin") ?? "";
    assert.match(fraca, /^drop-shadow\(0 [\d.]+cqmin [\d.]+cqmin rgba\(0, 0, 0, [\d.]+\)\)$/);
    const opaca = (s: string) => Number(/rgba\(0, 0, 0, ([\d.]+)\)/.exec(s)?.[1]);
    assert.ok(opaca(forte) > opaca(fraca));
    // A do nome é em "em": acompanha o corpo do texto no telão e na prévia.
    assert.match(sombraDoNome(60) ?? "", /^0 [\d.]+em [\d.]+em rgba\(0, 0, 0, [\d.]+\)$/);
  });
});
