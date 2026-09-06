import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = join(root, "public/__grok/icon-180.png");
const outDir = join(root, "desktop/build");
mkdirSync(outDir, { recursive: true });

if (!existsSync(pngPath)) {
  console.error("icon png missing");
  process.exit(1);
}

const png = readFileSync(pngPath);
writeFileSync(join(outDir, "icon.png"), png);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const dir = Buffer.alloc(16);
dir[0] = 0;
dir[1] = 0;
dir.writeUInt16LE(1, 4);
dir.writeUInt16LE(32, 6);
dir.writeUInt32LE(png.length, 8);
dir.writeUInt32LE(22, 12);
writeFileSync(join(outDir, "icon.ico"), Buffer.concat([header, dir, png]));
console.log("wrote desktop/build/icon.ico");
