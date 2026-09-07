#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const hashes = [];
for (const archArg of new Set(arches)) {
  const arch = archArg.slice(2);
  const command = [builder, "--win", archArg, "--publish", "never"];
  if (signed) command.push("-c.win.signAndEditExecutable=true", "-c.forceCodeSigning=true");
  const run = spawnSync(process.execPath, command, {
    cwd: root, stdio: "inherit",
    env: { ...process.env, ...(signed ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: "false" }) },
  });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
  for (const file of [`Lúmen-Setup-${pkg.version}-${arch}.exe`, `Lúmen-${pkg.version}-${arch}.zip`]) {
    const target = join(root, "dist-win", "release", file);
    if (!existsSync(target)) throw new Error(`Artefato ausente: ${target}`);
    hashes.push(`${createHash("sha256").update(readFileSync(target)).digest("hex")}  ${file}`);
    console.log(`Gerado: ${target}`);
  }
}
writeFileSync(join(root, "dist-win", "release", "SHA256SUMS.txt"), hashes.join("\n") + "\n");
console.log("Portátil: extraia TODO o ZIP antes de abrir Lúmen.exe. Os dados ficam no perfil do usuário deste PC.");
console.log(signed ? "Assinatura exigida nesta compilação." : "Compilação sem assinatura. Use win:release com certificado para distribuição assinada.");
