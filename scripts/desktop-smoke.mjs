import { _electron as electron } from "playwright";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { exportPackage, importPackage } from "../desktop/service-package.cjs";
const root = path.resolve(import.meta.dirname, "..");
const profile = await mkdtemp(path.join(os.tmpdir(), "lumen-smoke-"));
const evidence = path.join(root, "artifacts", "desktop-smoke");
await mkdir(evidence, { recursive: true });
let app;
const errors = [];
/** Campo controlado por store: limpar antes de escrever evita concatenar. */
const campoLimpar = async (campo) => {
  await campo.click();
  await campo.press("ControlOrMeta+a");
  await campo.press("Delete");
};
try {
  const launch = async () => {
    const executablePath = process.env.LUMEN_SMOKE_EXE;
    app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [ ...(executablePath ? ["--smoke-test"] : [root]), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], env: { ...process.env, LUMEN_TEST_DATA: profile }, timeout: 60000 });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    // Sem um tratador nosso, o Playwright dispensa o diálogo sozinho e às
    // vezes chega tarde — e o erro dele derruba o teste inteiro. "beforeunload"
    // é aceito porque recarregar a página é justamente o que queremos.
    page.on("dialog", (d) => {
      void (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {});
    });
    await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
    await page.waitForFunction(async () => !!(await window.lumenDesktop.storageGet("lumen-v2")));
    return page;
  };
  let page = await launch();
  assert.equal(new URL(page.url()).protocol, "lumen:");
  // Block all network URLs, including cached Google Fonts, while checking
  // assets. O servidor do controle remoto não é internet: ele roda nesta
  // máquina, e a página do celular precisa dele para ser testada de verdade.
  await app.context().route(/^https?:/, (route) => {
    const anfitriao = new URL(route.request().url()).hostname;
    return anfitriao === "127.0.0.1" || anfitriao === "localhost"
      ? route.continue()
      : route.abort();
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
  const bible = await page.evaluate(async () => (await fetch("/bible/almeida-1819.json")).json());
  assert.ok(bible.books.length >= 66);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('500 24px "Fraunces Variable"');
    return document.fonts.check('500 24px "Fraunces Variable"');
  });
  assert.ok(fonts);
  assert.equal(await page.evaluate(async () => (await fetch("/missing.js")).status), 404);
  // Exercise packaged media through the actual Electron protocol, including seeking.
  const bytes = Buffer.alloc(32044);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(32000, 40);
  const packageFile = path.join(profile, "smoke.lumen");
  await exportPackage(packageFile, { format: "lumen-service-v1", media: [{ type: "audio", path: "data:audio/wav;base64," + bytes.toString("base64") }] }, async () => null);
  const imported = await importPackage(packageFile, path.join(profile, "packages"));
  const mediaUrl = imported.media[0].path;
  const range = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=0-43" } });
    return { status: response.status, length: (await response.arrayBuffer()).byteLength };
  }, mediaUrl);
  assert.deepEqual(range, { status: 206, length: 44 });
  const preflight = await page.evaluate((url) => window.lumenDesktop.preflight([url, "/missing.mp4"]), mediaUrl);
  assert.deepEqual(preflight.missing, ["/missing.mp4"]);
  assert.equal((await page.evaluate(() => window.lumenDesktop.autoSlideStatus())).pronto, false);
  // Auto-Slide e YouTube não são mais botões soltos na barra — moraram para
  // dentro de "Mais", que só os revela com um clique.
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("menuitem", { name: "Auto-Slide", exact: true }).click();
  const autoDialog = page.getByRole("dialog", { name: "Reconhecimento de canto" });
  await autoDialog.waitFor();
  await autoDialog.getByRole("button", { name: "Instalar reconhecimento local", exact: true }).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "auto-slide.png") });
  await autoDialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await autoDialog.waitFor({ state: "hidden" });

  // Controle remoto: liga o servidor de verdade, pareia como um celular de
  // fora pareia (fetch deste processo Node, não de dentro da página — é o
  // único jeito de provar que a porta está realmente aberta na rede), manda
  // um comando e confirma que a cabine mudou pelo canal ao vivo, não só que
  // o comando foi aceito.
  const remoteStatus = await page.evaluate(() => window.lumenDesktop.remoteControlStart());
  assert.equal(remoteStatus.ligado, true);
  const remoteBase = `http://127.0.0.1:${remoteStatus.porta}`;
  // O nome fixo na rede: http://lumen.local:<porta>, para o endereço não
  // morrer quando o roteador trocar o IP do computador. Se o Firewall ou uma
  // porta 5353 já ocupada impedirem, a cabine tem que DIZER por quê — o que
  // não pode acontecer é o nome sumir calado.
  assert.ok(
    remoteStatus.nomeLocal || remoteStatus.avisoNome,
    "o nome na rede não subiu e o app não explicou por quê",
  );
  if (remoteStatus.nomeLocal) {
    assert.equal(remoteStatus.nomeLocal, "lumen.local");
  }
  const semNome = await fetch(`${remoteBase}/parear`, { method: "POST", body: JSON.stringify({}) });
  assert.equal(semNome.status, 400, "entrar sem nome devia ser recusado");
  const pareado = await fetch(`${remoteBase}/parear`, { method: "POST", body: JSON.stringify({ nome: "Smoke" }) }).then((r) => r.json());
  assert.equal(pareado.ok, true);
  // O PIN sozinho não comanda o telão: quem pareia entra como "chat" e a
  // cabine promove. Aqui isso passa pelo IPC de verdade, como no app.
  assert.equal(pareado.permissao, "chat");
  const semPermissao = await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "preto" }) });
  assert.equal(semPermissao.status, 403);
  const aparelhos = await page.evaluate(() => window.lumenDesktop.remoteControlDevices());
  assert.equal(aparelhos.length, 1);
  assert.equal(aparelhos[0].nome, "Smoke");
  await page.evaluate((id) => window.lumenDesktop.remoteControlSetPermission(id, "controle"), aparelhos[0].id);
  const statusAtual = () => page.evaluate(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status);
  assert.notEqual(await statusAtual(), "black");
  const comando = await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "preto" }) }).then((r) => r.json());
  assert.equal(comando.ok, true);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "black");
  // "preto" alterna, e alternar de novo pousaria em "presenting" — não em
  // "idle". Só "parar" devolve o estado exato que o resto do smoke espera,
  // e é o que evita a guarda de beforeunload (que trava em qualquer status
  // diferente de idle) atrapalhar o relançamento do Electron mais abaixo.
  await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "parar" }) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "idle");
  // ---- Permissões: quem entrou pelo celular, e o que pode fazer ----
  // Entrar deixou de pedir senha; esta lista virou a única barreira.
  await page.getByRole("button", { name: "Permissões", exact: true }).click();
  const dialogoPerm = page.getByRole("dialog", { name: "Permissões do celular" });
  await dialogoPerm.waitFor({ state: "visible", timeout: 10000 });
  await dialogoPerm.getByText("Smoke", { exact: true }).waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await dialogoPerm.waitFor({ state: "hidden", timeout: 10000 });

  // ---- Logo e nome da igreja, à mão na barra de cima ----
  // Era a primeira coisa que alguém faz ao instalar o Lúmen, e a mais
  // escondida: ficava no fundo das Configurações, entre margens e transições.
  await page.getByRole("button", { name: "Logo e nome da igreja" }).click();
  const dialogoLogo = page.getByRole("dialog", { name: "Logo e nome da igreja" });
  await dialogoLogo.waitFor({ state: "visible", timeout: 10000 });
  await assert.doesNotReject(
    dialogoLogo.getByRole("button", { name: /Escolher a imagem|Trocar a imagem/ }).waitFor({ timeout: 5000 }),
  );
  const campoNome = dialogoLogo.getByLabel("Nome da igreja");
  await campoLimpar(campoNome);
  await campoNome.fill("Igreja da Vila");
  await page.keyboard.press("Escape");
  // Esperar o diálogo sair de cena, não só a tecla: enquanto ele está aberto
  // o Radix prende o foco e bloqueia cliques no resto da cabine.
  await dialogoLogo.waitFor({ state: "hidden", timeout: 10000 });
  await page.waitForFunction(
    () => document.body.textContent.includes("Igreja da Vila"),
    null,
    { timeout: 10000 },
  );

  // ---- Celular: pasta de mídia espelhada, projetar item, buscar na internet ----
  const midiaNoCelular = await fetch(`${remoteBase}/midia?token=${pareado.token}`).then((r) => r.json());
  assert.equal(midiaNoCelular.ok, true);
  assert.ok(Array.isArray(midiaNoCelular.midia));

  const repertorioNoCelular = await fetch(`${remoteBase}/repertorio?token=${pareado.token}`).then((r) => r.json());
  assert.ok(repertorioNoCelular.musicas.length > 0, "o celular não recebeu o repertório");
  const escolhida = repertorioNoCelular.musicas[0];
  const projetou = await fetch(`${remoteBase}/projetar`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, tipo: "song", refId: escolhida.id }),
  }).then((r) => r.json());
  assert.equal(projetou.ok, true);
  await page.waitForFunction(
    (titulo) => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.deck?.title === titulo,
    escolhida.titulo,
    { timeout: 10000 },
  );

  // Buscar letra na internet: o que se prova aqui é a ponte — o celular
  // pergunta e a CABINE responde. Ter ou não rede muda o resultado, não o
  // caminho; 504 aqui seria a cabine muda, que é o defeito que importa.
  const buscaDoCelular = await fetch(`${remoteBase}/buscar`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, termo: "castelo forte" }),
  });
  assert.equal(buscaDoCelular.status, 200, "a cabine não respondeu à busca do celular");
  assert.ok(Array.isArray((await buscaDoCelular.json()).achados));

  // ---- O celular de verdade: um botão só para tocar e pausar ----
  // A mesma página que o aparelho da equipe abre, carregada numa janela do
  // Electron — é o único jeito de provar o botão, e não só a rota por trás.
  const janelaCelular = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, url) => {
    // Visível de propósito: janela que não pinta não passa na checagem de
    // clique do Playwright, e o que se quer provar aqui é o toque no botão.
    const w = new BrowserWindow({ width: 420, height: 860, show: true });
    void w.loadURL(url);
  }, `${remoteBase}/`);
  const celular = await janelaCelular;
  await celular.waitForLoadState("domcontentloaded");
  celular.on("dialog", (d) => {
    void d.dismiss().catch(() => {});
  });
  // O nome primeiro: o campo do PIN pareia sozinho ao completar seis dígitos,
  // e depois disso a tela de pareamento já não existe para receber o nome.
  await celular.fill("#nome", "Celular do teste");
  await celular.click("#entrar");
  await celular.waitForSelector("#conectado:not([hidden])", { timeout: 15000 });

  // Dois botões que nunca servem ao mesmo tempo roubavam espaço na tela do
  // aparelho e faziam errar o alvo com o dedo.
  const botoesMidia = await celular.evaluate(() =>
    [...document.querySelectorAll("#painelControle [data-acao]")]
      .filter((b) => ["tocar", "pausar"].includes(b.dataset.acao))
      .map((b) => b.textContent.trim()),
  );
  assert.deepEqual(botoesMidia, ["▶ Tocar"], "o celular devia ter um botão só de tocar/pausar");

  const aparelhoCelular = (await page.evaluate(() => window.lumenDesktop.remoteControlDevices())).find(
    (d) => d.nome === "Celular do teste",
  );
  assert.ok(aparelhoCelular, "o aparelho pareado pela página não apareceu na cabine");
  await page.evaluate(
    (id) => window.lumenDesktop.remoteControlSetPermission(id, "controle"),
    aparelhoCelular.id,
  );
  await celular.waitForFunction(() => !document.querySelector("#tocarPausar").disabled, null, {
    timeout: 10000,
  });

  const leBotao = () =>
    celular.evaluate(() => {
      const b = document.querySelector("#tocarPausar");
      return { texto: b.textContent.trim(), acao: b.dataset.acao };
    });
  assert.deepEqual(await leBotao(), { texto: "▶ Tocar", acao: "tocar" });
  await celular.click("#tocarPausar");
  await celular.waitForFunction(
    () => document.querySelector("#tocarPausar").dataset.acao === "pausar",
    null,
    { timeout: 10000 },
  );
  assert.deepEqual(await leBotao(), { texto: "❚❚ Pausar", acao: "pausar" });
  // E de volta: tocar em Pausar tem que voltar a oferecer Tocar.
  await celular.click("#tocarPausar");
  await celular.waitForFunction(
    () => document.querySelector("#tocarPausar").dataset.acao === "tocar",
    null,
    { timeout: 10000 },
  );
  assert.deepEqual(await leBotao(), { texto: "▶ Tocar", acao: "tocar" });
  // O volume do telão, pelo dedo: a barra existe, obedece a permissão e o
  // valor chega à cabine.
  assert.equal(await celular.locator("#volume").getAttribute("aria-label"), "Volume do telão");
  await celular.locator("#volume").fill("40");
  await celular.locator("#volume").dispatchEvent("change");
  await celular.waitForFunction(
    () => document.querySelector("#volumeRotulo").textContent === "40%",
    null,
    { timeout: 10000 },
  );

  await celular.close();

  // ---- A cabine não rola, nem para o lado nem para baixo ----
  // Controle que saiu da tela é controle que não existe: no meio do culto
  // ninguém procura barra de rolagem para achar o botão de parar. Um vídeo
  // com nome de arquivo comprido já inchou a coluna de trabalho até 1953px
  // numa janela de 1569 e empurrou o chat inteiro para fora da tela.
  const nomeComprido =
    "YTDown.com_YouTube_COISAS-MAIORES-ATITUDE-SOUNDS-feat-ESTHE_Media_Z1JJrI4DR28_003_480p (1)";
  await fetch(`${remoteBase}/musica`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, titulo: nomeComprido, letra: "Uma linha só" }),
  });
  await page.waitForFunction(
    (t) => document.body.textContent.includes(t.slice(0, 40)),
    nomeComprido,
    { timeout: 10000 },
  );
  const comprida = await fetch(`${remoteBase}/repertorio?token=${pareado.token}`)
    .then((r) => r.json())
    .then((d) => d.musicas.find((m) => m.titulo === nomeComprido));
  assert.ok(comprida, "a música de nome comprido não entrou no repertório");
  await fetch(`${remoteBase}/projetar`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, tipo: "song", refId: comprida.id }),
  });
  await page.waitForFunction(
    (t) => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.deck?.title === t,
    nomeComprido,
    { timeout: 10000 },
  );
  // Emulação, não setSize: o Windows recusa janela maior que o monitor, e a
  // varredura passava a medir um tamanho que não tinha pedido — dizendo "ok"
  // para telas que nunca chegou a testar.
  const cdp = await page.context().newCDPSession(page);
  for (const [largura, altura] of [
    [800, 600],
    [1024, 640],
    [1280, 720],
    [1366, 768],
    [1600, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: largura,
      height: altura,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.waitForTimeout(600);
    const rolagem = await page.evaluate(() => {
      const d = document.documentElement;
      const chat = document.querySelector('[aria-label="Chat com os celulares"]');
      const c = chat?.getBoundingClientRect();
      // Apresentar e Parar são os que ninguém pode perder no meio do culto.
      const vivos = ["Apresentar", "Parar"].map((nome) => {
        const b = document.querySelector(`button[aria-label="${nome}"]`);
        const r = b?.getBoundingClientRect();
        return { nome, direita: r ? Math.round(r.right) : -1, largura: r ? Math.round(r.width) : 0 };
      });
      return {
        sobraLado: d.scrollWidth - d.clientWidth,
        sobraBaixo: d.scrollHeight - d.clientHeight,
        janela: d.clientWidth,
        chatLargura: c ? Math.round(c.width) : 0,
        chatDireita: c ? Math.round(c.right) : 0,
        vivos,
      };
    });
    const onde = `${largura}x${altura}`;
    assert.equal(rolagem.sobraLado, 0, `a cabine rolou ${rolagem.sobraLado}px para o lado em ${onde}`);
    assert.equal(rolagem.sobraBaixo, 0, `a cabine rolou ${rolagem.sobraBaixo}px para baixo em ${onde}`);
    for (const v of rolagem.vivos) {
      assert.ok(v.largura > 0, `"${v.nome}" sumiu em ${onde}`);
      assert.ok(
        v.direita <= rolagem.janela + 1,
        `"${v.nome}" ficou ${v.direita - rolagem.janela}px fora da tela em ${onde}`,
      );
    }
    // O chat é uma coluna como as outras, e como as outras só existe no
    // layout de colunas — abaixo de 1280px a cabine vira abas, por desenho.
    if (largura >= 1280) {
      assert.ok(rolagem.chatLargura > 0, `o chat sumiu em ${onde}`);
      assert.ok(
        rolagem.chatDireita <= rolagem.janela + 1,
        `o chat ficou ${rolagem.chatDireita - rolagem.janela}px fora da tela em ${onde}`,
      );
    }
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");

  await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: pareado.token, acao: "parar" }) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "idle");

  const semSessao = await fetch(`${remoteBase}/comando`, { method: "POST", body: JSON.stringify({ token: "invalido", acao: "preto" }) });
  assert.equal(semSessao.status, 401);
  await page.evaluate(() => window.lumenDesktop.remoteControlStop());
  await assert.rejects(fetch(remoteBase + "/"));

  // Verificar atualizações sob pedido: não afirma um resultado — o repositório
  // pode ou não ter uma Release publicada no instante em que este teste roda
  // — só que pedir a verificação pelo menu não derruba a cabine. O status
  // final por IPC precisa ser um dos que o updater sabe relatar.
  const statusAtualizacao = await page.evaluate(async () => {
    await window.lumenDesktop.updateCheck();
    return window.lumenDesktop.updateStatus();
  });
  assert.ok(
    ["atualizado", "disponivel", "erro", "sem-verificacao"].includes(statusAtualizacao.fase),
    `fase inesperada: ${statusAtualizacao.fase}`,
  );

  await page.keyboard.press("Control+Shift+H");
  const checkup = page.getByRole("dialog", { name: "Check-up pré-culto" });
  await checkup.waitFor();
  await checkup.getByRole("button", { name: "Verificar reprodução", exact: true }).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "preflight.png") });
  await checkup.getByRole("button", { name: "Fechar", exact: true }).click();
  await checkup.waitFor({ state: "hidden" });
  // Review uses a fixture in this isolated profile, never the church library.
  const reviewText = "Deus é o nosso refúgio e fortaleza e está sempre presente para nos ajudar nas dificuldades. Cantamos juntos com alegria e gratidão por todo o seu amor e por sua presença em cada momento da nossa vida.";
  await page.evaluate(async (text) => {
    const api = window.lumenDesktop;
    const data = JSON.parse(await api.storageGet("lumen-v2"));
    const slides = [{ id: "review-slide", label: "Verso", text, sortOrder: 0 }];
    data.state.songs.push({ id: "review-song", title: "Teste de leitura", artist: "", groupId: data.state.groups[0]?.id ?? "", key: "", copyright: "", lyricsRaw: text, slides, createdAt: 0, updatedAt: 0 });
    data.state.preview = { kind: "song", refId: "review-song", title: "Teste de leitura", subtitle: "", slides };
    data.state.previewIndex = 0;
    data.state.status = "idle";
    await api.storageSet("lumen-v2", JSON.stringify(data));
  }, reviewText);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
  await page.keyboard.press("Control+Shift+O");
  const review = page.getByRole("dialog", { name: "Revisar leitura no telão" });
  await review.waitFor();
  await review.getByLabel("Resolução para revisar").selectOption("1024x768");
  await review.getByLabel("Enquadramento da sugestão").selectOption("cover");
  await review.getByText(/O preenchimento corta/).waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "readability-review.png") });
  assert.equal(await page.evaluate(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state.songs.find((s) => s.id === "review-song").lyricsRaw), reviewText);
  await review.getByLabel("Enquadramento da sugestão").selectOption("contain");
  await review.getByRole("button", { name: "Aplicar correções", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await page.waitForFunction(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state.songs.find((s) => s.id === "review-song").slides.length > 1);
  // Effective CSS viewport at 125%/150% matches Windows display scaling pressure.
  for (const [width, height, zoom] of [[1366, 768, 1], [1366, 768, 1.25], [1366, 768, 1.5], [800, 600, 1]]) {
    await app.evaluate(({ BrowserWindow }, args) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === "lumen://app/");
      win.setSize(args.width, args.height); win.webContents.setZoomFactor(args.zoom);
    }, { width, height, zoom });
    const assertWithin = async (locator) => {
      await locator.waitFor({ state: "visible" });
      assert.ok(await locator.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }), `Control outside viewport: ${width}x${height}@${zoom}`);
    };
    // Na cabine, o gatilho persistente agora é "Mais" — Auto-Slide só aparece
    // dentro do menu que ele abre. No Modo operador (F8) não existe "Mais",
    // então o botão Auto-Slide continua direto na barra.
    await assertWithin(page.getByRole("button", { name: "Mais", exact: true }));
    await page.screenshot({ animations: "disabled", path: path.join(evidence, `cabine-${width}-${zoom}.png`) });
    await page.keyboard.press("F8");
    await assertWithin(page.getByRole("button", { name: "Auto-Slide", exact: true }));
    await assertWithin(page.getByRole("button", { name: "Próximo", exact: true }));
    await assertWithin(page.getByRole("button", { name: "Preto", exact: true }));
    await page.screenshot({ animations: "disabled", path: path.join(evidence, `operador-${width}-${zoom}.png`) });
    await page.keyboard.press("F8");
  }
  const saved = await page.evaluate(async () => {
    const api = window.lumenDesktop;
    const data = JSON.parse(await api.storageGet("lumen-v2"));
    data.state.settings.churchName = "Persistência Windows";
    data.state.settings.lowPerformance = true;
    await api.storageSet("lumen-v2", JSON.stringify(data));
    return data.state.songs.length;
  });
  await app.close(); app = null;
  page = await launch();
  await page.waitForFunction(() => document.documentElement.dataset.lowPerformance === "true");
  const restored = await page.evaluate(async () => JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")));
  assert.equal(restored.state.settings.churchName, "Persistência Windows");
  assert.equal(restored.state.songs.length, saved);

  // O tema "Infantil" é o único do acervo que escreve o título da música no
  // telão — é com ele que dá para provar onde o texto fixo mora.
  await page.evaluate(async () => {
    const guardado = JSON.parse(await window.lumenDesktop.storageGet("lumen-v2"));
    guardado.state.songThemeId = "theme-infantil";
    await window.lumenDesktop.storageSet("lumen-v2", JSON.stringify(guardado));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("button").length > 10);
  const windowEvent = app.waitForEvent("window");
  await page.evaluate(() => window.lumenDesktop.openProjector());
  const projector = await windowEvent;
  projector.on("dialog", (d) => {
    void (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {});
  });
  await projector.waitForLoadState("domcontentloaded");
  assert.ok(projector.url().includes("/projetor"));
  const received = projector.evaluate(() => new Promise((resolve) => {
    const ch = new BroadcastChannel("lumen-smoke");
    const timer = setTimeout(() => { ch.close(); resolve(false); }, 5000);
    ch.onmessage = (event) => { clearTimeout(timer); ch.close(); resolve(event.data === "ok"); };
    localStorage.setItem("lumen-smoke-ready", "yes");
  }));
  await page.waitForFunction(() => localStorage.getItem("lumen-smoke-ready") === "yes");
  await page.evaluate(() => { const channel = new BroadcastChannel("lumen-smoke"); channel.postMessage("ok"); channel.close(); });
  assert.equal(await received, true);

  // ---- Dois cliques no repertório mandam para o telão ----
  const doisCliques = await page.evaluate(async () => {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const clicar = (txt) => {
      const alvo = [...document.querySelectorAll("button,[role=tab]")].find(
        (b) => (b.textContent || "").trim() === txt,
      );
      alvo?.click();
      return Boolean(alvo);
    };
    clicar("Biblioteca");
    await esperar(300);
    clicar("Letras");
    await esperar(500);
    const linhas = [...document.querySelectorAll('li > button[title^="Um clique seleciona"]')];
    if (linhas.length === 0) return { erro: "nenhuma linha de música no repertório" };
    const titulo = (linhas[0].querySelector("p")?.textContent ?? "").trim();
    linhas[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await esperar(900);
    return { titulo };
  });
  assert.ok(!doisCliques.erro, doisCliques.erro);
  assert.ok(doisCliques.titulo.length > 0, "a linha do repertório não tinha nome");

  // ---- Texto fixo do telão: sempre e apenas no rodapé ----
  // O título da música já foi desenhado no alto, à esquerda: a igreja lia o
  // nome pendurado num canto enquanto a letra corria no meio da tela.
  const noTelao = await projector.evaluate(async (titulo) => {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const palcoDe = () => document.querySelector(".origin-top-left");
    for (let i = 0; i < 60; i += 1) {
      const p = palcoDe();
      if (p && (p.textContent || "").includes(titulo)) break;
      await esperar(100);
    }
    const palco = palcoDe();
    if (!palco) return { erro: "o telão não desenhou slide nenhum" };
    if (!(palco.textContent || "").includes(titulo)) return { erro: "o telão não recebeu " + titulo };
    const caixa = palco.getBoundingClientRect();
    if (caixa.height <= 0) return { erro: "o telão mediu altura zero" };
    const fixos = [...palco.querySelectorAll("p")].filter(
      (el) => (el.textContent || "").trim() === titulo,
    );
    const altura = (el) => {
      const r = el.getBoundingClientRect();
      return Math.round(((r.top + r.height / 2 - caixa.top) / caixa.height) * 100);
    };
    const corpo = palco.querySelector(".slide-text");
    return {
      vezes: fixos.length,
      alturas: fixos.map(altura),
      letra: corpo ? altura(corpo) : null,
    };
  }, doisCliques.titulo);
  assert.ok(!noTelao.erro, noTelao.erro);
  assert.equal(noTelao.vezes, 1, `"${doisCliques.titulo}" apareceu ${noTelao.vezes}x no telão; o certo é 1`);
  // O rodapé fica no fim da área com margem, não no fim da tela crua: por isso
  // 84% já é "colado embaixo". O que prova a correção é a ordem — o texto fixo
  // abaixo da letra, e não pendurado num canto de cima, onde ele já esteve.
  assert.ok(
    noTelao.alturas[0] >= 70,
    `texto fixo a ${noTelao.alturas[0]}% da altura do telão; no rodapé ele passa de 70%`,
  );
  assert.ok(
    noTelao.letra !== null && noTelao.alturas[0] > noTelao.letra,
    `texto fixo a ${noTelao.alturas[0]}% e a letra a ${noTelao.letra}%: o fixo tem que ficar abaixo`,
  );

  // ---- Vídeo do YouTube recolhe a faixa de letras ----
  // Cartão de letra não tem o que dizer enquanto um vídeo toca, e come a
  // altura que o operador quer para acompanhar o próprio vídeo.
  const faixaDeLetras = () =>
    page.locator('button[aria-expanded]').filter({ hasText: /^Letras / }).first();
  if ((await faixaDeLetras().getAttribute("aria-expanded")) !== "true") {
    await faixaDeLetras().click();
  }
  assert.equal(await faixaDeLetras().getAttribute("aria-expanded"), "true");
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("menuitem", { name: "YouTube", exact: true }).click();
  await page.getByPlaceholder("Cole o link do YouTube").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByPlaceholder("Cole o link do YouTube").press("Enter");
  // O nome do vídeo depende de haver internet nesta máquina: com rede vem o
  // título do YouTube, sem rede vem "Vídeo do YouTube". O teste não depende
  // de qual dos dois — só de haver um item na fila para projetar.
  const projetarVideo = page.getByRole("button", { name: /^Projetar / }).first();
  await projetarVideo.waitFor({ state: "visible", timeout: 15000 });
  await projetarVideo.click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button[aria-expanded]")]
        .find((b) => /^Letras /.test((b.textContent || "").trim()))
        ?.getAttribute("aria-expanded") === "false",
    null,
    { timeout: 10000 },
  );
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator.png") });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === "lumen://app/")?.setSize(800, 600));
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator-800x600.png") });
  assert.deepEqual(errors, []);
  const disk = JSON.parse(await readFile(path.join(profile, "data", "library.json"), "utf8"));
  assert.ok(disk.values["lumen-v2"]);
  console.log(`PASS: offline, fonts, Bible, restart persistence, projector, media ranges, preflight, Auto-Slide, remote control (LAN, entrada por nome, nome fixo na rede), update check, review before apply, 1366×768 at 100/125/150% and 800×600, no scroll at seven sizes from 800×600 to 2560×1440 and the chat stays on screen, church logo and name reachable from the menu bar, double-click to project, fixed text only in the footer, YouTube collapses the lyrics strip, phone has one play/pause button and the screen volume, sees the media folder, projects from it and searches lyrics through the cabine. Evidence: ${evidence}`);
} finally {
  if (app) await app.close();
  console.log(`Isolated test profile: ${profile}`);
}
