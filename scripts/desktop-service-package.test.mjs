import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportPackage, importPackage, resolvePackage } from "../desktop/service-package.cjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lumen-package-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const image = path.join(root, "image.png");
  const bytes = Buffer.from("test media bytes");
  await writeFile(image, bytes);
  const url = "lumen://app/__midia/image/image.png";
  const data = {
    format: "lumen-service-v1", playlist: { name: "Culto de teste" },
    media: [{ id: "photo", path: url, type: "image", sessionOnly: true }],
    themes: [{ backgroundType: "image", backgroundValue: url }],
    settings: { logoUrl: "data:image/png;base64," + bytes.toString("base64") },
  };
  const target = path.join(root, "Culto.lumen");
  const packages = path.join(root, "packages");
  const resolve = async (ref) => ref === url ? image : null;
  return { root, data, bytes, target, packages, resolve };
}

test("portable package round trip preserves bytes, deduplicates references and isolates imports", async (t) => {
  const f = await fixture(t);
  const result = await exportPackage(f.target, f.data, f.resolve);
  assert.equal(result.files, 2);
  const data = await importPackage(f.target, f.packages);
  assert.equal(data.playlist.name, f.data.playlist.name);
  assert.equal(data.media[0].sessionOnly, false);
  assert.equal(data.media[0].path, data.themes[0].backgroundValue);
  for (const ref of [data.media[0].path, data.settings.logoUrl]) {
    assert.deepEqual(await readFile(await resolvePackage(ref, f.packages)), f.bytes);
  }
  assert.equal(f.data.media[0].sessionOnly, true);
  const second = await importPackage(f.target, f.packages);
  assert.notEqual(second.media[0].path, data.media[0].path);
  assert.equal(await resolvePackage(data.media[0].path.replace("lumen://app", "https://evil.example"), f.packages), null);
  assert.equal(await resolvePackage("http://[", f.packages), null);
  assert.equal(await resolvePackage("lumen://app/__pacotes/../../secret.txt", f.packages), null);
});

test("corrupt or truncated packages leave no imported files", async (t) => {
  const f = await fixture(t);
  await exportPackage(f.target, f.data, f.resolve);
  const good = await readFile(f.target);
  const damaged = Buffer.from(good);
  damaged[damaged.length - 1] ^= 255;
  await writeFile(f.target, damaged);
  await assert.rejects(importPackage(f.target, f.packages), /danificada/);
  assert.deepEqual(await readdir(f.packages), []);
  await writeFile(f.target, good.subarray(0, good.length - 1));
  await assert.rejects(importPackage(f.target, f.packages), /Tamanho/);
  assert.deepEqual(await readdir(f.packages), []);
});

test("failed export preserves an existing package and removes temporary output", async (t) => {
  const f = await fixture(t);
  await writeFile(f.target, "previous package");
  await assert.rejects(exportPackage(f.target, f.data, async () => null), /ausente/);
  assert.equal(await readFile(f.target, "utf8"), "previous package");
  assert.equal((await readdir(f.root)).some((name) => name.endsWith(".tmp")), false);
});

test("rejects unsafe archive names and unresolved references", async (t) => {
  const f = await fixture(t);
  const pack = async (manifest) => {
    const json = Buffer.from(JSON.stringify(manifest));
    const header = Buffer.alloc(12);
    header.write("LUMENPK1"); header.writeUInt32LE(json.length, 8);
    await writeFile(f.target, Buffer.concat([header, json]));
  };
  await pack({ data: f.data, entries: [{ name: "../evil.png", size: 0, sha256: "0".repeat(64) }] });
  await assert.rejects(importPackage(f.target, f.packages), /inválida/);
  await pack({ data: f.data, entries: [] });
  await assert.rejects(importPackage(f.target, f.packages), /todas as mídias/);
  assert.deepEqual(await readdir(f.packages), []);
});
