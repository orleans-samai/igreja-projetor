import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (arquivo) => readFile(path.join(raiz, arquivo), "utf8");

// O ícone do Lúmen é um só: o do aplicativo no PC, desenhado em
// public/favicon.svg (de onde sai o .ico do instalador). O celular chegou a
// mostrar três losangos e a página do dirigente uma lente de projetor, e a
// equipe não reconhecia o app.
test("as páginas do celular e do dirigente mostram o mesmo ícone do aplicativo no PC", async () => {
  const favicon = await ler("public/favicon.svg");
  const formas = favicon.match(/<(?:rect|circle|path)\b[^>]*\/>/g) ?? [];
  assert.equal(formas.length, 6, "o favicon.svg mudou de forma: confira o teste");
  for (const pagina of ["public/remote-control.html", "public/dirigente.html"]) {
    const html = (await ler(pagina)).replace(/\s+/g, " ");
    for (const forma of formas) {
      assert.ok(html.includes(forma.replace(/\s+/g, " ")), `${pagina} não tem o ícone do app: falta ${forma}`);
    }
    assert.ok(!html.includes("M17 3 31 10.5"), `${pagina} ainda tem os três losangos`);
    assert.ok(!html.includes('class="lente"'), `${pagina} ainda tem a lente de projetor`);
  }
});
