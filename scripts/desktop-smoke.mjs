import { _electron as electron } from "playwright";
import { mkdtemp, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { exportPackage, importPackage } from "../desktop/service-package.cjs";
import { zip } from "./zip-de-teste.mjs";
const root = path.resolve(import.meta.dirname, "..");
const profile = await mkdtemp(path.join(os.tmpdir(), "lumen-smoke-"));
const evidence = path.join(root, "artifacts", "desktop-smoke");
await mkdir(evidence, { recursive: true });
let app;
const errors = [];

/**
 * Espera uma condição que depende de promessa.
 *
 * `page.waitForFunction` NÃO aguarda função async: a promessa é um objeto,
 * objeto é verdadeiro, e a espera passa na hora. Foi provado com uma
 * função que devolve `false` e mesmo assim passou em 335 ms. Três
 * verificações deste arquivo passavam assim, sem conferir nada — uma delas
 * a do aviso do dirigente. `page.evaluate` aguarda a promessa; é por ele
 * que esta espera pergunta.
 */
/** Um WAV de verdade, curtinho (0,1 s de silêncio): a cabine gera capa e duração dele. */
function wavCurto() {
  const amostras = 800;
  const b = Buffer.alloc(44 + amostras);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + amostras, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(amostras, 40);
  b.fill(128, 44);
  return b;
}

async function esperarAsync(pagina, fn, arg, { timeout = 15000, intervalo = 300, oQue = "a condição" } = {}) {
  const fim = Date.now() + timeout;
  while (Date.now() < fim) {
    if (await pagina.evaluate(fn, arg)) return;
    await pagina.waitForTimeout(intervalo);
  }
  throw new Error(`${oQue} não aconteceu em ${timeout} ms`);
}
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
    await esperarAsync(page, async () => !!(await window.lumenDesktop.storageGet("lumen-v2")), undefined, {
      timeout: 30000,
      oQue: "o armazenamento da biblioteca",
    });
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

  // Bíblia: no repertório ela é um botão dourado que abre a tela da Bíblia
  // direto. O painelzinho que ficava embaixo da aba (busca, seletores,
  // Projetar capítulo) saiu — a tela grande já faz tudo aquilo.
  const botaoBiblia = page.locator("[data-abrir-biblia]");
  await botaoBiblia.waitFor();
  assert.match(
    await botaoBiblia.evaluate((b) => getComputedStyle(b).backgroundImage),
    /linear-gradient/,
    "o botão da Bíblia não está dourado",
  );
  assert.equal(await page.getByRole("tab", { name: "Bíblia" }).count(), 0, "a Bíblia ainda é aba");
  await botaoBiblia.click();
  const versaoBiblia = page.getByLabel("Versão da Bíblia", { exact: true });
  await versaoBiblia.waitFor();
  assert.equal(await page.getByLabel("Referência bíblica").count(), 0, "o painelzinho da Bíblia ainda está lá");
  assert.deepEqual(await versaoBiblia.locator("option").allTextContents(), [
    "Almeida 1819",
    "Bíblia Livre (BLIVRE)",
    "Nova Bíblia Viva",
    "Bíblia Portuguesa Mundial",
    "Bíblia Livre Para Todos (NT)",
    "Importar outra versão…",
  ]);
  const versiculoNaTela = (n) =>
    page.evaluate((v) => document.querySelector(`[data-verse="${v}"]`)?.textContent ?? "", n);
  const tituloDaBiblia = () => page.locator("h2").filter({ hasText: /\d+:\d+/ }).first().textContent();
  const irPara = async (livro, capitulo) => {
    await page.getByRole("button", { name: livro, exact: true }).click();
    await page.getByRole("button", { name: `Capítulo ${capitulo}`, exact: true }).click();
  };
  // Versão que ainda não desceu do disco carrega antes de virar a escolhida:
  // o texto que aparece é o dela, não o da Almeida com o nome dela.
  await versaoBiblia.selectOption("nvb-2007");
  await irPara("João", 3);
  await esperarAsync(page, async () => (document.querySelector('[data-verse="16"]')?.textContent ?? "").includes("amou tanto o mundo"), undefined, {
    oQue: "João 3:16 na Nova Bíblia Viva",
  });
  // A BLT só tem o Novo Testamento: Gênesis nela explica, em vez de mostrar
  // uma lista vazia, e oferece voltar para a Almeida.
  await versaoBiblia.selectOption("blt-2022");
  await page.waitForFunction(() => document.querySelector('select[aria-label="Versão da Bíblia"]').value === "blt-2022");
  await page.getByRole("button", { name: "Gênesis, não está nesta versão", exact: true }).click();
  const avisoSoNt = page.getByRole("status").filter({ hasText: "só tem o Novo Testamento" });
  await avisoSoNt.waitFor();
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "biblia-so-nt.png") });
  await avisoSoNt.getByRole("button", { name: "Abrir na Almeida 1819" }).click();
  await avisoSoNt.waitFor({ state: "hidden" });
  assert.match(await versiculoNaTela(1), /No princípio criou Deus/);
  // Versículo que a tradução omite: aparece marcado, e pedir por ele cai no
  // seguinte em vez de voltar ao versículo 1.
  await versaoBiblia.selectOption("blt-2022");
  await page.waitForFunction(() => document.querySelector('select[aria-label="Versão da Bíblia"]').value === "blt-2022");
  await irPara("Mateus", 17);
  await page.waitForFunction(() => (document.querySelector('[data-verse="21"]')?.textContent ?? "").includes("não consta nesta tradução"));
  await page.getByRole("button", { name: "Versículo 21", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("h2")].some((h) => h.textContent.includes("Mateus 17:22")));
  assert.match(await tituloDaBiblia(), /Mateus 17:22/);
  // Um clique no versículo já projeta: dois cliques faziam o versículo
  // esperar no escuro enquanto o pastor já lia.
  await page.waitForFunction(
    () => {
      const q = JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null");
      return q?.status === "presenting" && (q?.deck?.title ?? "").includes("Mateus 17:22");
    },
    null,
    { timeout: 10000 },
  );
  // Os quadrados de livros, capítulos e versículos têm − e +: cada tela e
  // cada vista pede um tamanho. O tamanho volta ao padrão no fim.
  const alturaDoLivro = () =>
    page.getByRole("button", { name: "Mateus", exact: true }).evaluate((b) => b.getBoundingClientRect().height);
  const esperarTamanho = (rotulo) =>
    page.waitForFunction(
      (r) => (document.querySelector('[aria-label="Tamanho dos quadrados da Bíblia"]')?.textContent ?? "").includes(r),
      rotulo,
      { timeout: 10000 },
    );
  await esperarTamanho("100%");
  const alturaPadrao = await alturaDoLivro();
  await page.getByRole("button", { name: "Aumentar os quadrados da Bíblia", exact: true }).click();
  await esperarTamanho("115%");
  assert.ok((await alturaDoLivro()) > alturaPadrao, "o + não aumentou os quadrados da Bíblia");
  await page.getByRole("button", { name: "Diminuir os quadrados da Bíblia", exact: true }).click();
  await esperarTamanho("100%");
  await page.getByRole("button", { name: "Diminuir os quadrados da Bíblia", exact: true }).click();
  await esperarTamanho("90%");
  assert.ok((await alturaDoLivro()) < alturaPadrao, "o − não diminuiu os quadrados da Bíblia");
  await page.getByRole("button", { name: "Aumentar os quadrados da Bíblia", exact: true }).click();
  await esperarTamanho("100%");
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "biblia.png") });
  // A letra fica no meio do telão, na vertical — nunca lá embaixo nem lá em
  // cima, com ou sem a referência no rodapé.
  const desvioDoCentro = await page.evaluate(() => {
    const palco = document.querySelector('[aria-label="Projetar versículo"] .aspect-video');
    const p = palco.getBoundingClientRect();
    const t = palco.querySelector(".slide-text").getBoundingClientRect();
    return Math.abs(t.y + t.height / 2 - (p.y + p.height / 2)) / p.height;
  });
  assert.ok(desvioDoCentro < 0.03, `o versículo saiu do meio do telão (${(desvioDoCentro * 100).toFixed(1)}%)`);
  // Versão que a igreja tem licença para usar (NVI, NAA…) não vem no app:
  // importa pelo próprio seletor. O arquivo é o formato em que essas
  // versões circulam (lista de livros com capítulos), salvo com BOM como o
  // Bloco de Notas faz — e o texto aqui é de teste, não de Bíblia nenhuma.
  const arquivoDeVersao = path.join(profile, "versao-de-teste.json");
  const livrosDeTeste = Array.from({ length: 66 }, (_, k) => ({
    abbrev: `l${k + 1}`,
    chapters: Array.from({ length: 30 }, (_, c) =>
      Array.from({ length: 30 }, (_, v) => `Texto de teste ${k + 1}.${c + 1}.${v + 1}`),
    ),
  }));
  await writeFile(arquivoDeVersao, "\uFEFF" + JSON.stringify(livrosDeTeste), "utf8");
  await page.locator('input[aria-label="Arquivo da versão da Bíblia"]').setInputFiles(arquivoDeVersao);
  await page.waitForFunction(
    () => document.querySelector('select[aria-label="Versão da Bíblia"]').selectedOptions[0]?.textContent === "versao de teste",
    null,
    { timeout: 10000 },
  );
  // A tela estava em Mateus 17:22 e continua lá, agora no texto importado.
  await page.waitForFunction(() => document.body.textContent.includes("Texto de teste 40.17.22"), null, { timeout: 10000 });

  // Volta como estava, para o resto do teste não depender desta parte.
  await versaoBiblia.selectOption("almeida-1819");
  await page.waitForFunction(() => document.querySelector('select[aria-label="Versão da Bíblia"]').value === "almeida-1819");
  // Reorganizar com a Bíblia aberta mexe nas três partes dela: soltar uma
  // sobre a outra troca as duas, e "Trocar lados" passa a coluna dupla.
  const xDaParte = (parte) =>
    page.evaluate((p) => document.querySelector(`[data-lugar-da-biblia="${p}"]`).getBoundingClientRect().x, parte);
  await page.getByRole("button", { name: "Reorganizar", exact: true }).click();
  await page.locator('[data-parte-da-biblia="previa"]').dragTo(page.locator('[data-parte-da-biblia="navegacao"]'));
  await page.waitForFunction(
    () =>
      document.querySelector('[data-lugar-da-biblia="previa"]').getBoundingClientRect().x >
      document.querySelector('[data-lugar-da-biblia="navegacao"]').getBoundingClientRect().x,
    null,
    { timeout: 5000 },
  );
  await page.getByRole("button", { name: "Trocar lados", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-lugar-da-biblia="versiculos"]').getBoundingClientRect().x >
      document.querySelector('[data-lugar-da-biblia="previa"]').getBoundingClientRect().x,
    null,
    { timeout: 5000 },
  );
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "biblia-reorganizada.png") });
  await page.getByRole("button", { name: "Voltar ao padrão", exact: true }).click();
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.locator("[data-parte-da-biblia]").first().waitFor({ state: "detached", timeout: 5000 });
  assert.ok((await xDaParte("versiculos")) < (await xDaParte("navegacao")), "Voltar ao padrão não devolveu a Bíblia");

  // O "Voltar" é dourado, como o botão que abriu a Bíblia.
  const voltarDaBiblia = page.getByRole("button", { name: "Voltar", exact: true });
  assert.match(await voltarDaBiblia.getAttribute("class"), /\bouro\b/, "o Voltar da Bíblia não está dourado");
  await voltarDaBiblia.click();
  await versaoBiblia.waitFor({ state: "detached" });

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
  // ---- Vídeo como tema, referenciado da pasta e não embutido ----
  // Um vídeo guardado como `data:` dentro do tema viajaria no quadro a cada
  // troca de slide; o tema guarda só o endereço do arquivo na pasta.
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("menuitem", { name: /Exibição|Configurações de exibição/ }).click().catch(async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Tela", exact: true }).click();
    await page.getByRole("menuitem", { name: "Configurações de exibição" }).click();
  });
  const dialogoExibicao = page.getByRole("dialog", { name: /exibição/i });
  await dialogoExibicao.waitFor({ state: "visible", timeout: 10000 });
  // Com a pasta de vídeo vazia o seletor não existe, e o painel explica o
  // que fazer — os dois casos mostram o mesmo rótulo.
  await dialogoExibicao.getByText("Fundo em vídeo").waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await dialogoExibicao.waitFor({ state: "hidden", timeout: 10000 });

  // ---- Achar a música pelo trecho que se lembra ----
  // Numa largura de cabine: a janela mantém os dois layouts montados, e sem
  // fixar o tamanho o teste pode acabar olhando para o que está escondido.
  const cdpBusca = await page.context().newCDPSession(page);
  await cdpBusca.send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.waitForTimeout(500);
  // O verso "Levantamos os olhos / Do vale até o monte" está partido em duas
  // linhas no acervo: era exatamente isso que fazia a busca por trecho falhar.
  await page.evaluate(async () => {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const clicar = (t) => {
      [...document.querySelectorAll("button,[role=tab]")]
        .find((x) => (x.textContent || "").trim() === t)
        ?.click();
    };
    clicar("Biblioteca");
    await esperar(300);
    clicar("Letras");
    await esperar(400);
  });
  // A cabine mantém o layout de colunas e o de abas montados; o campo existe
  // duas vezes, e só um deles está à vista.
  const buscaRepertorio = page
    .locator('input[placeholder="Pesquisar no repertório"]:visible')
    .first();
  await buscaRepertorio.fill("os olhos do vale");
  await page.waitForFunction(
    () => document.body.textContent.includes("Luz sobre o vale"),
    null,
    { timeout: 10000 },
  );
  // E a lista diz por que aquela música apareceu: o nome não bate com o que
  // foi digitado, o motivo está no meio do verso.
  await page.getByText(/letra ·/).first().waitFor({ timeout: 10000 });
  await buscaRepertorio.fill("");
  await page.waitForTimeout(400);
  await cdpBusca.send("Emulation.clearDeviceMetricsOverride");
  await page.waitForTimeout(400);

  // ---- Botão direito na letra: digitar e remover ----
  await page.evaluate(async () => {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const clicar = (t) => {
      const b = [...document.querySelectorAll("button,[role=tab]")].find(
        (x) => (x.textContent || "").trim() === t,
      );
      b?.click();
      return Boolean(b);
    };
    clicar("Biblioteca");
    await esperar(300);
    clicar("Letras");
    await esperar(500);
    document.querySelector('li > button[title^="Um clique seleciona"]')?.click();
    await esperar(600);
  });
  const cartoes = page.locator('button[aria-label^="Mandar "]');
  const antesDeRemover = await cartoes.count();
  assert.ok(antesDeRemover >= 2, `a música escolhida tinha ${antesDeRemover} slide(s)`);
  await cartoes.first().click({ button: "right" });
  const menuLetra = page.getByRole("menu");
  await menuLetra.getByRole("menuitem", { name: "Digitar" }).waitFor({ timeout: 10000 });
  await menuLetra.getByRole("menuitem", { name: "Remover" }).click();
  await page.waitForFunction(
    (quantos) => document.querySelectorAll('button[aria-label^="Mandar "]').length === quantos - 1,
    antesDeRemover,
    { timeout: 10000 },
  );

  // ---- Artes: briefing → lote → editor → arquivo, sem sair do app ----
  // O lote vem do gerador de regras (sem IA); as miniaturas são o mesmo
  // desenho Konva que vira arquivo; o arquivo sai com o tamanho exato do
  // formato, gravado na pasta de artes — aqui, dentro do perfil de teste.
  await page.getByRole("button", { name: "Artes", exact: true }).click();
  const dialogoArtes = page.getByRole("dialog", { name: "Artes" });
  await dialogoArtes.waitFor({ state: "visible", timeout: 10000 });
  await dialogoArtes.getByRole("button", { name: "Criar nova arte" }).click();
  await page.getByRole("button", { name: "Conferência", exact: true }).click();
  // O formulário pede só o título e a referência bíblica.
  await dialogoArtes.getByLabel("Título", { exact: true }).fill("Conferência de Jovens");
  await dialogoArtes.getByLabel("Referência bíblica").fill("Romanos 12:2");
  assert.equal(await dialogoArtes.getByLabel("Data", { exact: true }).count(), 0, "o formulário de artes ainda pede a data");
  await page.getByRole("button", { name: "Gerar artes" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-opcao-de-arte] img[src^='data:image/jpeg']").length === 8,
    null,
    { timeout: 45000 },
  );
  const rotulos = await page.$$eval("[data-opcao-de-arte] span.truncate", (els) => els.map((e) => e.textContent));
  assert.equal(rotulos.length, 8);
  assert.ok(new Set(rotulos).size >= 5, `o lote veio repetido: ${rotulos.join(", ")}`);
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "artes-galeria.png") });

  // O editor abre com a composição e o texto do formulário numa camada.
  await page.getByRole("button", { name: /^Editar / }).first().click();
  await page.locator("[data-editor-de-arte] canvas").first().waitFor({ timeout: 20000 });
  await page.waitForFunction(
    () => (document.querySelector('[aria-label="Camadas"]')?.textContent ?? "").toLocaleUpperCase("pt-BR").includes("CONFERÊNCIA"),
    null,
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await esperarAsync(
    page,
    async () => (await window.lumenDesktop.storageGet("lumen-artes-v1") ?? "").includes("Conferência de Jovens"),
    undefined,
    { oQue: "a arte salva chegar ao disco" },
  );
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "artes-editor.png") });

  // Exportar: PNG e JPEG com as dimensões do formato, lidas do arquivo.
  const pastaArtes = path.join(profile, "artes-exportadas");
  const arquivosDaPasta = async () => (await readdir(pastaArtes).catch(() => [])).sort();
  // O formato padrão das artes é Projeção Full HD.
  for (const [menu, ext] of [[/^PNG · 1920×1080/, ".png"], [/^JPEG · 1920×1080/, ".jpg"]]) {
    const antes = (await arquivosDaPasta()).length;
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByRole("menuitem", { name: menu }).click();
    const fimDaEspera = Date.now() + 20000;
    while ((await arquivosDaPasta()).length === antes && Date.now() < fimDaEspera) await page.waitForTimeout(250);
    const novo = (await arquivosDaPasta()).find((a) => a.endsWith(ext));
    assert.ok(novo, `a exportação ${ext} não gravou arquivo`);
    const bytes = await readFile(path.join(pastaArtes, novo));
    let dims;
    if (ext === ".png") dims = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    else {
      // JPEG: o primeiro marcador SOF traz altura e largura.
      let i = 2;
      while (i < bytes.length && !(bytes[i] === 0xff && bytes[i + 1] >= 0xc0 && bytes[i + 1] <= 0xc2)) i += 2 + bytes.readUInt16BE(i + 2);
      dims = [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
    }
    assert.deepEqual(dims, [1920, 1080], `${novo} saiu com ${dims.join("×")}`);
  }

  await page.getByRole("button", { name: "Fechar a arte" }).click();
  await page.keyboard.press("Escape");
  await dialogoArtes.waitFor({ state: "hidden", timeout: 10000 });

  // ---- VFX: os três modos, e o vídeo dinâmico virando arquivo ----
  // O que se prova aqui é a promessa inteira da área: a composição se monta
  // com efeito ao vivo, mas o que vai para o culto é um arquivo pronto, que
  // não gasta processador desenhando nada no domingo.
  // Numa largura de cabine: a coluna da direita só existe no layout de
  // colunas, e abaixo de 1280px a cabine vira abas — sem fixar o tamanho o
  // teste procuraria uma aba que, com razão, não está na tela.
  const cdpVfx = await page.context().newCDPSession(page);
  await cdpVfx.send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.waitForTimeout(500);

  const abrirVfx = async () => {
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByRole("menuitem", { name: "VFX" }).click();
    await page.getByRole("dialog", { name: "VFX" }).waitFor({ timeout: 10000 });
  };
  await abrirVfx();
  const dialogoVfx = page.getByRole("dialog", { name: "VFX" });
  for (const nome of ["Ativado", "Desativado", "Automático"]) {
    await dialogoVfx.getByRole("button", { name: new RegExp(`^${nome}`) }).waitFor({ timeout: 5000 });
  }
  await dialogoVfx.getByRole("button", { name: /^Desativado/ }).click();
  await page.keyboard.press("Escape");
  await dialogoVfx.waitFor({ state: "hidden", timeout: 10000 });

  // Desativado: a aba fica apagada e explica, em vez de sumir.
  const abaDinamicos = page.getByRole("tab", { name: "Dinâmicos" });
  await abaDinamicos.waitFor({ timeout: 10000 });
  assert.equal(
    await abaDinamicos.isDisabled(),
    true,
    "com o VFX desativado a aba de vídeos dinâmicos devia ficar apagada",
  );

  await abrirVfx();
  await dialogoVfx.getByRole("button", { name: /^Ativado/ }).click();
  await page.keyboard.press("Escape");
  await dialogoVfx.waitFor({ state: "hidden", timeout: 10000 });
  await page.waitForFunction(
    () => {
      const t = [...document.querySelectorAll('[role="tab"]')].find((b) =>
        b.textContent.includes("Dinâmicos"),
      );
      return t && !t.disabled;
    },
    null,
    { timeout: 10000 },
  );

  // Uma composição a partir de um modelo pronto, e um controle mexido.
  await abaDinamicos.click();
  await page.getByRole("button", { name: "Nova composição" }).click();
  await page.getByRole("button", { name: /Culto da bênção/ }).click();
  const editorVfx = page.getByRole("dialog", { name: "Vídeos dinâmicos" });
  await editorVfx.waitFor({ timeout: 10000 });
  await editorVfx.getByLabel("Nome da composição").fill("Fundo do ensaio");
  await editorVfx.getByLabel("Intensidade").fill("85");

  // Salvar como vídeo: o menor dos vídeos, porque a captura é em tempo real
  // e o teste não vai ficar dois minutos olhando uma barra.
  await editorVfx.getByRole("button", { name: "Salvar como vídeo" }).click();
  const salvarVideo = page.getByRole("dialog", { name: "Salvar como vídeo" });
  await salvarVideo.waitFor({ timeout: 10000 });
  await salvarVideo.getByLabel("Nome do vídeo").fill("Fundo do ensaio");
  await salvarVideo.getByRole("button", { name: "854 × 480 (leve)" }).click();
  await salvarVideo.locator('input[type="range"]').fill("3");
  await salvarVideo.getByRole("button", { name: "Renderizar e salvar" }).click();
  await salvarVideo.waitFor({ state: "detached", timeout: 90000 });
  await page.keyboard.press("Escape");
  await editorVfx.waitFor({ state: "hidden", timeout: 10000 });

  // O arquivo existe na pasta de vídeo da igreja, não só na tela.
  const naPasta = await page.evaluate(() => window.lumenDesktop.mediaList("video"));
  assert.ok(
    (naPasta.items ?? []).some((v) => v.title === "Fundo do ensaio" && v.size > 0),
    "o vídeo renderizado não chegou à pasta de vídeo",
  );

  // E aparece na aba Vídeos, que é onde o operador vai procurar.
  await page.getByRole("tab", { name: "Vídeos", exact: true }).click();
  await page.waitForFunction(
    () => document.body.textContent.includes("Fundo do ensaio"),
    null,
    { timeout: 15000 },
  );

  // O projeto não foi consumido: continua editável, agora com um vídeo no
  // currículo.
  await abaDinamicos.click();
  await page.waitForFunction(
    () => document.body.textContent.includes("1 vídeo gerado"),
    null,
    { timeout: 10000 },
  );

  // Automático fica guardado, e a aba continua de pé.
  await abrirVfx();
  await dialogoVfx.getByRole("button", { name: /^Automático/ }).click();
  await page.keyboard.press("Escape");
  await dialogoVfx.waitFor({ state: "hidden", timeout: 10000 });
  assert.equal(await abaDinamicos.isDisabled(), false, "no automático a aba continua aberta");
  await page.getByRole("tab", { name: "Temas" }).click();
  await cdpVfx.send("Emulation.clearDeviceMetricsOverride");
  await page.waitForTimeout(400);

  // O telão obedece ao celular: preto e de volta.
  await fetch(`${remoteBase}/comando`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, acao: "preto" }),
  });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "black",
    null,
    { timeout: 10000 },
  );
  await fetch(`${remoteBase}/comando`, {
    method: "POST",
    body: JSON.stringify({ token: pareado.token, acao: "parar" }),
  });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "idle",
    null,
    { timeout: 10000 },
  );

  // ---- Permissões: quem entrou pelo celular, e o que pode fazer ----
  // Entrar deixou de pedir senha; esta lista virou a única barreira.
  await page.getByRole("button", { name: "Permissões", exact: true }).click();
  const dialogoPerm = page.getByRole("dialog", { name: "Permissões do celular" });
  await dialogoPerm.waitFor({ state: "visible", timeout: 10000 });
  await dialogoPerm.getByText("Smoke", { exact: true }).waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await dialogoPerm.waitFor({ state: "hidden", timeout: 10000 });

  // ---- Controle pelo celular, ao lado de Permissões ----
  // O endereço para a equipe e os aparelhos conectados moravam só no menu
  // Tela; agora abrem num clique na barra de cima.
  await page.getByRole("button", { name: "Controle pelo celular", exact: true }).click();
  const dialogoControle = page.getByRole("dialog", { name: "Controle remoto pelo celular" });
  await dialogoControle.waitFor({ state: "visible", timeout: 10000 });
  await dialogoControle.getByText("Smoke", { exact: true }).waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await dialogoControle.waitFor({ state: "hidden", timeout: 10000 });

  // ---- Contas com senha: a cabine cria, o celular entra já com a permissão ----
  // O acesso rápido (só o nome) continua entrando só no chat; com a conta, a
  // pessoa não espera a cabine liberar o resto a cada culto.
  await page.getByRole("button", { name: "Permissões", exact: true }).click();
  await dialogoPerm.waitFor({ state: "visible", timeout: 10000 });
  const novaConta = dialogoPerm.locator("form", { hasText: "Nova conta" });
  await novaConta.getByLabel("Usuário da nova conta").fill("Tecladista");
  await novaConta.getByLabel("Senha da nova conta").fill("tecla-2026");
  await novaConta.getByRole("button", { name: "Editor", exact: true }).click();
  await novaConta.getByLabel("Equipe da nova conta").selectOption("louvor");
  await novaConta.getByRole("button", { name: "Criar conta", exact: true }).click();
  await dialogoPerm.getByText("Tecladista", { exact: true }).waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await dialogoPerm.waitFor({ state: "hidden", timeout: 10000 });
  const janelaDaConta = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, url) => {
    // Outra sessão: é outro aparelho, com o próprio armazenamento. Na mesma
    // sessão, o token da conta e o "Usuário e senha" lembrado vazariam para
    // o celular do teste, que abriria já logado como a conta.
    const w = new BrowserWindow({
      width: 420,
      height: 860,
      show: true,
      webPreferences: { partition: "celular-da-conta" },
    });
    void w.loadURL(url);
  }, `${remoteBase}/`);
  const celularDaConta = await janelaDaConta;
  await celularDaConta.waitForLoadState("domcontentloaded");
  // As duas entradas lado a lado, e o acesso rápido é o que abre primeiro.
  assert.equal(await celularDaConta.locator("#modoRapido").getAttribute("aria-selected"), "true");
  await celularDaConta.click("#modoConta");
  await celularDaConta.fill("#usuario", "tecladista");
  await celularDaConta.fill("#senha", "senha-errada");
  await celularDaConta.click("#entrarConta");
  await celularDaConta.waitForFunction(
    () => document.querySelector("#erroConta").textContent.includes("não conferem"),
    null,
    { timeout: 10000 },
  );
  await celularDaConta.fill("#senha", "tecla-2026");
  await celularDaConta.click("#entrarConta");
  await celularDaConta.waitForSelector("#conectado:not([hidden])", { timeout: 15000 });
  // Editor pela conta: mexe nas letras sem ninguém liberar o aparelho — e
  // continua sem comandar o telão, que a conta não dá. Lidos pelo atributo,
  // não pela tela: o aviso de editor mora na aba Letras, que está fechada, e
  // "escondido" ali seria verdade de qualquer jeito.
  const avisosDaConta = await celularDaConta.evaluate(() => ({
    semEditor: document.querySelector("#semEditor").hidden,
    semControle: document.querySelector("#semControle").hidden,
  }));
  assert.equal(avisosDaConta.semEditor, true, "a conta não trouxe a permissão de editor");
  assert.equal(avisosDaConta.semControle, false, "a conta de editor comandou o telão");
  await celularDaConta.close();

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

  // ---- Mídia nova chega ao celular na hora: pelo Importar e pelo Explorer ----
  // Antes o "Importar" criava um endereço de sessão que o celular nunca via,
  // e a cabine só reespelhava a pasta ao trocar o item no ar.
  const noCelularEm5s = async (titulo) => {
    const limite = Date.now() + 5000;
    while (Date.now() < limite) {
      const r = await fetch(`${remoteBase}/midia?token=${pareado.token}`).then((x) => x.json());
      if ((r.midia ?? []).some((m) => m.titulo === titulo)) return true;
      await new Promise((ok) => setTimeout(ok, 150));
    }
    return false;
  };
  const fora = await mkdtemp(path.join(os.tmpdir(), "lumen-importar-"));
  const hino = path.join(fora, "Hino de abertura.wav");
  await writeFile(hino, wavCurto());
  const biblioteca = page.locator("[data-soltar-biblioteca]");
  await biblioteca.getByRole("tab", { name: "Mídia", exact: true }).click();
  await biblioteca.getByRole("tab", { name: "Áudio", exact: true }).click();
  await biblioteca.locator('input[type="file"]').setInputFiles(hino);
  assert.ok(await noCelularEm5s("Hino de abertura"), "a mídia importada não chegou ao celular em 5 s");
  const pastaDeAudio = await page.evaluate(() => window.lumenDesktop.mediaList("audio"));
  assert.ok(
    (pastaDeAudio.items ?? []).some((i) => i.name === "Hino de abertura.wav" && i.size > 0),
    "o Importar não gravou o arquivo na pasta de áudio",
  );
  const linhaDoHino = biblioteca.locator("li", { hasText: "Hino de abertura" }).locator("button").first();
  await linhaDoHino.waitFor({ timeout: 5000 });

  // Copiado pelo Explorer, sem passar pela cabine: o vigia da pasta avisa.
  await writeFile(path.join(pastaDeAudio.dir, "Copiado pelo Explorer.wav"), wavCurto());
  assert.ok(
    await noCelularEm5s("Copiado pelo Explorer"),
    "arquivo copiado direto na pasta não chegou ao celular em 5 s",
  );

  // Arrastar a linha da biblioteca para a programação do culto.
  const culto = page.locator("[data-soltar-culto]");
  await linhaDoHino.dragTo(culto);
  await page.waitForFunction(
    () => document.querySelector("[data-soltar-culto]")?.textContent.includes("Hino de abertura"),
    null,
    { timeout: 5000 },
  );

  // Botão direito na mídia: projetar, pôr no culto e excluir (para a Lixeira).
  await linhaDoHino.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Excluir \(vai para a Lixeira\)/ }).waitFor({ timeout: 5000 });
  await page.getByRole("menuitem", { name: /Pôr no culto/ }).waitFor({ timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.getByRole("menuitem", { name: /Excluir/ }).waitFor({ state: "detached", timeout: 5000 });

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

  // ---- "Sair do vídeo": a mídia sai do telão; com letra no ar, nada muda ----
  const quadroNoTelao = () => page.evaluate(() => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null"));
  const projetarPeloCelular = (tipo, refId) =>
    fetch(`${remoteBase}/projetar`, {
      method: "POST",
      body: JSON.stringify({ token: pareado.token, tipo, refId }),
    }).then((r) => r.json());
  // ---- Tocou numa mídia da lista: os controles aparecem ali mesmo ----
  // Antes era preciso voltar à aba Controle para pausar, mexer no volume ou
  // tirar o vídeo do telão.
  await celular.click("#abaMidia");
  const itemDoHino = celular.locator("#midiaLista button", { hasText: "Hino de abertura" });
  await itemDoHino.click();
  await celular.waitForSelector("#midiaPlayer:not([hidden])", { timeout: 10000 });
  assert.match(await celular.locator("#midiaPlayerTitulo").textContent(), /Hino de abertura/);
  assert.equal(await itemDoHino.getAttribute("aria-current"), "true", "a mídia no telão não ficou marcada na lista");
  assert.equal(await celular.locator("#midiaPlayer .volume-telao").getAttribute("aria-label"), "Volume do telão na aba Mídia");
  await celular.click("#midiaPlayerSair");
  await celular.waitForSelector("#midiaPlayer", { state: "hidden", timeout: 10000 });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "clear",
    null,
    { timeout: 10000 },
  );
  await celular.click("#abaControle");

  assert.equal(await celular.locator('#painelControle [data-acao="parar-midia"]').textContent(), "■ Sair do vídeo");
  assert.equal((await projetarPeloCelular("media", "midia:audio:Hino de abertura.wav")).ok, true);
  await page.waitForFunction(
    () => {
      const q = JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null");
      return q?.deck?.kind === "media" && q.status === "presenting";
    },
    null,
    { timeout: 10000 },
  );
  await celular.click('#painelControle [data-acao="parar-midia"]');
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.status === "clear",
    null,
    { timeout: 10000 },
  );
  assert.equal((await projetarPeloCelular("song", escolhida.id)).ok, true);
  await page.waitForFunction(
    (titulo) => {
      const q = JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null");
      return q?.deck?.title === titulo && q.status === "presenting";
    },
    escolhida.titulo,
    { timeout: 10000 },
  );
  await celular.click('#painelControle [data-acao="parar-midia"]');
  await page.waitForTimeout(800);
  assert.equal((await quadroNoTelao()).status, "presenting", "Sair do vídeo apagou a letra do telão");

  // ---- A grade de slides: tocar numa estrofe põe ela no telão ----
  // É o caminho inteiro num teste só: a cabine manda os slides prontos, a
  // página desenha a grade, o dedo escolhe a quarta estrofe e o telão anda
  // para ela — não para o começo da música.
  await celular.click("#abaLetras");
  await celular.waitForSelector("#musicas li button", { timeout: 10000 });
  await celular.locator("#musicas li button").first().click();
  await celular.waitForSelector("#letrasSlides:not([hidden])", { timeout: 10000 });

  const grade = await celular.evaluate(() => ({
    titulo: document.querySelector("#slidesTitulo").textContent,
    quantos: document.querySelector("#slidesQuantos").textContent,
    miniaturas: document.querySelectorAll("#gradeSlides li").length,
    // A primeira estrofe tem que trazer texto: grade de quadrados vazios
    // não serve para escolher slide nenhum.
    primeira: document.querySelector("#gradeSlides .texto").textContent.trim(),
    // E o fundo do tema tem que ter chegado, senão a miniatura mente sobre
    // o que a igreja vai ver.
    fundo: document.querySelector("#gradeSlides .mini").style.backgroundImage,
  }));
  assert.ok(grade.miniaturas >= 3, `a grade veio com ${grade.miniaturas} slides`);
  assert.equal(grade.quantos, `${grade.miniaturas} slides`);
  assert.ok(grade.primeira.length > 0, "a miniatura veio sem a letra do slide");
  assert.match(grade.fundo, /^url\("data:image\/jpeg/, "a miniatura veio sem o fundo do tema");

  await celular.locator("#gradeSlides li button").nth(2).click();
  await page.waitForFunction(
    (titulo) => {
      const f = JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null");
      return f?.deck?.title === titulo && f?.index === 2;
    },
    grade.titulo,
    { timeout: 10000 },
  );

  // E a grade acende a estrofe que está no ar, para quem segura o aparelho
  // saber onde o culto está sem olhar para a parede.
  await celular.waitForFunction(
    () => document.querySelectorAll("#gradeSlides [aria-current='true']").length === 1,
    null,
    { timeout: 10000 },
  );
  const aceso = await celular.evaluate(() =>
    [...document.querySelectorAll("#gradeSlides li button")].findIndex((b) =>
      b.hasAttribute("aria-current"),
    ),
  );
  assert.equal(aceso, 2, "a grade acendeu o slide errado");

  // Recado novo chega em dourado no celular, esteja ele em qualquer aba:
  // quem está passando slides não olha o contador do Chat.
  await celular.click("#abaControle");
  await page.evaluate(() => window.lumenDesktop.remoteControlChat("Repete o refrão", "Cabine"));
  await celular.waitForFunction(
    () => {
      const a = document.querySelector("#avisoOuro");
      return a && !a.hidden && a.textContent.includes("Repete o refrão") && a.textContent.includes("Cabine");
    },
    null,
    { timeout: 10000 },
  );
  // Tocar no aviso leva ao chat.
  await celular.click("#avisoOuro");
  await celular.waitForSelector("#painelChat:not([hidden])", { timeout: 10000 });
  // O chat do celular é o mesmo do dirigente (chat-equipe.js): o recado em
  // balão, quem está no chat, e para quem vai o que se escreve.
  await celular.waitForFunction(
    () => [...document.querySelectorAll("#chatLista .ce-linha-msg")].some((l) => l.textContent.includes("Repete o refrão")),
    null,
    { timeout: 10000 },
  );
  assert.match(await celular.locator(".ce-presenca").textContent(), /Cabine/);
  assert.equal(await celular.locator('select[aria-label="Para quem vai a mensagem"]').count(), 1);
  await celular.click("#abaLetras");

  // Voltar tem que devolver a lista de músicas, não deixar as duas telas.
  await celular.click("#slidesVoltar");
  await celular.waitForSelector("#letrasLista:not([hidden])", { timeout: 10000 });
  assert.equal(await celular.locator("#letrasSlides").isHidden(), true);

  // ---- Aba Culto: a programação da cabine no celular, projetar e excluir ----
  await celular.click("#abaCulto");
  await celular.waitForSelector("#cultoLista [data-item-do-culto]", { timeout: 10000 });
  const titulosDaCabine = () =>
    page.$$eval("[data-soltar-culto] > li", (lis) => lis.map((li) => li.querySelector(".truncate")?.textContent));
  const titulosNoCelular = () => celular.$$eval("#cultoLista .nome", (els) => els.map((e) => e.textContent));
  assert.deepEqual(await titulosNoCelular(), await titulosDaCabine(), "a aba Culto não mostra a programação da cabine");

  const primeiroDoCulto = (await titulosNoCelular())[0];
  await celular.getByRole("button", { name: `Projetar ${primeiroDoCulto}`, exact: true }).click();
  await page.waitForFunction(
    (titulo) => JSON.parse(localStorage.getItem("lumen-live-frame") ?? "null")?.deck?.title === titulo,
    primeiroDoCulto,
    { timeout: 10000 },
  );

  // Excluir pede dois toques: o primeiro só arma o botão.
  await celular.getByRole("button", { name: "Excluir Hino de abertura", exact: true }).click();
  assert.ok((await titulosDaCabine()).includes("Hino de abertura"), "um toque só já excluiu");
  await celular.getByRole("button", { name: "Confirmar a exclusão de Hino de abertura", exact: true }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("[data-soltar-culto] > li")].some(
        (li) => li.querySelector(".truncate")?.textContent === "Hino de abertura",
      ),
    null,
    { timeout: 5000 },
  );
  await celular.waitForFunction(
    () => ![...document.querySelectorAll("#cultoLista .nome")].some((e) => e.textContent === "Hino de abertura"),
    null,
    { timeout: 5000 },
  );
  assert.deepEqual(await titulosNoCelular(), await titulosDaCabine(), "celular e cabine divergiram depois de excluir");

  await celular.close();

  // ---- A página do dirigente: existe, tem a cara da igreja, e é fechada ----
  const paginaDirigente = await fetch(`${remoteBase}/dirigente`);
  assert.equal(paginaDirigente.status, 200);
  assert.match(await paginaDirigente.text(), /ENVIAR PARA O CULTO/);
  const igrejaNaPagina = await fetch(`${remoteBase}/dirigente/igreja`).then((r) => r.json());
  // O nome vem da cabine, não está escrito na página.
  assert.equal(igrejaNaPagina.nome, "Igreja da Vila");
  // Sem senha definida ela não abre: receber arquivo de qualquer um na Wi-Fi
  // seria deixar a porta encostada.
  assert.equal(igrejaNaPagina.ligada, false);
  const dirigenteFechado = await fetch(`${remoteBase}/dirigente/entrar`, {
    method: "POST",
    body: JSON.stringify({ senha: "seja o que for" }),
  });
  assert.equal(dirigenteFechado.status, 403);

  // ---- A página do dirigente de verdade: entrar, abas, arquivo, chat, aviso ----
  // A mesma página que o dirigente abre no navegador, carregada numa janela
  // do Electron. Aqui se prova o caminho inteiro, não só as rotas: o campo,
  // o clique, a barra de envio, o recado chegando na cabine.
  await page.evaluate(() =>
    window.lumenDesktop.remoteControlSetDirigentePassword("cordeiro-de-deus"),
  );
  const janelaDirigente = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, url) => {
    const w = new BrowserWindow({ width: 1100, height: 860, show: true });
    void w.loadURL(url);
  }, `${remoteBase}/dirigente`);
  const dirigente = await janelaDirigente;
  await dirigente.waitForLoadState("domcontentloaded");
  dirigente.on("dialog", (d) => {
    void d.dismiss().catch(() => {});
  });

  // O olho da senha: quem digita no escuro precisa poder conferir.
  await dirigente.fill("#senha", "cordeiro-de-deus");
  assert.equal(await dirigente.locator("#senha").getAttribute("type"), "password");
  await dirigente.click("#verSenha");
  assert.equal(await dirigente.locator("#senha").getAttribute("type"), "text");
  await dirigente.click("#verSenha");

  // Sem usuário não entra: é o nome que a cabine mostra em cada arquivo.
  await dirigente.click("#entrar");
  await dirigente.waitForFunction(
    () => document.querySelector("#erro").textContent.includes("usuário"),
    null,
    { timeout: 10000 },
  );

  await dirigente.fill("#usuario", "Pastor Elias");
  await dirigente.click("#entrar");
  await dirigente.waitForSelector("#envio:not([hidden])", { timeout: 15000 });
  assert.equal(await dirigente.locator("#topo").isVisible(), true);
  assert.equal(await dirigente.locator("#quemTopo").textContent(), "Pastor Elias");
  // A senha não fica no campo depois de entrar.
  assert.equal(await dirigente.locator("#senha").inputValue(), "");

  // As abas trocam o que a folha pede, e o seletor de arquivo junto.
  await dirigente.click('[data-aba="imagem"]');
  await dirigente.waitForFunction(
    () => document.querySelector("#tituloFolha").textContent === "Enviar imagens",
    null,
    { timeout: 10000 },
  );
  assert.equal(await dirigente.locator("#arquivo").getAttribute("accept"), "image/*");
  await dirigente.click('[data-aba="apresentacao"]');

  // Um arquivo de verdade, pelo mesmo caminho do dirigente no domingo.
  const doDirigente = path.join(evidence, "fundo-do-dirigente.png");
  await writeFile(doDirigente, Buffer.alloc(2048, 7));
  await dirigente.setInputFiles("#arquivo", doDirigente);
  await dirigente.waitForFunction(
    () => document.querySelectorAll("#fila li").length === 1,
    null,
    { timeout: 10000 },
  );
  await dirigente.click("#enviar");
  await dirigente.waitForFunction(
    () => /No culto|Guardado/.test(document.querySelector("#fila .estado").textContent),
    null,
    { timeout: 20000 },
  );
  // E a cabine diz de quem veio, que é para isso que o usuário serve.
  await page.waitForFunction(
    () => document.body.textContent.includes("de Pastor Elias"),
    null,
    { timeout: 10000 },
  );

  // O chat: o dirigente escreve, e o recado chega ao mural da cabine.
  await dirigente.click('[data-aba="chat"]');
  await dirigente.waitForSelector("#painelChat:not([hidden])", { timeout: 10000 });
  await dirigente.fill("#textoChat", "Chegamos com o pen drive");
  await dirigente.click("#mandarChat");
  await page.waitForFunction(
    () => document.body.textContent.includes("Chegamos com o pen drive"),
    null,
    { timeout: 10000 },
  );
  // E volta para a própria página pelo fluxo, sem recarregar nada.
  await dirigente.waitForFunction(
    () => document.querySelector("#listaChat").textContent.includes("Chegamos com o pen drive"),
    null,
    { timeout: 10000 },
  );

  // Recado novo aparece em dourado na cabine, com o nome de quem mandou —
  // o operador pode estar olhando qualquer coisa menos a coluna do chat.
  // Procura dentro do aviso, não na página: o texto também está no mural,
  // e achar lá não provaria o aviso.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("[data-sonner-toast]")].some(
        (t) => t.textContent.includes("Chegamos com o pen drive") && t.textContent.includes("Pastor Elias"),
      ),
    null,
    { timeout: 10000 },
  );
  // E fica guardado no histórico daquele culto, com busca e exportação.
  await page.getByRole("button", { name: "Histórico do chat", exact: true }).click();
  const dialogoHistorico = page.getByRole("dialog", { name: "Histórico do chat" });
  await dialogoHistorico.waitFor({ state: "visible", timeout: 10000 });
  await dialogoHistorico.getByText("Chegamos com o pen drive").first().waitFor({ timeout: 10000 });
  assert.equal(await dialogoHistorico.getByRole("button", { name: "Exportar" }).count(), 1);
  await page.keyboard.press("Escape");
  await dialogoHistorico.waitFor({ state: "hidden", timeout: 10000 });
  // Quem escreveu não recebe aviso da própria mensagem: seria ruído.
  assert.equal(
    await dirigente.locator("#avisoOuro").isHidden(),
    true,
    "o dirigente recebeu aviso dourado da própria mensagem",
  );
  // E o recado da cabine chega ao dirigente em dourado.
  await page.evaluate(() => window.lumenDesktop.remoteControlChat("Podem subir, estamos prontos", "Cabine"));
  await dirigente.waitForFunction(
    () => {
      const a = document.querySelector("#avisoOuro");
      return a && !a.hidden && a.textContent.includes("Podem subir");
    },
    null,
    { timeout: 10000 },
  );

  // O aviso escrito vira texto na biblioteca da cabine, não item do culto.
  await dirigente.click('[data-aba="texto"]');
  await dirigente.waitForSelector("#painelTexto:not([hidden])", { timeout: 10000 });
  await dirigente.fill("#avisoTitulo", "Santa Ceia no domingo");
  await dirigente.fill("#avisoTexto", "Traga a família às dezenove horas");
  await dirigente.click("#enviarAviso");
  await esperarAsync(
    page,
    async () => {
      const cru = await window.lumenDesktop.storageGet("lumen-v2");
      return JSON.stringify(cru ?? "").includes("Santa Ceia no domingo");
    },
    undefined,
    { oQue: "o aviso do dirigente virar texto na biblioteca" },
  );

  await dirigente.close();

  // ---- PowerPoint e PDF do dirigente entram na programação como slides ----
  // A queixa era exatamente esta: o arquivo mandado pela página do
  // dirigente não chegava à programação do culto. PowerPoint é lido sem
  // Office (o PC que reportou não tem nenhum); PDF é desenhado pelo pdf.js,
  // e é ele que prova que o worker sobe dentro do app.
  const { token: tokenDirigente } = await (
    await fetch(`${remoteBase}/dirigente/entrar`, {
      method: "POST",
      body: JSON.stringify({ senha: "cordeiro-de-deus" }),
    })
  ).json();
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PNG_MINIMO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgAMYAAIxhBgFbqBx1AAAAAElFTkSuQmCC",
    "base64",
  );
  const pptxDoCulto = zip({
    "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId r:id="rId1"/><p:sldId r:id="rId2"/></p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels":
      `<Relationships><Relationship Id="rId1" Type="${REL}/slide" Target="slides/slide1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide2.xml"/></Relationships>`,
    "ppt/slides/slide1.xml":
      `<p:sld><p:cSld><p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId9"/></a:blipFill></p:bgPr></p:bg>` +
      `<p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Bem-vindos à Santa Ceia</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    "ppt/slides/_rels/slide1.xml.rels": `<Relationships><Relationship Id="rId9" Type="${REL}/image" Target="../media/fundo.png"/></Relationships>`,
    "ppt/slides/slide2.xml": `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Oferta</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    "ppt/media/fundo.png": PNG_MINIMO,
  });
  const pdfDoEstudo = (() => {
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>"];
    for (let i = 0; i < 2; i += 1) objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] >>");
    let out = "%PDF-1.4\n";
    const offs = [];
    objs.forEach((o, i) => {
      offs.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  })();

  const apresentacoesAntes = await page.evaluate(async () => {
    const st = JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state;
    return (st.apresentacoes ?? []).length;
  });
  for (const [nome, corpo] of [
    ["Santa Ceia.pptx", pptxDoCulto],
    ["Estudo.pdf", pdfDoEstudo],
  ]) {
    const r = await fetch(`${remoteBase}/dirigente/enviar`, {
      method: "POST",
      headers: {
        "x-lumen-dirigente": tokenDirigente,
        "x-lumen-arquivo": encodeURIComponent(nome),
        "x-lumen-de": encodeURIComponent("Pastor Elias"),
      },
      body: corpo,
    });
    assert.equal(r.status, 200, `o envio de ${nome} falhou`);
  }
  await esperarAsync(
    page,
    async (antes) => {
      const st = JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state;
      const itens = st.playlists.find((p) => p.id === st.activePlaylistId).items;
      return (st.apresentacoes ?? []).length === antes + 2 && itens.filter((i) => i.type === "apresentacao").length >= 2;
    },
    apresentacoesAntes,
    { timeout: 40000, oQue: "PowerPoint e PDF do dirigente entrarem na programação" },
  );
  const apresentacoes = await page.evaluate(async () => {
    const st = JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state;
    return st.apresentacoes.map((a) => ({ origem: a.origem, slides: a.slides }));
  });
  const doPptx = apresentacoes.find((a) => a.origem === "pptx");
  const doPdf = apresentacoes.find((a) => a.origem === "pdf");
  assert.ok(doPptx && doPdf, "faltou o PowerPoint ou o PDF na biblioteca");
  assert.equal(doPptx.slides.length, 2);
  assert.equal(doPptx.slides[0].texto, "Bem-vindos à Santa Ceia");
  assert.equal(doPdf.slides.length, 2, "o pdf.js não desenhou as duas páginas");
  // Toda imagem de slide chega pelo protocolo — a rota escrita e a rota
  // atendida já discordaram uma vez, e toda imagem dava 404.
  const respostas = await page.evaluate(async (urls) => {
    const r = [];
    for (const u of urls) r.push((await fetch(u)).status);
    return r;
  }, [...doPptx.slides, ...doPdf.slides].map((s) => s.imagem).filter(Boolean));
  assert.ok(respostas.length >= 3, `só ${respostas.length} imagens de slide`);
  assert.ok(respostas.every((c) => c === 200), `imagem de slide não abriu: ${respostas.join(",")}`);

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
    // Em volta do corte de 1280: é ali que a cabine troca de desenho, e
    // era ali que os dois desenhos ficavam montados ao mesmo tempo — um
    // deles com largura zero, medindo a si mesmo e errando.
    [1264, 720],
    [1279, 720],
    [1280, 720],
    [1281, 720],
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
    // Espera o desenho certo para esta largura antes de medir: colunas a
    // partir de 1280, abas abaixo. A troca vem de um evento do navegador e
    // pode levar um instante; 5 s sem trocar já é defeito.
    await page
      .waitForFunction(
        (colunas) => (document.querySelectorAll('[role="separator"]').length > 0) === colunas,
        largura >= 1280,
        { timeout: 5000 },
      )
      .catch(() => {});
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

    // Um desenho de cada vez, em qualquer tela.
    //
    // Os dois ficavam montados e o CSS escondia um. O escondido rodava
    // com largura zero, e as colunas redimensionáveis, que se medem para
    // se organizar, derrubavam a cabine inteira com "Panel constraints
    // not found for index 4" — a tela de erro no lugar do app, no
    // domingo de alguém.
    const desenho = await page.evaluate(() => ({
      colunas: document.querySelectorAll('[role="separator"]').length > 0,
      abas: !!document.querySelector('[role="tablist"][aria-label="Área da cabine"]'),
      quebrou: document.body.textContent.includes("Something went wrong"),
    }));
    assert.equal(desenho.quebrou, false, `a cabine mostrou a tela de erro em ${onde}`);
    assert.ok(
      desenho.colunas !== desenho.abas,
      `em ${onde} a cabine montou ${desenho.colunas && desenho.abas ? "os dois desenhos" : "desenho nenhum"}`,
    );
    // Onde cabe, as colunas são o desenho certo: é a cabine de verdade,
    // com o repertório, o culto, o que está no ar e os fundos à vista.
    if (largura >= 1280) {
      assert.ok(desenho.colunas, `${onde} comporta as colunas e mesmo assim abriu em abas`);
    } else {
      assert.ok(desenho.abas, `${onde} não comporta as colunas e mesmo assim ficou em colunas`);
    }

    // As abas do repertório inteiras, com o botão dourado da Bíblia ao
    // lado: na coluna estreita ele chegou a empurrar "Letras" e "Avisos"
    // para reticências.
    const abasCortadas = await page.evaluate(() => {
      const cortadas = [...document.querySelectorAll('[role="tablist"][aria-label="Tipo de conteúdo"] [role="tab"] span')]
        .filter((s) => s.scrollWidth > s.clientWidth)
        .map((s) => `${s.textContent} (${s.clientWidth}px de ${s.scrollWidth})`);
      if (!cortadas.length) return [];
      // Onde o repertório está, para o erro dizer o que espremeu.
      const cadeia = [];
      let el = document.querySelector('[role="tablist"][aria-label="Tipo de conteúdo"]');
      while (el && el !== document.body && cadeia.length < 8) {
        cadeia.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 40)}=${Math.round(el.getBoundingClientRect().width)}`);
        el = el.parentElement;
      }
      return [...cortadas, `janela ${innerWidth}`, ...cadeia];
    });
    assert.deepEqual(abasCortadas, [], `abas do repertório cortadas em ${onde} (${JSON.stringify(desenho)})`);

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
    // É por aqui que o app restaura o que estava selecionado depois do
    // reload: `preview` não vai para o disco. Sem isto o diálogo revisava a
    // música que estava selecionada antes — e a verificação lá embaixo só
    // passava porque a espera dela era async e nunca esperava de verdade.
    data.state.selectedSongId = "review-song";
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
  await esperarAsync(
    page,
    async () =>
      JSON.parse(await window.lumenDesktop.storageGet("lumen-v2")).state.songs.find((s) => s.id === "review-song").slides.length > 1,
    undefined,
    { oQue: "as correções de leitura partirem o slide" },
  );
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
    // Na cabine, o último item da barra é "Mais"; no Modo operador (F8), os
    // botões do transporte.
    await assertWithin(page.getByRole("button", { name: "Mais", exact: true }));
    await page.screenshot({ animations: "disabled", path: path.join(evidence, `cabine-${width}-${zoom}.png`) });
    await page.keyboard.press("F8");
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

  // ---- Sem IA, sem YouTube e sem Auto-Slide: nada disso existe mais ----
  // A igreja pediu para tirar. Nem botão, nem item de menu, nem ponte.
  assert.equal(await page.getByRole("button", { name: "IA", exact: true }).count(), 0, "o botão de IA voltou");
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: "YouTube", exact: true }).count(), 0, "o YouTube voltou ao menu");
  assert.equal(await page.getByRole("menuitem", { name: "Auto-Slide", exact: true }).count(), 0, "o Auto-Slide voltou ao menu");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tela", exact: true }).click();
  assert.equal(
    await page.getByRole("menuitem", { name: "Reconhecimento de canto", exact: true }).count(),
    0,
    "o reconhecimento de canto voltou ao menu Tela",
  );
  await page.keyboard.press("Escape");
  const pontes = await page.evaluate(() =>
    Object.keys(window.lumenDesktop).filter((k) => /^ia[A-Z]|youtube|autoSlide/i.test(k)),
  );
  assert.deepEqual(pontes, [], `sobrou ponte de IA, YouTube ou Auto-Slide: ${pontes.join(", ")}`);
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator.png") });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === "lumen://app/")?.setSize(800, 600));
  await page.screenshot({ animations: "disabled", path: path.join(evidence, "operator-800x600.png") });
  assert.deepEqual(errors, []);
  const disk = JSON.parse(await readFile(path.join(profile, "data", "library.json"), "utf8"));
  assert.ok(disk.values["lumen-v2"]);
  console.log(`PASS: offline, fonts, Bible (one click on a verse projects it, − and + resize the book, chapter and verse squares, gold buttons in and out of the Bible screen, five versions plus importing a licensed one, its three parts rearranged by dragging and swapping sides, New-Testament-only notice, omitted verse lands on the next), restart persistence, projector, media ranges, preflight, remote control (LAN, entrada por nome, nome fixo na rede, one click from the menu bar beside Permissões, accounts with username and password created in Permissões that sign in already holding their permission while the quick name-only access stays chat-only), update check, review before apply, 1366×768 at 100/125/150% and 800×600, no scroll and exactly one layout at ten sizes from 800×600 to 2560×1440, including every pixel around the 1280 cutover and the chat stays on screen, church logo and name reachable from the menu bar, art studio makes a batch of 8 distinct Konva designs from just a title and a Bible reference, opens one in the editor, saves it and exports PNG and JPEG at exactly 1920×1080 (Full HD is the default), VFX has three modes and a dynamic video becomes a real file in the Vídeos tab, no AI, no YouTube and no Auto-Slide anywhere in the app, dirigente page signs in, sends a file, chats and files a notice, and its PowerPoint and PDF become slides in the service programme, video as a theme background, find a song by a lyric excerpt, right-click on lyrics edits or removes, double-click to project, fixed text only in the footer and the verse always centred vertically, phone has one play/pause button, the screen volume and a Sair do vídeo that takes media off the screen but never a lyric, tapping a media item shows its controls right there in a mini-player, the team chat in bubbles with who is online and who each message is for on the phone and the dirigente page, kept per service in a searchable, exportable history in the cabine, every new chat message pops up in gold on the phone, the cabine and the dirigente page (never for its own author), sees the media folder, gets a file imported in the cabine or copied in by Explorer within 5 s, a library row dragged into the service programme, a right-click menu that deletes media, a Culto tab that mirrors the service programme and projects or deletes (two taps) from it, projects from it, opens a song as a grid of slides and puts one on the screen, and searches lyrics through the cabine. Evidence: ${evidence}`);
} finally {
  if (app) {
    // O fim do teste deixa uma música no ar, e a cabine (de propósito)
    // pergunta antes de fechar durante o culto. Parar a projeção antes é o
    // que o operador faz no domingo; aqui evita a pergunta.
    try {
      const janelas = app.windows();
      const cabine = janelas.find((w) => w.url() === "lumen://app/") ?? janelas[0];
      for (let i = 0; i < 4 && cabine; i++) await cabine.keyboard.press("Escape");
    } catch {
      /* a janela pode já ter caído — o limite abaixo cuida */
    }
    // Fechar pode travar: o Electron espera uma janela que não responde, e
    // o `await` nunca volta. Sem limite, um teste que falhou ficava horas
    // aberto — e o erro, que só sai depois do finally, nunca aparecia.
    const fechou = await Promise.race([
      app.close().then(() => true, () => true),
      new Promise((pronto) => setTimeout(() => pronto(false), 15000)),
    ]);
    if (!fechou) {
      console.log("O app não fechou em 15 s; encerrando o processo.");
      app.process().kill();
    }
  }
  console.log(`Isolated test profile: ${profile}`);
}
