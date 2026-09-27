import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import limpezaModule from "../desktop/limpeza.cjs";
const { apagarRestos } = limpezaModule;

test("o que o Auto-Slide baixou sai; o resto dos dados da igreja fica", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-limpeza-"));
  try {
    await mkdir(path.join(dir, "recognition", "install-abc", "engine"), { recursive: true });
    await writeFile(path.join(dir, "recognition", "ggml-base.bin"), "modelo de voz");
    await writeFile(path.join(dir, "recognition", "install-abc", "engine", "whisper-cli.exe"), "motor");
    await mkdir(path.join(dir, "data"), { recursive: true });
    await writeFile(path.join(dir, "data", "library.json"), '{"repertorio":true}');
    await mkdir(path.join(dir, "chat-fotos"), { recursive: true });
    await writeFile(path.join(dir, "chat-fotos", "setlist.jpg"), "foto");

    assert.deepEqual(await apagarRestos(dir), ["recognition"]);
    assert.deepEqual((await readdir(dir)).sort(), ["chat-fotos", "data"]);
    assert.equal(await readFile(path.join(dir, "data", "library.json"), "utf8"), '{"repertorio":true}');
    assert.equal(await readFile(path.join(dir, "chat-fotos", "setlist.jpg"), "utf8"), "foto");
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("sem nada para apagar, a abertura segue sem erro", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-limpeza-"));
  try {
    assert.deepEqual(await apagarRestos(dir), []);
    assert.deepEqual(await apagarRestos(path.join(dir, "nao-existe")), []);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
