import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idDoVideo, mensagemDeErro, relogio } from "./youtube.ts";

const ID = "dQw4w9WgXcQ";

describe("idDoVideo", () => {
  it("lê o link da barra de endereço", () => {
    assert.equal(idDoVideo(`https://www.youtube.com/watch?v=${ID}`), ID);
  });

  it("lê o link curto do botão compartilhar", () => {
    assert.equal(idDoVideo(`https://youtu.be/${ID}`), ID);
  });

  it("lê o link de transmissão ao vivo", () => {
    assert.equal(idDoVideo(`https://www.youtube.com/live/${ID}`), ID);
  });

  it("lê embed e shorts", () => {
    assert.equal(idDoVideo(`https://www.youtube.com/embed/${ID}`), ID);
    assert.equal(idDoVideo(`https://www.youtube.com/shorts/${ID}`), ID);
  });

  it("ignora o resto do endereço", () => {
    assert.equal(idDoVideo(`https://youtu.be/${ID}?t=42`), ID);
    assert.equal(idDoVideo(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`), ID);
    assert.equal(idDoVideo(`https://m.youtube.com/watch?v=${ID}`), ID);
    assert.equal(idDoVideo(`https://music.youtube.com/watch?v=${ID}`), ID);
    assert.equal(idDoVideo(`https://www.youtube-nocookie.com/embed/${ID}`), ID);
  });

  it("aguenta o que o operador realmente cola", () => {
    assert.equal(idDoVideo(`  https://www.youtube.com/watch?v=${ID}  `), ID, "com espaços");
    assert.equal(idDoVideo(`youtube.com/watch?v=${ID}`), ID, "sem protocolo");
    assert.equal(idDoVideo(`YouTube.com/watch?v=${ID}`), ID, "com maiúsculas no domínio");
    assert.equal(idDoVideo(ID), ID, "o id sozinho");
  });

  it("devolve null em vez de quebrar", () => {
    for (const entrada of [
      "",
      "   ",
      "não é link",
      "https://",
      "https://vimeo.com/123456",
      "https://www.youtube.com/",
      "https://www.youtube.com/watch?v=curto",
      "https://youtu.be/",
      "https://exemplo.com/watch?v=" + ID,
    ]) {
      assert.equal(idDoVideo(entrada), null, `esperava null para ${JSON.stringify(entrada)}`);
    }
  });

  it("não aceita domínio que só termina parecido", () => {
    assert.equal(idDoVideo(`https://naoyoutube.com/watch?v=${ID}`), null);
  });
});

describe("mensagemDeErro", () => {
  it("explica a incorporação bloqueada, que é o caso comum", () => {
    for (const codigo of [101, 150]) {
      assert.match(mensagemDeErro(codigo), /não permite exibi-lo fora do YouTube/);
    }
  });

  it("tem frase para todo código, inclusive um desconhecido", () => {
    for (const codigo of [2, 5, 100, 101, 150, 999]) {
      assert.ok(mensagemDeErro(codigo).length > 10, `código ${codigo} sem frase`);
    }
  });
});

describe("relogio", () => {
  it("mostra minutos e segundos", () => {
    assert.equal(relogio(0), "0:00");
    assert.equal(relogio(9), "0:09");
    assert.equal(relogio(75), "1:15");
  });

  it("passa a mostrar horas quando precisa", () => {
    assert.equal(relogio(3600), "1:00:00");
    assert.equal(relogio(3725), "1:02:05");
  });

  it("não quebra com valor ausente ou negativo", () => {
    assert.equal(relogio(Number.NaN), "0:00");
    assert.equal(relogio(-5), "0:00");
  });
});
