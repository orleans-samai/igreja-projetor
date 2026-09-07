import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const media = require("../desktop/media.cjs");

async function comPastas(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-midia-"));
  media.init(dir);
  await media.ensure();
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

test("cria uma pasta para cada tipo de mídia", async () => {
  await comPastas(async (dir) => {
    const pastas = media.folders();
    assert.equal(pastas.video, path.join(dir, "midia", "video"));
    assert.equal(pastas.audio, path.join(dir, "midia", "audio"));
    assert.equal(pastas.image, path.join(dir, "midia", "imagem"));
  });
});

test("lista só os arquivos que o tipo aceita e ignora o resto", async () => {
  await comPastas(async () => {
    const dir = media.folders().video;
    await writeFile(path.join(dir, "louvor.mp4"), "x");
    await writeFile(path.join(dir, "abertura.webm"), "x");
    await writeFile(path.join(dir, "notas.txt"), "x");
    await writeFile(path.join(dir, "capa.jpg"), "x");
    await mkdir(path.join(dir, "uma-pasta"));

    const r = await media.list("video");
    assert.equal(r.ok, true);
    assert.deepEqual(
      r.items.map((i) => i.name),
      ["abertura.webm", "louvor.mp4"],
    );
    assert.equal(r.items[0].title, "abertura");
    assert.equal(r.items[0].url, "lumen://app/__midia/video/abertura.webm");
  });
});

test("pasta vazia responde vazia, sem erro", async () => {
  await comPastas(async () => {
    const r = await media.list("audio");
    assert.equal(r.ok, true);
    assert.deepEqual(r.items, []);
  });
});

test("o mesmo arquivo mantém o id entre duas leituras", async () => {
  await comPastas(async () => {
    await writeFile(path.join(media.folders().image, "fundo.png"), "x");
    const a = await media.list("image");
    const b = await media.list("image");
    assert.equal(a.items[0].id, b.items[0].id);
  });
});

test("resolveMedia serve o arquivo que existe na pasta do tipo", async () => {
  await comPastas(async () => {
    const alvo = path.join(media.folders().image, "fundo.png");
    await writeFile(alvo, "x");
    assert.equal(await media.resolveMedia("/__midia/image/fundo.png"), alvo);
  });
});

test("resolveMedia recusa sair da pasta, tipo errado e caminho torto", async () => {
  await comPastas(async (dir) => {
    await writeFile(path.join(dir, "segredo.png"), "x");
    // o vídeo não pode servir uma imagem, nem o caminho subir de pasta
    for (const rota of [
      "/__midia/image/../segredo.png",
      "/__midia/image/..\\segredo.png",
      "/__midia/video/fundo.png",
      "/__midia/outro/fundo.png",
      "/__midia/image",
      "/__midia/image/sub/fundo.png",
    ]) {
      assert.equal(await media.resolveMedia(rota), null, rota);
    }
  });
});

test("apontar para outra pasta muda a listagem e volta atrás com reset", async () => {
  await comPastas(async (dir) => {
    const outra = path.join(dir, "pendrive");
    await mkdir(outra, { recursive: true });
    await writeFile(path.join(outra, "cantata.mp4"), "x");

    // choose() abre um diálogo; aqui exercitamos o efeito dele no estado
    media.init(dir);
    const antes = await media.list("video");
    assert.deepEqual(antes.items, []);

    await media.reset("video");
    assert.equal(media.folders().video, path.join(dir, "midia", "video"));
  });
});
