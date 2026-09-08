#!/usr/bin/env node
/**
 * Compiles dist-win/Lúmen-Setup-<version>.exe with Linux makensis.
 * Expects electron-builder --win dir output in dist-win/win-unpacked.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = join(root, "dist-win", "win-unpacked");
const exeName = "Lúmen.exe";
const exePath = join(unpacked, exeName);
const nsi = join(root, "desktop", "installer", "lumen-setup.nsi");
const icon = join(root, "desktop", "build", "icon.ico");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version || "1.0.0";
const outDir = join(root, "dist-win");
const outFile = join(outDir, `Lúmen-Setup-${version}.exe`);
const artifacts = join(root, "artifacts");

const nsisDir = process.env.NSISDIR || "/opt/nsis/usr/share/nsis";
const makensis = process.env.MAKENSIS || "/opt/nsis/usr/bin/makensis";

if (!existsSync(exePath)) {
  console.error("win-unpacked ausente — rode electron-builder --win dir primeiro");
  process.exit(1);
}
if (!existsSync(nsi)) {
  console.error("script NSIS ausente:", nsi);
  process.exit(1);
}
if (!existsSync(makensis)) {
  console.error("makensis não encontrado em", makensis);
  process.exit(1);
}

await patchExeIcon(exePath, icon);

mkdirSync(outDir, { recursive: true });
const args = [
  "-V3",
  "-INPUTCHARSET",
  "UTF8",
  `-DUNPACKED=${unpacked}`,
  `-DOUTFILE=${outFile}`,
];
if (existsSync(icon)) args.push(`-DICON=${icon}`);
args.push(nsi);

console.log("makensis", args.join(" "));
const run = spawnSync(makensis, args, {
  env: { ...process.env, NSISDIR: nsisDir },
  stdio: "inherit",
});
if (run.status !== 0) {
  if (existsSync(icon) && args.some((a) => a.startsWith("-DICON="))) {
    console.warn("retry without custom icon");
    const retry = spawnSync(
      makensis,
      args.filter((a) => !a.startsWith("-DICON=")),
      { env: { ...process.env, NSISDIR: nsisDir }, stdio: "inherit" },
    );
    if (retry.status !== 0) process.exit(retry.status ?? 1);
  } else {
    process.exit(run.status ?? 1);
  }
}

if (!existsSync(outFile)) {
  console.error("instalador não foi gerado");
  process.exit(1);
}
mkdirSync(artifacts, { recursive: true });
const artifactCopy = join(artifacts, `Lúmen-Setup-${version}.exe`);
copyFileSync(outFile, artifactCopy);
const mb = (statSync(outFile).size / (1024 * 1024)).toFixed(1);
console.log(`ok ${outFile} (${mb} MB)`);
console.log(`copy ${artifactCopy}`);

async function patchExeIcon(target, ico) {
  if (!existsSync(ico)) return;
  try {
    const ResEdit = await import("resedit");
    const peLibrary = ResEdit.NtExecutable ? ResEdit : await import("pe-library");
    const NtExecutable = ResEdit.NtExecutable || peLibrary.NtExecutable;
    const NtExecutableResource = ResEdit.NtExecutableResource || peLibrary.NtExecutableResource;
    const data = readFileSync(target);
    const exe = NtExecutable.from(data);
    const res = NtExecutableResource.from(exe);
    const iconFile = ResEdit.Data.IconFile.from(readFileSync(ico));
    const lang = 1033;
    const existing = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    const id = existing[0]?.id ?? 1;
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      id,
      lang,
      iconFile.icons.map((item) => item.data),
    );
    res.outputResource(exe);
    writeFileSync(target, Buffer.from(exe.generate()));
    console.log("ícone gravado em", target);
  } catch (err) {
    console.warn("não deu para gravar o ícone no .exe:", err instanceof Error ? err.message : err);
  }
}
