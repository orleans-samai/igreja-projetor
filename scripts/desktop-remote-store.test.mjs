import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import cofreModule from "../desktop/remote-store.cjs";
const { CofreRemoto, saneia, PORTA_PADRAO, VALIDADE_MS } = cofreModule;

const DIA = 24 * 60 * 60 * 1000;

test("arquivo ausente ou ilegível não derruba a abertura do app", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-cofre-"));
  try {
    const cofre = new CofreRemoto(dir);
    assert.deepEqual(cofre.ler(), { porta: PORTA_PADRAO, pin: null, dispositivos: [] });
    writeFileSync(path.join(dir, "remote.json"), "{ isto não é json");
    assert.equal(cofre.ler().porta, PORTA_PADRAO);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("grava e lê de volta o que a equipe precisa que não mude", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-cofre-"));
  try {
    const cofre = new CofreRemoto(dir);
    const agora = Date.now();
    cofre.gravar({
      porta: 9123,
      pin: "123456",
      dispositivos: [
        {
          token: "t".repeat(36),
          id: "id-1",
          nome: "Celular do Pastor",
          permissao: "controle",
          criadoEm: agora,
          ultimoVisto: agora,
        },
      ],
    });
    const lido = cofre.ler();
    assert.equal(lido.porta, 9123);
    assert.equal(lido.pin, "123456");
    assert.equal(lido.dispositivos.length, 1);
    assert.equal(lido.dispositivos[0].nome, "Celular do Pastor");
    assert.equal(lido.dispositivos[0].permissao, "controle");
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("uma semana parado ainda entra; três meses não", () => {
  const agora = Date.now();
  const aparelho = (quandoFoiVisto) => ({
    token: "t".repeat(36),
    id: "id",
    nome: "Celular",
    permissao: "chat",
    criadoEm: quandoFoiVisto,
    ultimoVisto: quandoFoiVisto,
  });
  assert.equal(saneia({ dispositivos: [aparelho(agora - 7 * DIA)] }, agora).dispositivos.length, 1);
  assert.equal(saneia({ dispositivos: [aparelho(agora - 30 * DIA)] }, agora).dispositivos.length, 1);
  assert.equal(
    saneia({ dispositivos: [aparelho(agora - VALIDADE_MS - DIA)] }, agora).dispositivos.length,
    0,
  );
});

test("conteúdo estranho no arquivo não vira estado do servidor", () => {
  const limpo = saneia({
    porta: "8787",
    pin: "abc",
    dispositivos: [
      { token: "curto", id: "x" },
      { token: "t".repeat(36) },
      "nem objeto é",
      { token: "u".repeat(36), id: "ok", permissao: "administrador" },
    ],
  });
  // Porta em texto e PIN com letra não são aproveitados: voltam ao padrão.
  assert.equal(limpo.porta, PORTA_PADRAO);
  assert.equal(limpo.pin, null);
  // Token curto, aparelho sem id e linha que não é objeto ficam de fora.
  assert.equal(limpo.dispositivos.length, 1);
  // Permissão inventada cai para a mais fraca, nunca para a mais forte.
  assert.equal(limpo.dispositivos[0].permissao, "chat");
});

test("a lista de aparelhos não cresce sem fim", () => {
  const agora = Date.now();
  const muitos = Array.from({ length: 200 }, (_, i) => ({
    token: String(i).padStart(36, "0"),
    id: `id-${i}`,
    nome: `Celular ${i}`,
    permissao: "chat",
    criadoEm: agora,
    ultimoVisto: agora - i * 1000,
  }));
  const limpo = saneia({ dispositivos: muitos }, agora);
  assert.equal(limpo.dispositivos.length, 50);
  // Fica quem apareceu por último, não quem pareou primeiro.
  assert.equal(limpo.dispositivos[0].nome, "Celular 0");
});
