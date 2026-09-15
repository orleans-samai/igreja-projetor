import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import remoteControlModule from "../desktop/remote-control.cjs";
const { RemoteControl } = remoteControlModule;

async function comPagina() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-remote-"));
  await writeFile(path.join(dir, "remote-control.html"), "<!doctype html><title>t</title>");
  return dir;
}

async function subir() {
  const dir = await comPagina();
  const rc = new RemoteControl(dir);
  const status = await rc.ligar();
  const base = `http://127.0.0.1:${status.porta}`;
  return { rc, dir, base, pin: status.pin };
}

async function derrubar({ rc, dir }) {
  rc.desligar();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

test("liga, escuta na rede (0.0.0.0) e desliga", async () => {
  const ctx = await subir();
  try {
    assert.equal(ctx.rc.status().ligado, true);
    assert.match(ctx.rc.status().pin, /^\d{6}$/);
    const r = await fetch(ctx.base + "/");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<!doctype html>/i);
  } finally {
    await derrubar(ctx);
  }
  assert.equal(ctx.rc.status().ligado, false);
  await assert.rejects(fetch(ctx.base + "/"));
});

test("pareamento: PIN certo dá token, PIN errado não", async () => {
  const ctx = await subir();
  try {
    const errado = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({ pin: "000000" === ctx.pin ? "111111" : "000000" }),
    });
    assert.equal(errado.status, 401);

    const certo = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({ pin: ctx.pin }),
    });
    assert.equal(certo.status, 200);
    const { ok, token } = await certo.json();
    assert.equal(ok, true);
    assert.equal(typeof token, "string");
    assert.ok(token.length > 10);
  } finally {
    await derrubar(ctx);
  }
});

test("cinco PINs errados bloqueiam o IP por um tempo", async () => {
  const ctx = await subir();
  try {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(ctx.base + "/parear", { method: "POST", body: JSON.stringify({ pin: "000000" }) });
      assert.equal(r.status, 401, `tentativa ${i + 1} deveria ser 401`);
    }
    const bloqueado = await fetch(ctx.base + "/parear", { method: "POST", body: JSON.stringify({ pin: ctx.pin }) });
    assert.equal(bloqueado.status, 429, "mesmo o PIN certo é recusado enquanto bloqueado");
  } finally {
    await derrubar(ctx);
  }
});

async function parear(base, pin) {
  const r = await fetch(base + "/parear", { method: "POST", body: JSON.stringify({ pin }) });
  const { token } = await r.json();
  return token;
}

test("comando exige sessão válida e ação da lista", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin);
    const recebidos = [];
    ctx.rc.onComando = (acao) => recebidos.push(acao);

    const semToken = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token: "invalido", acao: "proximo" }),
    });
    assert.equal(semToken.status, 401);

    const acaoRuim = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "apagar-tudo" }),
    });
    assert.equal(acaoRuim.status, 400);

    const bom = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(bom.status, 200);
    assert.deepEqual(recebidos, ["proximo"]);
  } finally {
    await derrubar(ctx);
  }
});

test("regenerar o PIN encerra as sessões anteriores", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin);
    const novo = ctx.rc.regenerarPin();
    assert.notEqual(novo.pin, ctx.pin);

    const comTokenVelho = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(comTokenVelho.status, 401, "sessão de antes do regenerar não deveria valer mais");
  } finally {
    await derrubar(ctx);
  }
});

test("estado (SSE) exige token e recebe o que a cabine publica", async () => {
  const ctx = await subir();
  try {
    const semToken = await fetch(ctx.base + "/estado");
    assert.equal(semToken.status, 401);

    const token = await parear(ctx.base, ctx.pin);
    const controlador = new AbortController();
    const resposta = await fetch(ctx.base + "/estado?token=" + token, { signal: controlador.signal });
    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get("content-type") || "", /text\/event-stream/);

    ctx.rc.atualizarEstado({ titulo: "Ousado Amor", slide: 3, total: 8 });
    const leitor = resposta.body.getReader();
    let bruto = "";
    while (!bruto.includes("Ousado Amor")) {
      const { value, done } = await leitor.read();
      if (done) break;
      bruto += Buffer.from(value).toString("utf8");
    }
    assert.match(bruto, /Ousado Amor/);
    controlador.abort();
  } finally {
    await derrubar(ctx);
  }
});

test("as ações permitidas não incluem trocar de música ou apagar repertório", async () => {
  const { ACOES_VALIDAS } = remoteControlModule;
  for (const perigosa of ["deletar", "importar", "apagar-repertorio", "trocar-musica"]) {
    assert.ok(!ACOES_VALIDAS.has(perigosa), `"${perigosa}" não deveria ser um comando remoto`);
  }
});
