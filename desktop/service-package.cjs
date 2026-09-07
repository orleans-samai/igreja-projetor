// Streaming package: a bounded JSON manifest followed by hashed media bytes.
// Imported names are generated here; archive paths are never used as disk paths.
const fs = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const path = require("node:path");
const os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const MAGIC = Buffer.from("LUMENPK1");
const MAX_FILE = 2 * 1024 ** 3, MAX_TOTAL = 8 * 1024 ** 3, MAX_JSON = 32 * 1024 ** 2;
function references(data) {
  const urls = new Set();
  for (const item of data.media ?? []) if (item.path && item.type !== "announcement") urls.add(item.path);
  for (const theme of data.themes ?? []) if (["image", "video"].includes(theme.backgroundType) && theme.backgroundValue) urls.add(theme.backgroundValue);
  if (data.settings?.logoUrl) urls.add(data.settings.logoUrl);
  return [...urls];
}
function replaceReferences(data, mapping) {
  const next = structuredClone(data);
  for (const item of next.media ?? []) { item.path = mapping[item.path] ?? item.path; item.sessionOnly = false; }
  for (const theme of next.themes ?? []) theme.backgroundValue = mapping[theme.backgroundValue] ?? theme.backgroundValue;
  if (next.settings?.logoUrl) next.settings.logoUrl = mapping[next.settings.logoUrl] ?? next.settings.logoUrl;
  return next;
}
async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function materialize(url, dir, resolveLocal) {
  if (typeof url !== "string") throw new Error("Referência de mídia inválida.");
  if (url.startsWith("lumen:") || url.startsWith("/")) {
    const file = await resolveLocal(url);
    if (!file) throw new Error(`Arquivo ausente: ${url}`);
    return file;
  }
  const file = path.join(dir, randomUUID());
  if (url.startsWith("data:")) {
    const match = /^data:(image|audio|video)\/[^;,]+;base64,(.*)$/s.exec(url);
    if (!match) throw new Error("Formato de mídia incorporada não suportado.");
    await fs.writeFile(file, Buffer.from(match[2], "base64"));
    return file;
  }
  if (!/^https?:\/\//.test(url)) throw new Error("Mídia temporária: coloque o arquivo na pasta de mídia antes de exportar.");
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok || !res.body) throw new Error(`Não foi possível baixar a mídia (${res.status}).`);
  let bytes = 0;
  await pipeline(Readable.fromWeb(res.body), new Transform({ transform(chunk, _enc, cb) {
    bytes += chunk.length; cb(bytes > MAX_FILE ? new Error("Mídia acima de 2 GB.") : null, chunk);
  } }), createWriteStream(file));
  return file;
}
function extension(url) {
  if (url.startsWith("data:")) {
    const mime = url.slice(5, url.indexOf(";"));
    return ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/mpeg": ".mp3", "video/mp4": ".mp4" })[mime] ?? ".bin";
  }
  const ext = path.extname(new URL(url, "lumen://app").pathname).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ".bin";
}
async function exportPackage(target, data, resolveLocal) {
  if (!data || data.format !== "lumen-service-v1") throw new Error("Culto inválido.");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lumen-package-"));
  const pending = target + "." + randomUUID() + ".tmp";
  let handle;
  try {
    const urls = references(data), entries = [], mapping = Object.create(null);
    if (urls.length > 2048) throw new Error("O pacote tem mídias demais.");
    let total = 0;
    for (const url of urls) {
      const file = await materialize(url, temp, resolveLocal);
      const { size } = await fs.stat(file);
      total += size;
      if (size > MAX_FILE || total > MAX_TOTAL) throw new Error("Limite: 2 GB por mídia e 8 GB por pacote.");
      const name = `${entries.length}${extension(url)}`;
      entries.push({ name, size, sha256: await digest(file), file });
      mapping[url] = `package:${name}`;
    }
    const manifest = Buffer.from(JSON.stringify({ data: replaceReferences(data, mapping), entries: entries.map(({ name, size, sha256 }) => ({ name, size, sha256 })) }));
    if (manifest.length > MAX_JSON) throw new Error("Dados do culto acima de 32 MB.");
    handle = await fs.open(pending, "wx");
    const length = Buffer.alloc(4); length.writeUInt32LE(manifest.length);
    await handle.writeFile(Buffer.concat([MAGIC, length, manifest]));
    for (const entry of entries) {
      let bytes = 0; const hash = createHash("sha256");
      for await (const chunk of createReadStream(entry.file)) { bytes += chunk.length; hash.update(chunk); await handle.writeFile(chunk); }
      if (bytes !== entry.size || hash.digest("hex") !== entry.sha256) throw new Error("Uma mídia mudou durante a exportação. Tente novamente.");
    }
    await handle.sync(); await handle.close(); handle = null;
    await fs.rename(pending, target);
    return { files: entries.length, bytes: total };
  } finally { await handle?.close(); await fs.rm(pending, { force: true }); await fs.rm(temp, { recursive: true, force: true }); }
}
async function importPackage(source, packageRoot) {
  const handle = await fs.open(source, "r");
  let staged;
  let position = 0;
  const read = async (size) => {
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) { const { bytesRead } = await handle.read(buffer, offset, size - offset, position); if (!bytesRead) throw new Error("Pacote incompleto."); offset += bytesRead; position += bytesRead; }
    return buffer;
  };
  try {
    const header = await read(12);
    if (!header.subarray(0, 8).equals(MAGIC)) throw new Error("Este arquivo não é um pacote Lúmen.");
    const len = header.readUInt32LE(8);
    if (len > MAX_JSON) throw new Error("Manifesto muito grande.");
    const manifest = JSON.parse((await read(len)).toString("utf8"));
    if (manifest.data?.format !== "lumen-service-v1" || !Array.isArray(manifest.entries) || manifest.entries.length > 2048) throw new Error("Manifesto inválido.");
    const names = new Set(); let total = 12 + len;
    for (const entry of manifest.entries) {
      if (!/^\d+\.[a-z0-9]{1,5}$/.test(entry.name) || names.has(entry.name) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Mídia inválida no pacote.");
      names.add(entry.name); total += entry.size;
    }
    if (total > MAX_TOTAL + MAX_JSON || total !== (await handle.stat()).size) throw new Error("Tamanho do pacote inválido.");
    const id = randomUUID();
    await fs.mkdir(packageRoot, { recursive: true });
    staged = await fs.mkdtemp(path.join(packageRoot, "import-"));
    const mapping = Object.create(null);
    for (const entry of manifest.entries) {
      const out = await fs.open(path.join(staged, entry.name), "wx");
      const hash = createHash("sha256");
      try {
        let remaining = entry.size;
        while (remaining) { const chunk = await read(Math.min(1024 * 1024, remaining)); remaining -= chunk.length; hash.update(chunk); await out.writeFile(chunk); }
      } finally { await out.close(); }
      if (hash.digest("hex") !== entry.sha256) throw new Error("Mídia danificada. Copie o pacote novamente.");
      mapping[`package:${entry.name}`] = `lumen://app/__pacotes/${id}/${entry.name}`;
    }
    for (const ref of references(manifest.data)) if (!Object.hasOwn(mapping, ref)) throw new Error("O pacote não contém todas as mídias referenciadas.");
    await fs.rename(staged, path.join(packageRoot, id)); staged = null;
    return replaceReferences(manifest.data, mapping);
  } finally { await handle.close(); if (staged) await fs.rm(staged, { recursive: true, force: true }); }
}
async function resolvePackage(url, packageRoot) {
  let parsed;
  try { parsed = new URL(url, "lumen://app"); } catch { return null; }
  if (parsed.protocol !== "lumen:" || parsed.hostname !== "app") return null;
  const pathname = parsed.pathname;
  if (!/^\/__pacotes\/[a-f0-9-]{36}\/\d+\.[a-z0-9]{1,5}$/.test(pathname)) return null;
  const file = path.join(packageRoot, ...pathname.split("/").slice(2));
  return await fs.stat(file).then((s) => s.isFile() ? file : null).catch(() => null);
}
module.exports = { exportPackage, importPackage, references, resolvePackage };
