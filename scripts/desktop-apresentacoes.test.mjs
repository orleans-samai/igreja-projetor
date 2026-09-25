import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { zip } from "./zip-de-teste.mjs";

const require = createRequire(import.meta.url);
const ap = require("../desktop/apresentacoes.cjs");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function pptxSimples() {
  return zip({
    "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId r:id="rId1"/><p:sldId r:id="rId2"/></p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels":
      `<Relationships><Relationship Id="rId1" Type="${R}/slide" Target="slides/slide1.xml"/>` +
      `<Relationship Id="rId2" Type="${R}/slide" Target="slides/slide2.xml"/></Relationships>`,
    "ppt/slides/slide1.xml":
      `<p:sld><p:cSld><p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId9"/></a:blipFill></p:bgPr></p:bg>` +
      `<p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Bem-vindos</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    "ppt/slides/_rels/slide1.xml.rels": `<Relationships><Relationship Id="rId9" Type="${R}/image" Target="../media/fundo.png"/></Relationships>`,
    "ppt/slides/slide2.xml": `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Oferta</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    "ppt/media/fundo.png": PNG,
  });
}

async function ambiente() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-apres-"));
  await mkdir(path.join(dir, "recebidos"), { recursive: true });
  ap.init(dir);
  return dir;
}

test("o nome que vem da rede não sai da pasta de recebidos", async () => {
  const dir = await ambiente();
  try {
    for (const ruim of ["../segredo.pptx", "..\\segredo.pptx", "a/b.pptx", "", "x\0.pptx", "..", "."]) {
      assert.equal(ap.recebido(ruim), null, JSON.stringify(ruim));
    }
    const bom = ap.recebido("Culto de Domingo.pptx");
    assert.equal(bom, path.join(dir, "recebidos", "Culto de Domingo.pptx"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("um PowerPoint recebido vira slides com imagem servida pelo protocolo", async () => {
  const dir = await ambiente();
  try {
    await writeFile(path.join(dir, "recebidos", "Culto.pptx"), pptxSimples());
    const r = await ap.importarPptx("Culto.pptx");
    assert.equal(r.ok, true, r.error);
    assert.equal(r.slides.length, 2);
    assert.equal(r.slides[0].texto, "Bem-vindos");
    assert.match(r.slides[0].imagem, /^lumen:\/\/app\/__apresentacao\/[a-f0-9-]{36}\/slide-1\.png$/);
    // Slide sem imagem não inventa uma.
    assert.equal(r.slides[1].imagem, "");
    // O título cai no nome do arquivo quando o PowerPoint não tem um.
    assert.equal(r.titulo, "Culto");

    // E o telão consegue pedir a imagem de volta.
    const pedido = new URL(r.slides[0].imagem).pathname;
    const arquivo = await ap.resolver(pedido);
    assert.ok(arquivo, "o protocolo não achou a imagem que acabou de ser gravada");
    assert.ok(arquivo.startsWith(path.join(dir, "apresentacoes")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("arquivo que não é PowerPoint é recusado com motivo, sem pasta órfã", async () => {
  const dir = await ambiente();
  try {
    await writeFile(path.join(dir, "recebidos", "falso.pptx"), Buffer.from("não sou um zip"));
    const r = await ap.importarPptx("falso.pptx");
    assert.equal(r.ok, false);
    assert.ok(r.error.length > 0);
    const sobras = await readdir(path.join(dir, "apresentacoes")).catch(() => []);
    assert.deepEqual(sobras, [], "ficou pasta de apresentação para um arquivo que falhou");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("o protocolo só serve o que tem cara de slide, de dentro da pasta", async () => {
  const dir = await ambiente();
  try {
    const id = "12345678-1234-1234-1234-123456789abc";
    const pasta = path.join(dir, "apresentacoes", id);
    await mkdir(pasta, { recursive: true });
    await writeFile(path.join(pasta, "slide-1.png"), PNG);
    await writeFile(path.join(dir, "segredo.txt"), "não pode sair");

    assert.ok(await ap.resolver(`/__apresentacao/${id}/slide-1.png`));
    for (const ruim of [
      `/__apresentacao/${id}/../../segredo.txt`,
      `/__apresentacao/nao-e-uuid/slide-1.png`,
      `/__apresentacao/${id}/segredo.txt`,
      `/__apresentacao/${id}/slide-1.exe`,
      `/__apresentacao/${id}`,
      `/__midia/${id}/slide-1.png`,
      `/__apresentacao/${id}/slide-9.png`,
    ]) {
      assert.equal(await ap.resolver(ruim), null, ruim);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("páginas de PDF só entram se forem PNG de verdade", async () => {
  const dir = await ambiente();
  try {
    const bom = await ap.salvarPaginas([PNG, PNG]);
    assert.equal(bom.ok, true);
    assert.equal(bom.urls.length, 2);
    assert.match(bom.urls[1], /pagina-2\.png$/);

    const ruim = await ap.salvarPaginas([PNG, Buffer.from("<script>")]);
    assert.equal(ruim.ok, false);
    assert.match(ruim.error, /página 2/);
    // A pasta da tentativa que falhou foi apagada inteira.
    const pastas = await readdir(path.join(dir, "apresentacoes"));
    assert.deepEqual(pastas, [bom.id]);

    assert.equal((await ap.salvarPaginas([])).ok, false);
    assert.equal((await ap.salvarPaginas("lixo")).ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("só PDF é lido como PDF, e só de dentro dos recebidos", async () => {
  const dir = await ambiente();
  try {
    await writeFile(path.join(dir, "recebidos", "estudo.pdf"), Buffer.from("%PDF-1.7"));
    await writeFile(path.join(dir, "recebidos", "culto.pptx"), pptxSimples());
    assert.equal((await ap.lerPdf("estudo.pdf")).ok, true);
    assert.equal((await ap.lerPdf("culto.pptx")).ok, false);
    assert.equal((await ap.lerPdf("../estudo.pdf")).ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("remover só aceita um id de apresentação", async () => {
  const dir = await ambiente();
  try {
    assert.equal((await ap.remover("../../")).ok, false);
    assert.equal((await ap.remover("")).ok, false);
    const r = await ap.salvarPaginas([PNG]);
    assert.equal((await ap.remover(r.id)).ok, true);
    assert.deepEqual(await readdir(path.join(dir, "apresentacoes")), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a rota que o módulo escreve é a mesma que o processo principal atende", async () => {
  // Foi o defeito da primeira versão: o módulo escrevia "__apresentacoe" e
  // o processo principal atendia "__apresentacao". Cada lado certo sozinho,
  // e toda imagem de slide em 404 no telão.
  const { readFile } = await import("node:fs/promises");
  const main = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
  const atendida = /startsWith\("\/(__apresentacao)\/"\)/.exec(main)?.[1];
  assert.ok(atendida, "o processo principal não atende rota de apresentação nenhuma");

  const dir = await ambiente();
  try {
    const r = await ap.salvarPaginas([PNG]);
    const escrita = new URL(r.urls[0]).pathname.split("/").filter(Boolean)[0];
    assert.equal(escrita, atendida);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
