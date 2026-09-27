import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CORES_DO_CHAT, chaveDaPessoa, corDaPessoa } from "./cor-do-chat.ts";

const raiz = path.resolve(import.meta.dirname, "..", "..");

test("oito pessoas na conversa, oito cores diferentes", () => {
  const usadas = new Map<string, number>();
  const nomes = ["Pastor João", "Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi"];
  const cores = nomes.map((n) => corDaPessoa(chaveDaPessoa({ de: n, daCabine: false }), usadas));
  assert.equal(new Set(cores).size, 8, cores.join(", "));
});

test("a mesma pessoa mantém a cor na conversa inteira", () => {
  const usadas = new Map<string, number>();
  const ana = chaveDaPessoa({ de: "Ana", daCabine: false });
  const primeira = corDaPessoa(ana, usadas);
  corDaPessoa(chaveDaPessoa({ de: "Bruno", daCabine: false }), usadas);
  assert.equal(corDaPessoa(ana, usadas), primeira);
  // Maiúscula e espaço sobrando não viram outra pessoa.
  assert.equal(corDaPessoa(chaveDaPessoa({ de: " ana ", daCabine: false }), usadas), primeira);
});

test("a cabine é uma pessoa só, e ninguém se passa por ela com o nome", () => {
  assert.equal(chaveDaPessoa({ de: "Operador", daCabine: true }), chaveDaPessoa({ de: "Cabine", daCabine: true }));
  assert.notEqual(chaveDaPessoa({ de: "cabine", daCabine: false }), chaveDaPessoa({ de: "cabine", daCabine: true }));
});

test("a nona pessoa ainda recebe uma cor da paleta", () => {
  const usadas = new Map<string, number>();
  for (let i = 0; i < 9; i += 1) {
    const cor = corDaPessoa(`p:pessoa-${i}`, usadas);
    assert.ok((CORES_DO_CHAT as readonly string[]).includes(cor));
  }
});

test("o chat do celular e do dirigente usa a mesma paleta e a mesma conta", () => {
  const paleta = CORES_DO_CHAT.map((c) => `"${c}"`).join(", ");
  const js = readFileSync(path.join(raiz, "public/chat-equipe.js"), "utf8");
  assert.ok(js.includes(`var CORES_DO_CHAT = [${paleta}];`), "paleta diferente");
  assert.ok(js.includes("h = (h * 31 + chave.charCodeAt(i)) >>> 0;"), "conta diferente");
  assert.ok(js.includes('return m.daCabine ? "cabine" : "p:" + String(m.de || "").trim().toLowerCase();'), "chave diferente");
});

test("as páginas do celular e do dirigente não dão zoom sem querer", () => {
  for (const pagina of ["public/remote-control.html", "public/dirigente.html"]) {
    const html = readFileSync(path.join(raiz, pagina), "utf8");
    // Campo com foco não amplia (iPhone) e a viewport não escala (Android).
    assert.match(html, /name="viewport" content="[^"]*maximum-scale=1[^"]*user-scalable=no/, pagina);
    // Toque duplo no Próximo não amplia.
    assert.match(html, /touch-action: manipulation/, pagina);
    // Pinça: o Safari ignora a viewport, então os gestos são cancelados.
    assert.ok(html.includes('["gesturestart", "gesturechange", "gestureend"]'), `${pagina}: pinça do Safari`);
    assert.ok(html.includes("e.touches.length > 1) e.preventDefault()"), `${pagina}: pinça do Android`);
  }
});
