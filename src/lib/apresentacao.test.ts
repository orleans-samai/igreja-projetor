import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDoDesenhoProprio, avisoDoLeitorProprio, motivoDeNaoImportar, sabeImportar } from "./apresentacao.ts";

test("PowerPoint em todos os formatos, OpenDocument e PDF entram; o resto não", () => {
  for (const nome of ["Culto.pptx", "Culto.PPSX", "antigo.ppt", "exibicao.pps", "libre.odp", "estudo.pdf"]) {
    assert.equal(sabeImportar(nome), true, nome);
  }
  for (const nome of ["carta.docx", "planilha.xlsx", "video.mp4", "sem-extensao"]) {
    assert.equal(sabeImportar(nome), false, nome);
  }
});

test("o que não entra diz o que fazer em vez disso", () => {
  assert.match(motivoDeNaoImportar("antigo.ppt"), /LibreOffice/);
  assert.match(motivoDeNaoImportar("carta.docx"), /\.ppsx/);
});

test("o aviso do leitor simplificado ensina a deixar igual ao PowerPoint", () => {
  assert.match(avisoDoLeitorProprio({ semConversor: true, error: "" }), /Instale o LibreOffice/);
  assert.match(
    avisoDoLeitorProprio({ error: "O LibreOffice não conseguiu abrir essa apresentação." }),
    /não conseguiu abrir/,
  );
});

test("o desenho do próprio Lúmen só avisa do que a igreja vai notar", () => {
  const semConversor = { semConversor: true, error: "" };
  assert.equal(avisoDoDesenhoProprio(semConversor, [], []), undefined);
  assert.match(avisoDoDesenhoProprio(semConversor, ["Montserrat"], []) ?? "", /Montserrat.*instale o LibreOffice/);
  assert.match(avisoDoDesenhoProprio(semConversor, [], ["gráfico"]) ?? "", /Ficou de fora: gráfico/);
  // O PowerPoint ou o LibreOffice recusaram: diz por quê, e que o Lúmen desenhou.
  const recusou = { error: "Nem o PowerPoint nem o LibreOffice conseguiram abrir essa apresentação." };
  assert.match(avisoDoDesenhoProprio(recusou, [], []) ?? "", /conseguiram abrir.*O Lúmen desenhou/);
  assert.doesNotMatch(avisoDoDesenhoProprio(recusou, [], []) ?? "", /instale/);
});
