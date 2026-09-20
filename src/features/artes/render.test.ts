import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapar, paraSvg, quebrarTexto } from "./render.ts";
import { montar } from "./variacoes.ts";
import { FORMATOS } from "./formatos.ts";
import { dadosVazios, type DadosDoEvento } from "./types.ts";

function dados(extra: Partial<DadosDoEvento> = {}): DadosDoEvento {
  return { ...dadosVazios(), titulo: "Culto da Benção", data: "12 de março", ...extra };
}

function arte(semente = 1, formatoId = "quadrado", d = dados()) {
  const f = FORMATOS.find((x) => x.id === formatoId)!;
  return montar({
    id: "a1",
    nome: "T",
    dados: d,
    semente,
    formatoId: f.id,
    largura: f.largura,
    altura: f.altura,
  });
}

describe("escapar", () => {
  test("o que vem do formulário não vira marcação", () => {
    // O nome do evento é digitado por qualquer pessoa da igreja.
    assert.equal(escapar("Jovens & Adolescentes"), "Jovens &amp; Adolescentes");
    assert.equal(escapar('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  test("texto comum atravessa sem estrago", () => {
    assert.equal(escapar("Louvor às 19h30"), "Louvor às 19h30");
  });
});

describe("quebrarTexto", () => {
  test("parte onde a linha acaba, sem cortar palavra", () => {
    const linhas = quebrarTexto("Conferência de jovens da igreja local", 400, 40);
    assert.ok(linhas.length >= 2);
    for (const l of linhas) assert.ok(!l.startsWith(" ") && !l.endsWith(" "), JSON.stringify(l));
    assert.equal(linhas.join(" "), "Conferência de jovens da igreja local");
  });

  test("respeita a quebra que a pessoa digitou", () => {
    // Endereço em duas linhas foi escrito assim de propósito.
    const linhas = quebrarTexto("Rua das Palmeiras, 1200\nJardim São Paulo", 2000, 20);
    assert.deepEqual(linhas, ["Rua das Palmeiras, 1200", "Jardim São Paulo"]);
  });

  test("palavra sozinha maior que a linha não some", () => {
    assert.deepEqual(quebrarTexto("Pentecostes", 40, 40), ["Pentecostes"]);
  });

  test("vazio não vira linha em branco", () => {
    assert.deepEqual(quebrarTexto("", 400, 40), []);
    assert.deepEqual(quebrarTexto("   \n  ", 400, 40), []);
  });
});

describe("paraSvg", () => {
  test("sai um SVG válido, no tamanho do formato", () => {
    const svg = paraSvg(arte(1, "story"));
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /width="1080" height="1920" viewBox="0 0 1080 1920"/);
    assert.match(svg, /<\/svg>$/);
  });

  test("a miniatura é o mesmo desenho num quadro menor", () => {
    // Miniatura que mente é pior que miniatura feia: o viewBox não muda.
    const cheio = paraSvg(arte(1), 1);
    const mini = paraSvg(arte(1), 0.15);
    assert.match(mini, /width="162" height="162"/);
    assert.equal(
      mini.replace(/width="\d+" height="\d+"/, ""),
      cheio.replace(/width="\d+" height="\d+"/, ""),
    );
  });

  test("o título aparece no desenho", () => {
    assert.match(paraSvg(arte()), /Culto da Benção/);
  });

  test("texto do formulário não injeta marcação no arquivo", () => {
    const svg = paraSvg(arte(1, "quadrado", dados({ titulo: '<script>x</script>' })));
    assert.ok(!svg.includes("<script>"), "injetou marcação no SVG");
    assert.match(svg, /&lt;script&gt;/);
  });

  test("elemento oculto não é desenhado", () => {
    const doc = arte();
    const comOculto = {
      ...doc,
      elementos: doc.elementos.map((e) =>
        e.tipo === "texto" && e.campo === "titulo" ? { ...e, oculto: true } : e,
      ),
    };
    assert.ok(!paraSvg(comOculto).includes("Culto da Benção"));
  });

  test("todo formato desenha, e nenhum sai vazio", () => {
    for (const f of FORMATOS) {
      const svg = paraSvg(arte(3, f.id));
      assert.ok(svg.length > 200, f.id);
      assert.match(svg, /<text /, f.id);
      assert.match(svg, /<rect |<image /, f.id);
    }
  });

  test("foto de fundo entra com véu por cima", () => {
    const svg = paraSvg(arte(2, "quadrado", dados({ imagem: "lumen://foto.jpg" })));
    assert.match(svg, /<image href="lumen:\/\/foto\.jpg"/);
    assert.match(svg, /fill="#000000" opacity="0\.45"/);
  });
});
