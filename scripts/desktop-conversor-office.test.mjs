import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pptxDeVerdade } from "./pptx-de-teste.mjs";
import { zip } from "./zip-de-teste.mjs";

const require = createRequire(import.meta.url);
const { paraPdf, conversorDisponivel, programasInstalados, acharLibreOffice, temPowerPoint, temSenha, descanso } =
  require("../desktop/conversor-office.cjs");

const nenhum = { temPowerPoint: async () => false, acharLibreOffice: async () => null };

async function pasta() {
  return mkdtemp(path.join(os.tmpdir(), "lumen-conversor-"));
}

function paginasDoPdf(bytes) {
  return (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

const SLIDES = [
  { texto: "Bem-vindos", fundo: "1F3B73" },
  { texto: "Santa Ceia", fundo: "7A1F1F" },
  { texto: "Oferta", fundo: "1F6B3B" },
];

/** Um "PowerPoint" e um "LibreOffice" de mentira, que anotam quem foi chamado e com qual arquivo. */
function falsos({ powerPoint = null, libre = null } = {}) {
  const chamadas = [];
  const desenha = async (pdf) => writeFile(pdf, "%PDF-1.4 falso");
  return {
    chamadas,
    conversores: {
      temPowerPoint: async () => powerPoint !== null,
      acharLibreOffice: async () => (libre !== null ? "soffice.exe" : null),
      comPowerPoint: async (entrada, pdf) => {
        chamadas.push(["PowerPoint", entrada]);
        if (powerPoint === "ok") await desenha(pdf);
        return { ok: powerPoint === "ok", senha: powerPoint === "senha", travou: powerPoint === "travou" };
      },
      comLibreOffice: async (_soffice, entrada, _pasta, _perfil, pdf) => {
        chamadas.push(["LibreOffice", entrada]);
        if (libre === "ok") await desenha(pdf);
        return { ok: libre === "ok", travou: libre === "travou" };
      },
      powerPointTravado: descanso(),
    },
  };
}

async function comApresentacao(corpo) {
  const dir = await pasta();
  const entrada = path.join(dir, "Culto de Domingo.pptx");
  await writeFile(entrada, pptxDeVerdade([{ texto: "Oi", fundo: "1F3B73" }]));
  try {
    await corpo(dir, entrada);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

test("sem PowerPoint e sem LibreOffice, a conversão diz que falta quem desenhe", async () => {
  await comApresentacao(async (dir, entrada) => {
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), nenhum);
    assert.equal(r.ok, false);
    assert.equal(r.semConversor, true);
    assert.equal(await conversorDisponivel(nenhum), null);
  });
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

test("com o PowerPoint funcionando, o LibreOffice nem é chamado", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "ok", libre: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, true);
    assert.equal(r.com, "PowerPoint");
    assert.deepEqual(chamadas.map(([quem]) => quem), ["PowerPoint"]);
  });
});

test("o PowerPoint não conseguiu: o LibreOffice desenha", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "falha", libre: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, true);
    assert.equal(r.com, "LibreOffice");
    assert.deepEqual(chamadas.map(([quem]) => quem), ["PowerPoint", "LibreOffice"]);
  });
});

test("os dois falharam: não é falta de conversor, é a apresentação", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { conversores } = falsos({ powerPoint: "falha", libre: "falha" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, false);
    assert.notEqual(r.semConversor, true);
    assert.match(r.error, /Nem o PowerPoint nem o LibreOffice/);
  });
});

test("só com PowerPoint, e ele falhou: a cabine ouve que foi o PowerPoint", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { conversores } = falsos({ powerPoint: "falha" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, false);
    assert.notEqual(r.semConversor, true);
    assert.match(r.error, /PowerPoint não conseguiu/);
  });
});

test("PowerPoint travado fica de fora das próximas: o culto não espera dois minutos de novo", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "travou", libre: "ok" });
    const primeira = await paraPdf(entrada, path.join(dir, "a"), path.join(dir, "perfil"), conversores);
    assert.equal(primeira.com, "LibreOffice");
    const segunda = await paraPdf(entrada, path.join(dir, "b"), path.join(dir, "perfil"), conversores);
    assert.equal(segunda.com, "LibreOffice");
    assert.deepEqual(
      chamadas.map(([quem]) => quem),
      ["PowerPoint", "LibreOffice", "LibreOffice"],
    );
  });
});

// O menu Slides da cabine: a igreja escolhe quem abre as apresentações.
test("com o LibreOffice escolhido, ele vai na frente mesmo tendo PowerPoint", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "ok", libre: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores, "libreoffice");
    assert.equal(r.ok, true);
    assert.equal(r.com, "LibreOffice");
    assert.equal(r.pulou, undefined);
    assert.deepEqual(chamadas.map(([quem]) => quem), ["LibreOffice"]);
  });
});

test("o LibreOffice escolhido não está instalado: o PowerPoint desenha e a cabine sabe por quê", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores, "libreoffice");
    assert.equal(r.ok, true);
    assert.equal(r.com, "PowerPoint");
    assert.match(r.pulou, /LibreOffice não está instalado/);
    assert.deepEqual(chamadas.map(([quem]) => quem), ["PowerPoint"]);
  });
});

test("o LibreOffice escolhido recusou: o PowerPoint ainda desenha, e o culto não fica sem slides", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "ok", libre: "falha" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores, "libreoffice");
    assert.equal(r.com, "PowerPoint");
    assert.match(r.pulou, /LibreOffice não conseguiu/);
    assert.deepEqual(chamadas.map(([quem]) => quem), ["LibreOffice", "PowerPoint"]);
  });
});

test("o PowerPoint recusou e o LibreOffice desenhou: o motivo vem junto", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { conversores } = falsos({ powerPoint: "falha", libre: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.com, "LibreOffice");
    assert.match(r.pulou, /PowerPoint não conseguiu/);
  });
});

test("o menu Slides sabe quais programas o computador tem", async () => {
  assert.deepEqual(await programasInstalados(nenhum), { powerPoint: false, libreOffice: false });
  assert.deepEqual(
    await programasInstalados({ temPowerPoint: async () => true, acharLibreOffice: async () => "soffice.exe" }),
    { powerPoint: true, libreOffice: true },
  );
});

test("o PowerPoint pediu senha: para aí, sem LibreOffice nem leitor próprio", async () => {
  await comApresentacao(async (dir, entrada) => {
    const { chamadas, conversores } = falsos({ powerPoint: "senha", libre: "ok" });
    const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, false);
    assert.equal(r.comSenha, true);
    assert.match(r.error, /senha/);
    assert.deepEqual(chamadas.map(([quem]) => quem), ["PowerPoint"]);
  });
});

test("cada programa recebe uma cópia dentro da pasta de trabalho, nunca o original", async () => {
  await comApresentacao(async (dir, entrada) => {
    const original = await readFile(entrada);
    const { chamadas, conversores } = falsos({ powerPoint: "falha", libre: "ok" });
    const saida = path.join(dir, "saida");
    await paraPdf(entrada, saida, path.join(dir, "perfil"), conversores);
    for (const [quem, arquivo] of chamadas) {
      assert.notEqual(arquivo, entrada, quem);
      assert.equal(path.dirname(arquivo), saida, quem);
      assert.deepEqual(await readFile(arquivo), original, quem);
    }
  });
});

// Um .pptx com senha é um arquivo OLE (assinatura D0 CF 11 E0) com a parte
// "EncryptedPackage" dentro. Montado aqui só com o que a conferência olha.
function pptxComSenha() {
  const ole = Buffer.alloc(4096);
  Buffer.from("d0cf11e0a1b11ae1", "hex").copy(ole, 0);
  Buffer.from("EncryptedPackage", "utf16le").copy(ole, 1024);
  return ole;
}

test("apresentação com senha é reconhecida antes de chamar qualquer programa", async () => {
  const dir = await pasta();
  try {
    const trancada = path.join(dir, "Trancada.pptx");
    await writeFile(trancada, pptxComSenha());
    const aberta = path.join(dir, "Aberta.pptx");
    await writeFile(aberta, pptxDeVerdade([{ texto: "Oi", fundo: "1F3B73" }]));
    assert.equal(await temSenha(trancada), true);
    assert.equal(await temSenha(aberta), false);
    const { chamadas, conversores } = falsos({ powerPoint: "ok", libre: "ok" });
    const r = await paraPdf(trancada, path.join(dir, "saida"), path.join(dir, "perfil"), conversores);
    assert.equal(r.ok, false);
    assert.equal(r.comSenha, true);
    assert.equal(chamadas.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
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

// Com o PowerPoint ou o LibreOffice instalados (a máquina de quem
// desenvolve e a da igreja), prova a conversão de verdade. Sem eles, pula —
// o CI do GitHub não tem nenhum dos dois.
const libreInstalado = await acharLibreOffice();
const powerPointInstalado = await temPowerPoint();

async function converteDeVerdade(conversores, com) {
  const dir = await pasta();
  try {
    for (const [nome, exibicao] of [["Culto de Domingo.pptx", false], ["Culto em Exibição.ppsx", true]]) {
      const entrada = path.join(dir, nome);
      await writeFile(entrada, pptxDeVerdade(SLIDES, { exibicao }));
      const r = await paraPdf(entrada, path.join(dir, `saida-${exibicao}`), path.join(dir, "perfil"), conversores);
      assert.equal(r.ok, true, `${nome}: ${r.error}`);
      assert.equal(r.com, com);
      const pdf = await readFile(r.pdf);
      assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-", nome);
      assert.equal(paginasDoPdf(pdf), 3, `${nome}: páginas no PDF`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

test(
  "o PowerPoint desenha .pptx e .ppsx de verdade: uma página de PDF por slide",
  { skip: powerPointInstalado ? false : "PowerPoint não instalado neste computador" },
  async () => {
    await converteDeVerdade({ temPowerPoint, acharLibreOffice: async () => null, powerPointTravado: descanso() }, "PowerPoint");
  },
);

test(
  "arquivo com defeito o PowerPoint recusa na hora, sem janela esperando resposta",
  { skip: powerPointInstalado ? false : "PowerPoint não instalado neste computador" },
  async () => {
    const dir = await pasta();
    try {
      // Sem [Content_Types].xml, sem mestre, sem tema: o PowerPoint não abre.
      // Tem de dizer isso depressa — uma janela de "reparar?" travaria o culto.
      const entrada = path.join(dir, "Defeito.pptx");
      await writeFile(
        entrada,
        zip({ "ppt/presentation.xml": "<p:presentation/>", "ppt/slides/slide1.xml": "<p:sld/>" }),
      );
      const inicio = Date.now();
      const r = await paraPdf(entrada, path.join(dir, "saida"), path.join(dir, "perfil"), {
        temPowerPoint,
        acharLibreOffice: async () => null,
        powerPointTravado: descanso(),
      });
      assert.equal(r.ok, false);
      assert.notEqual(r.semConversor, true);
      assert.ok(Date.now() - inicio < 90_000, `o PowerPoint levou ${Date.now() - inicio} ms para recusar`);
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  },
);

test(
  "o LibreOffice desenha .pptx e .ppsx de verdade: uma página de PDF por slide",
  { skip: libreInstalado ? false : "LibreOffice não instalado neste computador" },
  async () => {
    await converteDeVerdade({ temPowerPoint: async () => false, acharLibreOffice }, "LibreOffice");
  },
);
