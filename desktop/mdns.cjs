const dgram = require("node:dgram");
const os = require("node:os");

/**
 * Um nome fixo para o PC da cabine: http://lumen.local:8787
 *
 * A porta e o PIN já pararam de mudar (ver remote-store.cjs), mas o IP ainda
 * é do roteador: ele renova a concessão e entrega outro número, e o endereço
 * que o operador mandou no grupo da igreja morre sem aviso.
 *
 * mDNS resolve isso sem servidor e sem configurar roteador: o celular grita
 * "quem é lumen.local?" no multicast da rede e este processo responde com o
 * IP de agora. O nome nunca muda; o número por trás dele pode mudar todo dia.
 *
 * É escrito à mão, em cima de dgram, porque as bibliotecas de mDNS trazem
 * dependência nativa — e este app precisa instalar num PC de igreja sem
 * compilador, e sem ganhar megabytes por causa de 200 linhas.
 *
 * O que NÃO dá para prometer daqui: se o Firewall do Windows bloquear o
 * UDP 5353, ou se o aparelho for um Android antigo que não resolve ".local",
 * o nome não responde. Por isso ele é um caminho a mais, nunca o único — o
 * IP continua na tela e no QR.
 */

const GRUPO = "224.0.0.251";
const PORTA_MDNS = 5353;
/** Dois minutos: tempo de sobra para um culto, curto para um IP trocado. */
const TTL_S = 120;
/** RFC 6762 secao 6.7: resposta a perguntador antigo vive pouco e não limpa cache. */
const TTL_LEGADO_S = 10;
const TIPO_A = 1;
const TIPO_QUALQUER = 255;
const CLASSE_IN = 1;
const LIMPAR_CACHE = 0x8000;
const QUER_UNICAST = 0x8000;
const MAX_SALTOS = 16;

function ehIPv4(ip) {
  const p = String(ip).split(".");
  return (
    p.length === 4 && p.every((n) => /^[0-9]{1,3}$/.test(n) && Number(n) >= 0 && Number(n) <= 255)
  );
}

/**
 * Qual IP oferecer primeiro.
 *
 * Um PC comum tem adaptador virtual do VirtualBox, do Hyper-V, da VPN — e
 * responder com o IP de um deles manda o celular para uma rede onde a cabine
 * não está. A faixa doméstica vem na frente; o 169.254, que é o endereço de
 * quem não conseguiu endereço nenhum, vai para o fim.
 */
function pesoDoEndereco(ip) {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  const p = ip.split(".");
  if (p[0] === "172" && Number(p[1]) >= 16 && Number(p[1]) <= 31) return 2;
  if (ip.startsWith("169.254.")) return 4;
  return 3;
}

/**
 * Adaptador que existe em software e não leva a rede nenhuma.
 *
 * Um PC com VirtualBox instalado tem um 192.168.56.1 tão legítimo quanto o
 * IP do Wi-Fi da igreja, e nenhuma conta sobre faixas de endereço separa os
 * dois. O nome do adaptador separa.
 */
const NOMES_VIRTUAIS =
  /virtualbox|vmware|hyper-v|vethernet|docker|wsl|tap-|tun[0-9]|loopback|bluetooth|npcap|zerotier|tailscale|radmin|hamachi/i;

function ehInterfaceVirtual(nome) {
  return NOMES_VIRTUAIS.test(String(nome || ""));
}

/**
 * A ordenação é estável de propósito: quem chama já pode ter ordenado por
 * algo que só ele sabe — o nome do adaptador, por exemplo — e um desempate
 * alfabético aqui jogaria esse trabalho fora.
 */
function ordenarEnderecos(ips) {
  return [...ips].filter(ehIPv4).sort((a, b) => pesoDoEndereco(a) - pesoDoEndereco(b));
}

/** Os IPv4 desta máquina na rede, sem o 127.0.0.1 e sem adaptador de mentira. */
function enderecosLan() {
  const reais = [];
  const virtuais = [];
  for (const [nomeDaPlaca, lista] of Object.entries(os.networkInterfaces())) {
    for (const info of lista ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      (ehInterfaceVirtual(nomeDaPlaca) ? virtuais : reais).push(info.address);
    }
  }
  // Placa de verdade primeiro; a de mentira fica, porque numa máquina só com
  // elas é melhor oferecer alguma coisa do que não responder.
  return [...ordenarEnderecos(reais), ...ordenarEnderecos(virtuais)];
}

function escreverNome(nome) {
  const pedacos = [];
  for (const parte of String(nome).split(".")) {
    if (!parte) continue;
    const b = Buffer.from(parte, "utf8");
    if (b.length > 63) throw new Error("Rótulo de nome longo demais.");
    pedacos.push(Buffer.from([b.length]), b);
  }
  pedacos.push(Buffer.from([0]));
  return Buffer.concat(pedacos);
}

/**
 * Lê um nome do pacote, seguindo ponteiros de compressão.
 *
 * Devolve null em vez de lançar: o que chega aqui é um datagrama de qualquer
 * um na rede, e pacote torto é o caso comum, não a exceção.
 */
function lerNome(buf, inicio) {
  const partes = [];
  let i = inicio;
  let fim = -1;
  let saltos = 0;
  while (i >= 0 && i < buf.length) {
    const tam = buf[i];
    if (tam === 0) {
      if (fim < 0) fim = i + 1;
      return { nome: partes.join("."), fim };
    }
    if ((tam & 0xc0) === 0xc0) {
      if (i + 1 >= buf.length) return null;
      if (fim < 0) fim = i + 2;
      i = ((tam & 0x3f) << 8) | buf[i + 1];
      // Ponteiro em círculo é um pacote querendo prender o processo num laço.
      saltos += 1;
      if (saltos > MAX_SALTOS) return null;
      continue;
    }
    if (i + 1 + tam > buf.length) return null;
    partes.push(buf.toString("utf8", i + 1, i + 1 + tam));
    i += 1 + tam;
  }
  return null;
}

/** As perguntas de um pacote mDNS — ou null se não for uma pergunta válida. */
function lerPerguntas(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // Bit QR ligado é resposta de outra máquina: não é da nossa conta.
  if (buf.readUInt16BE(2) & 0x8000) return null;
  const quantas = buf.readUInt16BE(4);
  if (quantas === 0 || quantas > 64) return null;
  const perguntas = [];
  let i = 12;
  for (let n = 0; n < quantas; n += 1) {
    const lido = lerNome(buf, i);
    if (!lido || lido.fim + 4 > buf.length) return null;
    const classe = buf.readUInt16BE(lido.fim + 2);
    perguntas.push({
      nome: lido.nome.toLowerCase(),
      tipo: buf.readUInt16BE(lido.fim),
      classe: classe & 0x7fff,
      unicast: (classe & QUER_UNICAST) !== 0,
    });
    i = lido.fim + 4;
  }
  return { id: buf.readUInt16BE(0), perguntas };
}

function registroA(nome, ip, ttl, limparCache) {
  const cabeca = Buffer.alloc(10);
  cabeca.writeUInt16BE(TIPO_A, 0);
  cabeca.writeUInt16BE(CLASSE_IN | (limparCache ? LIMPAR_CACHE : 0), 2);
  cabeca.writeUInt32BE(ttl, 4);
  cabeca.writeUInt16BE(4, 8);
  const dados = Buffer.from(ip.split(".").map(Number));
  return Buffer.concat([escreverNome(nome), cabeca, dados]);
}

/**
 * Monta a resposta com um registro A por IP.
 *
 * `legado` é a pergunta que veio de uma porta qualquer em vez da 5353 — um
 * resolvedor comum, não um par de mDNS. A ele se responde repetindo a
 * pergunta, com validade curta e sem mandar limpar cache nenhum.
 */
function montarResposta({ nome, ips, id = 0, legado = false, pergunta = null, ttl = null }) {
  const bons = ordenarEnderecos(ips);
  const cabecalho = Buffer.alloc(12);
  cabecalho.writeUInt16BE(legado ? id : 0, 0);
  // QR=1, AA=1: é resposta, e desta máquina, com autoridade.
  cabecalho.writeUInt16BE(0x8400, 2);
  cabecalho.writeUInt16BE(legado && pergunta ? 1 : 0, 4);
  cabecalho.writeUInt16BE(bons.length, 6);
  const partes = [cabecalho];
  if (legado && pergunta) {
    const q = Buffer.alloc(4);
    q.writeUInt16BE(pergunta.tipo, 0);
    q.writeUInt16BE(CLASSE_IN, 2);
    partes.push(escreverNome(nome), q);
  }
  const validade = ttl === null ? (legado ? TTL_LEGADO_S : TTL_S) : ttl;
  for (const ip of bons) partes.push(registroA(nome, ip, validade, !legado));
  return Buffer.concat(partes);
}

/** Lê os registros A de uma resposta — é o que o teste usa para conferir. */
function lerRespostaA(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (!(buf.readUInt16BE(2) & 0x8000)) return null;
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6);
  let i = 12;
  for (let n = 0; n < qd; n += 1) {
    const lido = lerNome(buf, i);
    if (!lido) return null;
    i = lido.fim + 4;
  }
  const registros = [];
  for (let n = 0; n < an; n += 1) {
    const lido = lerNome(buf, i);
    if (!lido || lido.fim + 10 > buf.length) return null;
    const tipo = buf.readUInt16BE(lido.fim);
    const classe = buf.readUInt16BE(lido.fim + 2);
    const ttl = buf.readUInt32BE(lido.fim + 4);
    const tamanho = buf.readUInt16BE(lido.fim + 8);
    const inicio = lido.fim + 10;
    if (inicio + tamanho > buf.length) return null;
    if (tipo === TIPO_A && tamanho === 4) {
      registros.push({
        nome: lido.nome.toLowerCase(),
        ip: [...buf.subarray(inicio, inicio + 4)].join("."),
        ttl,
        limparCache: (classe & LIMPAR_CACHE) !== 0,
      });
    }
    i = inicio + tamanho;
  }
  return { id: buf.readUInt16BE(0), registros };
}

class Anunciante {
  /**
   * `porta` e `enderecos` existem para o teste: subir na 5353 de verdade
   * brigaria com o mDNS que o próprio Windows já roda, e o teste passaria a
   * depender da rede da máquina que o executa.
   */
  constructor({ nome = "lumen", porta = PORTA_MDNS, enderecos = enderecosLan } = {}) {
    this.host = `${nome}.local`;
    this.porta = porta;
    this.enderecos = enderecos;
    this.socket = null;
    this.erro = null;
  }

  get ativo() {
    return Boolean(this.socket);
  }

  /** Resolve true/false — nunca rejeita: o nome é um extra, não um requisito. */
  ligar() {
    if (this.socket) return Promise.resolve(true);
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      const desistir = (erro) => {
        // A 5353 costuma já estar ocupada — Bonjour da Apple, iTunes, o
        // próprio Windows. Sem o nome, o IP continua funcionando.
        this.erro = (erro && erro.message) || "não consegui abrir o nome na rede";
        try {
          socket.close();
        } catch {
          /* já fechado */
        }
        this.socket = null;
        resolve(false);
      };
      socket.once("error", desistir);
      socket.on("message", (msg, vindoDe) => this._responder(msg, vindoDe));
      try {
        socket.bind(this.porta, () => {
          socket.off("error", desistir);
          socket.on("error", () => {});
          this.socket = socket;
          this.erro = null;
          this._entrarNoGrupo();
          this._anunciar();
          resolve(true);
        });
      } catch (erro) {
        desistir(erro);
      }
    });
  }

  _entrarNoGrupo() {
    const socket = this.socket;
    if (!socket) return;
    try {
      socket.setMulticastTTL(255);
      socket.setMulticastLoopback(true);
    } catch {
      /* alguns adaptadores recusam; a resposta unicast ainda sai */
    }
    // Entra por interface: numa máquina com Wi-Fi e cabo, entrar só na
    // "padrão" deixaria metade da igreja sem resposta.
    let entrou = 0;
    for (const ip of this.enderecos()) {
      try {
        socket.addMembership(GRUPO, ip);
        entrou += 1;
      } catch {
        /* interface sem multicast */
      }
    }
    if (entrou === 0) {
      try {
        socket.addMembership(GRUPO);
      } catch (erro) {
        this.erro = (erro && erro.message) || "a rede não aceitou multicast";
      }
    }
  }

  _enviar(pacote, porta, destino) {
    if (!this.socket) return;
    try {
      this.socket.send(pacote, porta, destino, () => {});
    } catch {
      /* a rede caiu entre uma coisa e outra */
    }
  }

  /** Avisa a rede sem ninguém perguntar: quem já tinha o nome atualiza o IP. */
  _anunciar(ttl = null) {
    const ips = this.enderecos();
    if (ips.length === 0) return;
    this._enviar(montarResposta({ nome: this.host, ips, ttl }), this.porta, GRUPO);
  }

  _responder(msg, vindoDe) {
    const pergunta = lerPerguntas(msg);
    if (!pergunta) return;
    const nossas = pergunta.perguntas.filter(
      (p) =>
        p.nome === this.host &&
        p.classe === CLASSE_IN &&
        (p.tipo === TIPO_A || p.tipo === TIPO_QUALQUER),
    );
    if (nossas.length === 0) return;
    // Lê as interfaces agora, não no ligar: o IP pode ter mudado desde então,
    // e responder com o de antes seria o defeito que este módulo veio curar.
    const ips = this.enderecos();
    if (ips.length === 0) return;
    const legado = vindoDe.port !== this.porta;
    const pacote = montarResposta({
      nome: this.host,
      ips,
      id: pergunta.id,
      legado,
      pergunta: nossas[0],
    });
    if (legado || nossas.some((p) => p.unicast)) {
      this._enviar(pacote, vindoDe.port, vindoDe.address);
    } else {
      this._enviar(pacote, this.porta, GRUPO);
    }
  }

  desligar() {
    const socket = this.socket;
    if (!socket) return;
    // Despedida: TTL zero manda a rede esquecer o nome na hora, em vez de
    // mandar celular nenhum para um IP que não atende mais.
    this._anunciar(0);
    this.socket = null;
    try {
      socket.close();
    } catch {
      /* já fechado */
    }
  }
}

module.exports = {
  Anunciante,
  enderecosLan,
  ordenarEnderecos,
  pesoDoEndereco,
  ehInterfaceVirtual,
  escreverNome,
  lerNome,
  lerPerguntas,
  montarResposta,
  lerRespostaA,
  GRUPO,
  PORTA_MDNS,
  TTL_S,
  TTL_LEGADO_S,
};
