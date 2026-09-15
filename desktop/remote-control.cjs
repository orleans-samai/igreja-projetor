const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const nodeCrypto = require("node:crypto");
const fsp = require("node:fs/promises");

/**
 * Controle remoto pelo celular.
 *
 * Um servidor HTTP na rede local — não só em 127.0.0.1, como o do YouTube,
 * porque aqui quem precisa entrar é um aparelho de verdade, na mesma Wi-Fi da
 * igreja. Essa diferença é o motivo de existir um PIN: qualquer um na mesma
 * rede consegue abrir o endereço, então o gesto de digitar os seis dígitos
 * que estão na tela da cabine é o que prova que quem está pedindo controle
 * está fisicamente perto de quem já está de posse do programa.
 *
 * Depois do PIN, o aparelho guarda um token de sessão — o PIN não trafega de
 * novo a cada clique, e desligar ou regenerar o PIN invalida todas as sessões
 * de uma vez, inclusive as que ninguém está mais olhando.
 *
 * Só os comandos de transporte existem aqui: próximo, anterior, preto, logo,
 * ocultar letra, parar, próximo item. Nada que decida o que vai ao ar sem
 * confirmação — trocar de música ou apagar o repertório continuam exigindo
 * a cabine.
 */

const MAX_BODY = 4 * 1024;
const JANELA_TENTATIVAS_MS = 3 * 60 * 1000;
const LIMITE_TENTATIVAS = 5;

const ACOES_VALIDAS = new Set([
  "proximo",
  "anterior",
  "preto",
  "logo",
  "ocultar-letra",
  "parar",
  "proximo-item",
]);

function enderecosLan() {
  const saida = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const info of lista || []) {
      if (info.family === "IPv4" && !info.internal) saida.push(info.address);
    }
  }
  return saida;
}

function gerarPin() {
  return String(nodeCrypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

class RemoteControl {
  constructor(wwwRoot) {
    this.wwwRoot = wwwRoot;
    this.server = null;
    this.porta = null;
    this.pin = null;
    this.sessoes = new Set();
    this.tentativas = new Map();
    this.assinantes = new Set();
    this.ultimoEstado = null;
    /** Ligado pelo processo principal: o que fazer quando um comando chega. */
    this.onComando = null;
  }

  ligado() {
    return !!this.server;
  }

  status() {
    return {
      ligado: this.ligado(),
      porta: this.porta,
      pin: this.pin,
      enderecos: this.ligado() ? enderecosLan() : [],
      sessoesAtivas: this.sessoes.size,
    };
  }

  async ligar() {
    if (this.ligado()) return this.status();
    this.pin = gerarPin();
    this.sessoes.clear();
    this.tentativas.clear();
    await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this._rota(req, res);
      });
      server.once("error", reject);
      server.listen(0, "0.0.0.0", () => {
        server.off("error", reject);
        server.on("error", () => {});
        this.server = server;
        this.porta = server.address().port;
        resolve();
      });
    });
    return this.status();
  }

  desligar() {
    if (!this.server) return this.status();
    for (const res of this.assinantes) {
      try {
        res.end();
      } catch {
        /* já fechado */
      }
    }
    this.assinantes.clear();
    this.sessoes.clear();
    this.ultimoEstado = null;
    this.server.close();
    this.server = null;
    this.porta = null;
    this.pin = null;
    return this.status();
  }

  /** Novo PIN e todas as sessões antigas param de valer — é o "encerrar tudo". */
  regenerarPin() {
    if (!this.ligado()) return this.status();
    this.pin = gerarPin();
    this.sessoes.clear();
    for (const res of this.assinantes) {
      try {
        res.end();
      } catch {
        /* já fechado */
      }
    }
    this.assinantes.clear();
    return this.status();
  }

  /** O que a cabine está fazendo agora, para o aparelho mostrar. */
  atualizarEstado(payload) {
    this.ultimoEstado = payload;
    const linha = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.assinantes) {
      try {
        res.write(linha);
      } catch {
        this.assinantes.delete(res);
      }
    }
  }

  _limitado(ip) {
    const agora = Date.now();
    const t = this.tentativas.get(ip);
    if (!t || agora - t.desde > JANELA_TENTATIVAS_MS) {
      this.tentativas.set(ip, { n: 0, desde: agora });
      return false;
    }
    return t.n >= LIMITE_TENTATIVAS;
  }

  _registrarFalha(ip) {
    const t = this.tentativas.get(ip) || { n: 0, desde: Date.now() };
    t.n += 1;
    this.tentativas.set(ip, t);
  }

  async _lerCorpo(req) {
    return new Promise((resolve, reject) => {
      let total = 0;
      const partes = [];
      req.on("data", (c) => {
        total += c.length;
        if (total > MAX_BODY) {
          reject(new Error("corpo grande demais"));
          req.destroy();
          return;
        }
        partes.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
      req.on("error", reject);
    });
  }

  async _rota(req, res) {
    let url;
    try {
      url = new URL(req.url, "http://local");
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/") return await this._servirPagina(res);
      if (req.method === "GET" && url.pathname === "/estado") return this._sse(req, res, url);
      if (req.method === "POST" && url.pathname === "/parear") return await this._parear(req, res);
      if (req.method === "POST" && url.pathname === "/comando") return await this._comando(req, res);
    } catch {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Erro interno");
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
  }

  async _servirPagina(res) {
    try {
      const html = await fsp.readFile(path.join(this.wwwRoot, "remote-control.html"));
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(html);
    } catch {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Página ausente. Reinstale o Lúmen.");
    }
  }

  _sse(req, res, url) {
    const token = url.searchParams.get("token") || "";
    if (!token || !this.sessoes.has(token)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "Sessão expirada. Pareie novamente." }));
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    res.write(":ok\n\n");
    if (this.ultimoEstado) res.write(`data: ${JSON.stringify(this.ultimoEstado)}\n\n`);
    this.assinantes.add(res);
    req.on("close", () => this.assinantes.delete(res));
  }

  async _parear(req, res) {
    const ip = req.socket.remoteAddress || "?";
    if (this._limitado(ip)) {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." }));
      return;
    }
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const digitado = String(corpo.pin || "").trim();
    if (!this.pin || digitado !== this.pin) {
      this._registrarFalha(ip);
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "PIN incorreto." }));
      return;
    }
    const token = nodeCrypto.randomUUID();
    this.sessoes.add(token);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, token }));
  }

  async _comando(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const token = String(corpo.token || "");
    if (!this.sessoes.has(token)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "Sessão expirada. Pareie novamente." }));
      return;
    }
    const acao = String(corpo.acao || "");
    if (!ACOES_VALIDAS.has(acao)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "Comando desconhecido." }));
      return;
    }
    this.onComando?.(acao);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  }
}

module.exports = { RemoteControl, ACOES_VALIDAS };
