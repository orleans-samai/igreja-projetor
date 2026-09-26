import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapar, quebrarTexto } from "./render.ts";

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
