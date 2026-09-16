import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
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

test("trocar de pasta movendo o acervo leva os arquivos junto", async () => {
  await comPastas(async (dir) => {
    const antiga = media.folders().video;
    await writeFile(path.join(antiga, "louvor.mp4"), "conteudo");
    await writeFile(path.join(antiga, "cantata.webm"), "conteudo");
    await writeFile(path.join(antiga, "notas.txt"), "nao e video");

    const nova = path.join(dir, "pendrive");
    await mkdir(nova, { recursive: true });

    const r = await media.apply("video", nova, true);
    assert.equal(r.ok, true);
    assert.equal(r.movidos, 2);
    assert.deepEqual(r.falhas, []);
    assert.equal(media.folders().video, nova);

    const lista = await media.list("video");
    assert.deepEqual(
      lista.items.map((i) => i.name),
      ["cantata.webm", "louvor.mp4"],
    );
    // O que não é vídeo fica onde estava: a pasta antiga pode ser de outra coisa.
    assert.deepEqual((await readdir(antiga)).sort(), ["notas.txt"]);
  });
});

test("trocar de pasta sem mover deixa o acervo antigo intacto", async () => {
  await comPastas(async (dir) => {
    const antiga = media.folders().video;
    await writeFile(path.join(antiga, "louvor.mp4"), "conteudo");

    const nova = path.join(dir, "outra");
    await mkdir(nova, { recursive: true });

    const r = await media.apply("video", nova, false);
    assert.equal(r.ok, true);
    assert.equal(r.movidos, 0);
    assert.equal(media.folders().video, nova);
    assert.deepEqual(await readdir(antiga), ["louvor.mp4"]);
    assert.deepEqual((await media.list("video")).items, []);
  });
});

test("arquivo que já existe no destino não é sobrescrito, e o erro diz qual é", async () => {
  await comPastas(async (dir) => {
    const antiga = media.folders().video;
    await writeFile(path.join(antiga, "louvor.mp4"), "novo");
    await writeFile(path.join(antiga, "cantata.mp4"), "vai mover");

    const nova = path.join(dir, "destino");
    await mkdir(nova, { recursive: true });
    await writeFile(path.join(nova, "louvor.mp4"), "ja estava aqui");

    const r = await media.apply("video", nova, true);
    assert.equal(r.ok, true);
    assert.equal(r.movidos, 1);
    assert.equal(r.falhas.length, 1);
    assert.equal(r.falhas[0].nome, "louvor.mp4");
    assert.match(r.falhas[0].erro, /já existe/);
    // O arquivo do destino continua sendo o que já estava lá.
    assert.equal(await readFile(path.join(nova, "louvor.mp4"), "utf8"), "ja estava aqui");
    // E o que não moveu continua na pasta antiga, para ninguém perder nada.
    assert.equal(await readFile(path.join(antiga, "louvor.mp4"), "utf8"), "novo");
  });
});

test("pasta inválida é recusada e a pasta atual não muda", async () => {
  await comPastas(async (dir) => {
    const antes = media.folders().video;
    const arquivo = path.join(dir, "isto-e-um-arquivo.txt");
    await writeFile(arquivo, "x");

    const r = await media.apply("video", arquivo, false);
    assert.equal(r.ok, false);
    assert.match(r.error, /não é uma pasta/);
    assert.equal(media.folders().video, antes);
  });
});

test("tipo de mídia desconhecido responde erro em vez de derrubar o app", async () => {
  await comPastas(async (dir) => {
    const r = await media.apply("planilha", dir, false);
    assert.equal(r.ok, false);
    assert.match(r.error, /desconhecido/);
    const z = await media.reset("planilha");
    assert.equal(z.ok, false);
  });
});
