import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  JANELA_DO_GRUPO_MS,
  completarMencao,
  iniciais,
  posicaoNoGrupo,
  sugestoesDeMencao,
  trechosDoRecado,
} from "./chat-grupos.ts";

const raiz = path.resolve(import.meta.dirname, "..", "..");
const t0 = new Date(2026, 8, 27, 19, 0).getTime();
const r = (deId: string, minutos: number, daCabine = false) => ({
  de: deId,
  deId,
  daCabine,
  em: t0 + minutos * 60000,
});

test("recados seguidos da mesma pessoa formam um grupo", () => {
  const lista = [r("caio", 0), r("caio", 1), r("caio", 2), r("bia", 3)];
  assert.deepEqual(posicaoNoGrupo(lista, 0), { primeiro: true, ultimo: false });
  assert.deepEqual(posicaoNoGrupo(lista, 1), { primeiro: false, ultimo: false });
  assert.deepEqual(posicaoNoGrupo(lista, 2), { primeiro: false, ultimo: true });
  assert.deepEqual(posicaoNoGrupo(lista, 3), { primeiro: true, ultimo: true });
});

test("cinco minutos de silêncio abrem um grupo novo", () => {
  const lista = [r("caio", 0), r("caio", 6)];
  assert.deepEqual(posicaoNoGrupo(lista, 0), { primeiro: true, ultimo: true });
  assert.deepEqual(posicaoNoGrupo(lista, 1), { primeiro: true, ultimo: true });
});

test("a cabine é uma pessoa só, venha com o nome que vier", () => {
  const lista = [
    { de: "Operador", daCabine: true, em: t0 },
    { de: "Cabine", daCabine: true, em: t0 + 1000 },
  ];
  assert.deepEqual(posicaoNoGrupo(lista, 1), { primeiro: false, ultimo: true });
});

test("as iniciais do balão", () => {
  assert.equal(iniciais("Pastor João"), "PJ");
  assert.equal(iniciais("bia"), "B");
  assert.equal(iniciais("Ana Maria da Silva"), "AS");
  assert.equal(iniciais("  "), "?");
});

test("celular e página do dirigente usam a mesma janela de grupo, pelo mesmo chat", () => {
  const js = readFileSync(path.join(raiz, "public/chat-equipe.js"), "utf8");
  assert.ok(js.includes(`var JANELA_DO_GRUPO_MS = ${JANELA_DO_GRUPO_MS / 60000} * 60 * 1000;`), "janela diferente");
  // As duas páginas carregam o mesmo arquivo: uma cópia do chat em cada
  // página foi como elas começaram a divergir.
  for (const pagina of ["public/remote-control.html", "public/dirigente.html"]) {
    const html = readFileSync(path.join(raiz, pagina), "utf8");
    assert.ok(html.includes('<script src="/chat-equipe.js"></script>'), `${pagina}: não carrega o chat`);
    assert.equal(html.includes("var CORES_DO_CHAT"), false, `${pagina}: voltou a ter uma cópia do chat`);
  }
});

test("a menção aparece destacada no texto, achada sem acento e sem maiúscula", () => {
  const trechos = trechosDoRecado("Valeu @joao, e @Ana Paula sobe o retorno", [
    { id: "a", nome: "Ana" },
    { id: "ap", nome: "Ana Paula" },
    { id: "j", nome: "João" },
  ]);
  assert.deepEqual(
    trechos.map((t) => [t.texto, t.pessoa?.id ?? null]),
    [
      ["Valeu ", null],
      ["@joao", "j"],
      [", e ", null],
      // O nome mais comprido fica com o @: a Ana não é citada aqui.
      ["@Ana Paula", "ap"],
      [" sobe o retorno", null],
    ],
  );
});

test("sem menção o recado é um trecho só, e texto vazio não vira trecho", () => {
  assert.deepEqual(trechosDoRecado("Repete o refrão"), [{ texto: "Repete o refrão" }]);
  assert.deepEqual(trechosDoRecado(""), []);
});

test("o @ sugere quem está no chat, e nunca a própria pessoa", () => {
  const pessoas = [
    { id: "cabine", nome: "Cabine" },
    { id: "b", nome: "Bia" },
    { id: "br", nome: "Bruno" },
    { id: "c", nome: "Caio" },
  ];
  assert.deepEqual(
    sugestoesDeMencao("Valeu @b", pessoas, "c")?.pessoas.map((p) => p.id),
    ["b", "br"],
  );
  assert.equal(sugestoesDeMencao("Valeu @b", pessoas, "c")?.fragmento, "@b");
  assert.equal(sugestoesDeMencao("Valeu @c", pessoas, "c")?.pessoas.map((p) => p.id).join(), "cabine");
  assert.equal(sugestoesDeMencao("sem arroba", pessoas, "c"), null);
  assert.equal(sugestoesDeMencao("@zzz", pessoas, "c"), null);
});

test("escolher a sugestão completa o nome e deixa o cursor depois dele", () => {
  assert.deepEqual(completarMencao("Valeu @Bi, até", 9, "@Bi", "Bia"), {
    texto: "Valeu @Bia , até",
    cursor: 11,
  });
});
