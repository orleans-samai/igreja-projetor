import assert from "node:assert/strict";
import { test } from "node:test";
import regras from "../desktop/chat-regras.cjs";
import fotos from "../desktop/chat-fotos.cjs";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { paraValido, mencoesNoTexto, podeVer } = regras;

test("destino que chegou de fora vira um destino que alguém lê", () => {
  assert.deepEqual(paraValido(undefined), { tipo: "todos" });
  assert.deepEqual(paraValido({ tipo: "equipe", equipe: "som" }), { tipo: "equipe", equipe: "som" });
  // Equipe inventada não pode virar um recado que ninguém recebe.
  assert.deepEqual(paraValido({ tipo: "equipe", equipe: "hackers" }), { tipo: "todos" });
  assert.deepEqual(paraValido({ tipo: "pessoa", id: "a1", nome: "Bia" }), { tipo: "pessoa", id: "a1", nome: "Bia" });
  assert.deepEqual(paraValido({ tipo: "pessoa" }), { tipo: "todos" });
});

test("@nome acha a pessoa inteira, sem acento nem maiúscula importar", () => {
  const pessoas = [
    { id: "1", nome: "Ana" },
    { id: "2", nome: "Ana Paula" },
    { id: "3", nome: "Pastor João" },
    { id: "4", nome: "Anabela" },
  ];
  assert.deepEqual(
    mencoesNoTexto("@ana paula e @PASTOR JOAO, podem vir?", pessoas).map((p) => p.id).sort(),
    ["2", "3"],
  );
  // "@Ana" não é "@Anabela", e "@Ana Paula" não cita também a "Ana".
  assert.deepEqual(mencoesNoTexto("@Anabela chegou", pessoas).map((p) => p.id), ["4"]);
  assert.deepEqual(mencoesNoTexto("@Ana, liga o microfone", pessoas).map((p) => p.id), ["1"]);
  assert.deepEqual(mencoesNoTexto("sem ninguém citado", pessoas), []);
});

test("quem lê cada recado", () => {
  const som = { id: "s", nome: "Caio", equipe: "som" };
  const louvor = { id: "l", nome: "Bia", equipe: "louvor" };
  const cabine = { id: "cabine", nome: "Cabine", equipe: "cabine", cabine: true };
  const praLouvor = { deId: "s", para: { tipo: "equipe", equipe: "louvor" }, mencoes: [] };
  assert.equal(podeVer(louvor, praLouvor), true);
  assert.equal(podeVer(som, praLouvor), true, "quem escreveu lê o que escreveu");
  assert.equal(podeVer({ id: "x", nome: "Zé", equipe: "" }, praLouvor), false);
  assert.equal(podeVer(cabine, praLouvor), true, "a cabine modera, então lê tudo");

  const direto = { deId: "l", para: { tipo: "pessoa", id: "s", nome: "Caio" }, mencoes: [] };
  assert.equal(podeVer(som, direto), true);
  assert.equal(podeVer({ id: "x", nome: "Zé", equipe: "som" }, direto), false);

  // Citado com @ lê mesmo sem ser da equipe.
  const comMencao = { deId: "s", para: { tipo: "equipe", equipe: "som" }, mencoes: [{ id: "l" }] };
  assert.equal(podeVer(louvor, comMencao), true);
  assert.equal(podeVer(null, { para: { tipo: "todos" } }), false);
});

test("a foto do chat só entra se for foto, e fica presa na pasta dela", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-chat-fotos-"));
  fotos.init(dir);
  try {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const r = await fotos.salvar(png);
    assert.equal(r.ok, true);
    assert.match(r.arquivo, /^[a-f0-9-]{36}\.png$/);
    const lida = await fotos.ler(r.arquivo);
    assert.equal(lida.tipo, "image/png");
    assert.equal(lida.bytes.length, png.length);
    assert.ok(await fotos.resolver(`/__chat/${r.arquivo}`));

    // Texto com nome de foto não é foto.
    assert.equal((await fotos.salvar(Buffer.from("<script>alert(1)</script>"))).ok, false);
    // E ninguém sai da pasta pelo nome do arquivo.
    assert.equal(await fotos.ler("../../segredo.png"), null);
    assert.equal(await fotos.resolver("/__chat/../../segredo.png"), null);

    await fotos.apagar(r.arquivo);
    assert.deepEqual(await readdir(path.join(dir, "chat-fotos")), []);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
