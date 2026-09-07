import assert from "node:assert/strict";
import { test } from "node:test";
import { Recognition, validWav } from "../desktop/recognition.cjs";
import { paraWav } from "../src/lib/auto-slide/audio.ts";

const audio = () => Buffer.from(paraWav(new Float32Array(1600).fill(0.1)));

test("accepts renderer audio and rejects truncated or malformed WAV headers", () => {
  assert.equal(validWav(audio()), true);
  assert.equal(validWav(audio().subarray(0, 50)), false);
  assert.equal(validWav(Buffer.alloc(44)), false);
  for (const offset of [4, 12, 16, 20, 22, 24, 28, 32, 34, 36, 40]) {
    const wav = audio();
    wav[offset] ^= 255;
    assert.equal(validWav(wav), false, `header offset ${offset}`);
  }
});

test("canceling before the engine starts prevents transcription and releases the lock", async () => {
  const recognition = new Recognition("unused-test-profile");
  let release;
  recognition.status = () => new Promise((resolve) => { release = resolve; });
  const pending = recognition.transcribe(audio());
  const busy = await recognition.transcribe(audio());
  assert.equal(busy.ok, false);
  assert.match(busy.erro, /trecho anterior/);
  recognition.cancel();
  release({ pronto: true });
  const result = await pending;
  assert.equal(result.ok, false);
  assert.match(result.erro, /cancelado/);
  assert.equal(recognition.busy, false);
  recognition.status = async () => ({ pronto: false });
  assert.match((await recognition.transcribe(audio())).erro, /Instale/);
});
