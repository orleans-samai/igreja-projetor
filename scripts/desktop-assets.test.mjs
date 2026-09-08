import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assets from "../desktop/assets.cjs";
test("serves routes, refuses missing assets, traversal and foreign origins", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-assets-"));
  try {
    await writeFile(path.join(dir, "index.html"), "app");
    await writeFile(path.join(dir, "test.js"), "script");
    assert.equal(await assets.resolveAsset(dir, "lumen://app/projetor?tela=1"), path.join(dir, "index.html"));
    assert.equal(await assets.resolveAsset(dir, "lumen://app/test.js"), path.join(dir, "test.js"));
    for (const url of ["lumen://app/missing.js", "lumen://foreign/", "https://app/", "lumen://app/%2e%2e%2fsecret", "lumen://app/a%5cb", "lumen://app/index.html:stream", "lumen://app/%xx"]) assert.equal(await assets.resolveAsset(dir, url), null, url);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
