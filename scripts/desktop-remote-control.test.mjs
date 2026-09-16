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

async function parear(base, pin, nome) {
  const r = await fetch(base + "/parear", {
    method: "POST",
    body: JSON.stringify({ pin, nome }),
  });
  const { token } = await r.json();
  return token;
}

/** Pareia e promove a controle, que é o que a cabine faz com um toque. */
async function parearComControle(rc, base, pin, nome) {
  const token = await parear(base, pin, nome);
  const disp = rc.listarDispositivos()[0];
  rc.definirPermissao(disp.id, "controle");
  return token;
}

test("comando exige sessão válida e ação da lista", async () => {
  const ctx = await subir();
  try {
    const token = await parearComControle(ctx.rc, ctx.base, ctx.pin);
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

test("quem pareia entra sem controle do telão, e a cabine é quem promove", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin, "Celular do João");
    const disp = ctx.rc.listarDispositivos()[0];
    assert.equal(disp.nome, "Celular do João");
    assert.equal(disp.permissao, "chat");

    // Sem permissão: nem telão, nem repertório.
    const semControle = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(semControle.status, 403);
    const semEditor = await fetch(`${ctx.base}/repertorio?token=${token}`);
    assert.equal(semEditor.status, 403);

    // Editor abre o repertório, mas ainda não comanda o telão.
    ctx.rc.definirPermissao(disp.id, "editor");
    assert.equal((await fetch(`${ctx.base}/repertorio?token=${token}`)).status, 200);
    const aindaSemControle = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(aindaSemControle.status, 403);

    // Controle faz tudo que vem antes.
    ctx.rc.definirPermissao(disp.id, "controle");
    assert.equal((await fetch(`${ctx.base}/repertorio?token=${token}`)).status, 200);
    const agora = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(agora.status, 200);
  } finally {
    await derrubar(ctx);
  }
});

test("desconectar um aparelho não derruba os outros", async () => {
  const ctx = await subir();
  try {
    const a = await parearComControle(ctx.rc, ctx.base, ctx.pin, "A");
    const b = await parear(ctx.base, ctx.pin, "B");
    const dispB = ctx.rc.listarDispositivos().find((d) => d.nome === "B");
    ctx.rc.definirPermissao(dispB.id, "controle");

    ctx.rc.desconectar(dispB.id);
    assert.deepEqual(
      ctx.rc.listarDispositivos().map((d) => d.nome),
      ["A"],
    );

    const deB = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token: b, acao: "proximo" }),
    });
    assert.equal(deB.status, 401);
    const deA = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token: a, acao: "proximo" }),
    });
    assert.equal(deA.status, 200);
  } finally {
    await derrubar(ctx);
  }
});

test("chat vai do celular para a cabine e volta, com quem e quando", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin, "Louvor");
    const eventos = [];
    ctx.rc.onEvento = (e) => eventos.push(e);

    const r = await fetch(ctx.base + "/chat", {
      method: "POST",
      body: JSON.stringify({ token, texto: "Repete o refrão." }),
    });
    assert.equal(r.status, 200);
    const { mensagem } = await r.json();
    assert.equal(mensagem.de, "Louvor");
    assert.equal(mensagem.texto, "Repete o refrão.");
    assert.equal(mensagem.daCabine, false);
    assert.ok(mensagem.em > 0);
    assert.equal(eventos.filter((e) => e.tipo === "chat").length, 1);

    // Chat é a permissão mais fraca: até quem só tem chat consegue falar.
    assert.equal(ctx.rc.listarDispositivos()[0].permissao, "chat");

    // E a cabine responde.
    const resposta = ctx.rc.mensagemDaCabine("Repetindo agora.", "Cabine");
    assert.equal(resposta.daCabine, true);
    assert.equal(ctx.rc.chat.length, 2);

    const vazia = await fetch(ctx.base + "/chat", {
      method: "POST",
      body: JSON.stringify({ token, texto: "   " }),
    });
    assert.equal(vazia.status, 400);
  } finally {
    await derrubar(ctx);
  }
});

test("editar letra pelo celular chega à cabine como pedido, não como escrita direta", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin, "Tablet");
    const disp = ctx.rc.listarDispositivos()[0];
    ctx.rc.definirPermissao(disp.id, "editor");
    ctx.rc.atualizarRepertorio([
      { id: "s1", titulo: "Porque Ele Vive", artista: "Gaither", letra: "linha" },
    ]);

    const lista = await (await fetch(`${ctx.base}/repertorio?token=${token}`)).json();
    assert.deepEqual(lista.musicas, [{ id: "s1", titulo: "Porque Ele Vive", artista: "Gaither" }]);

    const uma = await (await fetch(`${ctx.base}/musica?token=${token}&id=s1`)).json();
    assert.equal(uma.musica.letra, "linha");
    assert.equal((await fetch(`${ctx.base}/musica?token=${token}&id=nao-existe`)).status, 404);

    const pedidos = [];
    ctx.rc.onEvento = (e) => e.tipo === "musica" && pedidos.push(e);
    const salvou = await fetch(ctx.base + "/musica", {
      method: "POST",
      body: JSON.stringify({ token, id: "s1", titulo: "Porque Ele Vive", letra: "linha nova" }),
    });
    assert.equal(salvou.status, 200);
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].musica.letra, "linha nova");
    assert.equal(pedidos[0].de, "Tablet");

    // Sem título ou sem letra não salva: o repertório não recebe música vazia.
    for (const corpo of [
      { token, titulo: "", letra: "x" },
      { token, titulo: "Nova", letra: "  " },
    ]) {
      const r = await fetch(ctx.base + "/musica", { method: "POST", body: JSON.stringify(corpo) });
      assert.equal(r.status, 400);
    }
  } finally {
    await derrubar(ctx);
  }
});

test("o SSE abre com o retrato inteiro: estado, permissão e chat de antes", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, ctx.pin, "Celular");
    ctx.rc.atualizarEstado({ titulo: "Hino", slideAtual: 1, slideTotal: 3, noAr: true, preto: false });
    ctx.rc.mensagemDaCabine("Já vai começar", "Cabine");

    const r = await fetch(`${ctx.base}/estado?token=${token}`);
    const leitor = r.body.getReader();
    const bruto = new TextDecoder().decode((await leitor.read()).value);
    const linha = bruto.split("\n").find((l) => l.startsWith("data: "));
    const payload = JSON.parse(linha.slice(6));
    assert.equal(payload.tipo, "inicio");
    assert.equal(payload.estado.titulo, "Hino");
    assert.equal(payload.permissao, "chat");
    assert.equal(payload.nome, "Celular");
    assert.equal(payload.chat.length, 1);
    await leitor.cancel();
  } finally {
    await derrubar(ctx);
  }
});

test("a permissão padrão do pareamento é escolha da cabine", async () => {
  const ctx = await subir();
  try {
    ctx.rc.definirPermissaoPadrao("controle");
    const token = await parear(ctx.base, ctx.pin, "Confiado");
    const r = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(r.status, 200);
    // Valor fora da lista é ignorado em vez de virar permissão inventada.
    ctx.rc.definirPermissaoPadrao("dono-do-mundo");
    assert.equal(ctx.rc.status().permissaoPadrao, "controle");
  } finally {
    await derrubar(ctx);
  }
});

test("o transporte de mídia entrou na lista de ações", async () => {
  const { ACOES_VALIDAS } = remoteControlModule;
  for (const acao of ["tocar", "pausar", "parar-midia"]) {
    assert.equal(ACOES_VALIDAS.has(acao), true, acao);
  }
  // E o que nunca pode continua fora.
  for (const acao of ["trocar-musica", "apagar-repertorio", "salvar"]) {
    assert.equal(ACOES_VALIDAS.has(acao), false, acao);
  }
});
