// Streaming package: a bounded JSON manifest followed by hashed media bytes.
// Imported names are generated here; archive paths are never used as disk paths.
const fs = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const https = require("node:https");
const path = require("node:path");
const os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const { lookup } = require("node:dns/promises");
const { BlockList, isIP } = require("node:net");
const MAGIC = Buffer.from("LUMENPK1");
const MAX_FILE = 2 * 1024 ** 3, MAX_TOTAL = 8 * 1024 ** 3, MAX_JSON = 32 * 1024 ** 2;
const MAX_INLINE = 100 * 1024 ** 2;
const MAX_REDIRECTS = 3;

// Package export runs in the privileged main process. Resolve every remote
// hop first so renderer-controlled media URLs cannot reach loopback or a LAN.
const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["100::", 64],
  ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
]) blockedAddresses.addSubnet(network, prefix, "ipv6");

function isBlockedAddress(address, family) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return blockedAddresses.check(mapped, "ipv4");
  return blockedAddresses.check(address, family === 6 ? "ipv6" : "ipv4");
}

async function resolvePublicHttpsUrl(raw, lookupImpl = lookup) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("URL de mídia inválida."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    throw new Error("Mídia remota deve usar HTTPS público na porta padrão.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  let addresses;
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await lookupImpl(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Não foi possível localizar o servidor da mídia.");
  }
  if (!addresses.length || addresses.some(({ address, family }) => isBlockedAddress(address, family)))
    throw new Error("Mídia remota aponta para uma rede local ou reservada.");
  return { url, addresses };
}

async function assertPublicHttpsUrl(raw, lookupImpl = lookup) {
  return (await resolvePublicHttpsUrl(raw, lookupImpl)).url;
}

function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  };
}

function decodeInlineMedia(url, maxBytes = MAX_INLINE) {
  const match = /^data:(image|audio|video)\/[^;,]+;base64,([a-z0-9+/]*={0,2})$/is.exec(url);
  if (!match || match[2].length % 4 === 1)
    throw new Error("Formato de mídia incorporada não suportado.");
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const decodedSize = Math.floor(match[2].length * 3 / 4) - padding;
  if (decodedSize > maxBytes) throw new Error("Mídia incorporada acima de 100 MB.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length !== decodedSize) throw new Error("Mídia incorporada inválida.");
  return bytes;
}

async function downloadRemote(raw, file) {
  let url = raw;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const safe = await resolvePublicHttpsUrl(url);
    // Pin the connection to the addresses that were approved above. A second
    // DNS lookup inside fetch would reopen the check/use gap to DNS rebinding.
    const res = await new Promise((resolve, reject) => {
      const req = https.get(safe.url, {
        lookup: pinnedLookup(safe.addresses),
      }, resolve);
      req.setTimeout(120000, () => req.destroy(new Error("Tempo esgotado ao baixar a mídia.")));
      req.on("error", reject);
    });
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
      const location = res.headers.location;
      res.resume();
      if (!location || redirects === MAX_REDIRECTS)
        throw new Error("Redirecionamentos demais ao baixar a mídia.");
      url = new URL(location, safe.url).href;
      continue;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.resume();
      throw new Error(`Não foi possível baixar a mídia (${res.statusCode}).`);
    }
    const declared = Number(res.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_FILE) {
      res.destroy();
      throw new Error("Mídia acima de 2 GB.");
    }
    let bytes = 0;
    await pipeline(res, new Transform({ transform(chunk, _enc, cb) {
      bytes += chunk.length;
      cb(bytes > MAX_FILE ? new Error("Mídia acima de 2 GB.") : null, chunk);
    } }), createWriteStream(file));
    return;
  }
}
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
    await fs.writeFile(file, decodeInlineMedia(url));
    return file;
  }
  if (!/^https?:\/\//.test(url)) throw new Error("Mídia temporária: coloque o arquivo na pasta de mídia antes de exportar.");
  await downloadRemote(url, file);
  return file;
}
function extension(url) {
  if (url.startsWith("data:")) {
    const mime = url.slice(5, url.indexOf(";"));
    return ({
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/gif": ".gif",
      "image/avif": ".avif",
      "image/bmp": ".bmp",
      "audio/mpeg": ".mp3",
      "audio/mp4": ".m4a",
      "audio/aac": ".aac",
      "audio/wav": ".wav",
      "audio/x-wav": ".wav",
      "audio/ogg": ".ogg",
      "audio/opus": ".opus",
      "audio/flac": ".flac",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/ogg": ".ogv",
    })[mime] ?? ".bin";
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
module.exports = {
  exportPackage,
  importPackage,
  references,
  resolvePackage,
  assertPublicHttpsUrl,
  decodeInlineMedia,
  pinnedLookup,
};
