const fs = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const ENGINE = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip";
const ENGINE_HASH = "49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a";
const MODEL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_HASH = "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe";
async function hash(file) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
async function download(url, file, expected, signal) {
  const timeout = AbortSignal.timeout(600000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok || !response.body) throw new Error(`Download falhou (${response.status}). Confira a internet e tente novamente.`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  if (await hash(file) !== expected) throw new Error("Download incompleto ou diferente do esperado. Tente novamente.");
}
async function findCli(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const file = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "whisper-cli.exe") return file;
    if (entry.isDirectory()) { const found = await findCli(file); if (found) return found; }
  }
  return null;
}
function validWav(wav) {
  return Buffer.isBuffer(wav) && wav.length > 44 && wav.length <= 1000000 && wav.length % 2 === 0 &&
    wav.toString("ascii", 0, 4) === "RIFF" && wav.toString("ascii", 8, 12) === "WAVE" &&
    wav.readUInt32LE(4) === wav.length - 8 && wav.toString("ascii", 12, 16) === "fmt " && wav.readUInt32LE(16) === 16 &&
    wav.readUInt16LE(20) === 1 && wav.readUInt16LE(22) === 1 && wav.readUInt32LE(24) === 16000 &&
    wav.readUInt32LE(28) === 32000 && wav.readUInt16LE(32) === 2 && wav.readUInt16LE(34) === 16 &&
    wav.toString("ascii", 36, 40) === "data" && wav.readUInt32LE(40) === wav.length - 44;
}
class Recognition {
  constructor(dataDir) { this.dir = path.join(dataDir, "recognition"); this.installing = null; this.installController = null; this.transcribing = null; this.busy = false; this.child = null; this.children = new Set(); this.generation = 0; }
  runTracked(file, args, options) {
    const task = run(file, args, options);
    const child = task.child;
    if (child) this.children.add(child);
    const release = () => { if (child) this.children.delete(child); };
    task.then(release, release);
    return task;
  }
  async status() {
    const cli = await findCli(this.dir);
    const model = path.join(this.dir, "ggml-base.bin");
    const exists = await fs.stat(model).then((s) => s.size === 147951465).catch(() => false);
    return { pronto: !!cli && exists, nome: "Whisper base · português · local", motivo: "Instale o reconhecimento pelo botão Auto-Slide." };
  }
  install() {
    if (this.installing) return this.installing;
    this.installController = new AbortController();
    this.installing = this.doInstall(this.installController.signal).then(() => ({ ok: true })).catch((e) => ({ ok: false, erro: e.name === "AbortError" ? "Instalacao cancelada." : e.message })).finally(() => { this.installing = null; this.installController = null; });
    return this.installing;
  }
  async doInstall(signal) {
    if (process.platform !== "win32" || !["x64", "arm64"].includes(process.arch)) throw new Error("Reconhecimento disponível no Windows x64; no ARM64, exige emulação x64 do Windows 11.");
    if ((await this.status()).pronto) return;
    await fs.mkdir(this.dir, { recursive: true });
    const staging = await fs.mkdtemp(path.join(this.dir, "install-"));
    try {
      const zip = path.join(staging, "engine.zip");
      await download(ENGINE, zip, ENGINE_HASH, signal);
      if (signal.aborted) throw signal.reason;
      const output = path.join(staging, "engine");
      await this.runTracked("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:LUMEN_ENGINE_ZIP, $env:LUMEN_ENGINE_OUT)"], {
        windowsHide: true, timeout: 120000, env: { ...process.env, LUMEN_ENGINE_ZIP: zip, LUMEN_ENGINE_OUT: output },
      });
      if (signal.aborted) throw signal.reason;
      const cli = await findCli(output);
      if (!cli) throw new Error("Motor não encontrado no pacote.");
      await this.runTracked(cli, ["--help"], { windowsHide: true, timeout: 30000 });
      await download(MODEL, path.join(staging, "model.bin"), MODEL_HASH, signal);
      // Unique directories let failed installations retry without overwriting a running engine.
      await fs.rename(output, path.join(this.dir, `engine-${Date.now()}`));
      await fs.rename(path.join(staging, "model.bin"), path.join(this.dir, "ggml-base.bin"));
    } finally { await fs.rm(staging, { recursive: true, force: true }); }
  }
  async transcribe(input) {
    if (!(input instanceof Uint8Array)) return { ok: false, erro: "Áudio inválido." };
    const wav = Buffer.from(input);
    if (!validWav(wav)) return { ok: false, erro: "Use áudio WAV mono, 16 kHz e 16 bits." };
    if (this.busy) return { ok: false, erro: "O reconhecimento ainda está processando o trecho anterior." };
    this.busy = true;
    const generation = this.generation;
    const checkCanceled = () => { if (generation !== this.generation) throw new Error("Reconhecimento cancelado."); };
    let temp;
    try {
      if (!(await this.status()).pronto) throw new Error("Instale o reconhecimento local primeiro.");
      checkCanceled();
      temp = await fs.mkdtemp(path.join(os.tmpdir(), "lumen-audio-"));
      const audio = path.join(temp, "audio.wav"), output = path.join(temp, "result");
      await fs.writeFile(audio, wav);
      const cli = await findCli(this.dir);
      checkCanceled();
      const task = this.runTracked(cli, ["-m", path.join(this.dir, "ggml-base.bin"), "-f", audio, "-l", "pt", "-t", String(Math.max(1, Math.min(4, os.availableParallelism() - 1))), "-nt", "-otxt", "-of", output, "-ng"], { windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 });
      this.child = task.child;
      this.transcribing = task;
      await this.transcribing;
      const texto = (await fs.readFile(output + ".txt", "utf8")).replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      checkCanceled();
      return { ok: true, texto };
    } catch (e) { return { ok: false, erro: e.killed ? "Reconhecimento demorou demais. Use sugestões ou uma entrada de áudio mais limpa." : e.message }; }
    finally { this.child = null; this.transcribing = null; this.busy = false; if (temp) await fs.rm(temp, { recursive: true, force: true }); }
  }
  cancel() { this.generation += 1; this.child?.kill(); }
  async shutdown() {
    this.cancel();
    this.installController?.abort();
    for (const child of this.children) child.kill();
    await Promise.allSettled([this.installing, this.transcribing].filter(Boolean));
  }
}
module.exports = { Recognition, validWav };
