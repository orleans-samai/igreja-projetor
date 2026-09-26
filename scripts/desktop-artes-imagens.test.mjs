import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const imagens = require("../desktop/artes-imagens.cjs");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

let dir;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "lumen-artes-"));
  imagens.init(dir);
});

describe("imagens das artes", () => {
  test("guarda JPEG, PNG e WebP com a extensão do conteúdo", async () => {
    for (const [bytes, ext] of [[JPEG, "jpg"], [PNG, "png"], [WEBP, "webp"]]) {
      const r = await imagens.salvar(bytes);
      assert.equal(r.ok, true);
      assert.match(r.url, new RegExp(`^lumen://app/__artes/[a-f0-9-]{36}\\.${ext}$`));
      const arquivo = await imagens.resolver(new URL(r.url).pathname);
      assert.deepEqual(await readFile(arquivo), bytes);
    }
  });

  test("recusa o que não é imagem, vazio ou grande demais", async () => {
    assert.equal((await imagens.salvar(Buffer.from("<svg onload=alert(1)>"))).ok, false);
    assert.equal((await imagens.salvar(Buffer.alloc(0))).ok, false);
    const grande = Buffer.concat([JPEG, Buffer.alloc(21 * 1024 * 1024)]);
    assert.equal((await imagens.salvar(grande)).ok, false);
  });

  test("o endereço não escapa da pasta", async () => {
    for (const p of ["/__artes/../../segredo.txt", "/__artes/..%2f..%2fx.jpg", "/__artes/a/b.jpg", "/__apresentacao/x.jpg", "/__artes/nao-e-uuid.jpg"]) {
      assert.equal(await imagens.resolver(p), null, p);
    }
  });

  test("a rota escrita é a rota atendida", async () => {
    const r = await imagens.salvar(JPEG);
    assert.equal(new URL(r.url).pathname.split("/")[1], imagens.ROTA);
    assert.ok(await imagens.resolver(new URL(r.url).pathname));
  });
});

describe("exportação das artes", () => {
  test("grava na pasta de artes e nunca sobrescreve", async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), "lumen-export-"));
    imagens.definirExportacao(pasta);
    const a = await imagens.exportar("Culto-1080x1080.png", PNG);
    const b = await imagens.exportar("Culto-1080x1080.png", PNG);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(path.basename(a.caminho), "Culto-1080x1080.png");
    assert.equal(path.basename(b.caminho), "Culto-1080x1080 (2).png");
    assert.equal(imagens.dentroDaExportacao(a.caminho), true);
  });

  test("nome não sai da pasta, e conteúdo tem de bater com a extensão", async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), "lumen-export-"));
    imagens.definirExportacao(pasta);
    // "../" é descartado: sobra o nome do arquivo, e ele fica dentro da pasta.
    const fora = await imagens.exportar("../fora.png", PNG);
    assert.equal(path.dirname(fora.caminho), pasta);
    assert.equal((await imagens.exportar("arte.exe", PNG)).ok, false);
    assert.equal((await imagens.exportar("arte.png", JPEG)).ok, false);
    assert.equal(imagens.dentroDaExportacao(path.join(pasta, "..", "segredo.txt")), false);
  });
});
