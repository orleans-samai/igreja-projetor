#!/usr/bin/env node
/**
 * Gera as Bíblias embutidas a partir dos arquivos VPL do eBible.org.
 *
 *   node --experimental-strip-types scripts/gerar-biblias.mjs <pasta-com-os-vpl>
 *
 * A pasta deve ter `poronbv_vpl.txt`, `porbrbsl_vpl.txt` e `porblt_vpl.txt`,
 * baixados de https://ebible.org/Scriptures/<id>_vpl.zip.
 *
 * Fica no repositório por um motivo que não é técnico: duas dessas versões
 * são CC BY-SA, que pede para dizer de onde o texto veio e o que foi feito
 * com ele. Aqui está escrito — só a troca de formato, e, na domínio
 * público, a limpeza do espaço solto antes de pontuação.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lerVpl } from "../src/lib/biblia-vpl.ts";

export const VERSOES = [
  {
    arquivo: "poronbv_vpl.txt",
    id: "nvb-2007",
    name: "Nova Bíblia Viva",
    license:
      "Biblica® Open Nova Bíblia Viva™ Copyright © 2007, 2010 by Biblica, Inc. — CC BY-SA 4.0. " +
      "“Biblica” é uma marca registrada nos EUA por Biblica, Inc. Usado com permissão. " +
      "Original gratuito em biblica.com e open.bible.",
    // CC BY-SA: o texto vai como veio. Troca de formato não é mudança de texto.
    arrumar: false,
  },
  {
    arquivo: "porbrbsl_vpl.txt",
    id: "bpm-2026",
    name: "Bíblia Portuguesa Mundial",
    license: "domínio público — eBible.org (tradução ainda em revisão pelos autores)",
    // Domínio público: o espaço solto antes da vírgula pode sair.
    arrumar: true,
  },
  {
    arquivo: "porblt_vpl.txt",
    id: "blt-2022",
    name: "Bíblia Livre Para Todos (NT)",
    license: "Copyright © 2022 Free Bible Ministry, Inc. — CC BY-SA 4.0 — eBible.org",
    arrumar: false,
  },
];

const pasta = process.argv[2];
if (!pasta) {
  console.error("Uso: node --experimental-strip-types scripts/gerar-biblias.mjs <pasta-com-os-vpl>");
  process.exit(1);
}

const destino = path.resolve(import.meta.dirname, "..", "public", "bible");
for (const v of VERSOES) {
  const texto = await readFile(path.join(pasta, v.arquivo), "utf8");
  const biblia = lerVpl(texto, v);
  const versiculos = biblia.books.reduce((n, b) => n + b.c.reduce((m, c) => m + c.length, 0), 0);
  await writeFile(path.join(destino, `${v.id}.json`), JSON.stringify(biblia));
  console.log(`${v.id}: ${biblia.books.length} livros, ${versiculos} versículos`);
}
