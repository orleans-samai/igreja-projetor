import assert from "node:assert/strict";
import test from "node:test";
import { zip } from "./zip-de-teste.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { lerPptx, ArquivoInvalido, MAX_SLIDES } = require("../desktop/pptx.cjs");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function rels(lista) {
  return (
    `<?xml version="1.0"?><Relationships>` +
    lista
      .map(([id, tipo, alvo, modo]) =>
        `<Relationship Id="${id}" Type="${R}/${tipo}" Target="${alvo}"${modo ? ` TargetMode="${modo}"` : ""}/>`,
      )
      .join("") +
    `</Relationships>`
  );
}

function slide({ textos = [], figura = null, fundo = null, ruido = false }) {
  const sp = textos
    .map(
      (t) =>
        `<p:sp><p:txBody>${t
          .split("\n")
          .map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`)
          .join("")}</p:txBody></p:sp>`,
    )
    .join("");
  const numero = ruido
    ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody></p:sp>` +
      `<p:sp><p:nvSpPr><p:nvPr><p:ph type="dt"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>25/09/2026</a:t></a:r></a:p></p:txBody></p:sp>`
    : "";
  const pic = figura
    ? `<p:pic><p:blipFill><a:blip r:embed="${figura}"/></p:blipFill><p:spPr><a:xfrm><a:ext cx="9000000" cy="5000000"/></a:xfrm></p:spPr></p:pic>`
    : "";
  const bg = fundo ? `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="${fundo}"/></a:blipFill></p:bgPr></p:bg>` : "";
  return `<p:sld><p:cSld>${bg}<p:spTree>${sp}${numero}${pic}</p:spTree></p:cSld></p:sld>`;
}

/**
 * A apresentação de culto típica: foto no mestre, letra nos slides, e a
 * ordem da lista de slides diferente da ordem dos nomes de arquivo.
 */
function apresentacaoDeCulto() {
  return zip({
    "ppt/presentation.xml":
      `<p:presentation><p:sldIdLst>` +
      `<p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/><p:sldId id="258" r:id="rId4"/>` +
      `</p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": rels([
      ["rId2", "slide", "slides/slide1.xml"],
      ["rId3", "slide", "slides/slide2.xml"],
      ["rId4", "slide", "slides/slide3.xml"],
      ["rId9", "slideMaster", "slideMasters/slideMaster1.xml"],
    ]),
    // Primeiro da lista: slide2.xml, com figura própria e rodapé de ruído.
    "ppt/slides/slide2.xml": slide({ textos: ["Grande é o Senhor\nE mui digno de louvor"], figura: "rId5", ruido: true }),
    "ppt/slides/_rels/slide2.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId5", "image", "../media/image2.jpeg"],
    ]),
    // Segundo: slide1.xml, sem imagem — herda o fundo do mestre.
    "ppt/slides/slide1.xml": slide({ textos: ["Santo, Santo &amp; Santo", "Caf&#233; da manh&#xE3;"] }),
    "ppt/slides/_rels/slide1.xml.rels": rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]),
    // Terceiro: slide3.xml, fundo próprio do slide.
    "ppt/slides/slide3.xml": slide({ textos: ["Amém"], fundo: "rId7" }),
    "ppt/slides/_rels/slide3.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId7", "image", "../media/image3.png"],
    ]),
    "ppt/slideLayouts/slideLayout1.xml": `<p:sldLayout><p:cSld><p:spTree/></p:cSld></p:sldLayout>`,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
    "ppt/slideMasters/slideMaster1.xml": `<p:sldMaster><p:cSld><p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:bgPr></p:bg></p:cSld></p:sldMaster>`,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([["rId2", "image", "../media/image1.png"]]),
    "ppt/media/image1.png": PNG,
    "ppt/media/image2.jpeg": JPG,
    "ppt/media/image3.png": Buffer.concat([PNG, Buffer.from([7])]),
    "docProps/core.xml": `<cp:coreProperties><dc:title>Culto de Domingo</dc:title></cp:coreProperties>`,
  });
}

test("os slides saem na ordem da apresentação, não na dos nomes de arquivo", () => {
  const { slides } = lerPptx(apresentacaoDeCulto());
  assert.equal(slides.length, 3);
  assert.equal(slides[0].texto, "Grande é o Senhor\nE mui digno de louvor");
  assert.match(slides[1].texto, /^Santo/);
  assert.equal(slides[2].texto, "Amém");
});

test("número de slide, data e rodapé não entram no telão", () => {
  const { slides } = lerPptx(apresentacaoDeCulto());
  assert.ok(!slides[0].texto.includes("7"), slides[0].texto);
  assert.ok(!slides[0].texto.includes("2026"), slides[0].texto);
});

test("acento e símbolo codificados em XML chegam como texto normal", () => {
  const { slides } = lerPptx(apresentacaoDeCulto());
  assert.equal(slides[1].texto, "Santo, Santo & Santo\nCafé da manhã");
});

test("a imagem vem do slide, e quando ele não tem, do mestre", () => {
  const { slides } = lerPptx(apresentacaoDeCulto());
  // Figura própria.
  assert.equal(slides[0].imagem.ext, ".jpg");
  assert.deepEqual(slides[0].imagem.bytes, JPG);
  // Sem imagem no slide: o fundo do mestre, que é o caso mais comum.
  assert.equal(slides[1].imagem.ext, ".png");
  assert.deepEqual(slides[1].imagem.bytes, PNG);
  // Fundo declarado no próprio slide ganha do mestre.
  assert.equal(slides[2].imagem.bytes.length, PNG.length + 1);
});

test("o título vem das propriedades do arquivo", () => {
  assert.equal(lerPptx(apresentacaoDeCulto()).titulo, "Culto de Domingo");
});

test("lê arquivo guardado sem compressão também", () => {
  const semCompressao = zip(
    {
      "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId r:id="rId1"/></p:sldIdLst></p:presentation>`,
      "ppt/_rels/presentation.xml.rels": rels([["rId1", "slide", "slides/slide1.xml"]]),
      "ppt/slides/slide1.xml": slide({ textos: ["Oi"] }),
    },
    { compactar: false },
  );
  assert.equal(lerPptx(semCompressao).slides[0].texto, "Oi");
});

test("imagem externa, apontando para a internet, não é baixada", () => {
  const externo = zip({
    "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId r:id="rId1"/></p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": rels([["rId1", "slide", "slides/slide1.xml"]]),
    "ppt/slides/slide1.xml": slide({ textos: ["Oi"], figura: "rId2" }),
    "ppt/slides/_rels/slide1.xml.rels": rels([["rId2", "image", "http://fora/x.png", "External"]]),
  });
  assert.equal(lerPptx(externo).slides[0].imagem, null);
});

test("o que não é PowerPoint é recusado com motivo, sem derrubar nada", () => {
  const casos = [
    Buffer.alloc(0),
    Buffer.from("isto é um texto qualquer, não um zip"),
    zip({ "word/document.xml": "<w:document/>" }),
    apresentacaoDeCulto().subarray(0, 200),
  ];
  for (const c of casos) {
    assert.throws(() => lerPptx(c), ArquivoInvalido);
  }
});

test("ZIP que mente o tamanho não se expande sem limite", () => {
  // Uma entrada pequena que declara 300 MB descompactados: o teto por
  // entrada recusa antes de alocar, que é a defesa contra bomba de ZIP.
  const b = apresentacaoDeCulto();
  const i = b.lastIndexOf(Buffer.from("ppt/presentation.xml"));
  const central = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), i);
  b.writeUInt32LE(300 * 1024 * 1024, central + 24);
  assert.throws(() => lerPptx(b), ArquivoInvalido);
});

test("apresentação sem slide nenhum é recusada, não vira item vazio no culto", () => {
  const vazia = zip({
    "ppt/presentation.xml": `<p:presentation><p:sldIdLst/></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": rels([]),
  });
  assert.throws(() => lerPptx(vazia), /não tem slides/);
});

test("há teto de slides, para o arquivo que diz ter milhares", () => {
  assert.ok(MAX_SLIDES >= 100 && MAX_SLIDES <= 2000);
});
