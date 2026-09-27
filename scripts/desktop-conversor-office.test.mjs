import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pptxDeVerdade } from "./pptx-de-teste.mjs";

const require = createRequire(import.meta.url);
const { paraPdf, conversorDisponivel, acharLibreOffice } = require("../desktop/conversor-office.cjs");

const nenhum = { temPowerPoint: async () => false, acharLibreOffice: async () => null };

async function pasta() {
  return mkdtemp(path.join(os.tmpdir(), "lumen-conversor-"));
}

function paginasDoPdf(bytes) {
  return (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

test("sem PowerPoint e sem LibreOffice, a conversão diz que falta quem desenhe", async () => {
  const dir = await pasta();
  try {
    const entrada = path.join(dir, "Culto.pptx");
    await writeFile(entrada, pptxDeVerdade([{ texto: "Oi", fundo: "1F3B73" }]));
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), nenhum);
    assert.equal(r.ok, false);
    assert.equal(r.semConversor, true);
    assert.equal(await conversorDisponivel(nenhum), null);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("só apresentação vai para o conversor", async () => {
  const dir = await pasta();
  try {
    for (const nome of ["carta.docx", "planilha.xlsx", "script.ps1", "sem-extensao"]) {
      const r = await paraPdf(path.join(dir, nome), path.join(dir, "saida"), path.join(dir, "perfil"), {
        temPowerPoint: async () => {
          throw new Error("não devia nem perguntar");
        },
        acharLibreOffice: async () => {
          throw new Error("não devia nem procurar");
        },
      });
      assert.equal(r.ok, false, nome);
      assert.notEqual(r.semConversor, true, nome);
    }
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("o PowerPoint tem a preferência; sem ele, o LibreOffice", async () => {
  assert.equal(
    await conversorDisponivel({ temPowerPoint: async () => true, acharLibreOffice: async () => "soffice.exe" }),
    "PowerPoint",
  );
  assert.equal(
    await conversorDisponivel({ temPowerPoint: async () => false, acharLibreOffice: async () => "soffice.exe" }),
    "LibreOffice",
  );
});

test("acha o LibreOffice no lugar em que ele foi instalado", async () => {
  const dir = await pasta();
  try {
    const soffice = path.join(dir, "soffice.exe");
    await writeFile(soffice, "");
    assert.equal(await acharLibreOffice([path.join(dir, "nao-existe.exe"), soffice]), soffice);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

// Com o LibreOffice instalado (a máquina de quem desenvolve e a da igreja
// que escolheu instalá-lo), prova a conversão de verdade. Sem ele, pula —
// o CI do GitHub não tem LibreOffice.
const instalado = await acharLibreOffice();

test(
  "o LibreOffice desenha .pptx e .ppsx de verdade: uma página de PDF por slide",
  { skip: instalado ? false : "LibreOffice não instalado neste computador" },
  async () => {
    const dir = await pasta();
    try {
      const slides = [
        { texto: "Bem-vindos", fundo: "1F3B73" },
        { texto: "Santa Ceia", fundo: "7A1F1F" },
        { texto: "Oferta", fundo: "1F6B3B" },
      ];
      const libre = { temPowerPoint: async () => false, acharLibreOffice };
      for (const [nome, exibicao] of [["Culto de Domingo.pptx", false], ["Culto em Exibição.ppsx", true]]) {
        const entrada = path.join(dir, nome);
        await writeFile(entrada, pptxDeVerdade(slides, { exibicao }));
        const r = await paraPdf(entrada, path.join(dir, `saida-${exibicao}`), path.join(dir, "perfil"), libre);
        assert.equal(r.ok, true, `${nome}: ${r.error}`);
        assert.equal(r.com, "LibreOffice");
        const pdf = await readFile(r.pdf);
        assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-", nome);
        assert.equal(paginasDoPdf(pdf), 3, `${nome}: páginas no PDF`);
      }
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  },
);
