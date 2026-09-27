import { zip } from "./zip-de-teste.mjs";

/**
 * Um .pptx de verdade, com todas as partes que o formato exige.
 *
 * O leitor simples do Lúmen aceita um ZIP com meia dúzia de XML, mas quem
 * desenha a apresentação igual ao PowerPoint (o LibreOffice, o próprio
 * PowerPoint) recusa um pacote sem tipos de conteúdo, mestre, layout e tema.
 * Cada slide tem cor de fundo e um texto numa posição conhecida: é o que
 * deixa o teste conferir que o slide saiu fiel, e não só que saiu.
 */

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const TIPO = "application/vnd.openxmlformats-officedocument";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** @param {[string, string, string][]} lista */
function rels(lista) {
  return (
    XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    lista.map(([id, tipo, alvo]) => `<Relationship Id="${id}" Type="${REL}/${tipo}" Target="${alvo}"/>`).join("") +
    "</Relationships>"
  );
}

const ARVORE_VAZIA =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';

const CORES = [
  ["dk1", "000000"], ["lt1", "FFFFFF"], ["dk2", "1F497D"], ["lt2", "EEECE1"],
  ["accent1", "4F81BD"], ["accent2", "C0504D"], ["accent3", "9BBB59"], ["accent4", "8064A2"],
  ["accent5", "4BACC6"], ["accent6", "F79646"], ["hlink", "0000FF"], ["folHlink", "800080"],
];

const TEMA =
  XML +
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Lumen">` +
  "<a:themeElements>" +
  `<a:clrScheme name="Lumen">${CORES.map(([n, v]) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`).join("")}</a:clrScheme>` +
  '<a:fontScheme name="Lumen"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Lumen">' +
  "<a:fillStyleLst>" + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3) + "</a:fillStyleLst>" +
  "<a:lnStyleLst>" + '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3) + "</a:lnStyleLst>" +
  "<a:effectStyleLst>" + "<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3) + "</a:effectStyleLst>" +
  "<a:bgFillStyleLst>" + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3) + "</a:bgFillStyleLst>" +
  "</a:fmtScheme></a:themeElements></a:theme>";

const MESTRE =
  XML +
  `<p:sldMaster ${NS}><p:cSld>${ARVORE_VAZIA}</p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ' +
  'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';

const LAYOUT =
  XML +
  `<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Em branco">${ARVORE_VAZIA}</p:cSld>` +
  "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";

/** @param {string} texto */
function escapar(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** @param {{ texto: string, fundo: string }} s */
function slide({ texto, fundo }) {
  return (
    XML +
    `<p:sld ${NS}><p:cSld>` +
    `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${fundo}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titulo"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    // Faixa no meio do slide, a um quinto da altura: o resto é só o fundo.
    '<p:spPr><a:xfrm><a:off x="838200" y="2743200"/><a:ext cx="10515600" cy="1371600"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/>' +
    '<a:r><a:rPr lang="pt-BR" sz="5400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>' +
    `<a:t>${escapar(texto)}</a:t></a:r></a:p></p:txBody></p:sp>` +
    "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"
  );
}

/**
 * @param {{ texto: string, fundo: string }[]} slides  fundo em RRGGBB
 * @param {{ exibicao?: boolean }} [opcoes]  exibicao: salva como .ppsx (abre direto na apresentação)
 */
export function pptxDeVerdade(slides, { exibicao = false } = {}) {
  const principal = exibicao
    ? `${TIPO}.presentationml.slideshow.main+xml`
    : `${TIPO}.presentationml.presentation.main+xml`;
  /** @type {Record<string, string>} */
  const partes = {
    "[Content_Types].xml":
      XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      `<Override PartName="/ppt/presentation.xml" ContentType="${principal}"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${TIPO}.presentationml.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${TIPO}.presentationml.slideLayout+xml"/>` +
      `<Override PartName="/ppt/theme/theme1.xml" ContentType="${TIPO}.theme+xml"/>` +
      slides
        .map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${TIPO}.presentationml.slide+xml"/>`)
        .join("") +
      "</Types>",
    "_rels/.rels": rels([["rId1", "officeDocument", "ppt/presentation.xml"]]),
    "ppt/presentation.xml":
      XML +
      `<p:presentation ${NS}>` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join("")}</p:sldIdLst>` +
      '<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    "ppt/_rels/presentation.xml.rels": rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rId2", "theme", "theme/theme1.xml"],
      ...slides.map((_, i) => /** @type {[string, string, string]} */ ([`rId${i + 3}`, "slide", `slides/slide${i + 1}.xml`])),
    ]),
    "ppt/slideMasters/slideMaster1.xml": MESTRE,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "theme", "../theme/theme1.xml"],
    ]),
    "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
    "ppt/theme/theme1.xml": TEMA,
  };
  slides.forEach((s, i) => {
    partes[`ppt/slides/slide${i + 1}.xml`] = slide(s);
    partes[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]);
  });
  return zip(partes);
}
