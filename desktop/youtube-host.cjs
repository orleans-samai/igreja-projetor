const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

/**
 * Servidor mínimo para a página do player do YouTube.
 *
 * O app roda de lumen://app, e de um esquema próprio o YouTube recusa a
 * reprodução com o erro 153: não existe referrer http para mandar aos
 * servidores dele. Esta é a menor coisa que resolve isso — uma página, servida
 * de 127.0.0.1, que é uma origem de verdade.
 *
 * Deliberadamente pequeno: escuta só no laço local, serve um caminho só, com
 * um token sorteado a cada abertura, e não lê nada que venha da requisição
 * além de comparar esse caminho. Não há como pedir outro arquivo porque não
 * há outro arquivo — o caminho servido é uma constante, não uma entrada.
 */
class YoutubeHost {
  constructor(wwwRoot) {
    this.wwwRoot = wwwRoot;
    this.server = null;
    this.base = null;
    this.token = randomUUID();
    this.subindo = null;
  }

  /** Sobe na primeira vez que alguém usa o YouTube, e não antes. */
  async start() {
    if (this.base) return this.base;
    if (this.subindo) return this.subindo;
    this.subindo = new Promise((resolve, reject) => {
      const rota = `/${this.token}/youtube-player.html`;
      const server = http.createServer((req, res) => {
        if (req.method !== "GET" || (req.url || "").split("?")[0] !== rota) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("Não encontrado");
          return;
        }
        fs.readFile(path.join(this.wwwRoot, "youtube-player.html"))
          .then((html) => {
            res.writeHead(200, {
              "content-type": "text/html; charset=utf-8",
              "x-content-type-options": "nosniff",
              "cache-control": "no-store",
            });
            res.end(html);
          })
          .catch(() => {
            res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
            res.end("Página do player ausente. Reinstale o Lúmen.");
          });
      });
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        this.server = server;
        this.base = `http://127.0.0.1:${port}${rota}`;
        resolve(this.base);
      });
    });
    try {
      return await this.subindo;
    } finally {
      this.subindo = null;
    }
  }

  stop() {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.base = null;
  }
}

module.exports = { YoutubeHost };
