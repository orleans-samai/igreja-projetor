import assert from "node:assert/strict";
import { describe, it } from "node:test";
import zlib from "node:zlib";
import { zip } from "../../../scripts/zip-de-teste.mjs";
import { pptxDeVerdade } from "../../../scripts/pptx-de-teste.mjs";
import { montarCena, numeracao, type Item } from "./cena.ts";
import { corDe, lerMapa, lerTema, TEMA_PADRAO, type ContextoDeCor } from "./cores.ts";
import { areaDeTexto, geometriaDe, tracosDe } from "./geometria.ts";
import { lerXml, type No } from "./xml.ts";
import { abrirZip, ArquivoInvalido } from "./zip.ts";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function rels(lista: [string, string, string][]): string {
  return (
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    lista.map(([id, tipo, alvo]) => `<Relationship Id="${id}" Type="${REL}/${tipo}" Target="${alvo}"/>`).join("") +
    "</Relationships>"
  );
}

function no(xml: string): No {
  const n = lerXml(xml);
  assert.ok(n);
  return n;
}

describe("o XML do PowerPoint", () => {
  it("tira o prefixo dos nomes, decodifica entidades e guarda o espaço do texto", () => {
    const r = no(`<p:sp ${NS}><a:t xml:space="preserve"> Graça &amp; paz &#233;&#x1F54A; </a:t><a:blip r:embed='rId3'/></p:sp>`);
    assert.equal(r.nome, "sp");
    assert.equal(r.filhos[0].nome, "t");
    assert.equal(r.filhos[0].texto, " Graça & paz é🕊 ");
    assert.equal(r.filhos[1].attrs.embed, "rId3");
  });

  it("não expande entidade declarada: a bomba de entidades não passa", () => {
    const bomba =
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;">]>' +
      "<x><![CDATA[<cru>]]>&b;<!-- nada --></x>";
    const r = no(bomba);
    assert.equal(r.nome, "x");
    assert.equal(r.texto, "<cru>&b;");
  });
});

describe("o ZIP do PowerPoint", () => {
  it("lê partes guardadas e compactadas", async () => {
    const buf = zip({ "a.xml": "<a/>", "b.bin": Buffer.from([1, 2, 3]) });
    const pacote = abrirZip(buf);
    assert.equal(await pacote.texto("a.xml"), "<a/>");
    assert.deepEqual([...((await pacote.bytes("b.bin")) ?? [])], [1, 2, 3]);
    assert.equal(await pacote.bytes("nao-existe"), null);
    const guardado = abrirZip(zip({ "c.xml": "<c/>" }, { compactar: false }));
    assert.equal(await guardado.texto("c.xml"), "<c/>");
  });

  it("para quando uma parte se expande muito além do que o índice diz", async () => {
    const buf = zip({ "grande.xml": Buffer.alloc(1024 * 1024, 32) });
    // O índice central passa a dizer que a parte tem 100 bytes.
    const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const central = buf.readUInt32LE(fim + 16);
    buf.writeUInt32LE(100, central + 24);
    await assert.rejects(abrirZip(buf).bytes("grande.xml"), ArquivoInvalido);
  });

  it("arquivo que não é ZIP é recusado com motivo", () => {
    assert.throws(() => abrirZip(Buffer.from("isto não é um pptx")), ArquivoInvalido);
  });
});

describe("as cores do PowerPoint", () => {
  const tema = lerTema(
    no(
      '<a:theme xmlns:a="x"><a:themeElements><a:clrScheme name="t">' +
        '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
        '<a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme>' +
        '<a:fontScheme name="f"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Verdana"/></a:minorFont></a:fontScheme>' +
        "</a:themeElements></a:theme>",
    ),
  );
  const ctx: ContextoDeCor = { tema, mapa: lerMapa(null) };

  it("Texto 1 passa pelo mapa do mestre e chega ao Escuro 1 do tema", () => {
    assert.deepEqual(corDe(no('<a:schemeClr val="tx1"/>'), ctx), { r: 0, g: 0, b: 0, a: 1 });
    assert.deepEqual(corDe(no('<a:schemeClr val="bg1"/>'), ctx), { r: 255, g: 255, b: 255, a: 1 });
  });

  it("'Destaque 1, 40% mais claro' sai igual ao PowerPoint: #8FAADC", () => {
    const c = corDe(no('<a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr>'), ctx);
    assert.ok(c);
    assert.deepEqual([Math.round(c.r), Math.round(c.g), Math.round(c.b)], [0x8f, 0xaa, 0xdc]);
  });

  it("transparência, cor com nome e fontes do tema", () => {
    assert.equal(corDe(no('<a:srgbClr val="FF0000"><a:alpha val="25000"/></a:srgbClr>'), ctx)?.a, 0.25);
    assert.deepEqual(corDe(no('<a:prstClr val="dkBlue"/>'), ctx), { r: 0, g: 0, b: 139, a: 1 });
    assert.equal(tema.fonteTitulo, "Georgia");
    assert.equal(tema.fonteCorpo, "Verdana");
    assert.equal(lerTema(null), TEMA_PADRAO);
  });
});

describe("as formas", () => {
  it("retângulo arredondado tem os cantos em arco; forma desconhecida vira retângulo", () => {
    const redondo = tracosDe(geometriaDe(no('<p:spPr><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom></p:spPr>')), 200, 100);
    assert.equal(redondo[0].comandos.filter((c) => c.op === "A").length, 4);
    const estranha = tracosDe(geometriaDe(no('<p:spPr><a:prstGeom prst="formaQueNaoExiste"/></p:spPr>')), 200, 100);
    assert.deepEqual(
      estranha[0].comandos.filter((c) => c.op === "L").map((c) => (c.op === "L" ? [c.x, c.y] : [])),
      [[200, 0], [200, 100], [0, 100]],
    );
  });

  it("o ajuste do autor muda a forma: seta com ponta mais comprida", () => {
    const seta = (adj2: number) =>
      tracosDe(
        geometriaDe(no(`<p:spPr><a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj2" fmla="val ${adj2}"/></a:avLst></a:prstGeom></p:spPr>`)),
        400,
        100,
      )[0].comandos;
    const baseDaPonta = (cs: ReturnType<typeof seta>) => (cs[1].op === "L" ? cs[1].x : 0);
    assert.ok(baseDaPonta(seta(100000)) < baseDaPonta(seta(50000)));
  });

  it("forma desenhada à mão estica o próprio quadro até a caixa", () => {
    const g = geometriaDe(
      no(
        '<p:spPr><a:custGeom><a:pathLst><a:path w="10" h="10">' +
          '<a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="10" y="5"/></a:lnTo><a:close/>' +
          "</a:path></a:pathLst></a:custGeom></p:spPr>",
      ),
    );
    const [t] = tracosDe(g, 300, 200);
    assert.deepEqual(t.comandos[1], { op: "L", x: 300, y: 100 });
  });

  it("o texto dentro da elipse fica no retângulo que cabe nela", () => {
    const a = areaDeTexto({ tipo: "preset", nome: "ellipse", ajustes: {} }, 200, 100);
    assert.ok(a.x > 25 && a.x < 35 && a.y > 10 && a.y < 20);
  });
});

/** Uma apresentação com mestre, layout e tema de verdade, para provar a herança. */
function apresentacaoComHeranca(slides: string[], opcoes: { mestreComLogo?: boolean } = {}): Buffer {
  const tema =
    `<a:theme ${NS} name="t"><a:themeElements><a:clrScheme name="t">` +
    '<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="C0504D"/></a:accent1></a:clrScheme>' +
    '<a:fontScheme name="f"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Verdana"/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="m"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
    "</a:themeElements></a:theme>";
  const logo = opcoes.mestreComLogo
    ? '<p:sp><p:nvSpPr><p:cNvPr id="9" name="Faixa"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="0" y="6000000"/><a:ext cx="12192000" cy="858000"/></a:xfrm><a:prstGeom prst="rect"/>' +
      '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr></p:sp>'
    : "";
  const mestre =
    `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg2"/></p:bgRef></p:bg><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Título"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="300" cy="400"/></a:xfrm></p:spPr>' +
    '<p:txBody><a:bodyPr anchor="b"/><a:lstStyle/><a:p><a:r><a:t>Título do mestre</a:t></a:r></a:p></p:txBody></p:sp>' +
    logo +
    "</p:spTree></p:cSld>" +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>' +
    '<p:bodyStyle><a:lvl1pPr marL="228600" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle>' +
    '<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles>' +
    "</p:sldMaster>";
  const layout =
    `<p:sldLayout ${NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Título"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="838200" y="1000000"/><a:ext cx="10515600" cy="1500000"/></a:xfrm></p:spPr></p:sp>' +
    "</p:spTree></p:cSld></p:sldLayout>";
  const partes: Record<string, string> = {
    "ppt/presentation.xml":
      `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>` +
      '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
    "ppt/_rels/presentation.xml.rels": rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ...slides.map((_, i): [string, string, string] => [`rId${i + 2}`, "slide", `slides/slide${i + 1}.xml`]),
    ]),
    "ppt/slideMasters/slideMaster1.xml": mestre,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "theme", "../theme/theme1.xml"],
    ]),
    "ppt/slideLayouts/slideLayout1.xml": layout,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
    "ppt/theme/theme1.xml": tema,
  };
  slides.forEach((s, i) => {
    partes[`ppt/slides/slide${i + 1}.xml`] = s;
    partes[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]);
  });
  return zip(partes);
}

function slide(arvore: string, atributos = ""): string {
  return (
    `<p:sld ${NS} ${atributos}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    arvore +
    "</p:spTree></p:cSld></p:sld>"
  );
}

const TITULO = (texto: string) =>
  '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Título"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>' +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR"/><a:t>${texto}</a:t></a:r></a:p></p:txBody></p:sp>`;

function formas(itens: Item[]): Extract<Item, { tipo: "forma" }>[] {
  return itens.flatMap((i) => (i.tipo === "forma" ? [i] : i.tipo === "grupo" ? formas(i.filhos) : []));
}

describe("a cena de um PowerPoint", () => {
  it("o slide de teste sai com o fundo, a posição e o texto que o arquivo diz", async () => {
    const cena = await montarCena(abrirZip(pptxDeVerdade([{ texto: "Bem-vindos", fundo: "1F3B73" }])));
    assert.equal(cena.slides.length, 1);
    assert.deepEqual(cena.slides[0].fundo, { tipo: "solido", cor: { r: 0x1f, g: 0x3b, b: 0x73, a: 1 } });
    const [caixa] = formas(cena.slides[0].itens);
    assert.deepEqual([caixa.caixa.x, caixa.caixa.y, caixa.caixa.cx, caixa.caixa.cy], [838200, 2743200, 10515600, 1371600]);
    const p = caixa.texto?.paragrafos[0];
    assert.equal(p?.alinhamento, "ctr");
    const t = p?.trechos[0];
    assert.equal(t?.texto, "Bem-vindos");
    assert.equal(t?.tamanho, 54);
    assert.equal(t?.negrito, true);
    assert.deepEqual(t?.cor, { tipo: "solido", cor: { r: 255, g: 255, b: 255, a: 1 } });
    // Sem fonte na letra, vale a do corpo do tema.
    assert.equal(t?.fonte, "Arial");
  });

  it("o título que só tem texto herda a posição do layout e a letra do mestre", async () => {
    const cena = await montarCena(abrirZip(apresentacaoComHeranca([slide(TITULO("Santa Ceia"))])));
    const [titulo] = formas(cena.slides[0].itens);
    // Posição do layout (não a do mestre); âncora do mestre.
    assert.deepEqual([titulo.caixa.x, titulo.caixa.y, titulo.caixa.cx, titulo.caixa.cy], [838200, 1000000, 10515600, 1500000]);
    assert.equal(titulo.texto?.ancora, "b");
    const t = titulo.texto?.paragrafos[0].trechos[0];
    assert.equal(t?.tamanho, 44);
    assert.equal(t?.negrito, true);
    assert.equal(t?.fonte, "Georgia");
    assert.deepEqual(t?.cor, { tipo: "solido", cor: { r: 0xc0, g: 0x50, b: 0x4d, a: 1 } });
    assert.equal(titulo.texto?.paragrafos[0].alinhamento, "ctr");
    // O fundo vem do mestre, pelo estilo do tema (bgRef com Claro 2).
    assert.deepEqual(cena.slides[0].fundo, { tipo: "solido", cor: { r: 0xee, g: 0xec, b: 0xe1, a: 1 } });
  });

  it("o placeholder do mestre não se desenha; a faixa decorativa do mestre, sim — menos onde o slide esconde", async () => {
    const cena = await montarCena(
      abrirZip(apresentacaoComHeranca([slide(TITULO("Com faixa")), slide(TITULO("Sem faixa"), 'showMasterSp="0"')], { mestreComLogo: true })),
    );
    const primeiro = formas(cena.slides[0].itens);
    assert.equal(primeiro.length, 2);
    assert.ok(!primeiro.some((f) => f.texto?.paragrafos[0].trechos[0]?.texto === "Título do mestre"));
    assert.deepEqual(primeiro[0].preenchimento, { tipo: "solido", cor: { r: 0xc0, g: 0x50, b: 0x4d, a: 1 } });
    assert.equal(formas(cena.slides[1].itens).length, 1);
  });

  it("placeholder vazio não aparece, e slide escondido não entra", async () => {
    const vazio =
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Corpo"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
      '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p></p:txBody></p:sp>';
    const cena = await montarCena(
      abrirZip(apresentacaoComHeranca([slide(TITULO("Visível") + vazio), slide(TITULO("Escondido"), 'show="0"')])),
    );
    assert.equal(cena.slides.length, 1);
    assert.equal(formas(cena.slides[0].itens).length, 1);
  });

  it("o corpo herda marcador e recuo do mestre; a numeração conta 1, 2, 3", async () => {
    const corpo =
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Corpo"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
      "<p:txBody><a:bodyPr/><a:lstStyle/>" +
      "<a:p><a:r><a:t>Louvor</a:t></a:r></a:p>" +
      '<a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Um</a:t></a:r></a:p>' +
      '<a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Dois</a:t></a:r></a:p>' +
      "</p:txBody></p:sp>";
    const cena = await montarCena(abrirZip(apresentacaoComHeranca([slide(corpo)])));
    const [f] = formas(cena.slides[0].itens);
    const ps = f.texto?.paragrafos ?? [];
    assert.equal(ps[0].marcador?.texto, "•");
    assert.equal(ps[0].margemEsq, 228600);
    assert.equal(ps[0].recuo, -228600);
    assert.equal(ps[0].trechos[0].tamanho, 28);
    assert.equal(ps[1].marcador?.texto, "1.");
    assert.equal(ps[2].marcador?.texto, "2.");
  });

  it("grupo leva as caixas dos filhos para o lugar do grupo, na escala dele", async () => {
    const grupo =
      '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Grupo"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="1000" y="2000"/><a:ext cx="2000" cy="2000"/><a:chOff x="0" y="0"/><a:chExt cx="1000" cy="1000"/></a:xfrm></p:grpSpPr>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="6" name="q"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="500" y="0"/><a:ext cx="500" cy="500"/></a:xfrm><a:prstGeom prst="ellipse"/>' +
      '<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></p:spPr></p:sp></p:grpSp>';
    const cena = await montarCena(abrirZip(apresentacaoComHeranca([slide(grupo)])));
    const [g] = cena.slides[0].itens;
    assert.equal(g.tipo, "grupo");
    const [filho] = formas([g]);
    assert.deepEqual([filho.caixa.x, filho.caixa.y, filho.caixa.cx, filho.caixa.cy], [2000, 2000, 1000, 1000]);
  });

  it("arquivo sem slides, ou que não é PowerPoint, é recusado com motivo", async () => {
    await assert.rejects(montarCena(abrirZip(zip({ "word/document.xml": "<w:document/>" }))), ArquivoInvalido);
    const semSlides = zip({
      "ppt/presentation.xml": `<p:presentation ${NS}><p:sldIdLst/></p:presentation>`,
    });
    await assert.rejects(montarCena(abrirZip(semSlides)), ArquivoInvalido);
  });

  it("imagem que não abre fica de fora e é contada, sem derrubar o slide", async () => {
    const figura =
      '<p:pic><p:nvPicPr><p:cNvPr id="7" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>' +
      '<p:blipFill><a:blip r:embed="rId9"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
      '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="1000"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr></p:pic>';
    const buf = apresentacaoComHeranca([slide(figura + TITULO("Ainda aqui"))]);
    const cena = await montarCena(abrirZip(buf));
    assert.equal(formas(cena.slides[0].itens).length, 1);
    assert.equal(cena.slides[0].itens.filter((i) => i.tipo === "imagem").length, 0);
    void zlib;
  });
});

describe("a numeração automática", () => {
  it("números, letras e romanos, com o fecho de cada estilo", () => {
    assert.equal(numeracao("arabicPeriod", 3), "3.");
    assert.equal(numeracao("arabicParenR", 3), "3)");
    assert.equal(numeracao("alphaLcParenR", 2), "b)");
    assert.equal(numeracao("alphaUcPeriod", 27), "AA.");
    assert.equal(numeracao("romanUcPeriod", 4), "IV.");
    assert.equal(numeracao("romanLcParenBoth", 9), "(ix)");
    assert.equal(numeracao("circleNumDbPlain", 3), "③");
  });
});
