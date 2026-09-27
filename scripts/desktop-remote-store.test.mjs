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
    assert.deepEqual(cofre.ler(), {
      porta: PORTA_PADRAO,
      dispositivos: [],
      senhaDirigente: null,
      contas: [],
    });
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
    assert.equal(lido.dispositivos.length, 1);
    assert.equal(lido.dispositivos[0].nome, "Celular do Pastor");
    // O remote.json de antes guardava o degrau: "controle" vira o acesso completo.
    assert.deepEqual(lido.dispositivos[0].permissoes, ["completo"]);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("as permissões por parte voltam do arquivo na ordem de sempre, sem repetição nem invenção", () => {
  const agora = Date.now();
  const r = saneia({
    dispositivos: [
      { token: "t".repeat(36), id: "a", nome: "Mídia", permissoes: ["midia", "culto", "midia", "root"], criadoEm: agora, ultimoVisto: agora },
      { token: "u".repeat(36), id: "b", nome: "Tudo", permissoes: ["completo"], criadoEm: agora, ultimoVisto: agora - 1 },
    ],
  }, agora);
  assert.deepEqual(r.dispositivos.map((d) => d.permissoes), [["culto", "midia"], ["completo"]]);
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
    dispositivos: [
      { token: "curto", id: "x" },
      { token: "t".repeat(36) },
      "nem objeto é",
      { token: "u".repeat(36), id: "ok", permissao: "administrador" },
    ],
  });
  // Porta escrita como texto não é aproveitada: volta ao padrão.
  assert.equal(limpo.porta, PORTA_PADRAO);
  // Token curto, aparelho sem id e linha que não é objeto ficam de fora.
  assert.equal(limpo.dispositivos.length, 1);
  // Permissão inventada vira só o chat, nunca mais que isso.
  assert.deepEqual(limpo.dispositivos[0].permissoes, []);
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

test("a senha do dirigente é guardada cozida, nunca em claro", () => {
  const { cozinharSenha, senhaConfere } = cofreModule;
  const guardada = cozinharSenha("culto2026");
  assert.notEqual(guardada.chave, "culto2026");
  assert.match(guardada.sal, /^[0-9a-f]{32}$/);
  assert.equal(senhaConfere(guardada, "culto2026"), true);
  assert.equal(senhaConfere(guardada, "culto2025"), false);
  // Sal por senha: a mesma senha guardada duas vezes não dá o mesmo resultado,
  // então quem lê o arquivo não descobre que duas igrejas usam a mesma.
  assert.notEqual(cozinharSenha("culto2026").chave, guardada.chave);
  // Sem nada guardado, nada confere — nem string vazia.
  assert.equal(senhaConfere(null, ""), false);
  assert.equal(senhaConfere({ sal: "x" }, ""), false);
});

test("senha estranha no arquivo não vira senha válida", () => {
  assert.equal(saneia({ senhaDirigente: "culto2026" }).senhaDirigente, null);
  assert.equal(saneia({ senhaDirigente: { sal: 1, chave: 2 } }).senhaDirigente, null);
  assert.deepEqual(saneia({ senhaDirigente: { sal: "aa", chave: "bb" } }).senhaDirigente, {
    sal: "aa",
    chave: "bb",
  });
});

test("conta guardada leva a senha cozida; sem senha cozida ou repetida, não entra", () => {
  const { cozinharSenha, senhaConfere } = cofreModule;
  const cozida = cozinharSenha("louvor-2026");
  const r = saneia({
    contas: [
      { id: "a", usuario: "Bia", senha: cozida, permissao: "editor", equipe: "louvor" },
      // A mesma pessoa duas vezes teria duas senhas.
      { id: "b", usuario: " BIA ", senha: cozida },
      // Senha em claro que alguém escreveu no arquivo não vira senha.
      { id: "c", usuario: "Zé", senha: "louvor-2026" },
      { id: "d", usuario: "Caio", senha: cozida, permissao: "dono", equipe: "cozinha" },
    ],
  });
  assert.deepEqual(
    r.contas.map((c) => [c.id, c.usuario, c.permissoes, c.equipe]),
    [["a", "Bia", ["culto", "midia", "letras"], "louvor"], ["d", "Caio", [], ""]],
  );
  assert.ok(senhaConfere(r.contas[0].senha, "louvor-2026"));
});

test("a equipe do aparelho volta do arquivo, e equipe inventada não", () => {
  const agora = Date.now();
  const base = { id: "d", nome: "Zé", permissao: "chat", criadoEm: agora, ultimoVisto: agora };
  const r = saneia({
    dispositivos: [
      { ...base, token: "t".repeat(20), equipe: "pastor", contaId: "conta-1" },
      { ...base, token: "u".repeat(20), id: "e", equipe: "cozinha" },
    ],
  });
  assert.deepEqual(
    r.dispositivos.map((d) => [d.id, d.equipe, d.contaId]).sort(),
    [["d", "pastor", "conta-1"], ["e", "", ""]],
  );
});
