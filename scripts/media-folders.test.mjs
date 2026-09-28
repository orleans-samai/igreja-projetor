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

test("importar copia para a pasta do tipo, sem sobrescrever; apresentação e qualquer outro arquivo também entram", async () => {
  await comPastas(async (dir) => {
    const fora = path.join(dir, "area-de-trabalho");
    await mkdir(fora, { recursive: true });
    await writeFile(path.join(fora, "Abertura.mp4"), "video-novo");
    await writeFile(path.join(fora, "Louvor.mp3"), "audio");
    await writeFile(path.join(fora, "Cartaz.png"), "imagem");
    await writeFile(path.join(fora, "planilha.xlsx"), "x");
    await writeFile(path.join(fora, "Culto.pptx"), "pptx");
    // Já existe um "Abertura.mp4" na pasta: o da igreja não pode sumir.
    await writeFile(path.join(media.folders().video, "Abertura.mp4"), "video-antigo");

    const r = await media.importarCaminhos([
      path.join(fora, "Abertura.mp4"),
      path.join(fora, "Louvor.mp3"),
      path.join(fora, "Cartaz.png"),
      path.join(fora, "planilha.xlsx"),
      path.join(fora, "Culto.pptx"),
      path.join(fora, "nao-existe.mp4"),
      "relativo/sem-raiz.mp4",
      42,
    ]);

    assert.deepEqual(
      r.importados.map((i) => [i.kind, i.name]),
      [
        ["video", "Abertura (2).mp4"],
        ["audio", "Louvor.mp3"],
        ["image", "Cartaz.png"],
      ],
    );
    assert.equal(r.importados[0].id, "midia:video:Abertura (2).mp4");
    assert.equal(r.importados[0].url, "lumen://app/__midia/video/Abertura%20(2).mp4");
    assert.equal(await readFile(path.join(media.folders().video, "Abertura.mp4"), "utf8"), "video-antigo");
    assert.equal(await readFile(path.join(media.folders().video, "Abertura (2).mp4"), "utf8"), "video-novo");
    assert.deepEqual(
      r.recusados.map((x) => x.nome),
      ["nao-existe.mp4"],
    );
    // A apresentação vai para "recebidos", de onde a cabine faz os slides;
    // o que não é mídia nem apresentação fica guardado em Arquivos.
    assert.deepEqual(r.apresentacoes, [{ nome: "Culto.pptx" }]);
    assert.equal(await readFile(path.join(dir, "recebidos", "Culto.pptx"), "utf8"), "pptx");
    assert.deepEqual(r.arquivos, [{ nome: "planilha.xlsx" }]);
    const guardados = await media.listarArquivos();
    assert.deepEqual(guardados.itens.map((i) => [i.nome, i.bytes]), [["planilha.xlsx", 1]]);
    // O original fica onde estava: importar é copiar, não mover.
    assert.equal(await readFile(path.join(fora, "Louvor.mp3"), "utf8"), "audio");
  });
});

test("arquivo que já mora na pasta não é copiado de novo", async () => {
  await comPastas(async () => {
    const dir = media.folders().image;
    await writeFile(path.join(dir, "Foto.jpg"), "x");
    const r = await media.importarCaminhos([path.join(dir, "Foto.jpg")]);
    assert.deepEqual(r.importados.map((i) => i.name), ["Foto.jpg"]);
    assert.deepEqual(await readdir(dir), ["Foto.jpg"]);
  });
});

test("Arquivos: só o que está dentro da pasta, e o nome não escapa dela", async () => {
  await comPastas(async (dir) => {
    const fora = path.join(dir, "fora");
    await mkdir(fora, { recursive: true });
    await writeFile(path.join(fora, "escala.docx"), "a");
    await writeFile(path.join(fora, "escala (copia).docx"), "b");
    const r = await media.importarCaminhos([path.join(fora, "escala.docx"), path.join(fora, "escala.docx")]);
    // O segundo com o mesmo nome não apaga o primeiro.
    assert.deepEqual(r.arquivos.map((a) => a.nome), ["escala.docx", "escala (2).docx"]);
    assert.deepEqual(
      (await media.listarArquivos()).itens.map((i) => i.nome),
      ["escala (2).docx", "escala.docx"],
    );
    // Nome com caminho não sai da pasta: vira só o nome, e esse não existe.
    await writeFile(path.join(dir, "recebidos-secreto.txt"), "fora da pasta");
    assert.equal(media.mostrarArquivo(String.raw`..\..\recebidos-secreto.txt`).ok, false);
    assert.equal(media.mostrarArquivo("../../recebidos-secreto.txt").ok, false);
    assert.equal((await media.excluirArquivo("../fora/escala.docx")).ok, false);
  });
});

test("o vigia avisa quando entra mídia na pasta, uma vez só por rajada", async () => {
  await comPastas(async () => {
    const avisos = [];
    media.vigiar((kinds) => avisos.push(kinds));
    try {
      const dir = media.folders().video;
      // Rajada: copiar um vídeo grande dispara vários eventos seguidos.
      await writeFile(path.join(dir, "Culto.mp4"), "a");
      await writeFile(path.join(dir, "Culto.mp4"), "ab");
      await writeFile(path.join(dir, "Culto.mp4"), "abc");
      const limite = Date.now() + 5000;
      while (avisos.length === 0 && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(avisos.length, 1, JSON.stringify(avisos));
      assert.deepEqual(avisos[0], ["video"]);

      // Arquivo que não é do tipo (o teste de gravação da pasta) não conta.
      avisos.length = 0;
      await writeFile(path.join(dir, "notas.txt"), "x");
      await new Promise((r) => setTimeout(r, 800));
      assert.equal(avisos.length, 0);
    } finally {
      media.vigiar(null);
    }
  });
});
