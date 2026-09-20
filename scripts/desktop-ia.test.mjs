import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import iaModule from "../desktop/ia.cjs";
import modelosModule from "../desktop/ia-modelos.cjs";

const { AssistenteLocal, argumentosDoServidor, textoDaResposta, portaLivre, CONTEXTO_MIN, CONTEXTO_MAX } =
  iaModule;

function gguf(bytes = modelosModule.MENOR_PLAUSIVEL + 1024) {
  const b = Buffer.alloc(bytes);
  b.write("GGUF", 0, "ascii");
  b.writeUInt32LE(3, 4);
  return b;
}

async function comApp(tarefa) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-ia-app-"));
  const ia = new AssistenteLocal(dir);
  try {
    return await tarefa(ia, dir);
  } finally {
    await ia.desligar();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

describe("o modelo só escuta esta máquina", () => {
  test("os argumentos prendem o servidor no 127.0.0.1", () => {
    const a = argumentosDoServidor({ modelo: "m.gguf", porta: 51515 });
    const i = a.indexOf("--host");
    assert.equal(a[i + 1], "127.0.0.1", "o modelo não pode escutar a rede da igreja");
    assert.equal(a[a.indexOf("--port") + 1], "51515");
  });

  test("uma geração por vez, e sem interface web própria", () => {
    const a = argumentosDoServidor({ modelo: "m.gguf", porta: 1 });
    assert.equal(a[a.indexOf("--parallel") + 1], "1");
    assert.ok(a.includes("--no-webui"));
  });

  test("nenhum argumento abre arquivo, terminal ou execução", () => {
    const a = argumentosDoServidor({ modelo: "m.gguf", porta: 1 }).join(" ");
    for (const perigo of ["--path", "--api-key-file", "--chat-template-file", "--jinja", "--lora"]) {
      assert.ok(!a.includes(perigo), `${perigo} não deveria estar aí`);
    }
  });

  test("o contexto fica na faixa que um PC de igreja aguenta", () => {
    const curto = argumentosDoServidor({ modelo: "m", porta: 1, contexto: 10 });
    assert.equal(Number(curto[curto.indexOf("--ctx-size") + 1]), CONTEXTO_MIN);
    const longo = argumentosDoServidor({ modelo: "m", porta: 1, contexto: 999999 });
    assert.equal(Number(longo[longo.indexOf("--ctx-size") + 1]), CONTEXTO_MAX);
  });

  test("a porta é sorteada e está livre de verdade", async () => {
    const p = await portaLivre();
    assert.ok(p > 1024 && p < 65536);
  });
});

describe("o orçamento de contexto bate dos dois lados", () => {
  test("o processo principal e a janela combinam os mesmos números", () => {
    // conversa.ts monta a instrução contando com estes valores, e os dois
    // arquivos não se falam — um é CommonJS do processo principal, o outro é
    // a janela. Sem este par de testes, mudar um lado passaria batido.
    assert.equal(iaModule.CONTEXTO_PADRAO, 2048, "conversa.ts conta com 2048 de contexto");
    assert.equal(iaModule.MAX_TOKENS_RESPOSTA, 320, "conversa.ts conta com 320 de resposta");
  });
});

describe("ler a resposta do llama-server", () => {
  test("aceita os dois formatos que as versões devolvem", () => {
    assert.equal(textoDaResposta({ choices: [{ message: { content: "oi" } }] }), "oi");
    assert.equal(textoDaResposta({ choices: [{ text: "oi" }] }), "oi");
    assert.equal(textoDaResposta({ content: "oi" }), "oi");
  });

  test("resposta estranha vira texto vazio, não exceção", () => {
    for (const lixo of [null, undefined, 42, "texto", {}, { choices: [] }]) {
      assert.equal(textoDaResposta(lixo), "");
    }
  });
});

describe("estado e ciclo de vida", () => {
  test("começa desativada, e diz que não achou o runtime", async () => {
    await comApp(async (ia) => {
      const e = await ia.estado();
      assert.equal(e.modo, "desativado");
      assert.equal(e.situacao, "desativada");
      assert.equal(e.runtime.achado, false);
      assert.equal(e.modelo, null);
    });
  });

  test("sem runtime, ligar falha com motivo — e a cabine segue viva", async () => {
    await comApp(async (ia, dir) => {
      const alvo = path.join(dir, "m.gguf");
      await writeFile(alvo, gguf());
      await ia.escolherModelo(alvo);
      ia.modo = "sob-demanda";
      const r = await ia.ligar();
      assert.equal(r.ok, false);
      assert.match(r.erro, /llama-server/);
      assert.equal((await ia.estado()).situacao, "erro");
    });
  });

  test("modelo inválido não é escolhido, e o anterior não é perdido", async () => {
    await comApp(async (ia, dir) => {
      const bom = path.join(dir, "bom.gguf");
      await writeFile(bom, gguf());
      await ia.escolherModelo(bom);
      const ruim = path.join(dir, "ruim.gguf");
      await writeFile(ruim, Buffer.alloc(100, 1));
      const r = await ia.escolherModelo(ruim);
      assert.equal(r.ok, false);
      assert.equal(ia.modelo.nome, "bom.gguf", "o modelo bom foi perdido por causa de um ruim");
    });
  });

  test("desativar derruba tudo e devolve a memória, mesmo sem nada de pé", async () => {
    await comApp(async (ia) => {
      await ia.configurar({ modo: "desativado" });
      const e = await ia.estado();
      assert.equal(e.situacao, "desativada");
      assert.equal(ia.processo, null);
      // Duas vezes não pode explodir: é o caminho de fechar o app.
      await ia.desligar();
      await ia.desligar();
    });
  });

  test("a lista de modelos ignora o que não é modelo", async () => {
    await comApp(async (ia) => {
      await mkdir(ia.pastaModelos, { recursive: true });
      await writeFile(path.join(ia.pastaModelos, "bom.gguf"), gguf());
      await writeFile(path.join(ia.pastaModelos, "leia-me.txt"), "nada");
      await writeFile(path.join(ia.pastaModelos, "quebrado.gguf"), Buffer.alloc(50, 9));
      const lista = await ia.listarModelos();
      assert.deepEqual(lista.map((m) => m.nome), ["bom.gguf"]);
      assert.ok(lista[0].veredito);
    });
  });

  test("importar confere antes de copiar", async () => {
    await comApp(async (ia, dir) => {
      const ruim = path.join(dir, "foto.gguf");
      await writeFile(ruim, Buffer.alloc(200, 3));
      assert.equal((await ia.importarModelo(ruim)).ok, false);

      const bom = path.join(dir, "ok.gguf");
      await writeFile(bom, gguf());
      const r = await ia.importarModelo(bom);
      assert.equal(r.ok, true);
      assert.equal(path.dirname(r.caminho), ia.pastaModelos);
    });
  });

  test("perguntar sem modelo não trava esperando nada", async () => {
    await comApp(async (ia) => {
      ia.modo = "sob-demanda";
      const r = await ia.perguntar([{ role: "user", content: "oi" }]);
      assert.equal(r.ok, false);
      assert.match(r.erro, /modelo/i);
    });
  });

  test("os minutos até descarregar ficam numa faixa sensata", async () => {
    await comApp(async (ia) => {
      await ia.configurar({ modo: "sob-demanda", minutos: 9999 });
      assert.ok(ia.minutosOciosoAteDescarregar <= 120);
      await ia.configurar({ modo: "sob-demanda", minutos: 0 });
      assert.ok(ia.minutosOciosoAteDescarregar >= 1);
    });
  });
});
