const fs = require("node:fs/promises");
const path = require("node:path");

const KEYS = new Set(["lumen-v2", "lumen-ops-v1", "lumen-bibles-v1"]);
const LIMIT = 100 * 1024 * 1024;

function validate(data) {
  if (!data || data.format !== "lumen-backup-v1" || !data.values || typeof data.values !== "object" || Array.isArray(data.values)) {
    throw new Error("Backup Lúmen inválido.");
  }
  for (const [key, value] of Object.entries(data.values)) {
    if (!KEYS.has(key) || typeof value !== "string" || Buffer.byteLength(value) > LIMIT) throw new Error("Conteúdo de backup inválido.");
    const parsed = JSON.parse(value);
    if (key === "lumen-bibles-v1") {
      if (!Array.isArray(parsed) || parsed.some((b) => !b || typeof b.id !== "string" || !Array.isArray(b.books))) throw new Error("Bíblias inválidas.");
    } else if (!parsed || typeof parsed.state !== "object" || !parsed.state || Array.isArray(parsed.state)) {
      throw new Error("Estado de biblioteca inválido.");
    }
  }
  return data;
}

class Storage {
  constructor(dir, report = () => {}) {
    this.dir = dir;
    this.file = path.join(dir, "library.json");
    this.report = report;
    this.data = { format: "lumen-backup-v1", values: {} };
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    const candidates = [this.file, this.file + ".bak"];
    let damaged = false;
    for (const file of candidates) {
      try {
        const raw = await fs.readFile(file, "utf8");
        if (Buffer.byteLength(raw) > LIMIT) throw new Error("Arquivo muito grande.");
        this.data = validate(JSON.parse(raw));
        if (damaged) {
          await fs.copyFile(this.file, this.file + `.corrupt-${Date.now()}`).catch(() => {});
          await this.atomic(this.file, JSON.stringify(this.data));
          this.report("Biblioteca recuperada da cópia de segurança.");
        }
        await this.archive();
        return;
      } catch (error) {
        if (error.code !== "ENOENT") damaged = true;
      }
    }
    if (damaged) throw new Error("Biblioteca e backup não puderam ser lidos. Os arquivos foram preservados; restaure um backup pela pasta de dados.");
  }
  async atomic(file, text) {
    const handle = await fs.open(file + ".tmp", "w");
    try { await handle.writeFile(text, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(file + ".tmp", file);
  }
  async archive() {
    const dir = path.join(this.dir, "backups");
    await fs.mkdir(dir, { recursive: true });
    await this.atomic(path.join(dir, `backup-${Date.now()}.json`), JSON.stringify(this.data));
    const files = (await fs.readdir(dir)).filter((f) => /^backup-\d+\.json$/.test(f)).sort().reverse();
    for (const file of files.slice(7)) await fs.unlink(path.join(dir, file));
  }
  enqueue(operation) {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => {});
    return task;
  }
  async get(key) {
    if (!KEYS.has(key)) throw new Error("Chave inválida.");
    await this.queue;
    return this.data.values[key] ?? null;
  }
  set(key, value) {
    if (!KEYS.has(key)) return Promise.reject(new Error("Chave inválida."));
    return this.enqueue(async () => {
      if (this.data.values[key] === value) return;
      const values = { ...this.data.values };
      if (value === null) delete values[key]; else values[key] = value;
      const next = validate({ format: "lumen-backup-v1", values });
      const raw = JSON.stringify(next);
      if (Buffer.byteLength(raw) > LIMIT) throw new Error("Biblioteca acima de 100 MB. Remova imagens grandes após exportar um backup.");
      await this.atomic(this.file + ".bak", JSON.stringify(this.data));
      await this.atomic(this.file, raw);
      this.data = next;
    });
  }
  async export() { await this.queue; return JSON.stringify(this.data, null, 2); }
  restore(raw) {
    if (Buffer.byteLength(raw) > LIMIT) return Promise.reject(new Error("Backup acima de 100 MB."));
    const next = validate(JSON.parse(raw));
    return this.enqueue(async () => {
      await this.archive();
      await this.atomic(this.file + ".bak", JSON.stringify(this.data));
      await this.atomic(this.file, JSON.stringify(next));
      this.data = next;
    });
  }
}
module.exports = { Storage, validate };
