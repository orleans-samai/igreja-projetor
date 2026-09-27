import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
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
  return { rc, dir, base };
}

async function derrubar({ rc, dir }) {
  rc.desligar();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

test("liga, escuta na rede (0.0.0.0) e desliga", async () => {
  const ctx = await subir();
  try {
    assert.equal(ctx.rc.status().ligado, true);
    const r = await fetch(ctx.base + "/");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<!doctype html>/i);
  } finally {
    await derrubar(ctx);
  }
  assert.equal(ctx.rc.status().ligado, false);
  await assert.rejects(fetch(ctx.base + "/"));
});

test("entrar exige um nome, e o nome é o que a cabine lê", async () => {
  const ctx = await subir();
  try {
    // Sem nome a cabine teria uma fila de aparelhos idênticos e nenhuma forma
    // de escolher entre eles na hora de dar permissão.
    const semNome = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(semNome.status, 400);
    const curto = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({ nome: "a" }),
    });
    assert.equal(curto.status, 400);

    const ok = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({ nome: "Celular do Pastor" }),
    });
    assert.equal(ok.status, 200);
    const corpo = await ok.json();
    assert.ok(corpo.token);
    // Entra no chat e nada além: a barreira é o que se pode fazer, não a porta.
    assert.equal(corpo.permissao, "chat");
    assert.equal(ctx.rc.status().dispositivos[0].nome, "Celular do Pastor");
  } finally {
    await derrubar(ctx);
  }
});

test("cinco tentativas sem nome bloqueiam o IP por um tempo", async () => {
  const ctx = await subir();
  try {
    for (let i = 0; i < 5; i += 1) {
      const r = await fetch(ctx.base + "/parear", { method: "POST", body: JSON.stringify({}) });
      assert.equal(r.status, 400);
    }
    // Não é mais senha para adivinhar, mas continua sendo porta aberta na
    // rede: quem insiste em bater é segurado.
    const bloqueado = await fetch(ctx.base + "/parear", {
      method: "POST",
      body: JSON.stringify({ nome: "Celular" }),
    });
    assert.equal(bloqueado.status, 429);
  } finally {
    await derrubar(ctx);
  }
});

async function parear(base, nome = "Celular") {
  const r = await fetch(base + "/parear", {
    method: "POST",
    body: JSON.stringify({ nome }),
  });
  const { token } = await r.json();
  return token;
}

/** Pareia e promove a controle, que é o que a cabine faz com um toque. */
async function parearComControle(rc, base, nome = "Celular") {
  const token = await parear(base, nome);
  const disp = rc.listarDispositivos()[0];
  rc.definirPermissao(disp.id, "controle");
  return token;
}

test("comando exige sessão válida e ação da lista", async () => {
  const ctx = await subir();
  try {
    const token = await parearComControle(ctx.rc, ctx.base);
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

test("desconectar todos encerra as sessões anteriores", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base);
    const depois = ctx.rc.desconectarTodos();
    assert.equal(depois.dispositivos.length, 0, "a lista de aparelhos devia ficar vazia");

    const comTokenVelho = await fetch(ctx.base + "/comando", {
      method: "POST",
      body: JSON.stringify({ token, acao: "proximo" }),
    });
    assert.equal(comTokenVelho.status, 401, "a sessão de antes não deveria valer mais");
  } finally {
    await derrubar(ctx);
  }
});

test("estado (SSE) exige token e recebe o que a cabine publica", async () => {
  const ctx = await subir();
  try {
    const semToken = await fetch(ctx.base + "/estado");
    assert.equal(semToken.status, 401);

    const token = await parear(ctx.base);
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
    const token = await parear(ctx.base, "Celular do João");
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
    const a = await parearComControle(ctx.rc, ctx.base, "Aparelho A");
    const b = await parear(ctx.base, "Aparelho B");
    const dispB = ctx.rc.listarDispositivos().find((d) => d.nome === "Aparelho B");
    ctx.rc.definirPermissao(dispB.id, "controle");

    ctx.rc.desconectar(dispB.id);
    assert.deepEqual(
      ctx.rc.listarDispositivos().map((d) => d.nome),
      ["Aparelho A"],
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
    const token = await parear(ctx.base, "Louvor");
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
    const token = await parear(ctx.base, "Tablet");
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
    const token = await parear(ctx.base, "Celular");
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
    const token = await parear(ctx.base, "Confiado");
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

/*
 * O endereço que o operador passou para a equipe não pode envelhecer.
 *
 * Antes, cada abertura sorteava porta nova, PIN novo e esquecia todo aparelho
 * pareado: o link mandado no grupo da igreja durante a semana já não existia
 * no domingo. Com o cofre, porta, PIN e pareamentos atravessam o fechar do app.
 */
async function comCofre(dir) {
  const { CofreRemoto } = (await import("../desktop/remote-store.cjs")).default;
  return new CofreRemoto(dir);
}

test("a porta sobrevive a fechar e abrir o app", async () => {
  const dir = await comPagina();
  try {
    const primeira = new RemoteControl(dir, await comCofre(dir));
    const a = await primeira.ligar();
    primeira.desligar();

    const segunda = new RemoteControl(dir, await comCofre(dir));
    const b = await segunda.ligar();
    segunda.desligar();

    assert.equal(b.porta, a.porta, "a porta mudou entre uma abertura e outra");
    assert.equal(a.porta, 8787, "a porta preferida devia ser a 8787");
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("celular pareado continua entrando depois de o app fechar", async () => {
  const dir = await comPagina();
  try {
    const primeira = new RemoteControl(dir, await comCofre(dir));
    const a = await primeira.ligar();
    const parear = await fetch(`http://127.0.0.1:${a.porta}/parear`, {
      method: "POST",
      body: JSON.stringify({ nome: "Celular do Pastor" }),
    });
    const { token } = await parear.json();
    assert.ok(token);
    primeira.desligar();

    const segunda = new RemoteControl(dir, await comCofre(dir));
    const b = await segunda.ligar();
    try {
      // Sem PIN de novo: o mesmo token de uma semana atrás tem que valer.
      const r = await fetch(`http://127.0.0.1:${b.porta}/chat`, {
        method: "POST",
        body: JSON.stringify({ token, texto: "cheguei" }),
      });
      assert.equal(r.status, 200, "o aparelho pareado foi esquecido no fechar");
      assert.equal(
        segunda.status().dispositivos.some((d) => d.nome === "Celular do Pastor"),
        true,
      );
    } finally {
      segunda.desligar();
    }
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("porta ocupada não impede abrir, e a nova vira a preferida", async () => {
  const dir = await comPagina();
  const ocupante = new RemoteControl(await comPagina(), await comCofre(dir));
  try {
    const dela = await ocupante.ligar();
    assert.equal(dela.porta, 8787);

    const outroDir = await comPagina();
    const segunda = new RemoteControl(dir, await comCofre(outroDir));
    const b = await segunda.ligar();
    try {
    assert.notEqual(b.porta, 8787, "devia ter caído para outra porta");
      assert.ok(b.porta > 0);
    } finally {
      segunda.desligar();
    }
    // E a porta de plano B passa a ser a lembrada, para o endereço novo
    // também parar de mudar. Só dá para conferir com a segunda já fechada:
    // enquanto ela segura a porta, ninguém consegue reabri-la.
    const terceira = new RemoteControl(dir, await comCofre(outroDir));
    const c = await terceira.ligar();
    terceira.desligar();
    assert.equal(c.porta, b.porta, "a porta de plano B não foi lembrada");
  } finally {
    ocupante.desligar();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

/*
 * A pasta de mídia do PC, vista do celular — e o caminho de volta: tocar num
 * item manda para o telão, buscar letra na internet é a cabine quem faz.
 */
async function comPermissao(ctx, permissao) {
  const r = await fetch(`${ctx.base}/parear`, {
    method: "POST",
    body: JSON.stringify({ nome: "Celular" }),
  });
  const { token } = await r.json();
  const id = ctx.rc.status().dispositivos[0].id;
  ctx.rc.definirPermissao(id, permissao);
  return token;
}

test("a mídia da cabine chega ao celular, e ver não é mandar para o telão", async () => {
  const ctx = await subir();
  try {
    ctx.rc.atualizarMidia([
      { id: "v1", tipo: "video", titulo: "Chamada do culto", detalhe: "Vídeo" },
      { id: "a1", tipo: "audio", titulo: "Playback", detalhe: "Áudio" },
      { id: "x", tipo: "inventado", titulo: "Estranho" },
    ]);
    const token = await comPermissao(ctx, "editor");
    const lista = await (await fetch(`${ctx.base}/midia?token=${token}`)).json();
    assert.equal(lista.ok, true);
    assert.equal(lista.midia.length, 3);
    // Tipo que não existe vira vídeo em vez de vazar para o celular.
    assert.equal(lista.midia[2].tipo, "video");

    // Editor vê a pasta, mas não muda o que a igreja está vendo.
    const negado = await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "media", refId: "v1" }),
    });
    assert.equal(negado.status, 403);
  } finally {
    await derrubar(ctx);
  }
});

test("projetar pelo celular chega à cabine como pedido, com o item", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  try {
    const token = await comPermissao(ctx, "controle");
    const ok = await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "media", refId: "v1" }),
    });
    assert.equal(ok.status, 200);
    const pedido = vistos.find((e) => e.tipo === "projetar");
    assert.deepEqual(
      { tipo: pedido.tipo, kind: pedido.kind, refId: pedido.refId },
      { tipo: "projetar", kind: "media", refId: "v1" },
    );

    // Tipo fora da lista não vira comando: o celular não escolhe o que o
    // telão sabe desenhar.
    const recusado = await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "planilha", refId: "v1" }),
    });
    assert.equal(recusado.status, 400);
  } finally {
    await derrubar(ctx);
  }
});

test("o dirigente conversa no mesmo mural do celular, e o aviso vira texto", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  try {
    await ctx.rc.definirSenhaDirigente("cordeiro-de-deus");
    const entrou = await (
      await fetch(`${ctx.base}/dirigente/entrar`, {
        method: "POST",
        body: JSON.stringify({ senha: "cordeiro-de-deus" }),
      })
    ).json();
    assert.equal(entrou.ok, true);
    const chave = { "x-lumen-dirigente": entrou.token };

    // O recado do dirigente entra no mesmo mural que o celular lê.
    const recado = await fetch(`${ctx.base}/dirigente/chat`, {
      method: "POST",
      headers: chave,
      body: JSON.stringify({ texto: "Chegamos com o pen drive", de: "Pastor Elias" }),
    });
    assert.equal(recado.status, 200);
    const noMural = ctx.rc.chat.at(-1);
    assert.equal(noMural.de, "Pastor Elias");
    assert.equal(noMural.texto, "Chegamos com o pen drive");
    assert.equal(noMural.daCabine, false);
    // E a cabine é avisada, senão o operador só veria ao recarregar.
    assert.equal(vistos.filter((e) => e.tipo === "chat").length, 1);

    // A página é uma pessoa só: recado sem nome, da mesma página, continua
    // sendo de quem entrou — é o que faz "para o Pastor" e @nome chegarem.
    await fetch(`${ctx.base}/dirigente/chat`, {
      method: "POST",
      headers: chave,
      body: JSON.stringify({ texto: "oi" }),
    });
    assert.equal(ctx.rc.chat.at(-1).de, "Pastor Elias");

    // Página nova, que nunca disse o nome, aparece como "Dirigente".
    const outra = await (
      await fetch(`${ctx.base}/dirigente/entrar`, {
        method: "POST",
        body: JSON.stringify({ senha: "cordeiro-de-deus" }),
      })
    ).json();
    await fetch(`${ctx.base}/dirigente/chat`, {
      method: "POST",
      headers: { "x-lumen-dirigente": outra.token },
      body: JSON.stringify({ texto: "oi" }),
    });
    assert.equal(ctx.rc.chat.at(-1).de, "Dirigente");

    // Vazio não vira mensagem em branco no mural de ninguém.
    const vazio = await fetch(`${ctx.base}/dirigente/chat`, {
      method: "POST",
      headers: chave,
      body: JSON.stringify({ texto: "   ", de: "Pastor Elias" }),
    });
    assert.equal(vazio.status, 400);

    // O aviso escrito é outra coisa: vai para a biblioteca, não para o chat.
    const aviso = await fetch(`${ctx.base}/dirigente/aviso`, {
      method: "POST",
      headers: chave,
      body: JSON.stringify({ titulo: "Santa Ceia", texto: "Domingo, às 19h", de: "Pastor Elias" }),
    });
    assert.equal(aviso.status, 200);
    const guardado = vistos.at(-1);
    assert.deepEqual(
      { tipo: guardado.tipo, titulo: guardado.titulo, texto: guardado.texto, de: guardado.de },
      { tipo: "aviso", titulo: "Santa Ceia", texto: "Domingo, às 19h", de: "Pastor Elias" },
    );
    // Aviso sem título não entra na biblioteca sem nome.
    const semTitulo = await fetch(`${ctx.base}/dirigente/aviso`, {
      method: "POST",
      headers: chave,
      body: JSON.stringify({ titulo: "", texto: "algo" }),
    });
    assert.equal(semTitulo.status, 400);

    // Sem a sessão, nada disso abre — é a senha que segura esta porta.
    for (const rota of ["/dirigente/chat", "/dirigente/aviso"]) {
      const r = await fetch(ctx.base + rota, {
        method: "POST",
        headers: { "x-lumen-dirigente": "token-inventado" },
        body: JSON.stringify({ texto: "entrei", titulo: "t", de: "x" }),
      });
      assert.equal(r.status, 401, rota);
    }
    const fluxo = await fetch(`${ctx.base}/dirigente/estado?token=token-inventado`);
    assert.equal(fluxo.status, 401);
  } finally {
    await derrubar(ctx);
  }
});

test("quem mandou o arquivo chega junto com o arquivo", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  ctx.rc.aoReceberArquivo = async (nome) => ({
    ok: true,
    nome,
    kind: "image",
    id: "m1",
    projetavel: true,
  });
  try {
    await ctx.rc.definirSenhaDirigente("cordeiro-de-deus");
    const { token } = await (
      await fetch(`${ctx.base}/dirigente/entrar`, {
        method: "POST",
        body: JSON.stringify({ senha: "cordeiro-de-deus" }),
      })
    ).json();

    await fetch(`${ctx.base}/dirigente/enviar`, {
      method: "POST",
      headers: {
        "x-lumen-dirigente": token,
        "x-lumen-arquivo": encodeURIComponent("Fundo Alvorada.jpg"),
        "x-lumen-de": encodeURIComponent("Pastor Elias"),
      },
      body: "conteudo",
    });
    assert.equal(vistos.at(-1).de, "Pastor Elias");

    // Sem o cabeçalho, o arquivo chega do mesmo jeito — só sem o nome.
    await fetch(`${ctx.base}/dirigente/enviar`, {
      method: "POST",
      headers: {
        "x-lumen-dirigente": token,
        "x-lumen-arquivo": encodeURIComponent("Outro.jpg"),
      },
      body: "conteudo",
    });
    assert.equal(vistos.at(-1).de, "");
  } finally {
    await derrubar(ctx);
  }
});

test("a grade do celular pede um slide, e índice inventado é recusado", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  try {
    const token = await comPermissao(ctx, "controle");

    const ok = await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "song", refId: "s1", slide: 3 }),
    });
    assert.equal(ok.status, 200);
    assert.equal(vistos.at(-1).slide, 3);

    // O primeiro slide é o zero, e zero não pode virar "sem slide": seria a
    // música começando do começo quando a pessoa tocou na primeira estrofe.
    await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "song", refId: "s1", slide: 0 }),
    });
    assert.equal(vistos.at(-1).slide, 0);

    // Sem slide o item vai inteiro — é o caminho da lista de mídia.
    await fetch(`${ctx.base}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token, tipo: "media", refId: "v1" }),
    });
    assert.equal(vistos.at(-1).slide, undefined);

    // Índice fora da faixa é recusado em vez de aparado: aparar mandaria
    // para o telão um slide que não é o que a pessoa tocou.
    const quantos = vistos.length;
    for (const slide of [-1, 1.5, 99999, "abc", {}]) {
      const r = await fetch(`${ctx.base}/projetar`, {
        method: "POST",
        body: JSON.stringify({ token, tipo: "song", refId: "s1", slide }),
      });
      assert.equal(r.status, 400, `slide ${slide} devia ser recusado`);
    }
    assert.equal(vistos.length, quantos);
  } finally {
    await derrubar(ctx);
  }
});

test("a música chega ao celular com slides e com a cara do tema", async () => {
  const ctx = await subir();
  try {
    const token = await comPermissao(ctx, "editor");
    ctx.rc.atualizarRepertorio([
      {
        id: "s1",
        titulo: "Porque Ele Vive",
        artista: "Gaither",
        letra: "linha",
        tema: "t-foto",
        slides: [{ rotulo: "Verso 1", texto: "Deus enviou seu Filho amado" }],
      },
    ]);
    ctx.rc.atualizarTemas([
      {
        id: "t-cor",
        fundo: "linear-gradient(#000, #111)",
        imagem: "",
        cor: "#fff",
        maiusculas: false,
      },
      {
        id: "t-foto",
        // Fundo com url() não passa: esta página não faz requisição para
        // fora, e um tema não vai ser o primeiro a fazer.
        fundo: "url(http://fora/imagem.png)",
        imagem: "data:image/jpeg;base64,AAAA",
        cor: "#ffeecc",
        maiusculas: true,
      },
      { id: "t-mau", fundo: "", imagem: "javascript:alert(1)", cor: "#fff", maiusculas: false },
    ]);

    const r = await (await fetch(`${ctx.base}/musica?token=${token}&id=s1`)).json();
    assert.equal(r.musica.slides[0].texto, "Deus enviou seu Filho amado");
    assert.equal(r.tema.id, "t-foto");
    assert.equal(r.tema.fundo, "");
    assert.equal(r.tema.imagem, "data:image/jpeg;base64,AAAA");
    assert.equal(r.tema.maiusculas, true);

    // Só `data:image/jpeg` vira capa; o resto some.
    assert.equal(ctx.rc.temas.find((t) => t.id === "t-mau").imagem, "");
    assert.equal(ctx.rc.temas.find((t) => t.id === "t-cor").fundo, "linear-gradient(#000, #111)");

    // Música com tema que a cabine não mandou cai no primeiro, em vez de
    // deixar a grade sem fundo nenhum.
    ctx.rc.atualizarRepertorio([{ id: "s2", titulo: "Outra", artista: "", letra: "", tema: "sumiu", slides: [] }]);
    const outra = await (await fetch(`${ctx.base}/musica?token=${token}&id=s2`)).json();
    assert.equal(outra.tema.id, "t-cor");
  } finally {
    await derrubar(ctx);
  }
});

test("buscar letra na internet é a cabine quem faz, e o celular espera", async () => {
  const ctx = await subir();
  try {
    ctx.rc.onEvento = (e) => {
      if (e.tipo === "buscar-musica") {
        assert.equal(e.termo, "castelo forte");
        ctx.rc.responderPedido(e.pedido, {
          achados: [{ titulo: "Castelo Forte", artista: "Lutero", fonte: "https://x/y" }],
        });
      }
      if (e.tipo === "letra-musica") {
        assert.equal(e.fonte, "https://x/y");
        ctx.rc.responderPedido(e.pedido, { letra: "Castelo forte é nosso Deus" });
      }
    };
    const token = await comPermissao(ctx, "editor");

    const busca = await (
      await fetch(`${ctx.base}/buscar`, {
        method: "POST",
        body: JSON.stringify({ token, termo: "castelo forte" }),
      })
    ).json();
    assert.equal(busca.achados.length, 1);
    assert.equal(busca.achados[0].titulo, "Castelo Forte");

    const letra = await (
      await fetch(`${ctx.base}/letra`, {
        method: "POST",
        body: JSON.stringify({ token, fonte: busca.achados[0].fonte }),
      })
    ).json();
    assert.match(letra.letra, /Castelo forte/);

    // Endereço que não é http não vira pedido à cabine.
    const ruim = await fetch(`${ctx.base}/letra`, {
      method: "POST",
      body: JSON.stringify({ token, fonte: "file:///C:/senhas.txt" }),
    });
    assert.equal(ruim.status, 400);
  } finally {
    await derrubar(ctx);
  }
});

test("cabine muda não deixa o celular girando para sempre", async () => {
  const ctx = await subir();
  try {
    // Sem onEvento — é a janela da cabine fechada, ou travada.
    ctx.rc.onEvento = null;
    const token = await comPermissao(ctx, "editor");
    const r = await fetch(`${ctx.base}/buscar`, {
      method: "POST",
      body: JSON.stringify({ token, termo: "qualquer coisa" }),
    });
    const d = await r.json();
    assert.equal(r.status, 504);
    assert.match(d.erro, /não respondeu/i);
  } finally {
    await derrubar(ctx);
  }
});

test("o nome na rede sobe com o servidor e cai junto", async () => {
  const dir = await comPagina();
  const { Anunciante } = (await import("../desktop/mdns.cjs")).default;
  // Porta 0: o nome é provado de verdade nos testes de mDNS; aqui o que
  // importa é que o servidor o acende, o apaga e conta isso à cabine.
  const anunciante = new Anunciante({ nome: "lumen", porta: 0, enderecos: () => ["192.168.0.5"] });
  const rc = new RemoteControl(dir, null, anunciante);
  try {
    assert.equal(rc.status().nomeLocal, null, "o nome não existe com o servidor desligado");
    await rc.ligar();
    assert.equal(rc.status().nomeLocal, "lumen.local");
    assert.equal(anunciante.ativo, true);
    rc.desligar();
    assert.equal(anunciante.ativo, false, "o nome ficou de pé depois de desligar");
    assert.equal(rc.status().nomeLocal, null);
  } finally {
    anunciante.desligar();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("o celular recebe o endereço que não vence, quando existe", async () => {
  const dir = await comPagina();
  const { Anunciante } = (await import("../desktop/mdns.cjs")).default;
  const anunciante = new Anunciante({ nome: "lumen", porta: 0, enderecos: () => ["192.168.0.5"] });
  const rc = new RemoteControl(dir, null, anunciante);
  const status = await rc.ligar();
  const base = `http://127.0.0.1:${status.porta}`;
  try {
    const { token } = await (
      await fetch(`${base}/parear`, { method: "POST", body: JSON.stringify({ nome: "Celular" }) })
    ).json();
    const fluxo = await fetch(`${base}/estado?token=${token}`);
    const leitor = fluxo.body.getReader();
    const primeiro = new TextDecoder().decode((await leitor.read()).value);
    const inicio = JSON.parse(
      (primeiro.match(/data: (.*)/) ?? [])[1] ??
        new TextDecoder().decode((await leitor.read()).value).match(/data: (.*)/)[1],
    );
    assert.equal(inicio.tipo, "inicio");
    assert.equal(inicio.enderecoFixo, `http://lumen.local:${status.porta}`);
    await leitor.cancel();
  } finally {
    rc.desligar();
    anunciante.desligar();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("o volume do telão vem do celular, e só de quem controla", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  try {
    const soChat = await parear(ctx.base, "Visitante");
    const negado = await fetch(ctx.base + "/volume", {
      method: "POST",
      body: JSON.stringify({ token: soChat, valor: 50 }),
    });
    // Som que a igreja inteira escuta não é preferência de aparelho.
    assert.equal(negado.status, 403);

    const token = await parearComControle(ctx.rc, ctx.base, "Mesa de som");
    const ok = await fetch(ctx.base + "/volume", {
      method: "POST",
      body: JSON.stringify({ token, valor: 35 }),
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(
      vistos.filter((e) => e.tipo === "volume").map((e) => e.valor),
      [35],
    );

    for (const valor of [-1, 101, "alto", null]) {
      const r = await fetch(ctx.base + "/volume", {
        method: "POST",
        body: JSON.stringify({ token, valor }),
      });
      assert.equal(r.status, 400, `volume ${valor} devia ser recusado`);
    }
  } finally {
    await derrubar(ctx);
  }
});

test("recado falado chega ao chat, e formato estranho não", async () => {
  const ctx = await subir();
  const vistos = [];
  ctx.rc.onEvento = (e) => vistos.push(e);
  try {
    // Só chat basta: falar é a coisa mais básica que o aparelho faz aqui.
    const token = await parear(ctx.base, "Ministério");
    const ok = await fetch(ctx.base + "/voz", {
      method: "POST",
      body: JSON.stringify({
        token,
        audio: "data:audio/webm;codecs=opus;base64,AAAAAAAAAAAA",
        segundos: 7,
      }),
    });
    assert.equal(ok.status, 200);
    const msg = vistos.find((e) => e.tipo === "chat")?.mensagem;
    assert.ok(msg.audio.startsWith("data:audio/webm"));
    assert.equal(msg.segundos, 7);
    assert.equal(msg.de, "Ministério");
    // Recado falado não precisa de texto escrito.
    assert.equal(msg.texto, "");

    // Uma imagem disfarçada de recado não entra no chat da cabine.
    const imagem = await fetch(ctx.base + "/voz", {
      method: "POST",
      body: JSON.stringify({ token, audio: "data:image/png;base64,AAAA" }),
    });
    assert.equal(imagem.status, 400);

    // Duração absurda é aparada, não aceita como veio.
    await fetch(ctx.base + "/voz", {
      method: "POST",
      body: JSON.stringify({ token, audio: "data:audio/ogg;base64,AAAA", segundos: 99999 }),
    });
    const ultima = ctx.rc.chat[ctx.rc.chat.length - 1];
    assert.equal(ultima.segundos, 120);
  } finally {
    await derrubar(ctx);
  }
});

test("a página do dirigente não abre sem senha, e a senha não fica no disco em claro", async () => {
  const dir = await comPagina();
  const cofreModule = (await import("../desktop/remote-store.cjs")).default;
  const rc = new RemoteControl(dir, new cofreModule.CofreRemoto(dir));
  const recebidos = [];
  rc.aoReceberArquivo = async (nome, dados) => {
    recebidos.push({ nome, bytes: dados.length });
    return { ok: true, nome, kind: null, id: null, projetavel: false };
  };
  const status = await rc.ligar();
  const base = `http://127.0.0.1:${status.porta}`;
  try {
    // Sem senha definida, receber arquivo de qualquer um na Wi-Fi seria
    // deixar a porta encostada.
    assert.equal(rc.status().temSenhaDirigente, false);
    const fechada = await fetch(`${base}/dirigente/entrar`, {
      method: "POST",
      body: JSON.stringify({ senha: "qualquer" }),
    });
    assert.equal(fechada.status, 403);

    rc.definirSenhaDirigente("culto2026");
    assert.equal(rc.status().temSenhaDirigente, true);

    const errada = await fetch(`${base}/dirigente/entrar`, {
      method: "POST",
      body: JSON.stringify({ senha: "culto2025" }),
    });
    assert.equal(errada.status, 401);

    const certa = await fetch(`${base}/dirigente/entrar`, {
      method: "POST",
      body: JSON.stringify({ senha: "culto2026" }),
    });
    const { token } = await certa.json();
    assert.ok(token);

    // Sem token, ninguém larga arquivo no computador da igreja.
    const semToken = await fetch(`${base}/dirigente/enviar`, {
      method: "POST",
      headers: { "x-lumen-arquivo": "culto.pptx" },
      body: Buffer.from("PK"),
    });
    assert.equal(semToken.status, 401);

    const enviou = await fetch(`${base}/dirigente/enviar`, {
      method: "POST",
      headers: { "x-lumen-dirigente": token, "x-lumen-arquivo": encodeURIComponent("culto domingo.pptx") },
      body: Buffer.from("PK conteúdo"),
    });
    assert.equal(enviou.status, 200);
    assert.equal(recebidos[0].nome, "culto domingo.pptx");

    // O que fica no disco é o resultado do scrypt, nunca a senha.
    const guardado = await readFile(path.join(dir, "remote.json"), "utf8");
    assert.ok(!guardado.includes("culto2026"), "a senha foi parar no disco em texto claro");
    assert.match(guardado, /"sal":/);
  } finally {
    rc.desligar();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("a capa da mídia só passa se for um JPEG que a cabine gerou", async () => {
  const ctx = await subir();
  try {
    ctx.rc.atualizarMidia([
      { id: "v1", tipo: "video", titulo: "Chamada", capa: "data:image/jpeg;base64,AAAA", segundos: 268 },
      // Endereço de fora viraria uma requisição que o celular faria para a
      // internet — e esta página não faz requisição para fora.
      { id: "v2", tipo: "video", titulo: "Outro", capa: "https://exemplo.com/foto.jpg", segundos: 10 },
      { id: "v3", tipo: "video", titulo: "Terceiro", capa: "data:text/html,<script>x</script>" },
      { id: "v4", tipo: "image", titulo: "Foto", segundos: -5 },
    ]);
    const token = await comPermissao(ctx, "editor");
    const { midia } = await (await fetch(`${ctx.base}/midia?token=${token}`)).json();
    assert.equal(midia[0].capa, "data:image/jpeg;base64,AAAA");
    assert.equal(midia[0].segundos, 268);
    assert.equal(midia[1].capa, "", "endereço de fora não pode virar capa");
    assert.equal(midia[2].capa, "", "data: de outro tipo não pode virar capa");
    // Duração negativa não existe; vira zero em vez de aparecer na tela.
    assert.equal(midia[3].segundos, 0);
  } finally {
    await derrubar(ctx);
  }
});

test("capa gigante é aparada antes de ir para o celular", async () => {
  const ctx = await subir();
  try {
    ctx.rc.atualizarMidia([
      { id: "v1", tipo: "video", titulo: "Chamada", capa: "data:image/jpeg;base64," + "A".repeat(500000) },
    ]);
    const token = await comPermissao(ctx, "editor");
    const { midia } = await (await fetch(`${ctx.base}/midia?token=${token}`)).json();
    assert.ok(midia[0].capa.length <= 96 * 1024, String(midia[0].capa.length));
  } finally {
    await derrubar(ctx);
  }
});

test("mídia nova chega ao celular na hora, pelo fluxo de eventos", async () => {
  const ctx = await subir();
  try {
    const token = await comPermissao(ctx, "editor");
    const controlador = new AbortController();
    const resposta = await fetch(`${ctx.base}/estado?token=${token}`, { signal: controlador.signal });
    const leitor = resposta.body.getReader();

    ctx.rc.atualizarMidia([{ id: "midia:video:Chamada.mp4", tipo: "video", titulo: "Chamada" }]);
    let bruto = "";
    while (!bruto.includes('"tipo":"midia"')) {
      const { value, done } = await leitor.read();
      if (done) break;
      bruto += Buffer.from(value).toString("utf8");
    }
    // O aviso não carrega a lista: ver a mídia exige permissão de editor, e
    // o fluxo chega a todo aparelho pareado.
    assert.match(bruto, /"tipo":"midia"}/);
    assert.ok(!bruto.includes("Chamada"), "o aviso não pode levar os nomes da pasta");
    controlador.abort();

    const { midia } = await (await fetch(`${ctx.base}/midia?token=${token}`)).json();
    assert.deepEqual(
      midia.map((m) => m.titulo),
      ["Chamada"],
    );
  } finally {
    await derrubar(ctx);
  }
});

test("a mesma lista reenviada não avisa, e a capa que já veio não some", async () => {
  const ctx = await subir();
  try {
    const avisos = [];
    const transmitir = ctx.rc._transmitir.bind(ctx.rc);
    ctx.rc._transmitir = (payload) => {
      avisos.push(payload.tipo);
      transmitir(payload);
    };
    const soNomes = [{ id: "v1", tipo: "video", titulo: "Chamada" }];
    ctx.rc.atualizarMidia(soNomes);
    assert.deepEqual(avisos, ["midia"]);

    // Trocar o item no ar reenvia a mesma pasta: nada mudou, nada de aviso.
    ctx.rc.atualizarMidia(soNomes);
    assert.deepEqual(avisos, ["midia"]);

    // Chegou a capa: vale avisar, para o celular desenhá-la.
    ctx.rc.atualizarMidia([
      { id: "v1", tipo: "video", titulo: "Chamada", capa: "data:image/jpeg;base64,AAAA", segundos: 30 },
    ]);
    assert.deepEqual(avisos, ["midia", "midia"]);

    // A cabine manda primeiro só os nomes; a capa de antes fica até a nova chegar.
    ctx.rc.atualizarMidia(soNomes);
    assert.deepEqual(avisos, ["midia", "midia"], "reenviar só os nomes não pode apagar a capa");
    ctx.rc.atualizarMidia([...soNomes, { id: "i1", tipo: "image", titulo: "Foto nova" }]);
    assert.deepEqual(avisos, ["midia", "midia", "midia"]);

    const token = await comPermissao(ctx, "editor");
    const { midia } = await (await fetch(`${ctx.base}/midia?token=${token}`)).json();
    const chamada = midia.find((m) => m.id === "v1");
    assert.equal(chamada.capa, "data:image/jpeg;base64,AAAA");
    assert.equal(chamada.segundos, 30);
    assert.ok(midia.some((m) => m.titulo === "Foto nova"));
  } finally {
    await derrubar(ctx);
  }
});

const CULTO = {
  nome: "Domingo 19h",
  itens: [
    { id: "i1", titulo: "Boas-vindas", tipo: "text", detalhe: "", etapa: "pendente" },
    { id: "i2", titulo: "Cântico da alvorada", tipo: "song", detalhe: "Coletivo", etapa: "no-ar" },
    { id: "i3", titulo: "João 3:16", tipo: "bible", detalhe: "Almeida", etapa: "proximo" },
  ],
};

async function postar(ctx, rota, corpo) {
  const r = await fetch(`${ctx.base}${rota}`, { method: "POST", body: JSON.stringify(corpo) });
  return { status: r.status, corpo: await r.json() };
}

test("a programação do culto chega ao celular de editor, e não ao de só chat", async () => {
  const ctx = await subir();
  try {
    ctx.rc.atualizarCulto(CULTO);
    const soChat = await parear(ctx.base);
    assert.equal((await fetch(`${ctx.base}/culto?token=${soChat}`)).status, 403);

    const editor = await comPermissao(ctx, "editor");
    const { culto } = await (await fetch(`${ctx.base}/culto?token=${editor}`)).json();
    assert.equal(culto.nome, "Domingo 19h");
    assert.deepEqual(culto.itens.map((i) => [i.titulo, i.etapa]), [
      ["Boas-vindas", "pendente"],
      ["Cântico da alvorada", "no-ar"],
      ["João 3:16", "proximo"],
    ]);
  } finally {
    await derrubar(ctx);
  }
});

test("mudou a programação, o celular é avisado; a mesma reenviada, não", async () => {
  const ctx = await subir();
  try {
    const avisos = [];
    const transmitir = ctx.rc._transmitir.bind(ctx.rc);
    ctx.rc._transmitir = (payload) => {
      avisos.push(payload.tipo);
      transmitir(payload);
    };
    ctx.rc.atualizarCulto(CULTO);
    ctx.rc.atualizarCulto(CULTO);
    assert.deepEqual(avisos, ["culto"]);
    ctx.rc.atualizarCulto({ ...CULTO, itens: CULTO.itens.slice(1) });
    assert.deepEqual(avisos, ["culto", "culto"]);
    // Etapa ou tipo inventados não passam adiante.
    ctx.rc.atualizarCulto({ nome: "X", itens: [{ id: "z", titulo: "Z", tipo: "script", etapa: "hackeado" }] });
    assert.deepEqual(ctx.rc.culto.itens[0], { id: "z", titulo: "Z", tipo: "outro", detalhe: "", etapa: "pendente" });
  } finally {
    await derrubar(ctx);
  }
});

test("excluir do culto pelo celular é de editor e só vale para item que está lá", async () => {
  const ctx = await subir();
  const vistos = [];
  // Parear também avisa a cabine ("dispositivos"); aqui só interessa o culto.
  ctx.rc.onEvento = (e) => e.tipo.startsWith("culto-") && vistos.push(e);
  try {
    ctx.rc.atualizarCulto(CULTO);
    const soChat = await parear(ctx.base);
    assert.equal((await postar(ctx, "/culto/remover", { token: soChat, id: "i3" })).status, 403);

    const editor = await comPermissao(ctx, "editor");
    const inventado = await postar(ctx, "/culto/remover", { token: editor, id: "nao-existe" });
    assert.equal(inventado.status, 404);
    assert.equal(vistos.length, 0);

    const ok = await postar(ctx, "/culto/remover", { token: editor, id: "i3" });
    assert.equal(ok.status, 200);
    assert.equal(vistos.length, 1);
    assert.equal(vistos[0].tipo, "culto-remover");
    assert.equal(vistos[0].id, "i3");
    assert.equal(vistos[0].titulo, "João 3:16");
    // Some daqui na hora, sem esperar a cabine confirmar.
    const { culto } = await (await fetch(`${ctx.base}/culto?token=${editor}`)).json();
    assert.deepEqual(culto.itens.map((i) => i.id), ["i1", "i2"]);
  } finally {
    await derrubar(ctx);
  }
});

test("projetar um item do culto pelo celular exige o controle do telão", async () => {
  const ctx = await subir();
  const vistos = [];
  // Parear também avisa a cabine ("dispositivos"); aqui só interessa o culto.
  ctx.rc.onEvento = (e) => e.tipo.startsWith("culto-") && vistos.push(e);
  try {
    ctx.rc.atualizarCulto(CULTO);
    const editor = await comPermissao(ctx, "editor");
    assert.equal((await postar(ctx, "/culto/projetar", { token: editor, id: "i3" })).status, 403);
    const controle = await comPermissao(ctx, "controle");
    assert.equal((await postar(ctx, "/culto/projetar", { token: controle, id: "i3" })).status, 200);
    assert.deepEqual(
      vistos.map((e) => [e.tipo, e.id]),
      [["culto-projetar", "i3"]],
    );
    // Projetar não tira nada da programação.
    assert.equal(ctx.rc.culto.itens.length, 3);
  } finally {
    await derrubar(ctx);
  }
});

/* ───────────────────────── chat da equipe: destino, presença, moderação, fotos */

/** Abre o fluxo de eventos de um aparelho e junta o que chega. */
async function fluxo(ctx, token) {
  const controlador = new AbortController();
  const resposta = await fetch(`${ctx.base}/estado?token=${token}`, { signal: controlador.signal });
  const eventos = [];
  const leitor = resposta.body.getReader();
  let resto = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += Buffer.from(value).toString("utf8");
        let fim;
        while ((fim = resto.indexOf("\n\n")) >= 0) {
          const bloco = resto.slice(0, fim);
          resto = resto.slice(fim + 2);
          for (const linha of bloco.split("\n")) {
            if (linha.startsWith("data: ")) eventos.push(JSON.parse(linha.slice(6)));
          }
        }
      }
    } catch {
      /* fluxo fechado */
    }
  })();
  const esperar = async (achar, ms = 2000) => {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      const e = eventos.find(achar);
      if (e) return e;
      await new Promise((ok) => setTimeout(ok, 20));
    }
    return null;
  };
  await esperar((e) => e.tipo === "inicio");
  return { eventos, esperar, fechar: () => controlador.abort() };
}

/** Três aparelhos: Caio (Som), Bia (Louvor) e Zé (sem equipe), com o chat aberto. */
async function equipeNoChat(ctx) {
  const pessoas = {};
  for (const [nome, equipe] of [["Caio", "som"], ["Bia", "louvor"], ["Zé", ""]]) {
    const token = await parear(ctx.base, nome);
    const id = ctx.rc.dispositivos.get(token).id;
    if (equipe) {
      const r = await fetch(`${ctx.base}/chat/equipe`, { method: "POST", body: JSON.stringify({ token, equipe }) });
      assert.equal(r.status, 200);
    }
    pessoas[nome] = { token, id, fluxo: await fluxo(ctx, token) };
  }
  return pessoas;
}

const chatDe = (texto) => (e) => e.tipo === "chat" && e.mensagem.texto === texto;
const escrever = (ctx, token, texto, para) =>
  fetch(`${ctx.base}/chat`, { method: "POST", body: JSON.stringify({ token, texto, para }) });
const semEsperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

test("recado para uma equipe chega só a ela; quem escreveu e a cabine também leem", async () => {
  const ctx = await subir();
  const cabine = [];
  ctx.rc.onEvento = (e) => e.tipo === "chat" && cabine.push(e.mensagem);
  const p = await equipeNoChat(ctx);
  try {
    const r = await escrever(ctx, p.Caio.token, "Sobe o retorno do teclado", { tipo: "equipe", equipe: "louvor" });
    assert.equal(r.status, 200);
    assert.ok(await p.Bia.fluxo.esperar(chatDe("Sobe o retorno do teclado")), "a equipe do Louvor não recebeu");
    assert.ok(await p.Caio.fluxo.esperar(chatDe("Sobe o retorno do teclado")), "quem escreveu não viu o próprio recado");
    await semEsperar(300);
    assert.equal(p.Zé.fluxo.eventos.some(chatDe("Sobe o retorno do teclado")), false, "chegou a quem não era do Louvor");
    assert.equal(cabine.length, 1);
    assert.deepEqual(cabine[0].para, { tipo: "equipe", equipe: "louvor" });

    // Recado direto da cabine: só a pessoa.
    ctx.rc.mensagemDaCabine("Bia, pode entrar", "Operador", { tipo: "pessoa", id: p.Bia.id, nome: "Bia" });
    assert.ok(await p.Bia.fluxo.esperar(chatDe("Bia, pode entrar")));
    await semEsperar(300);
    assert.equal(p.Caio.fluxo.eventos.some(chatDe("Bia, pode entrar")), false);
    assert.equal(p.Zé.fluxo.eventos.some(chatDe("Bia, pode entrar")), false);
  } finally {
    Object.values(p).forEach((x) => x.fluxo.fechar());
    await derrubar(ctx);
  }
});

test("@nome chega a quem foi citado, mesmo fora da equipe do recado", async () => {
  const ctx = await subir();
  const p = await equipeNoChat(ctx);
  try {
    await escrever(ctx, p.Caio.token, "@Zé confere o cabo do púlpito", { tipo: "equipe", equipe: "som" });
    const recebido = await p.Zé.fluxo.esperar(chatDe("@Zé confere o cabo do púlpito"));
    assert.ok(recebido, "quem foi citado não recebeu");
    assert.deepEqual(recebido.mensagem.mencoes.map((m) => m.nome), ["Zé"]);
    await semEsperar(300);
    assert.equal(p.Bia.fluxo.eventos.some(chatDe("@Zé confere o cabo do púlpito")), false);
  } finally {
    Object.values(p).forEach((x) => x.fluxo.fechar());
    await derrubar(ctx);
  }
});

test("quem está no chat e quem está digitando", async () => {
  const ctx = await subir();
  const p = await equipeNoChat(ctx);
  try {
    const nomes = (e) => e.pessoas.map((x) => x.nome).sort();
    const todos = await p.Zé.fluxo.esperar((e) => e.tipo === "presenca" && e.pessoas.length === 4);
    assert.deepEqual(nomes(todos), ["Bia", "Cabine", "Caio", "Zé"]);
    assert.equal(todos.pessoas.find((x) => x.nome === "Bia").equipe, "louvor");

    // Digitando para o Louvor: a Bia vê, o Zé não.
    await fetch(`${ctx.base}/chat/digitando`, {
      method: "POST",
      body: JSON.stringify({ token: p.Caio.token, para: { tipo: "equipe", equipe: "louvor" } }),
    });
    assert.ok(await p.Bia.fluxo.esperar((e) => e.tipo === "digitando" && e.de === "Caio"));
    await semEsperar(300);
    assert.equal(p.Zé.fluxo.eventos.some((e) => e.tipo === "digitando"), false);

    // Fechou o chat, saiu da lista.
    p.Bia.fluxo.fechar();
    const semBia = await p.Zé.fluxo.esperar((e) => e.tipo === "presenca" && !e.pessoas.some((x) => x.nome === "Bia"));
    assert.ok(semBia, "a Bia continuou na lista depois de sair");
  } finally {
    Object.values(p).forEach((x) => x.fluxo.fechar());
    await derrubar(ctx);
  }
});

test("a cabine apaga um recado e silencia um aparelho", async () => {
  const ctx = await subir();
  const p = await equipeNoChat(ctx);
  try {
    await escrever(ctx, p.Zé.token, "recado errado", undefined);
    const msg = ctx.rc.chat.at(-1);
    assert.equal(ctx.rc.apagarMensagem(msg.id).ok, true);
    assert.ok(await p.Bia.fluxo.esperar((e) => e.tipo === "chat-apagada" && e.id === msg.id));
    assert.equal(ctx.rc.chat.at(-1).apagada, true);
    assert.equal(ctx.rc.chat.at(-1).texto, "");

    // Silenciado: continua lendo, não escreve.
    assert.equal(ctx.rc.silenciar(p.Zé.id, 5).ok, true);
    const aviso = await p.Zé.fluxo.esperar((e) => e.tipo === "silenciado");
    assert.ok(aviso.ate > Date.now());
    assert.equal((await escrever(ctx, p.Zé.token, "posso falar?")).status, 403);
    const lista = await p.Bia.fluxo.esperar(
      (e) => e.tipo === "presenca" && e.pessoas.some((x) => x.nome === "Zé" && x.silenciado),
    );
    assert.ok(lista, "a lista não mostrou o Zé silenciado");

    ctx.rc.silenciar(p.Zé.id, 0);
    assert.equal((await escrever(ctx, p.Zé.token, "agora posso")).status, 200);
  } finally {
    Object.values(p).forEach((x) => x.fluxo.fechar());
    await derrubar(ctx);
  }
});

test("foto no chat: só foto de verdade entra, e só quem lê o recado vê a foto", async () => {
  const ctx = await subir();
  const guardadas = new Map();
  const apagadas = [];
  ctx.rc.aoGuardarFoto = async (bytes) => {
    const arquivo = `00000000-0000-0000-0000-00000000000${guardadas.size}.png`;
    guardadas.set(arquivo, bytes);
    return { ok: true, arquivo };
  };
  ctx.rc.aoLerFoto = async (arquivo) => (guardadas.has(arquivo) ? { bytes: guardadas.get(arquivo), tipo: "image/png" } : null);
  ctx.rc.aoApagarFoto = (arquivo) => apagadas.push(arquivo);
  const p = await equipeNoChat(ctx);
  try {
    const png = "data:image/png;base64," + Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
    const enviada = await (
      await fetch(`${ctx.base}/chat/foto`, {
        method: "POST",
        body: JSON.stringify({ token: p.Caio.token, foto: png, texto: "Setlist de hoje", para: { tipo: "pessoa", id: p.Zé.id, nome: "Zé" } }),
      })
    ).json();
    assert.equal(enviada.ok, true);
    const { arquivo } = enviada.mensagem.foto;

    const doZe = await fetch(`${ctx.base}/chat/foto?arquivo=${arquivo}&token=${p.Zé.token}`);
    assert.equal(doZe.status, 200);
    assert.equal(doZe.headers.get("content-type"), "image/png");
    // A Bia não recebeu o recado, então também não vê a foto dele.
    assert.equal((await fetch(`${ctx.base}/chat/foto?arquivo=${arquivo}&token=${p.Bia.token}`)).status, 404);

    const texto = await fetch(`${ctx.base}/chat/foto`, {
      method: "POST",
      body: JSON.stringify({ token: p.Caio.token, foto: "data:text/html;base64,PHNjcmlwdD4=" }),
    });
    assert.equal(texto.status, 400);

    // Apagar o recado apaga a foto do disco.
    ctx.rc.apagarMensagem(enviada.mensagem.id);
    assert.deepEqual(apagadas, [arquivo]);
  } finally {
    Object.values(p).forEach((x) => x.fluxo.fechar());
    await derrubar(ctx);
  }
});

test("o aparelho escolhe a equipe dele, e equipe inventada não entra", async () => {
  const ctx = await subir();
  try {
    const token = await parear(ctx.base, "Caio");
    const mudar = (equipe) => fetch(`${ctx.base}/chat/equipe`, { method: "POST", body: JSON.stringify({ token, equipe }) });
    assert.equal((await mudar("som")).status, 200);
    assert.equal(ctx.rc.dispositivos.get(token).equipe, "som");
    // "Cabine" é só da cabine.
    assert.equal((await mudar("cabine")).status, 400);
    assert.equal((await mudar("qualquer")).status, 400);
    assert.equal((await mudar("")).status, 200);
    assert.equal(ctx.rc.dispositivos.get(token).equipe, "");
  } finally {
    await derrubar(ctx);
  }
});
