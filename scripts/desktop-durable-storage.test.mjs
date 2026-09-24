import assert from "node:assert/strict";
import { test } from "node:test";
import { durableStorage } from "../src/lib/durable-storage.ts";

test("durable storage skips serialization and IPC when partialized fields are unchanged", async () => {
  const calls = [];
  const originalWindow = globalThis.window;
  globalThis.window = {
    lumenDesktop: {
      isDesktop: true,
      storageGet: async () => JSON.stringify({ state: { config: { mode: "safe" }, count: 1 }, version: 0 }),
      storageSet: async (...args) => calls.push(args),
    },
  };
  try {
    const loaded = await durableStorage.getItem("lumen-dedupe-test");
    await durableStorage.setItem("lumen-dedupe-test", {
      state: { config: loaded.state.config, count: 1 },
      version: 0,
    });
    assert.equal(calls.length, 0);

    await durableStorage.setItem("lumen-dedupe-test", {
      state: { config: { mode: "fast" }, count: 1 },
      version: 0,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "lumen-dedupe-test");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
