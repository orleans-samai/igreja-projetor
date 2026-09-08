#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const builder = join(root, "node_modules", "electron-builder", "cli.js");
const args = process.argv.slice(2);
if (args.some((a) => !["--x64", "--arm64", "--signed"].includes(a))) throw new Error("Use --x64, --arm64 ou --signed. Windows de 32 bits não é suportado.");
const arches = args.filter((a) => ["--x64", "--arm64"].includes(a));
if (!arches.length) arches.push("--x64", "--arm64");
const signed = args.includes("--signed");
const destino = join(root, "dist-win", "release");

function empacotar(archArg, saida) {
  const command = [builder, "--win", archArg, "--publish", "never"];
  if (saida) command.push(`-c.directories.output=${saida}`);
  if (signed) command.push("-c.win.signAndEditExecutable=true", "-c.forceCodeSigning=true");
  const run = spawnSync(process.execPath, command, {
    cwd: root, stdio: "inherit",
    env: { ...process.env, ...(signed ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: "false" }) },
  });
  if (run.error) throw run.error;
  return run.status ?? 1;
}

/**
 * Onde o pacote é montado.
 *
 * Nunca dentro do projeto. O antivírus do Windows segura a pasta recém-
 * extraída quando o projeto mora em Downloads ou em OneDrive, e o
 * electron-builder morre no rename do win-unpacked — de forma intermitente,
 * que é pior do que falhar sempre. Montar fora e copiar o resultado custa
 * segundos e vale em qualquer máquina, inclusive na do GitHub.
 */
const oficina = join(process.env.LOCALAPPDATA || tmpdir(), "lumen-build", "release");

const hashes = [];
for (const archArg of new Set(arches)) {
  const arch = archArg.slice(2);
  const saida = oficina;
  rmSync(saida, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  const status = empacotar(archArg, saida);
  if (status !== 0) process.exit(status);
  for (const file of [`Lúmen-Setup-${pkg.version}-${arch}.exe`, `Lúmen-${pkg.version}-${arch}.zip`]) {
    const origem = join(saida, file);
    if (!existsSync(origem)) throw new Error(`Artefato ausente: ${origem}`);
    const target = join(destino, file);
    if (origem !== target) {
      mkdirSync(destino, { recursive: true });
      copyFileSync(origem, target);
      // O blockmap e o latest.yml descrevem este arquivo; deixados para trás,
      // apontariam para a compilação anterior.
      for (const extra of [`${file}.blockmap`, "latest.yml"]) {
        if (existsSync(join(saida, extra))) copyFileSync(join(saida, extra), join(destino, extra));
      }
    }
    hashes.push(`${createHash("sha256").update(readFileSync(target)).digest("hex")}  ${file}`);
    console.log(`Gerado: ${target}`);
  }
}
writeFileSync(join(root, "dist-win", "release", "SHA256SUMS.txt"), hashes.join("\n") + "\n");
console.log("Portátil: extraia TODO o ZIP antes de abrir Lúmen.exe. Os dados ficam no perfil do usuário deste PC.");
console.log(signed ? "Assinatura exigida nesta compilação." : "Compilação sem assinatura. Use win:release com certificado para distribuição assinada.");
