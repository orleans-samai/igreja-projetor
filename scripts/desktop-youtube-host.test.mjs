import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import youtubeModule from "../desktop/youtube-host.cjs";

const { YoutubeHost } = youtubeModule;

test("YouTube host closes its loopback listener during shutdown", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lumen-youtube-host-"));
  try {
    await writeFile(path.join(dir, "youtube-player.html"), "<!doctype html><title>ok</title>");
    const host = new YoutubeHost(dir);
    const url = await host.start();
    assert.equal((await fetch(url)).status, 200);
    const server = host.server;
    await host.stop();
    assert.equal(host.server, null);
    assert.equal(server.listening, false);
    await assert.rejects(fetch(url));
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
