const { spawn } = require("node:child_process");
const net = require("node:net");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { inspecionar, veredito } = require("./ia-modelos.cjs");

/**
 * O assistente local: um llama.cpp que só este processo comanda.
 *
 * Regras que não se negociam, e o porquê de cada uma:
 *
 * - Escuta só em 127.0.0.1, em porta sorteada. Ninguém na Wi-Fi da igreja
 *   conversa com o modelo; nem o celular, nem o vizinho.
 * - Quem sobe e derruba é o processo principal. A janela da cabine nunca
 *   inicia executável — ela pede, por IPC, e é só.
 * - Um modelo por vez. Dois carregados é a maneira mais rápida de ficar sem
 *   memória num PC que também está projetando.
 * - Morre junto com o Lúmen, e morre de verdade: processo pendurado segura
 *   gigabytes depois que a igreja já foi embora.
 * - Nenhuma flag que dê ao modelo leitura de arquivo, escrita ou terminal.
 *   O llama-server não tem isso por padrão, e nada aqui vai ligar.
 *
 * A projeção nunca depende disto. Se o runtime não existe, se o modelo não
 * carrega, se o processo trava — o culto continua, e o parser determinístico
 * (copilot.ts) segue entendendo "próximo", "preto", "João 3:16".
 */

/** Onde procuramos o llama-server, em ordem. */
const NOMES_RUNTIME =
  process.platform === "win32"
    ? ["llama-server.exe", "server.exe"]
    : ["llama-server", "server"];

/** Contexto curto de propósito: PC de igreja, e resposta curta é o que se quer. */
const CONTEXTO_PADRAO = 1024;
const CONTEXTO_MIN = 512;
const CONTEXTO_MAX = 4096;
/** Resposta longa no meio de um culto é resposta que ninguém lê. */
const MAX_TOKENS_RESPOSTA = 320;
/** Quanto esperamos o modelo subir antes de desistir. */
const ESPERA_SUBIR_MS = 90 * 1000;
/** Quanto esperamos uma resposta antes de cortar. */
const ESPERA_RESPOSTA_MS = 60 * 1000;

const MODOS = ["desativado", "sob-demanda", "sempre"];

/**
 * Os argumentos do llama-server.
 *
 * Função à parte para poder ser conferida por teste: é aqui que mora a
 * promessa de escutar só em 127.0.0.1, e uma promessa dessas merece um teste
 * que a leia.
 */
function argumentosDoServidor({ modelo, porta, contexto = CONTEXTO_PADRAO, threads }) {
  const ctx = Math.min(CONTEXTO_MAX, Math.max(CONTEXTO_MIN, Math.round(contexto)));
  return [
    "--model", modelo,
    // Só a máquina local. Sem isto o llama-server aceitaria a rede inteira.
    "--host", "127.0.0.1",
    "--port", String(porta),
    "--ctx-size", String(ctx),
    // Uma geração por vez: o PC está projetando, não servindo uma API.
    "--parallel", "1",
    "--threads", String(Math.max(1, Math.min(8, threads || Math.max(1, os.cpus().length - 2)))),
    // Sem a interface web do próprio llama.cpp: a porta existe para esta
    // janela falar com o modelo, não para virar site.
    "--no-webui",
  ];
}

/** Uma porta livre no loopback, sorteada pelo sistema. */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/**
 * O texto de uma resposta do llama-server, em qualquer um dos dois formatos.
 *
 * Versões diferentes devolvem `choices[].message.content` (estilo OpenAI) ou
 * `content` solto. Aceitar os dois é o que faz o Lúmen funcionar com o
 * binário que a igreja tiver baixado.
 */
function textoDaResposta(corpo) {
  if (!corpo || typeof corpo !== "object") return "";
  const escolha = Array.isArray(corpo.choices) ? corpo.choices[0] : null;
  const deChat = escolha?.message?.content ?? escolha?.text;
  const valor = typeof deChat === "string" ? deChat : corpo.content;
  return typeof valor === "string" ? valor : "";
}

class AssistenteLocal {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.pastaRuntime = path.join(dataDir, "ia", "runtime");
    this.pastaModelos = path.join(dataDir, "ia", "modelos");
    this.modo = "desativado";
    /** Minutos sem uso até descarregar, no modo sob demanda. */
    this.minutosOciosoAteDescarregar = 10;
    this.modelo = null;
    this.processo = null;
    this.porta = null;
    this.situacao = "desativada";
    this.erro = null;
    this.ocioso = null;
    /** Só uma pergunta por vez: o PC está projetando. */
    this.emAndamento = null;
  }

  async _acharRuntime() {
    const candidatos = [];
    for (const nome of NOMES_RUNTIME) candidatos.push(path.join(this.pastaRuntime, nome));
    for (const c of candidatos) {
      try {
        await fsp.access(c);
        return c;
      } catch {
        /* próximo */
      }
    }
    return null;
  }

  async estado() {
    const runtime = await this._acharRuntime();
    const livreGB = os.freemem() / (1024 * 1024 * 1024);
    return {
      modo: this.modo,
      situacao: this.situacao,
      erro: this.erro,
      runtime: {
        achado: Boolean(runtime),
        caminho: runtime,
        pasta: this.pastaRuntime,
      },
      modelo: this.modelo,
      pastaModelos: this.pastaModelos,
      memoriaLivreGB: Math.round(livreGB * 10) / 10,
      veredito: this.modelo ? veredito(this.modelo.ramEstimadaGB, livreGB) : "desconhecido",
      minutosOciosoAteDescarregar: this.minutosOciosoAteDescarregar,
    };
  }

  async configurar({ modo, minutos }) {
    if (MODOS.includes(modo)) this.modo = modo;
    if (Number.isFinite(minutos)) {
      this.minutosOciosoAteDescarregar = Math.min(120, Math.max(1, Math.round(minutos)));
    }
    // Desativado é desativado: o processo cai e a memória volta agora, não
    // quando der.
    if (this.modo === "desativado") await this.desligar();
    else if (this.modo === "sempre") await this.ligar().catch(() => {});
    return this.estado();
  }

  /** Lista os .gguf da pasta de modelos, já conferidos. */
  async listarModelos() {
    await fsp.mkdir(this.pastaModelos, { recursive: true }).catch(() => {});
    let nomes = [];
    try {
      nomes = await fsp.readdir(this.pastaModelos);
    } catch {
      return [];
    }
    const livreGB = os.freemem() / (1024 * 1024 * 1024);
    const saida = [];
    for (const nome of nomes) {
      if (!nome.toLowerCase().endsWith(".gguf")) continue;
      const r = await inspecionar(path.join(this.pastaModelos, nome));
      if (!r.ok) continue;
      saida.push({ ...r, veredito: veredito(r.ramEstimadaGB, livreGB) });
    }
    return saida;
  }

  /** Copia um .gguf de fora para a pasta do app, depois de conferir. */
  async importarModelo(caminho) {
    const r = await inspecionar(caminho);
    if (!r.ok) return r;
    await fsp.mkdir(this.pastaModelos, { recursive: true });
    const destino = path.join(this.pastaModelos, path.basename(caminho));
    if (path.resolve(destino) !== path.resolve(caminho)) {
      await fsp.copyFile(caminho, destino);
    }
    return { ...r, caminho: destino };
  }

  async escolherModelo(caminho) {
    const r = await inspecionar(caminho);
    if (!r.ok) {
      this.erro = r.erro;
      return { ok: false, erro: r.erro };
    }
    // Trocar de modelo derruba o anterior: dois carregados é como se fica sem
    // memória no meio do culto.
    await this.desligar();
    this.modelo = r;
    this.erro = null;
    if (this.modo === "sempre") await this.ligar().catch(() => {});
    return { ok: true, modelo: r };
  }

  _adiarDescarregar() {
    if (this.ocioso) clearTimeout(this.ocioso);
    if (this.modo !== "sob-demanda") return;
    this.ocioso = setTimeout(
      () => void this.desligar(),
      this.minutosOciosoAteDescarregar * 60 * 1000,
    );
  }

  /** Sobe o modelo, se já não estiver de pé. Nunca duas vezes. */
  async ligar() {
    if (this.processo) {
      this._adiarDescarregar();
      return { ok: true, porta: this.porta };
    }
    if (this.modo === "desativado") return { ok: false, erro: "O assistente está desativado." };
    if (!this.modelo) return { ok: false, erro: "Nenhum modelo escolhido." };
    const runtime = await this._acharRuntime();
    if (!runtime) {
      this.situacao = "erro";
      this.erro = "Não achei o llama-server. Ponha o executável na pasta do assistente.";
      return { ok: false, erro: this.erro };
    }

    this.situacao = "carregando";
    this.erro = null;
    const porta = await portaLivre();
    const filho = spawn(
      runtime,
      argumentosDoServidor({ modelo: this.modelo.caminho, porta, contexto: CONTEXTO_PADRAO }),
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    this.processo = filho;
    this.porta = porta;

    filho.once("exit", (codigo) => {
      // Saiu sozinho: ou o operador desligou, ou o modelo não coube. Nos dois
      // casos o estado tem que refletir a verdade, não a intenção.
      if (this.processo === filho) {
        this.processo = null;
        this.porta = null;
        if (this.situacao !== "desativada") {
          this.situacao = "erro";
          this.erro = this.erro || `O assistente parou sozinho (código ${codigo}).`;
        }
      }
    });
    filho.once("error", (e) => {
      this.situacao = "erro";
      this.erro = e?.message || "Não consegui iniciar o assistente.";
    });

    const subiu = await this._esperarSubir(porta);
    if (!subiu) {
      await this.desligar();
      this.situacao = "erro";
      this.erro = this.erro || "O modelo não subiu a tempo. Tente um modelo menor.";
      return { ok: false, erro: this.erro };
    }
    this.situacao = "pronta";
    this._adiarDescarregar();
    return { ok: true, porta };
  }

  async _esperarSubir(porta) {
    const limite = Date.now() + ESPERA_SUBIR_MS;
    while (Date.now() < limite) {
      if (!this.processo) return false;
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (r.ok) return true;
      } catch {
        /* ainda carregando */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  /**
   * Pergunta ao modelo. Uma por vez, com corte.
   *
   * `cancelar()` corta de verdade: aborta a requisição e o llama-server para
   * de gerar. Sem isso, "parar" seria só deixar de mostrar, com a CPU
   * continuando a queimar enquanto o culto acontece.
   */
  async perguntar(mensagens) {
    if (this.emAndamento) return { ok: false, erro: "Já estou respondendo uma coisa." };
    const pronto = await this.ligar();
    if (!pronto.ok) return { ok: false, erro: pronto.erro };
    const controle = new AbortController();
    this.emAndamento = controle;
    const relogio = setTimeout(() => controle.abort(), ESPERA_RESPOSTA_MS);
    try {
      const r = await fetch(`http://127.0.0.1:${this.porta}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: mensagens,
          temperature: 0.2,
          max_tokens: MAX_TOKENS_RESPOSTA,
          stream: false,
        }),
        signal: controle.signal,
      });
      if (!r.ok) return { ok: false, erro: `O assistente respondeu ${r.status}.` };
      const texto = textoDaResposta(await r.json());
      if (!texto.trim()) return { ok: false, erro: "O assistente não respondeu nada." };
      this._adiarDescarregar();
      return { ok: true, texto };
    } catch (e) {
      if (e?.name === "AbortError") return { ok: false, erro: "cancelado", cancelado: true };
      return { ok: false, erro: "Perdi contato com o assistente." };
    } finally {
      clearTimeout(relogio);
      this.emAndamento = null;
    }
  }

  cancelar() {
    this.emAndamento?.abort();
    return { ok: true };
  }

  /** Derruba o processo e devolve a memória. Idempotente. */
  async desligar() {
    if (this.ocioso) {
      clearTimeout(this.ocioso);
      this.ocioso = null;
    }
    this.emAndamento?.abort();
    this.emAndamento = null;
    const filho = this.processo;
    this.processo = null;
    this.porta = null;
    this.situacao = "desativada";
    if (!filho) return { ok: true };
    try {
      filho.kill();
      // Quem não sai por bem sai por mal: um llama-server pendurado segura
      // gigabytes depois que a igreja já foi embora.
      await new Promise((r) => {
        const t = setTimeout(() => {
          try {
            filho.kill("SIGKILL");
          } catch {
            /* já morreu */
          }
          r();
        }, 3000);
        filho.once("exit", () => {
          clearTimeout(t);
          r();
        });
      });
    } catch {
      /* já morreu */
    }
    return { ok: true };
  }
}

module.exports = {
  AssistenteLocal,
  argumentosDoServidor,
  textoDaResposta,
  portaLivre,
  MODOS,
  CONTEXTO_PADRAO,
  CONTEXTO_MIN,
  CONTEXTO_MAX,
  MAX_TOKENS_RESPOSTA,
};
