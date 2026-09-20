import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import modelos from "../desktop/ia-modelos.cjs";

const { inspecionar, quantizacaoPeloNome, ramEstimadaGB, veredito, PERFIS, MENOR_PLAUSIVEL } =
  modelos;

/** Um GGUF de mentira: cabeçalho certo, recheio de zeros. */
function gguf(versao = 3, bytes = MENOR_PLAUSIVEL + 1024) {
  const b = Buffer.alloc(bytes);
  b.write("GGUF", 0, "ascii");
  b.writeUInt32LE(versao, 4);
  return b;
}

async function comPasta(tarefa) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-ia-"));
  try {
    return await tarefa(dir);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

describe("inspecionar um arquivo de modelo", () => {
  test("GGUF de verdade é aceito, com o que a tela precisa mostrar", async () => {
    await comPasta(async (dir) => {
      const alvo = path.join(dir, "qwen3-0.6b-Q4_K_M.gguf");
      await writeFile(alvo, gguf());
      const r = await inspecionar(alvo);
      assert.equal(r.ok, true);
      assert.equal(r.quantizacao, "Q4_K_M");
      assert.equal(r.versao, 3);
      assert.ok(r.bytes > 0);
      assert.ok(r.ramEstimadaGB > 0);
    });
  });

  test("arquivo que não é GGUF é recusado com motivo", async () => {
    await comPasta(async (dir) => {
      const alvo = path.join(dir, "modelo.gguf");
      await writeFile(alvo, Buffer.alloc(MENOR_PLAUSIVEL + 10, 7));
      const r = await inspecionar(alvo);
      assert.equal(r.ok, false);
      assert.match(r.erro, /não é um arquivo GGUF/i);
    });
  });

  test("arquivo truncado não vira modelo", async () => {
    // Download interrompido é o jeito mais comum de isso acontecer.
    await comPasta(async (dir) => {
      const alvo = path.join(dir, "cortado.gguf");
      await writeFile(alvo, gguf(3, 1024));
      const r = await inspecionar(alvo);
      assert.equal(r.ok, false);
      assert.match(r.erro, /pequeno demais/i);
    });
  });

  test("versão de formato que não lemos é dita, não engolida", async () => {
    await comPasta(async (dir) => {
      const alvo = path.join(dir, "futuro.gguf");
      await writeFile(alvo, gguf(99));
      const r = await inspecionar(alvo);
      assert.equal(r.ok, false);
      assert.match(r.erro, /versão 99/);
    });
  });

  test("arquivo que não existe não derruba nada", async () => {
    const r = await inspecionar(path.join(os.tmpdir(), "nao-existe-mesmo.gguf"));
    assert.equal(r.ok, false);
    assert.match(r.erro, /Não achei/);
  });
});

describe("quantização pelo nome", () => {
  test("lê o que todo mundo escreve no nome do arquivo", () => {
    assert.equal(quantizacaoPeloNome("gemma-3-1b-it-Q4_K_M.gguf"), "Q4_K_M");
    assert.equal(quantizacaoPeloNome("modelo.IQ3_XS.gguf"), "IQ3_XS");
    assert.equal(quantizacaoPeloNome("algo-f16.gguf"), "F16");
  });

  test("quando não está escrito, dizemos que não sabemos", () => {
    // Inventar "Q4" aqui faria a tela prometer um tamanho que não é o do arquivo.
    assert.equal(quantizacaoPeloNome("modelo.gguf"), "desconhecida");
  });
});

describe("memória e veredito", () => {
  test("a estimativa passa dos pesos, porque contexto e runtime também pesam", () => {
    const umGB = 1024 * 1024 * 1024;
    assert.ok(ramEstimadaGB(umGB) > 1);
  });

  test("o veredito compara com o que sobra, não com o que a máquina tem", () => {
    assert.equal(veredito(1.2, 8), "otimo");
    assert.equal(veredito(1.2, 3), "adequado");
    assert.equal(veredito(1.2, 2), "pode-travar");
    assert.equal(veredito(5, 5), "nao-recomendado");
  });

  test("sem saber a memória livre, não inventamos veredito", () => {
    assert.equal(veredito(1.2, NaN), "desconhecido");
    assert.equal(veredito(1.2, 0), "desconhecido");
  });
});

describe("perfis sugeridos", () => {
  test("vão do mais leve ao mais pesado, e cada um diz para quem serve", () => {
    assert.ok(PERFIS.length >= 3);
    for (const p of PERFIS) {
      assert.ok(p.recomendacao.length > 10, p.id);
      assert.ok(p.ramGB > 0);
      assert.ok(p.contexto >= 512 && p.contexto <= 4096, `${p.id} pede contexto fora do razoável`);
    }
    const ram = PERFIS.map((p) => p.ramGB);
    assert.deepEqual(ram, [...ram].sort((a, b) => a - b), "os perfis deviam vir do leve ao pesado");
  });
});
