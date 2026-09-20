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
