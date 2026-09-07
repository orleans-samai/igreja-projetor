import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import storageModule from "../desktop/storage.cjs";
const { Storage } = storageModule;
const state = (title) => JSON.stringify({ state: { title }, version: 0 });
test("serializes saves, survives restart, exports and restores", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-storage-"));
  try {
    const store = new Storage(dir); await store.init();
    await Promise.all([store.set("lumen-v2", state("primeiro")), store.set("lumen-v2", state("último")), store.set("lumen-ops-v1", state("operador"))]);
    const restarted = new Storage(dir); await restarted.init();
    assert.equal(await restarted.get("lumen-v2"), state("último"));
    const backup = await restarted.export();
    await restarted.set("lumen-v2", state("alterado"));
    await restarted.restore(backup);
    assert.equal(await restarted.get("lumen-v2"), state("último"));
    assert.equal(await restarted.get("lumen-ops-v1"), state("operador"));
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); }
});
test("recovers corruption and preserves damaged file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-storage-"));
  try {
    const store = new Storage(dir); await store.init();
    await store.set("lumen-v2", state("seguro"));
    await store.set("lumen-v2", state("recente"));
    await writeFile(store.file, "broken");
    const messages = [];
    const restarted = new Storage(dir, (m) => messages.push(m)); await restarted.init();
    assert.equal(await restarted.get("lumen-v2"), state("seguro"));
    assert.equal(messages.length, 1);
    assert.ok((await readdir(dir)).some((f) => f.includes(".corrupt-")));
    assert.equal(JSON.parse(await readFile(store.file, "utf8")).values["lumen-v2"], state("seguro"));
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); }
});
test("rejects unknown keys and malformed backups, preserves data", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-storage-"));
  try {
    const store = new Storage(dir); await store.init();
    await store.set("lumen-v2", state("safe"));
    await assert.rejects(store.set("../escape", state("bad")));
    await assert.rejects(store.set("lumen-v2", "invalid json"));
    assert.throws(() => store.restore('{"format":"wrong"}'));
    assert.equal(await store.get("lumen-v2"), state("safe"));
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); }
});
test("fails closed if both files are corrupt", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-storage-"));
  try {
    await writeFile(path.join(dir, "library.json"), "bad");
    await writeFile(path.join(dir, "library.json.bak"), "bad");
    await assert.rejects(new Storage(dir).init());
    assert.equal(await readFile(path.join(dir, "library.json"), "utf8"), "bad");
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); }
});
