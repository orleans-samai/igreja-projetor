import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mediaResponse } from "../desktop/media-response.cjs";

test("streams full media, seek ranges, suffixes and HEAD without changing bytes", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-ranges-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "audio.wav");
  await writeFile(file, "0123456789");
  for (const [range, expected, status] of [[null, "0123456789", 200], ["bytes=2-5", "2345", 206], ["bytes=7-", "789", 206], ["bytes=-3", "789", 206], ["bytes=7-999", "789", 206]]) {
    const response = await mediaResponse(file, new Request("lumen://app/audio.wav", { headers: range ? { Range: range } : {} }), "audio/wav");
    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-length"), String(expected.length));
    assert.equal(await response.text(), expected);
  }
  for (const range of ["bytes=20-", "bytes=5-2", "bytes=-0", "bytes=-", "invalid"]) {
    const response = await mediaResponse(file, new Request("lumen://app/audio.wav", { headers: { Range: range } }), "audio/wav");
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */10");
  }
  const head = await mediaResponse(file, new Request("lumen://app/audio.wav", { method: "HEAD" }), "audio/wav");
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
});
