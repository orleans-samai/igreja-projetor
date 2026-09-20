const http = require("node:http");
const path = require("node:path");
const nodeCrypto = require("node:crypto");
const fsp = require("node:fs/promises");
const { enderecosLan } = require("./mdns.cjs");

/**
 * Controle remoto pelo celular.
 *
 * Um servidor HTTP na rede local — não só em 127.0.0.1, como o do YouTube,
 * porque aqui quem precisa entrar é um aparelho de verdade, na mesma Wi-Fi da
 * igreja.
 *
 * Entrar não pede senha: pede nome. Quem abre o endereço se identifica e
 * entra como "chat", que é conversar com a cabine e mais nada. A barreira não
 * está na porta, está no que se pode fazer depois dela — e quem decide isso é
 * o operador, vendo a lista de aparelhos com o nome de cada pessoa.
 *
 * Foi uma troca consciente. O PIN de seis dígitos provava presença, mas
 * cobrava isso de toda a equipe, toda semana, no minuto em que o culto ia
 * começar. Numa rede de igreja o custo era alto e o ganho pequeno: quem já
 * está na Wi-Fi já está dentro. Agora o aparelho desconhecido aparece na
 * cabine com nome e hora, e o operador o promove — ou o desconecta.
 *
 * O aparelho guarda um token de sessão; desconectar um aparelho, ou todos,
 * invalida o token na hora, inclusive o de quem ninguém está mais olhando.
 *
 * O que trafega:
 *
 *   /parear      um nome vira um token de sessão
 *   /estado      SSE: o que está no ar, o chat e a permissão do aparelho
 *   /comando     transporte do telão                        (permissão: controle)
 *   /repertorio  lista de músicas                           (permissão: editor)
 *   /musica      ler e salvar uma letra                     (permissão: editor)
 *   /chat        recado para a cabine                       (permissão: chat)
 */

const MAX_BODY = 4 * 1024;
/** Letra de música é maior que um comando: um hino comprido passa de 4 KB. */
const MAX_BODY_MUSICA = 256 * 1024;
const JANELA_TENTATIVAS_MS = 3 * 60 * 1000;
const LIMITE_TENTATIVAS = 5;
/** O aparelho que não dá notícia há tanto tempo aparece como desconectado. */
const SUMIU_MS = 30 * 1000;
const MAX_CHAT = 200;
/** Tipos de mídia que o celular pode enxergar e mandar para o telão. */
const TIPOS_MIDIA = ["video", "audio", "image"];
/** O que o celular pode mandar para o telão pelo nome do item. */
const TIPOS_PROJETAVEIS = ["song", "text", "media"];
/**
 * Quanto o celular espera a cabine antes de desistir de um pedido.
 *
 * Maior que os 18s que o provedor de letra se dá (ver lyrics-web.ts): quem
 * tem que desistir primeiro é quem sabe do que desistiu. Se esta espera
 * fosse a menor, uma busca lenta viraria "a cabine não respondeu", que é a
 * mensagem errada.
 */
const ESPERA_CABINE_MS = 25 * 1000;

const ACOES_VALIDAS = new Set([
  "proximo",
  "anterior",
  "preto",
  "logo",
  "ocultar-letra",
  "parar",
  "proximo-item",
  // Transporte de mídia: o vídeo local que está no telão.
  "tocar",
  "pausar",
  "parar-midia",
]);

/** Da mais fraca para a mais forte: quem pode X também pode o que vem antes. */
const PERMISSOES = ["chat", "editor", "controle"];

function podeFazer(permissao, minima) {
  const tem = PERMISSOES.indexOf(permissao);
  const precisa = PERMISSOES.indexOf(minima);
  return tem >= 0 && precisa >= 0 && tem >= precisa;
}

/**
 * Tira caracteres de controle de texto que veio do celular.
 *
 * Nome de aparelho e recado de chat são desenhados na tela da cabine e
 * viajam pelo SSE, cujo quadro é delimitado por quebras de linha. O JSON já
 * escapa o que importa, mas texto de controle não tem uso legítimo aqui e
 * atravessa log, terminal e interface sem ser visto — some antes de entrar.
 *
 * @param {string} bruto
 * @param {boolean} manterQuebras tabulação e quebra de linha sobrevivem
 */
function semControle(bruto, manterQuebras = false) {
  let saida = "";
  for (const ch of String(bruto || "")) {
    const c = ch.codePointAt(0);
    const permitido = manterQuebras && (c === 9 || c === 10);
    if (!permitido && (c < 32 || c === 127)) continue;
    saida += ch;
  }
  return saida;
}

/** Nome que o aparelho mandou, limpo — vai aparecer na tela da cabine. */
function nomeLimpo(bruto, padrao) {
  const s = semControle(bruto).trim();
  return s ? s.slice(0, 32) : padrao;
}

class RemoteControl {
  constructor(wwwRoot, cofre = null, anunciante = null) {
    this.wwwRoot = wwwRoot;
    /**
     * Quem responde por "lumen.local" na rede. Opcional de propósito: os
     * testes sobem dezenas de servidores, e nenhum deles precisa disputar a
     * porta 5353 do sistema para provar o que veio provar.
     */
    this.anunciante = anunciante;
    /** Onde porta e aparelhos pareados sobrevivem ao fechar do app.
     *  Sem cofre (nos testes) o controle volta a ser de uma sessão só. */
    this.cofre = cofre;
    const guardado = cofre ? cofre.ler() : null;
    this.server = null;
    this.porta = null;
    /** A porta que queremos de volta toda vez — é ela que o operador ditou
     *  para a equipe durante a semana. Zero (sem cofre) é "qualquer uma": sem
     *  lugar para lembrar, insistir numa porta fixa só criaria disputa. */
    this.portaPreferida = guardado ? guardado.porta : 0;
    /** token → dispositivo. Substitui o Set de tokens: agora cada aparelho
     *  tem nome, permissão e histórico, que é o que a cabine precisa ver. */
    this.dispositivos = new Map();
    for (const d of guardado?.dispositivos ?? []) {
      this.dispositivos.set(d.token, {
        id: d.id,
        nome: d.nome,
        permissao: d.permissao,
        criadoEm: d.criadoEm,
        ultimoVisto: d.ultimoVisto,
      });
    }
    this.tentativas = new Map();
    /** res do SSE → token, para saber de quem é cada conexão aberta. */
    this.assinantes = new Map();
    this.ultimoEstado = null;
    this.repertorio = [];
    /** Espelho da pasta de mídia: vídeo, áudio e imagem que a cabine enxerga. */
    this.midia = [];
    /**
     * Pedidos que só a cabine sabe responder — buscar letra na internet, abrir
     * uma letra achada. O celular fica esperando o HTTP; a cabine responde
     * pelo IPC e a resposta sai por aqui. Sem isto, a busca teria que rodar no
     * celular, que pode não ter internet, e com provedor diferente do que a
     * cabine usa — dois resultados diferentes para a mesma busca.
     */
    this.pedidos = new Map();
    this.proximoPedido = 1;
    this.chat = [];
    /** Permissão de quem acabou de parear. A cabine pode afrouxar isto. */
    this.permissaoPadrao = "chat";
    /** Ligados pelo processo principal. */
    this.onComando = null;
    this.onEvento = null;
  }

  ligado() {
    return !!this.server;
  }

  /** Guarda o que não pode mudar entre um culto e outro. */
  _salvar() {
    if (!this.cofre) return;
    this.cofre.gravar({
      porta: this.porta ?? this.portaPreferida,
      dispositivos: [...this.dispositivos].map(([token, d]) => ({ token, ...d })),
    });
  }

  _online(disp) {
    return Date.now() - disp.ultimoVisto < SUMIU_MS;
  }

  listarDispositivos() {
    return [...this.dispositivos.values()]
      .map((d) => ({
        id: d.id,
        nome: d.nome,
        permissao: d.permissao,
        criadoEm: d.criadoEm,
        ultimoVisto: d.ultimoVisto,
        online: this._online(d),
      }))
      .sort((a, b) => b.ultimoVisto - a.ultimoVisto);
  }

  status() {
    return {
      ligado: this.ligado(),
      porta: this.porta,
      enderecos: this.ligado() ? enderecosLan() : [],
      /** "lumen.local" quando o nome está de pé na rede; null quando não. */
      nomeLocal: this.ligado() && this.anunciante?.ativo ? this.anunciante.host : null,
      /** Por que o nome não subiu — para a cabine poder explicar em vez de sumir. */
      avisoNome: this.ligado() ? (this.anunciante?.erro ?? null) : null,
      sessoesAtivas: [...this.dispositivos.values()].filter((d) => this._online(d)).length,
      dispositivos: this.listarDispositivos(),
      permissaoPadrao: this.permissaoPadrao,
    };
  }

  /**
   * Sobe o servidor sempre na mesma porta.
   *
   * Uma porta sorteada a cada abertura invalidava o endereço que o operador
   * tinha passado para a equipe. Se a preferida estiver ocupada — outro
   * programa, ou um Lúmen que não fechou direito — pega qualquer uma livre e
   * passa a lembrar dessa, que é melhor do que não abrir.
   */
  _abrir(porta) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this._rota(req, res);
      });
      const falhou = (erro) => {
        server.close();
        reject(erro);
      };
      server.once("error", falhou);
      server.listen(porta, "0.0.0.0", () => {
        server.off("error", falhou);
        server.on("error", () => {});
        resolve(server);
      });
    });
  }

  async ligar() {
    if (this.ligado()) return this.status();
    this.tentativas.clear();
    this.chat = [];
    let server;
    try {
      server = await this._abrir(this.portaPreferida);
    } catch {
      server = await this._abrir(0);
    }
    this.server = server;
    this.porta = server.address().port;
    this.portaPreferida = this.porta;
    this._salvar();
    // O nome é um extra: se não subir, o endereço por IP continua inteiro.
    await this.anunciante?.ligar();
    return this.status();
  }

  desligar() {
    if (!this.server) return this.status();
    // Avisa antes de fechar: o celular mostra "conexão encerrada" em vez de
    // ficar tentando reconectar com um servidor que não existe mais.
    this._transmitir({ tipo: "encerrado" });
    for (const res of this.assinantes.keys()) {
      try {
        res.end();
      } catch {
        /* já fechado */
      }
    }
    this.assinantes.clear();
    // Os aparelhos ficam: quem pareou no domingo passado abre o link e entra,
    // sem se identificar de novo. É o que "desligar e ligar" tem que custar.
    this._salvar();
    this.ultimoEstado = null;
    this.chat = [];
    this.server.close();
    // O SSE é uma conexão que fica aberta de propósito. `close()` só para de
    // aceitar novas e espera as antigas terminarem — sem isto, fechar o
    // Lúmen com um celular conectado deixaria o processo pendurado.
    this.server.closeAllConnections?.();
    this.server = null;
    this.porta = null;
    this.anunciante?.desligar();
    return this.status();
  }

  /** Todas as sessões param de valer — é o "encerrar tudo" da cabine. */
  desconectarTodos() {
    if (!this.ligado()) return this.status();
    this.dispositivos.clear();
    this._transmitir({ tipo: "desconectado" });
    for (const res of this.assinantes.keys()) {
      try {
        res.end();
      } catch {
        /* já fechado */
      }
    }
    this.assinantes.clear();
    this._salvar();
    return this.status();
  }

  /** Tira um aparelho do controle sem mexer nos outros. */
  desconectar(id) {
    for (const [token, d] of this.dispositivos) {
      if (d.id !== id) continue;
      this.dispositivos.delete(token);
      for (const [res, t] of this.assinantes) {
        if (t !== token) continue;
        try {
          res.write(`data: ${JSON.stringify({ tipo: "desconectado" })}\n\n`);
          res.end();
        } catch {
          /* já fechado */
        }
        this.assinantes.delete(res);
      }
      break;
    }
    this._salvar();
    return this.status();
  }

  definirPermissao(id, permissao) {
    if (!PERMISSOES.includes(permissao)) return this.status();
    for (const [token, d] of this.dispositivos) {
      if (d.id !== id) continue;
      d.permissao = permissao;
      this._paraToken(token, { tipo: "permissao", permissao });
      this._salvar();
      break;
    }
    return this.status();
  }

  definirPermissaoPadrao(permissao) {
    if (PERMISSOES.includes(permissao)) this.permissaoPadrao = permissao;
    return this.status();
  }

  /** O que a cabine está fazendo agora, para o aparelho mostrar. */
  atualizarEstado(payload) {
    this.ultimoEstado = payload;
    this._transmitir({ tipo: "estado", estado: payload });
  }

  /** A lista de músicas que o celular pode abrir para editar. */
  /** A pasta de mídia do PC, espelhada para o celular. */
  atualizarMidia(lista) {
    this.midia = (Array.isArray(lista) ? lista : [])
      .filter((m) => m && typeof m.id === "string" && typeof m.titulo === "string")
      .slice(0, 2000)
      .map((m) => ({
        id: m.id,
        tipo: TIPOS_MIDIA.includes(m.tipo) ? m.tipo : "video",
        titulo: semControle(String(m.titulo)).slice(0, 120),
        detalhe: semControle(String(m.detalhe || "")).slice(0, 60),
      }));
  }

  /**
   * Faz um pedido à cabine e espera a resposta dela.
   *
   * Devolve null se a cabine não responder a tempo — janela fechada, ou
   * internet caída no meio de uma busca. O celular mostra "não deu", que é
   * melhor que uma tela girando para sempre.
   */
  _pedirACabine(tipo, dados) {
    if (!this.onEvento) return Promise.resolve(null);
    const id = this.proximoPedido++;
    return new Promise((resolve) => {
      const relogio = setTimeout(() => {
        this.pedidos.delete(id);
        resolve(null);
      }, ESPERA_CABINE_MS);
      this.pedidos.set(id, { resolve, relogio });
      this.onEvento({ tipo, pedido: id, ...dados });
    });
  }

  /** Chamado pelo processo principal quando a cabine termina o pedido. */
  responderPedido(id, resposta) {
    const espera = this.pedidos.get(Number(id));
    if (!espera) return;
    this.pedidos.delete(Number(id));
    clearTimeout(espera.relogio);
    espera.resolve(resposta ?? null);
  }

  atualizarRepertorio(lista) {
    this.repertorio = Array.isArray(lista) ? lista : [];
  }

  /** Recado escrito na cabine, para aparecer nos celulares. */
  mensagemDaCabine(texto, autor) {
    return this._registrarChat({
      de: nomeLimpo(autor, "Cabine"),
      texto: String(texto || "").slice(0, 500),
      daCabine: true,
    });
  }

  _registrarChat({ de, texto, daCabine }) {
    const limpo = semControle(texto, true).trim();
    if (!limpo) return null;
    const msg = {
      id: nodeCrypto.randomUUID(),
      de,
      texto: limpo.slice(0, 500),
      em: Date.now(),
      daCabine: !!daCabine,
    };
    this.chat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
    this._transmitir({ tipo: "chat", mensagem: msg });
    return msg;
  }

  _transmitir(payload) {
    const linha = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of [...this.assinantes.keys()]) {
      try {
        res.write(linha);
      } catch {
        this.assinantes.delete(res);
      }
    }
  }

  _paraToken(token, payload) {
    const linha = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [res, t] of this.assinantes) {
      if (t !== token) continue;
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

  async _lerCorpo(req, limite = MAX_BODY) {
    return new Promise((resolve, reject) => {
      let total = 0;
      const partes = [];
      req.on("data", (c) => {
        total += c.length;
        if (total > limite) {
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

  /** Quem está falando, se é que está — e marca que o aparelho deu notícia. */
  _sessao(token) {
    const d = this.dispositivos.get(String(token || ""));
    if (!d) return null;
    d.ultimoVisto = Date.now();
    return d;
  }

  _json(res, codigo, corpo) {
    res.writeHead(codigo, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(corpo));
  }

  _semPermissao(res, precisa) {
    this._json(res, 403, {
      ok: false,
      erro:
        precisa === "controle"
          ? "Este aparelho ainda não tem permissão para comandar o telão. Peça na cabine."
          : "Este aparelho ainda não tem permissão para editar letras. Peça na cabine.",
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
      const m = req.method;
      const p = url.pathname;
      if (m === "GET" && p === "/") return await this._servirPagina(res);
      if (m === "GET" && p === "/estado") return this._sse(req, res, url);
      if (m === "POST" && p === "/parear") return await this._parear(req, res);
      if (m === "POST" && p === "/comando") return await this._comando(req, res);
      if (m === "GET" && p === "/repertorio") return this._repertorio(res, url);
      if (m === "GET" && p === "/musica") return this._musica(res, url);
      if (m === "POST" && p === "/musica") return await this._salvarMusica(req, res);
      if (m === "POST" && p === "/chat") return await this._chat(req, res);
      if (m === "GET" && p === "/midia") return this._midia(res, url);
      if (m === "POST" && p === "/projetar") return await this._projetar(req, res);
      if (m === "POST" && p === "/volume") return await this._volume(req, res);
      if (m === "POST" && p === "/buscar") return await this._buscar(req, res);
      if (m === "POST" && p === "/letra") return await this._letra(req, res);
    } catch {
      this._json(res, 500, { ok: false, erro: "Erro interno" });
      return;
    }
    this._json(res, 404, { ok: false, erro: "Não encontrado" });
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

  /** http://lumen.local:8787 — ou null quando o nome não subiu na rede. */
  _enderecoFixo() {
    if (!this.ligado() || !this.anunciante?.ativo) return null;
    return `http://${this.anunciante.host}:${this.porta}`;
  }

  _sse(req, res, url) {
    const token = url.searchParams.get("token") || "";
    const disp = this._sessao(token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      // Sem isto, um proxy no caminho pode segurar o fluxo em buffer e o
      // celular só receber o slide depois que a igreja já cantou.
      "x-accel-buffering": "no",
    });
    res.write(":ok\n\n");
    // O aparelho que acabou de conectar precisa do retrato inteiro, não só
    // das mudanças daqui para a frente.
    res.write(
      `data: ${JSON.stringify({
        tipo: "inicio",
        estado: this.ultimoEstado,
        permissao: disp.permissao,
        nome: disp.nome,
        // O endereço que não vence, para o aparelho poder guardar. Vai como
        // um link de verdade: se abrir neste celular, funciona neste celular
        // — melhor descobrir agora do que no domingo de manhã.
        enderecoFixo: this._enderecoFixo(),
        chat: this.chat.slice(-30),
      })}\n\n`,
    );
    this.assinantes.set(res, token);

    // Um ping regular mantém a conexão de pé e mantém `ultimoVisto` fresco,
    // que é como a cabine sabe quem ainda está por perto.
    const ping = setInterval(() => {
      try {
        res.write(":ping\n\n");
        const d = this.dispositivos.get(token);
        if (d) d.ultimoVisto = Date.now();
      } catch {
        clearInterval(ping);
      }
    }, 15000);

    const encerrar = () => {
      clearInterval(ping);
      this.assinantes.delete(res);
      this.onEvento?.({ tipo: "dispositivos" });
    };
    req.on("close", encerrar);
    req.on("error", encerrar);
    this.onEvento?.({ tipo: "dispositivos" });
  }

  async _parear(req, res) {
    const ip = req.socket.remoteAddress || "?";
    if (this._limitado(ip)) {
      this._json(res, 429, { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." });
      return;
    }
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    // O nome é o que a cabine vai ler na lista para decidir o que este
    // aparelho pode fazer. Sem nome, o operador teria uma fila de "Celular"
    // idênticos e nenhuma forma de escolher entre eles.
    const nome = nomeLimpo(corpo.nome, "");
    if (nome.length < 2) {
      this._registrarFalha(ip);
      this._json(res, 400, { ok: false, erro: "Escreva seu nome para entrar." });
      return;
    }
    const token = nodeCrypto.randomUUID();
    const agora = Date.now();
    const disp = {
      id: nodeCrypto.randomUUID(),
      nome,
      permissao: this.permissaoPadrao,
      criadoEm: agora,
      ultimoVisto: agora,
    };
    this.dispositivos.set(token, disp);
    this._salvar();
    this.onEvento?.({ tipo: "dispositivos", novo: disp.nome });
    this._json(res, 200, {
      ok: true,
      token,
      permissao: disp.permissao,
      nome: disp.nome,
    });
  }

  async _comando(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "controle")) return this._semPermissao(res, "controle");

    const acao = String(corpo.acao || "");
    if (!ACOES_VALIDAS.has(acao)) {
      this._json(res, 400, { ok: false, erro: "Comando desconhecido." });
      return;
    }
    this.onComando?.(acao);
    this._json(res, 200, { ok: true });
  }

  _repertorio(res, url) {
    const disp = this._sessao(url.searchParams.get("token"));
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");
    this._json(res, 200, {
      ok: true,
      musicas: this.repertorio.map((m) => ({ id: m.id, titulo: m.titulo, artista: m.artista })),
    });
  }

  _musica(res, url) {
    const disp = this._sessao(url.searchParams.get("token"));
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");
    const id = String(url.searchParams.get("id") || "");
    const musica = this.repertorio.find((m) => m.id === id);
    if (!musica) {
      this._json(res, 404, { ok: false, erro: "Música não encontrada." });
      return;
    }
    this._json(res, 200, { ok: true, musica });
  }

  _midia(res, url) {
    const disp = this._sessao(url.searchParams.get("token"));
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");
    this._json(res, 200, { ok: true, midia: this.midia });
  }

  /**
   * Manda um item da biblioteca para o telão.
   *
   * Não entra na lista de ações porque não é um botão fixo: carrega qual item
   * é. Exige controle do telão — ver o que existe é de editor, mudar o que a
   * igreja está vendo é de quem opera.
   */
  async _projetar(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "controle")) return this._semPermissao(res, "controle");
    const tipo = String(corpo.tipo || "");
    const refId = String(corpo.refId || "");
    if (!TIPOS_PROJETAVEIS.includes(tipo) || !refId) {
      this._json(res, 400, { ok: false, erro: "Item inválido." });
      return;
    }
    this.onEvento?.({ tipo: "projetar", kind: tipo, refId, de: disp.nome });
    this._json(res, 200, { ok: true });
  }

  /** Volume do que toca no telão, de 0 a 100. Exige controle: é som que a
   *  igreja inteira escuta, não uma preferência do aparelho. */
  async _volume(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "controle")) return this._semPermissao(res, "controle");
    const valor = Number(corpo.valor);
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      this._json(res, 400, { ok: false, erro: "Volume inválido." });
      return;
    }
    this.onEvento?.({ tipo: "volume", valor: Math.round(valor), de: disp.nome });
    this._json(res, 200, { ok: true });
  }

  async _buscar(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");
    const termo = semControle(String(corpo.termo || "")).trim().slice(0, 120);
    if (termo.length < 2) {
      this._json(res, 400, { ok: false, erro: "Escreva ao menos duas letras." });
      return;
    }
    const resposta = await this._pedirACabine("buscar-musica", { termo });
    if (!resposta) {
      this._json(res, 504, { ok: false, erro: "A cabine não respondeu. Tente de novo." });
      return;
    }
    this._json(res, 200, { ok: true, achados: resposta.achados ?? [], erro: resposta.erro ?? null });
  }

  async _letra(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");
    const fonte = String(corpo.fonte || "");
    if (!/^https?:\/\//.test(fonte)) {
      this._json(res, 400, { ok: false, erro: "Endereço de letra inválido." });
      return;
    }
    const resposta = await this._pedirACabine("letra-musica", { fonte });
    if (!resposta) {
      this._json(res, 504, { ok: false, erro: "A cabine não respondeu. Tente de novo." });
      return;
    }
    this._json(res, 200, { ok: Boolean(resposta.letra), letra: resposta.letra ?? "", erro: resposta.erro ?? null });
  }

  async _salvarMusica(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req, MAX_BODY_MUSICA));
    } catch {
      this._json(res, 400, { ok: false, erro: "A letra é grande demais ou chegou incompleta." });
      return;
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!podeFazer(disp.permissao, "editor")) return this._semPermissao(res, "editor");

    const titulo = String(corpo.titulo || "").trim();
    const letra = String(corpo.letra || "");
    if (!titulo) {
      this._json(res, 400, { ok: false, erro: "A música precisa de um título." });
      return;
    }
    if (!letra.trim()) {
      this._json(res, 400, { ok: false, erro: "A música precisa de uma letra." });
      return;
    }
    const musica = {
      id: String(corpo.id || "") || null,
      titulo: titulo.slice(0, 120),
      artista: String(corpo.artista || "").trim().slice(0, 120),
      letra,
    };
    // Quem guarda o repertório é a cabine; aqui só se entrega o pedido.
    this.onEvento?.({ tipo: "musica", musica, de: disp.nome });
    this._json(res, 200, { ok: true });
  }

  async _chat(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    const msg = this._registrarChat({ de: disp.nome, texto: corpo.texto, daCabine: false });
    if (!msg) {
      this._json(res, 400, { ok: false, erro: "Mensagem vazia." });
      return;
    }
    this.onEvento?.({ tipo: "chat", mensagem: msg });
    this._json(res, 200, { ok: true, mensagem: msg });
  }
}

module.exports = { RemoteControl, ACOES_VALIDAS, PERMISSOES, podeFazer };
