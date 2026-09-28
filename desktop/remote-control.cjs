const http = require("node:http");
const path = require("node:path");
const nodeCrypto = require("node:crypto");
const fsp = require("node:fs/promises");
const { enderecosLan } = require("./mdns.cjs");
const { senhaConfere, cozinharSenha, chaveDoUsuario, MAX_CONTAS } = require("./remote-store.cjs");
const { EQUIPES_DE_APARELHO, paraValido, mencoesNoTexto, podeVer } = require("./chat-regras.cjs");
const { normalizarPermissoes, pode, podeAlguma, alemDoChat } = require("./permissoes.cjs");

/**
 * Controle remoto pelo celular.
 *
 * Um servidor HTTP na rede local — não só em 127.0.0.1 —,
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
 *   /chat        recado para todos, uma equipe ou uma pessoa (permissão: chat)
 *   /chat/foto   foto no chat; /chat/digitando; /chat/equipe  (permissão: chat)
 */

const MAX_BODY = 4 * 1024;
/** Letra de música é maior que um comando: um hino comprido passa de 4 KB. */
const MAX_BODY_MUSICA = 256 * 1024;
/**
 * Recado falado cabe em 4,5 MB.
 *
 * A página do celular converte a gravação para WAV de 12 kHz, mono, antes de
 * mandar (o m4a do iPhone e o 3gp de muito Android não tocam em todo lugar):
 * dois minutos disso dão 2,9 MB, e uns 3,9 MB em base64. Com 1,5 MB, recado
 * de mais de meio minuto era recusado sem ninguém entender por quê. O teto
 * continua apertado o bastante para ninguém mandar um culto pelo chat.
 */
const MAX_BODY_VOZ = 4608 * 1024;
/** Tipos de áudio que um navegador de celular grava (a página nova manda sempre WAV). */
const AUDIOS_ACEITOS = /^data:audio\/(webm|ogg|mp4|x-m4a|aac|mpeg|wav|x-wav|wave)(;[^,]*)?,/i;
/** Recado mais comprido que isto é conversa, não recado. */
const MAX_SEGUNDOS_VOZ = 120;
/**
 * Foto no chat: o celular já reduz para 1600 px antes de mandar, o que dá
 * poucas centenas de KB. O teto (em base64) cobre foto de celular que não
 * reduziu, sem virar porta para arquivo grande.
 */
const MAX_BODY_FOTO = 9 * 1024 * 1024;
const FOTOS_ACEITAS = /^data:image\/(jpeg|png|webp);base64,/i;
/** "Digitando…" não precisa chegar mais que uma vez por segundo. */
const DIGITANDO_INTERVALO_MS = 1000;
const TIPO_HTML = "text/html; charset=utf-8";
const TIPO_JS = "text/javascript; charset=utf-8";
/** Teto do que a página do dirigente pode largar no computador da igreja. */
const MAX_ARQUIVO_DIRIGENTE = 64 * 1024 * 1024;
/** Uma sessão de envio dura um culto, não uma semana. */
const SESSAO_DIRIGENTE_MS = 6 * 60 * 60 * 1000;
const JANELA_TENTATIVAS_MS = 3 * 60 * 1000;
const LIMITE_TENTATIVAS = 5;
/** O aparelho que não dá notícia há tanto tempo aparece como desconectado. */
const SUMIU_MS = 30 * 1000;
const MAX_CHAT = 200;
/** Tipos de mídia que o celular pode enxergar e mandar para o telão. */
const TIPOS_MIDIA = ["video", "audio", "image"];
/** Uma capa de 160px em JPEG cabe folgado nisto; acima é coisa errada. */
const MAX_CAPA = 96 * 1024;
/** Teto do índice de slide que o celular pode pedir — baralho nenhum passa. */
const MAX_SLIDE = 5000;
/** O que o celular pode mandar para o telão pelo nome do item. */
const TIPOS_PROJETAVEIS = ["song", "text", "media"];
/** O que pode aparecer na programação do culto, e em que etapa. */
const TIPOS_DO_CULTO = ["song", "bible", "media", "text", "apresentacao"];
const ETAPAS_DO_CULTO = ["no-ar", "proximo", "pendente"];
const MAX_ITENS_DO_CULTO = 300;
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

/** Tocar, pausar e sair do vídeo também moram no mini-player da aba Mídia. */
const ACOES_DA_MIDIA = new Set(["tocar", "pausar", "parar-midia"]);

/** O teto de uma posição ou duração de vídeo: um dia. */
const MAX_SEGUNDOS = 24 * 60 * 60;

/** O tempo do vídeo que vem da cabine, limpo — ou null. */
function tempoDaMidiaValido(bruto) {
  if (!bruto || typeof bruto !== "object") return null;
  const estado = ["tocando", "pausado", "fim"].includes(bruto.estado) ? bruto.estado : null;
  const numero = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_SEGUNDOS ? v : null);
  const tempo = numero(bruto.tempo);
  const duracao = numero(bruto.duracao);
  if (!estado || tempo === null || duracao === null) return null;
  return { estado, tempo, duracao };
}

/**
 * Senha de ninguém, para conferir quando o usuário não existe: responder
 * mais depressa a um usuário inexistente contaria quais usuários existem.
 * Cozida na primeira vez que precisa, não na abertura do app.
 */
let senhaDeNinguem = null;
function senhaDeMentira() {
  if (!senhaDeNinguem) senhaDeNinguem = cozinharSenha(nodeCrypto.randomUUID());
  return senhaDeNinguem;
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
/**
 * O que o celular enxerga da lista de mídia, resumido: quem está, com que
 * nome e se já tem capa. Mudou isto, vale avisar; a mesma lista reenviada
 * (troca de item no ar) não vale.
 */
function assinaturaDaMidia(lista) {
  return lista
    .map((m) => `${m.id}|${m.tipo}|${m.titulo}|${m.capa ? m.capa.length : 0}|${m.segundos}`)
    .join("\n");
}

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
        permissoes: normalizarPermissoes(d.permissoes ?? d.permissao),
        equipe: d.equipe || "",
        contaId: d.contaId || "",
        criadoEm: d.criadoEm,
        ultimoVisto: d.ultimoVisto,
      });
    }
    /**
     * Contas com senha da equipe. Quem entra com uma já chega com o que
     * pode fazer; o acesso rápido, só com o nome, continua entrando no
     * chat e esperando a cabine liberar o resto.
     */
    this.contas = (guardado?.contas ?? []).map((c) => ({ ...c }));
    this.tentativas = new Map();
    /** res do SSE → token, para saber de quem é cada conexão aberta. */
    this.assinantes = new Map();
    this.ultimoEstado = null;
    this.ultimoTempo = null;
    this.repertorio = [];
    /** A cara dos temas, para a grade de slides do celular ter fundo. */
    this.temas = [];
    /** Espelho da pasta de mídia: vídeo, áudio e imagem que a cabine enxerga. */
    this.midia = [];
    /** A programação do culto aberta na cabine. */
    this.culto = { nome: "", itens: [] };
    /** O nome com que a cabine aparece no chat — o do operador, se houver. */
    this.nomeCabine = "Cabine";
    /** Página do dirigente aberta: token → quem é, para o chat saber a quem entregar. */
    this.dirigentes = new Map();
    /** Quem a cabine silenciou no chat: id → até quando (ms). Vale até reiniciar. */
    this.silenciados = new Map();
    /** Último "digitando…" de cada um, para não inundar a rede. */
    this.digitandoEm = new Map();
    /** Ligados pelo processo principal: é ele que sabe escrever e ler a foto no disco. */
    this.aoGuardarFoto = null;
    this.aoLerFoto = null;
    this.aoApagarFoto = null;
    /**
     * Pedidos que só a cabine sabe responder — buscar letra na internet, abrir
     * uma letra achada. O celular fica esperando o HTTP; a cabine responde
     * pelo IPC e a resposta sai por aqui. Sem isto, a busca teria que rodar no
     * celular, que pode não ter internet, e com provedor diferente do que a
     * cabine usa — dois resultados diferentes para a mesma busca.
     */
    this.pedidos = new Map();
    this.proximoPedido = 1;
    /**
     * A senha da página de envio de arquivos — a única do Lúmen que pede uma.
     * Mandar arquivo para o computador da igreja é bem mais arriscado que
     * mandar recado no chat, e aqui não há operador olhando a lista.
     */
    this.senhaDirigente = guardado ? guardado.senhaDirigente : null;
    /** token → quando entrou. Sessão de envio dura um culto, não uma semana. */
    this.sessoesDirigente = new Map();
    /** Nome e logo da igreja, para a página abrir com a cara da casa. */
    this.igreja = { nome: "", logo: "" };
    /** Ligado pelo processo principal: é ele que sabe escrever no disco. */
    this.aoReceberArquivo = null;
    this.chat = [];
    /** Permissões de quem acabou de parear: só o chat. A cabine pode afrouxar isto. */
    this.permissoesPadrao = [];
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
      senhaDirigente: this.senhaDirigente,
      dispositivos: [...this.dispositivos].map(([token, d]) => ({ token, ...d })),
      contas: this.contas,
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
        permissoes: d.permissoes,
        equipe: d.equipe || "",
        porConta: Boolean(d.contaId),
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
      /** Se a página de envio de arquivos já tem senha definida. */
      temSenhaDirigente: Boolean(this.senhaDirigente),
      /** "lumen.local" quando o nome está de pé na rede; null quando não. */
      nomeLocal: this.ligado() && this.anunciante?.ativo ? this.anunciante.host : null,
      /** Por que o nome não subiu — para a cabine poder explicar em vez de sumir. */
      avisoNome: this.ligado() ? (this.anunciante?.erro ?? null) : null,
      sessoesAtivas: [...this.dispositivos.values()].filter((d) => this._online(d)).length,
      dispositivos: this.listarDispositivos(),
      permissoesPadrao: this.permissoesPadrao,
      contas: this.listarContas(),
    };
  }

  /** As contas para a cabine — sem a senha, nem cozida. */
  listarContas() {
    const aparelhos = [...this.dispositivos.values()];
    return this.contas
      .map((c) => ({
        id: c.id,
        usuario: c.usuario,
        permissoes: c.permissoes,
        equipe: c.equipe,
        criadaEm: c.criadaEm,
        aparelhos: aparelhos.filter((d) => d.contaId === c.id).length,
      }))
      .sort((a, b) => a.usuario.localeCompare(b.usuario, "pt-BR"));
  }

  /**
   * Cria ou muda uma conta. A senha chega em claro só até aqui: o que fica
   * no disco é o scrypt dela, como a senha do dirigente.
   *
   * Quem já entrou com a conta acompanha a mudança na hora — permissão,
   * equipe e nome. Senha trocada tira todo mundo que entrou com a antiga:
   * trocar a senha é justamente o que se faz quando ela vazou.
   */
  salvarConta(dados) {
    const d = dados && typeof dados === "object" ? dados : {};
    const falha = (erro) => ({ ok: false, erro, status: this.status() });
    const usuario = nomeLimpo(d.usuario, "");
    if (chaveDoUsuario(usuario).length < 2) return falha("O usuário precisa de ao menos duas letras.");
    const id = typeof d.id === "string" ? d.id : "";
    const existente = id ? this.contas.find((c) => c.id === id) : null;
    if (id && !existente) return falha("Essa conta não existe mais.");
    const chave = chaveDoUsuario(usuario);
    if (this.contas.some((c) => c.id !== id && chaveDoUsuario(c.usuario) === chave)) {
      return falha("Já existe uma conta com esse usuário.");
    }
    const senha = typeof d.senha === "string" ? d.senha.trim() : "";
    if (senha && senha.length < 4) return falha("A senha precisa de ao menos quatro caracteres.");
    const permissoes = normalizarPermissoes(d.permissoes ?? d.permissao);
    const equipe = EQUIPES_DE_APARELHO.includes(d.equipe) ? d.equipe : "";
    if (!existente) {
      if (!senha) return falha("Escolha uma senha para a conta.");
      if (this.contas.length >= MAX_CONTAS) return falha("O Lúmen guarda até 50 contas. Apague uma que não se usa mais.");
      this.contas.push({
        id: nodeCrypto.randomUUID(),
        usuario,
        senha: cozinharSenha(senha),
        permissoes,
        equipe,
        criadaEm: Date.now(),
      });
      this._salvar();
      return { ok: true, status: this.status() };
    }
    existente.usuario = usuario;
    existente.permissoes = permissoes;
    existente.equipe = equipe;
    if (senha) {
      existente.senha = cozinharSenha(senha);
      this._desconectarDaConta(existente.id);
    }
    for (const [token, disp] of this.dispositivos) {
      if (disp.contaId !== existente.id) continue;
      disp.nome = usuario;
      disp.equipe = equipe;
      if (JSON.stringify(disp.permissoes) !== JSON.stringify(permissoes)) {
        disp.permissoes = [...permissoes];
        this._paraToken(token, { tipo: "permissoes", permissoes });
      }
    }
    this._salvar();
    this._avisarPresenca();
    return { ok: true, status: this.status() };
  }

  /** Alguém saiu da equipe: a conta some, e os aparelhos dela saem junto. */
  apagarConta(id) {
    const antes = this.contas.length;
    this.contas = this.contas.filter((c) => c.id !== id);
    if (this.contas.length !== antes) {
      this._desconectarDaConta(id);
      this._salvar();
    }
    return this.status();
  }

  _desconectarDaConta(contaId) {
    for (const d of [...this.dispositivos.values()]) {
      if (d.contaId === contaId) this.desconectar(d.id);
    }
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
    this.ultimoTempo = null;
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

  /**
   * O que um aparelho pode: a lista de partes (culto, mídia, letras,
   * controle), ["completo"] ou [] — só o chat. O nome antigo de um degrau
   * ("editor", "controle") ainda é aceito e vira a lista equivalente.
   */
  definirPermissao(id, permissoes) {
    const lista = normalizarPermissoes(permissoes);
    for (const [token, d] of this.dispositivos) {
      if (d.id !== id) continue;
      d.permissoes = lista;
      this._paraToken(token, { tipo: "permissoes", permissoes: lista });
      this._salvar();
      break;
    }
    return this.status();
  }

  definirPermissaoPadrao(permissoes) {
    this.permissoesPadrao = normalizarPermissoes(permissoes);
    return this.status();
  }

  /** O que a cabine está fazendo agora, para o aparelho mostrar. */
  atualizarEstado(payload) {
    this.ultimoEstado = payload;
    // O que está no ar é de quem mexe no culto: quem só tem o chat vê só o chat.
    this._transmitir({ tipo: "estado", estado: payload }, (d) => alemDoChat(d.permissoes));
  }

  /**
   * Onde está o vídeo do telão, para a barra de tempo do celular.
   *
   * Evento próprio e leve: mandar o estado inteiro a cada segundo pesaria
   * no celular velho. Vai só para quem pode mexer na mídia, que é quem tem
   * a barra; `null` é "nenhum vídeo no ar".
   */
  atualizarTempo(payload) {
    this.ultimoTempo = tempoDaMidiaValido(payload);
    this._transmitir({ tipo: "tempo", tempo: this.ultimoTempo }, (d) => podeAlguma(d.permissoes, ["midia", "controle"]));
  }

  /** A lista de músicas que o celular pode abrir para editar. */
  /**
   * Define (ou tira) a senha da página de envio de arquivos.
   *
   * Vazio desliga a página: sem senha ela não abre, porque receber arquivo de
   * qualquer um na Wi-Fi é o tipo de porta que não se deixa encostada.
   */
  definirSenhaDirigente(senha) {
    const limpa = String(senha || "").trim();
    this.senhaDirigente = limpa.length >= 4 ? cozinharSenha(limpa) : null;
    this.sessoesDirigente.clear();
    this._salvar();
    return this.status();
  }

  /** Nome e logo da igreja, para a página do dirigente ter a cara da casa. */
  atualizarIgreja(dados) {
    this.igreja = {
      nome: semControle(String(dados?.nome || "")).slice(0, 80),
      // A logo já vem reduzida pela cabine (ver logo-imagem.ts).
      logo: typeof dados?.logo === "string" && dados.logo.startsWith("data:image/") ? dados.logo : "",
    };
  }

  _sessaoDirigente(token) {
    const em = this.sessoesDirigente.get(String(token || ""));
    if (!em) return false;
    if (Date.now() - em > SESSAO_DIRIGENTE_MS) {
      this.sessoesDirigente.delete(String(token));
      return false;
    }
    return true;
  }

  /**
   * A pasta de mídia do PC, espelhada para o celular.
   *
   * A cabine manda a lista duas vezes — primeiro só os nomes, depois com
   * capa e duração. Item que já tinha capa e chega sem ela fica com a que
   * tinha: sem isso, cada troca de item no ar apagava as capas do celular
   * por um instante.
   *
   * Mudou de verdade (entrou, saiu, ganhou capa)? Os aparelhos abertos
   * recebem um aviso e releem a lista na hora. O aviso não leva a lista:
   * ver a mídia exige permissão de editor, e o fluxo de eventos chega a
   * todos os pareados.
   */
  atualizarMidia(lista) {
    const anteriores = new Map(this.midia.map((m) => [m.id, m]));
    const antes = assinaturaDaMidia(this.midia);
    this.midia = (Array.isArray(lista) ? lista : [])
      .filter((m) => m && typeof m.id === "string" && typeof m.titulo === "string")
      .slice(0, 2000)
      .map((m) => ({
        id: m.id,
        tipo: TIPOS_MIDIA.includes(m.tipo) ? m.tipo : "video",
        titulo: semControle(String(m.titulo)).slice(0, 120),
        detalhe: semControle(String(m.detalhe || "")).slice(0, 60),
        // A capa é um JPEG pequeno que a cabine gerou. Só `data:image/jpeg`
        // passa: qualquer outro endereço aqui viraria uma requisição que o
        // celular faria para fora, e esta página não faz requisição para
        // fora.
        capa:
          typeof m.capa === "string" && m.capa.startsWith("data:image/jpeg;base64,")
            ? m.capa.slice(0, MAX_CAPA)
            : "",
        segundos: Number.isFinite(m.segundos) ? Math.max(0, Math.round(m.segundos)) : 0,
      }))
      .map((m) => {
        const antigo = anteriores.get(m.id);
        if (!antigo || m.capa) return m;
        return { ...m, capa: antigo.capa, segundos: m.segundos || antigo.segundos };
      });
    if (assinaturaDaMidia(this.midia) !== antes) this._transmitir({ tipo: "midia" }, (d) => pode(d.permissoes, "midia"));
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

  /**
   * A programação do culto que está aberta na cabine, espelhada no celular.
   *
   * Mudou (item entrou, saiu, trocou de lugar, outro foi para o ar)? Os
   * aparelhos abertos recebem um aviso e releem. Como na mídia, o aviso não
   * leva a lista: ver a programação é de editor.
   */
  atualizarCulto(dados) {
    const antes = JSON.stringify(this.culto);
    const itens = Array.isArray(dados?.itens) ? dados.itens : [];
    this.culto = {
      nome: semControle(String(dados?.nome || "")).slice(0, 80),
      itens: itens
        .filter((i) => i && typeof i.id === "string" && i.id && typeof i.titulo === "string")
        .slice(0, MAX_ITENS_DO_CULTO)
        .map((i) => ({
          id: i.id.slice(0, 64),
          titulo: semControle(i.titulo).slice(0, 120),
          tipo: TIPOS_DO_CULTO.includes(i.tipo) ? i.tipo : "outro",
          detalhe: semControle(String(i.detalhe || "")).slice(0, 80),
          etapa: ETAPAS_DO_CULTO.includes(i.etapa) ? i.etapa : "pendente",
        })),
    };
    if (JSON.stringify(this.culto) !== antes) this._transmitir({ tipo: "culto" }, (d) => pode(d.permissoes, "culto"));
  }

  /**
   * A cara dos temas, como o celular vai desenhar as miniaturas.
   *
   * Os dois campos de fundo são peneirados pelo mesmo motivo da capa de
   * mídia: esta página não faz requisição para fora, e nem um `data:` de
   * outro tipo nem um `url()` no CSS vão fazê-la começar agora.
   */
  atualizarTemas(lista) {
    this.temas = (Array.isArray(lista) ? lista : [])
      .filter((t) => t && typeof t.id === "string")
      .slice(0, 32)
      .map((t) => ({
        id: t.id,
        fundo:
          typeof t.fundo === "string" && !/url\s*\(/i.test(t.fundo)
            ? t.fundo.slice(0, 400)
            : "",
        imagem:
          typeof t.imagem === "string" && t.imagem.startsWith("data:image/jpeg;base64,")
            ? t.imagem.slice(0, MAX_CAPA)
            : "",
        cor: typeof t.cor === "string" ? t.cor.slice(0, 40) : "#ffffff",
        maiusculas: !!t.maiusculas,
      }));
  }

  /** Recado escrito na cabine, para aparecer nos celulares. */
  mensagemDaCabine(texto, autor, para) {
    this._nomeDaCabine(autor);
    return this._registrarChat({
      de: this.nomeCabine,
      deId: "cabine",
      texto: String(texto || "").slice(0, 500),
      daCabine: true,
      para,
    });
  }

  /** Foto mandada pela cabine; o arquivo já foi gravado pelo processo principal. */
  fotoDaCabine(arquivo, texto, autor, para) {
    this._nomeDaCabine(autor);
    return this._registrarChat({
      de: this.nomeCabine,
      deId: "cabine",
      texto: String(texto || "").slice(0, 500),
      daCabine: true,
      para,
      foto: { arquivo: String(arquivo) },
    });
  }

  _nomeDaCabine(autor) {
    const nome = nomeLimpo(autor, "Cabine");
    if (nome === this.nomeCabine) return;
    this.nomeCabine = nome;
    this._avisarPresenca();
  }

  _registrarChat({ de, deId = "", texto, daCabine, audio, segundos, para, foto }) {
    const limpo = semControle(texto, true).trim();
    // Recado falado ou foto não precisam de texto escrito; recado escrito precisa.
    if (!limpo && !audio && !foto) return null;
    const msg = {
      id: nodeCrypto.randomUUID(),
      de,
      deId,
      texto: limpo.slice(0, 500),
      em: Date.now(),
      daCabine: !!daCabine,
      para: paraValido(para),
      mencoes: mencoesNoTexto(limpo, this.presenca()),
      ...(audio ? { audio, segundos } : {}),
      ...(foto ? { foto } : {}),
    };
    this.chat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
    this._transmitirChat(msg);
    return msg;
  }

  /**
   * Entrega um recado só a quem pode lê-lo.
   *
   * O filtro é aqui, por conexão — esconder na tela de quem não devia ler
   * não bastaria, porque o recado já teria chegado ao aparelho.
   */
  _transmitirChat(msg) {
    const linha = `data: ${JSON.stringify({ tipo: "chat", mensagem: msg })}\n\n`;
    for (const [res, token] of [...this.assinantes]) {
      if (!podeVer(this._leitor(token), msg)) continue;
      try {
        res.write(linha);
      } catch {
        this.assinantes.delete(res);
      }
    }
  }

  /** O histórico que um leitor pode ver, ao conectar. */
  _chatPara(leitor) {
    return this.chat.filter((m) => podeVer(leitor, m)).slice(-40);
  }

  /** Quem é o dono de um token: um aparelho pareado ou a página do dirigente. */
  _leitor(token) {
    const chave = String(token || "");
    const d = this.dispositivos.get(chave);
    if (d) return { id: d.id, nome: d.nome, equipe: d.equipe || "" };
    const dir = this.dirigentes.get(chave);
    if (dir && this._sessaoDirigente(chave)) return { id: dir.id, nome: dir.nome, equipe: "pastor" };
    return null;
  }

  _silenciado(id) {
    const ate = this.silenciados.get(id);
    if (!ate) return false;
    if (ate > Date.now()) return true;
    this.silenciados.delete(id);
    return false;
  }

  /** Quem está com o chat aberto agora: a cabine e cada aparelho ou página conectada. */
  presenca() {
    const pessoas = new Map();
    pessoas.set("cabine", { id: "cabine", nome: this.nomeCabine, equipe: "cabine", silenciado: false });
    for (const token of this.assinantes.values()) {
      const l = this._leitor(token);
      if (l && !pessoas.has(l.id)) pessoas.set(l.id, { ...l, silenciado: this._silenciado(l.id) });
    }
    return [...pessoas.values()];
  }

  _avisarPresenca() {
    const pessoas = this.presenca();
    this._transmitir({ tipo: "presenca", pessoas });
    this.onEvento?.({ tipo: "presenca", pessoas });
  }

  /** Um evento só para uma pessoa (todas as conexões dela). */
  _paraLeitor(id, payload) {
    const linha = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [res, token] of [...this.assinantes]) {
      if (this._leitor(token)?.id !== id) continue;
      try {
        res.write(linha);
      } catch {
        this.assinantes.delete(res);
      }
    }
  }

  /**
   * "Fulano está digitando…", só para quem vai poder ler o recado — quem
   * escreve para o Som não mostra "digitando" para o Louvor.
   */
  _transmitirDigitando(autor, para) {
    const agora = Date.now();
    if ((this.digitandoEm.get(autor.id) || 0) > agora - DIGITANDO_INTERVALO_MS) return;
    this.digitandoEm.set(autor.id, agora);
    const destino = paraValido(para);
    const evento = { tipo: "digitando", deId: autor.id, de: autor.nome, para: destino };
    const linha = `data: ${JSON.stringify(evento)}\n\n`;
    for (const [res, token] of [...this.assinantes]) {
      const leitor = this._leitor(token);
      if (!leitor || leitor.id === autor.id) continue;
      if (!podeVer(leitor, { deId: autor.id, para: destino, mencoes: [] })) continue;
      try {
        res.write(linha);
      } catch {
        this.assinantes.delete(res);
      }
    }
    if (autor.id !== "cabine") this.onEvento?.(evento);
  }

  /** A cabine está digitando. */
  digitandoDaCabine(para) {
    this._transmitirDigitando({ id: "cabine", nome: this.nomeCabine }, para);
  }

  /**
   * A cabine apaga um recado. Some de todas as telas; a foto sai do disco.
   * O aviso leva só o id — nada do que foi apagado viaja de novo.
   */
  apagarMensagem(id) {
    const msg = this.chat.find((m) => m.id === String(id));
    if (!msg) return { ok: false, erro: "Recado não encontrado." };
    if (msg.foto) this.aoApagarFoto?.(msg.foto.arquivo);
    msg.apagada = true;
    msg.texto = "";
    delete msg.audio;
    delete msg.foto;
    msg.mencoes = [];
    this._transmitir({ tipo: "chat-apagada", id: msg.id });
    this.onEvento?.({ tipo: "chat-apagada", id: msg.id });
    return { ok: true };
  }

  /**
   * A cabine silencia (ou devolve a voz a) um aparelho no chat.
   * `minutos` 0 tira o silêncio. Quem foi silenciado continua lendo.
   */
  silenciar(id, minutos) {
    const alvo = String(id || "");
    if (!alvo || alvo === "cabine") return { ok: false, erro: "Aparelho inválido." };
    const m = Number(minutos);
    if (Number.isFinite(m) && m > 0) this.silenciados.set(alvo, Date.now() + Math.min(m, 24 * 60) * 60000);
    else this.silenciados.delete(alvo);
    this._paraLeitor(alvo, { tipo: "silenciado", ate: this.silenciados.get(alvo) || 0 });
    this._avisarPresenca();
    return { ok: true };
  }

  /** Para todos os aparelhos — ou só para os que `filtro` aprova. */
  _transmitir(payload, filtro) {
    const linha = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [res, token] of [...this.assinantes]) {
      if (filtro) {
        const d = this.dispositivos.get(token);
        if (!d || !filtro(d)) continue;
      }
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
    const qual = {
      controle: "comandar o telão",
      letras: "usar as letras",
      midia: "usar a mídia",
      culto: "mexer no culto",
    };
    this._json(res, 403, {
      ok: false,
      erro: `Este aparelho ainda não tem permissão para ${qual[precisa] ?? "isso"}. Peça na cabine.`,
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
      if (m === "GET" && p === "/") return await this._servirArquivo(res, "remote-control.html", TIPO_HTML);
      if (m === "GET" && p === "/chat-equipe.js") return await this._servirArquivo(res, "chat-equipe.js", TIPO_JS);
      if (m === "GET" && p === "/estado") return this._sse(req, res, url);
      if (m === "POST" && p === "/parear") return await this._parear(req, res);
      if (m === "POST" && p === "/entrar") return await this._entrar(req, res);
      if (m === "POST" && p === "/comando") return await this._comando(req, res);
      if (m === "GET" && p === "/repertorio") return this._repertorio(res, url);
      if (m === "GET" && p === "/musica") return this._musica(res, url);
      if (m === "POST" && p === "/musica") return await this._salvarMusica(req, res);
      if (m === "POST" && p === "/chat") return await this._chat(req, res);
      if (m === "POST" && p === "/chat/foto") return await this._fotoNoChat(req, res, false);
      if (m === "GET" && p === "/chat/foto") return await this._servirFoto(res, url);
      if (m === "POST" && p === "/chat/digitando") return await this._digitando(req, res, false);
      if (m === "POST" && p === "/chat/equipe") return await this._minhaEquipe(req, res);
      if (m === "POST" && p === "/dirigente/chat/foto") return await this._fotoNoChat(req, res, true);
      if (m === "POST" && p === "/dirigente/digitando") return await this._digitando(req, res, true);
      if (m === "POST" && p === "/voz") return await this._voz(req, res);
      if (m === "GET" && p === "/dirigente") return await this._servirArquivo(res, "dirigente.html", TIPO_HTML);
      if (m === "GET" && p === "/dirigente/igreja") return this._igrejaDirigente(res);
      if (m === "POST" && p === "/dirigente/entrar") return await this._entrarDirigente(req, res);
      if (m === "POST" && p === "/dirigente/enviar") return await this._enviarDirigente(req, res);
      if (m === "GET" && p === "/dirigente/estado") return this._sseDirigente(req, res, url);
      if (m === "POST" && p === "/dirigente/chat") return await this._chatDirigente(req, res);
      if (m === "POST" && p === "/dirigente/aviso") return await this._avisoDirigente(req, res);
      if (m === "GET" && p === "/midia") return this._midia(res, url);
      if (m === "GET" && p === "/culto") return this._culto(res, url);
      if (m === "POST" && p === "/culto/remover") return await this._itemDoCulto(req, res, "remover");
      if (m === "POST" && p === "/culto/adicionar") return await this._adicionarAoCulto(req, res);
      if (m === "POST" && p === "/culto/projetar") return await this._itemDoCulto(req, res, "projetar");
      if (m === "POST" && p === "/projetar") return await this._projetar(req, res);
      if (m === "POST" && p === "/volume") return await this._volume(req, res);
      if (m === "POST" && p === "/posicao") return await this._posicao(req, res);
      if (m === "POST" && p === "/buscar") return await this._buscar(req, res);
      if (m === "POST" && p === "/letra") return await this._letra(req, res);
    } catch {
      this._json(res, 500, { ok: false, erro: "Erro interno" });
      return;
    }
    this._json(res, 404, { ok: false, erro: "Não encontrado" });
  }

  /**
   * As páginas do celular e do dirigente, e o chat que as duas carregam.
   * Nomes fixos, nunca vindos do pedido: nada fora destes arquivos sai daqui.
   */
  async _servirArquivo(res, nome, tipo) {
    try {
      const corpo = await fsp.readFile(path.join(this.wwwRoot, nome));
      res.writeHead(200, {
        "content-type": tipo,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(corpo);
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
        estado: alemDoChat(disp.permissoes) ? this.ultimoEstado : null,
        tempo: podeAlguma(disp.permissoes, ["midia", "controle"]) ? this.ultimoTempo : null,
        permissoes: disp.permissoes,
        nome: disp.nome,
        // O endereço que não vence, para o aparelho poder guardar. Vai como
        // um link de verdade: se abrir neste celular, funciona neste celular
        // — melhor descobrir agora do que no domingo de manhã.
        enderecoFixo: this._enderecoFixo(),
        eu: { id: disp.id, equipe: disp.equipe || "" },
        silenciadoAte: this._silenciado(disp.id) ? this.silenciados.get(disp.id) : 0,
        chat: this._chatPara(this._leitor(token)),
        presenca: this.presenca(),
      })}\n\n`,
    );
    this.assinantes.set(res, token);
    this._avisarPresenca();

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
      this._avisarPresenca();
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
      permissoes: [...this.permissoesPadrao],
      criadoEm: agora,
      ultimoVisto: agora,
    };
    this.dispositivos.set(token, disp);
    this._salvar();
    this.onEvento?.({ tipo: "dispositivos", novo: disp.nome });
    this._json(res, 200, {
      ok: true,
      token,
      permissoes: disp.permissoes,
      nome: disp.nome,
    });
  }

  /**
   * Entrar com usuário e senha.
   *
   * A conta que a cabine criou já traz o que a pessoa pode fazer — sem o
   * operador promover o aparelho a cada culto. Errar conta nas mesmas
   * tentativas do acesso rápido: cinco e o IP espera alguns minutos.
   */
  async _entrar(req, res) {
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
    const chave = chaveDoUsuario(String(corpo.usuario || "").slice(0, 64));
    const conta = chave ? this.contas.find((c) => chaveDoUsuario(c.usuario) === chave) : null;
    const senha = String(corpo.senha || "").trim().slice(0, 128);
    const confere = senhaConfere(conta ? conta.senha : senhaDeMentira(), senha);
    if (!conta || !confere) {
      this._registrarFalha(ip);
      this._json(res, 401, { ok: false, erro: "Usuário ou senha não conferem." });
      return;
    }
    const token = nodeCrypto.randomUUID();
    const agora = Date.now();
    const disp = {
      id: nodeCrypto.randomUUID(),
      nome: conta.usuario,
      permissoes: [...conta.permissoes],
      equipe: conta.equipe,
      contaId: conta.id,
      criadoEm: agora,
      ultimoVisto: agora,
    };
    this.dispositivos.set(token, disp);
    this._salvar();
    this.onEvento?.({ tipo: "dispositivos", novo: disp.nome });
    this._json(res, 200, { ok: true, token, permissoes: disp.permissoes, nome: disp.nome });
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
    const acao = String(corpo.acao || "");
    if (!ACOES_VALIDAS.has(acao)) {
      this._json(res, 400, { ok: false, erro: "Comando desconhecido." });
      return;
    }
    const daMidia = ACOES_DA_MIDIA.has(acao);
    if (daMidia ? !podeAlguma(disp.permissoes, ["midia", "controle"]) : !pode(disp.permissoes, "controle")) {
      return this._semPermissao(res, daMidia ? "midia" : "controle");
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
    if (!pode(disp.permissoes, "letras")) return this._semPermissao(res, "letras");
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
    if (!pode(disp.permissoes, "letras")) return this._semPermissao(res, "letras");
    const id = String(url.searchParams.get("id") || "");
    const musica = this.repertorio.find((m) => m.id === id);
    if (!musica) {
      this._json(res, 404, { ok: false, erro: "Música não encontrada." });
      return;
    }
    // O tema vai junto porque a grade de slides do celular precisa dele na
    // mesma hora — e uma segunda ida à cabine, numa Wi-Fi de igreja, é a
    // grade aparecendo cinza e se pintando depois.
    const tema = this.temas.find((t) => t.id === musica.tema) || this.temas[0] || null;
    this._json(res, 200, { ok: true, musica, tema });
  }

  _midia(res, url) {
    const disp = this._sessao(url.searchParams.get("token"));
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!pode(disp.permissoes, "midia")) return this._semPermissao(res, "midia");
    this._json(res, 200, { ok: true, midia: this.midia });
  }

  _culto(res, url) {
    const disp = this._sessao(url.searchParams.get("token"));
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Pareie novamente." });
      return;
    }
    if (!pode(disp.permissoes, "culto")) return this._semPermissao(res, "culto");
    this._json(res, 200, { ok: true, culto: this.culto });
  }

  /**
   * Tirar um item da programação ou mandá-lo para o telão, pelo celular.
   *
   * Tirar e projetar são da aba Culto: quem cuida da programação é quem a
   * põe no ar pelo celular (o controle do telão pode também). O item precisa estar na programação que a
   * cabine mostrou; quem aplica é a cabine, que é dona do culto. Tirar some
   * daqui na hora, para o celular não mostrar um item que já saiu enquanto a
   * cabine confirma.
   *
   * @param {"remover" | "projetar"} acao
   */
  async _itemDoCulto(req, res, acao) {
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
    if (!podeAlguma(disp.permissoes, ["culto", "controle"])) return this._semPermissao(res, "culto");
    const id = String(corpo.id || "");
    const item = this.culto.itens.find((i) => i.id === id);
    if (!item) {
      this._json(res, 404, { ok: false, erro: "Este item não está mais na programação." });
      return;
    }
    if (acao === "remover") {
      this.culto = { ...this.culto, itens: this.culto.itens.filter((i) => i.id !== id) };
      this._transmitir({ tipo: "culto" });
    }
    this.onEvento?.({
      tipo: acao === "remover" ? "culto-remover" : "culto-projetar",
      id,
      titulo: item.titulo,
      de: disp.nome,
    });
    this._json(res, 200, { ok: true });
  }

  /**
   * Põe uma música ou uma mídia no fim da programação, pelo + do celular.
   *
   * É de editor, como tirar do culto: mexe no roteiro, não no que a igreja
   * está vendo. Só entra o que a cabine mostrou ao celular — um id inventado
   * não vira item da programação.
   */
  async _adicionarAoCulto(req, res) {
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
    const tipo = String(corpo.tipo || "");
    const refId = String(corpo.refId || "");
    // O + mora na aba Letras (música) e na aba Mídia: é a permissão dela.
    const parte = tipo === "media" ? "midia" : "letras";
    if (!pode(disp.permissoes, parte)) return this._semPermissao(res, parte);
    const lista = tipo === "song" ? this.repertorio : tipo === "media" ? this.midia : [];
    const item = lista.find((x) => x && x.id === refId);
    if (!item) {
      this._json(res, 404, { ok: false, erro: "Esse item não está mais na biblioteca." });
      return;
    }
    const titulo = String(item.titulo || "");
    this.onEvento?.({ tipo: "culto-adicionar", kind: tipo, refId, titulo, de: disp.nome });
    this._json(res, 200, { ok: true, titulo });
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
    const tipo = String(corpo.tipo || "");
    const refId = String(corpo.refId || "");
    if (!TIPOS_PROJETAVEIS.includes(tipo) || !refId) {
      this._json(res, 400, { ok: false, erro: "Item inválido." });
      return;
    }
    // A estrofe é da aba Letras, a mídia é da aba Mídia; o controle pode tudo.
    const parte = tipo === "song" ? "letras" : tipo === "media" ? "midia" : "controle";
    if (!podeAlguma(disp.permissoes, [parte, "controle"])) return this._semPermissao(res, parte);
    // O slide é opcional: sem ele o item vai inteiro, do começo. Com ele, o
    // toque na grade manda a estrofe exata. Índice fora da faixa é recusado
    // em vez de aparado — aparar mandaria para o telão um slide que não é o
    // que a pessoa tocou.
    let slide;
    if (corpo.slide !== undefined && corpo.slide !== null) {
      slide = Number(corpo.slide);
      if (!Number.isInteger(slide) || slide < 0 || slide > MAX_SLIDE) {
        this._json(res, 400, { ok: false, erro: "Slide inválido." });
        return;
      }
    }
    this.onEvento?.({ tipo: "projetar", kind: tipo, refId, de: disp.nome, slide });
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
    if (!podeAlguma(disp.permissoes, ["midia", "controle"])) return this._semPermissao(res, "midia");
    // `typeof` antes de `Number`: `Number(null)` é zero, e um corpo torto
    // passaria por "mudo" — a igreja perderia o som sem ninguém ter pedido.
    const valor = typeof corpo.valor === "number" ? corpo.valor : NaN;
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      this._json(res, 400, { ok: false, erro: "Volume inválido." });
      return;
    }
    this.onEvento?.({ tipo: "volume", valor: Math.round(valor), de: disp.nome });
    this._json(res, 200, { ok: true });
  }

  /**
   * Levar o vídeo do telão a um ponto, em segundos: a barra de tempo do
   * celular e o voltar/avançar 10 s. O mesmo direito de tocar e pausar.
   */
  async _posicao(req, res) {
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
    if (!podeAlguma(disp.permissoes, ["midia", "controle"])) return this._semPermissao(res, "midia");
    const segundos = typeof corpo.segundos === "number" ? corpo.segundos : NaN;
    // Vídeo de culto não tem um dia inteiro: número fora disso é engano.
    if (!Number.isFinite(segundos) || segundos < 0 || segundos > MAX_SEGUNDOS) {
      this._json(res, 400, { ok: false, erro: "Posição inválida." });
      return;
    }
    this.onEvento?.({ tipo: "posicao", segundos, de: disp.nome });
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
    if (!pode(disp.permissoes, "letras")) return this._semPermissao(res, "letras");
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
    if (!pode(disp.permissoes, "letras")) return this._semPermissao(res, "letras");
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
    if (!pode(disp.permissoes, "letras")) return this._semPermissao(res, "letras");

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
    // `noCulto`: o + de um resultado da internet cria a música e já a põe
    // na programação — o celular não sabe o id que ela vai ganhar.
    this.onEvento?.({ tipo: "musica", musica, de: disp.nome, noCulto: corpo.noCulto === true });
    this._json(res, 200, { ok: true });
  }

  _igrejaDirigente(res) {
    this._json(res, 200, {
      ok: true,
      nome: this.igreja.nome,
      logo: this.igreja.logo,
      ligada: Boolean(this.senhaDirigente),
    });
  }

  async _entrarDirigente(req, res) {
    const ip = req.socket.remoteAddress || "?";
    if (this._limitado(ip)) {
      this._json(res, 429, { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." });
      return;
    }
    if (!this.senhaDirigente) {
      this._json(res, 403, { ok: false, erro: "O envio de arquivos está desligado na cabine." });
      return;
    }
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    if (!senhaConfere(this.senhaDirigente, String(corpo.senha || ""))) {
      this._registrarFalha(ip);
      this._json(res, 401, { ok: false, erro: "Senha incorreta." });
      return;
    }
    const token = nodeCrypto.randomUUID();
    this.sessoesDirigente.set(token, Date.now());
    this._json(res, 200, { ok: true, token });
  }

  /**
   * Recebe um arquivo da página do dirigente.
   *
   * Os bytes vêm crus, não em JSON: uma apresentação de 40 MB viraria 54 em
   * base64, e a diferença é sentida numa Wi-Fi de igreja. O nome viaja num
   * cabeçalho, e quem escreve no disco é o processo principal.
   */
  async _enviarDirigente(req, res) {
    if (!this._sessaoDirigente(req.headers["x-lumen-dirigente"])) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    if (!this.aoReceberArquivo) {
      this._json(res, 503, { ok: false, erro: "A cabine não está pronta para receber." });
      return;
    }
    const nome = decodeURIComponent(String(req.headers["x-lumen-arquivo"] || "arquivo"));
    // Quem mandou. Não é credencial — a senha é que abre a porta — mas é o
    // que a cabine mostra no aviso, e "chegou um arquivo" sem dizer de quem
    // é um aviso que não ajuda ninguém no domingo de manhã.
    const de = nomeLimpo(decodeURIComponent(String(req.headers["x-lumen-de"] || "")), "");
    let dados;
    try {
      dados = await this._lerBytes(req, MAX_ARQUIVO_DIRIGENTE);
    } catch {
      this._json(res, 413, { ok: false, erro: "Arquivo grande demais (máximo 64 MB)." });
      return;
    }
    const r = await this.aoReceberArquivo(nome, dados);
    if (!r?.ok) {
      this._json(res, 400, { ok: false, erro: r?.error || "Não consegui guardar o arquivo." });
      return;
    }
    this.onEvento?.({
      tipo: "arquivo",
      nome: r.nome,
      de,
      kind: r.kind,
      id: r.id,
      url: r.url || null,
      projetavel: Boolean(r.projetavel),
    });
    this._json(res, 200, { ok: true, nome: r.nome, projetavel: Boolean(r.projetavel) });
  }

  /** Corpo cru, com teto — o `_lerCorpo` monta texto, e aqui vêm bytes. */
  _lerBytes(req, max) {
    return new Promise((resolve, reject) => {
      const partes = [];
      let total = 0;
      req.on("data", (pedaco) => {
        total += pedaco.length;
        if (total > max) {
          reject(new Error("grande demais"));
          req.destroy();
          return;
        }
        partes.push(pedaco);
      });
      req.on("end", () => resolve(Buffer.concat(partes)));
      req.on("error", reject);
    });
  }

  /**
   * Recado falado do celular.
   *
   * O áudio viaja como `data:` e fica só na memória desta sessão: some ao
   * fechar o Lúmen, como qualquer recado de culto. Quem manda precisa só de
   * chat — falar é a coisa mais básica que o aparelho faz aqui.
   */
  async _voz(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req, MAX_BODY_VOZ));
    } catch {
      this._json(res, 400, { ok: false, erro: "O recado é grande demais ou chegou incompleto." });
      return;
    }
    const disp = this._sessao(corpo.token);
    if (!disp) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    const audio = String(corpo.audio || "");
    if (!AUDIOS_ACEITOS.test(audio)) {
      this._json(res, 400, { ok: false, erro: "Formato de áudio não reconhecido." });
      return;
    }
    if (audio.length > MAX_BODY_VOZ) {
      this._json(res, 400, { ok: false, erro: "Recado longo demais. Grave um mais curto." });
      return;
    }
    if (this._silenciado(disp.id)) return this._calado(res);
    const segundos = Number(corpo.segundos);
    const msg = this._registrarChat({
      de: disp.nome,
      deId: disp.id,
      texto: "",
      daCabine: false,
      para: corpo.para,
      audio,
      segundos:
        Number.isFinite(segundos) && segundos > 0 ? Math.min(MAX_SEGUNDOS_VOZ, Math.round(segundos)) : 0,
    });
    if (!msg) {
      this._json(res, 400, { ok: false, erro: "Recado vazio." });
      return;
    }
    this.onEvento?.({ tipo: "chat", mensagem: msg });
    this._json(res, 200, { ok: true, mensagem: { id: msg.id, em: msg.em } });
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
    if (this._silenciado(disp.id)) return this._calado(res);
    const msg = this._registrarChat({
      de: disp.nome,
      deId: disp.id,
      texto: corpo.texto,
      daCabine: false,
      para: corpo.para,
    });
    if (!msg) {
      this._json(res, 400, { ok: false, erro: "Mensagem vazia." });
      return;
    }
    this.onEvento?.({ tipo: "chat", mensagem: msg });
    this._json(res, 200, { ok: true, mensagem: msg });
  }

  _calado(res) {
    this._json(res, 403, { ok: false, erro: "A cabine silenciou este aparelho no chat por enquanto." });
  }

  /** Quem manda: o aparelho pelo token no corpo, ou a página do dirigente pelo cabeçalho. */
  _autorDoPedido(req, corpo, dirigente) {
    if (!dirigente) {
      const disp = this._sessao(corpo.token);
      return disp ? { id: disp.id, nome: disp.nome, equipe: disp.equipe || "" } : null;
    }
    const token = String(req.headers["x-lumen-dirigente"] || "");
    if (!this._sessaoDirigente(token)) return null;
    const dir = this._dirigente(token, corpo.de);
    return { id: dir.id, nome: dir.nome, equipe: "pastor" };
  }

  /** A página do dirigente: o nome vem dela, a identidade fica presa ao token. */
  _dirigente(token, nome) {
    let dir = this.dirigentes.get(token);
    if (!dir) {
      dir = { id: `dirigente:${nodeCrypto.createHash("sha256").update(token).digest("hex").slice(0, 12)}`, nome: "Dirigente" };
      this.dirigentes.set(token, dir);
    }
    if (nome) {
      const limpo = nomeLimpo(nome, dir.nome);
      if (limpo !== dir.nome) {
        dir.nome = limpo;
        this._avisarPresenca();
      }
    }
    return dir;
  }

  /**
   * Foto no chat. Chega como `data:image/…;base64,`, o processo principal
   * confere pelos primeiros bytes e grava; o recado leva só o nome do arquivo.
   */
  async _fotoNoChat(req, res, dirigente) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req, MAX_BODY_FOTO));
    } catch {
      this._json(res, 400, { ok: false, erro: "A foto é grande demais ou chegou incompleta." });
      return;
    }
    const autor = this._autorDoPedido(req, corpo, dirigente);
    if (!autor) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    if (this._silenciado(autor.id)) return this._calado(res);
    const dados = String(corpo.foto || "");
    if (!FOTOS_ACEITAS.test(dados) || !this.aoGuardarFoto) {
      this._json(res, 400, { ok: false, erro: "Mande uma foto (JPEG, PNG ou WebP)." });
      return;
    }
    const guardada = await this.aoGuardarFoto(Buffer.from(dados.slice(dados.indexOf(",") + 1), "base64"));
    if (!guardada?.ok) {
      this._json(res, 400, { ok: false, erro: guardada?.error || "Não consegui guardar a foto." });
      return;
    }
    const msg = this._registrarChat({
      de: autor.nome,
      deId: autor.id,
      texto: corpo.texto || "",
      daCabine: false,
      para: corpo.para,
      foto: { arquivo: guardada.arquivo },
    });
    this.onEvento?.({ tipo: "chat", mensagem: msg });
    this._json(res, 200, { ok: true, mensagem: msg });
  }

  /** A foto de um recado, só para quem pode ler o recado. */
  async _servirFoto(res, url) {
    const leitor = this._leitor(url.searchParams.get("token"));
    if (!leitor) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada." });
      return;
    }
    const arquivo = String(url.searchParams.get("arquivo") || "");
    const msg = this.chat.find((m) => m.foto?.arquivo === arquivo);
    if (!msg || !podeVer(leitor, msg) || !this.aoLerFoto) {
      this._json(res, 404, { ok: false, erro: "Foto não encontrada." });
      return;
    }
    const foto = await this.aoLerFoto(arquivo);
    if (!foto) {
      this._json(res, 404, { ok: false, erro: "Foto não encontrada." });
      return;
    }
    res.writeHead(200, {
      "content-type": foto.tipo,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    res.end(foto.bytes);
  }

  async _digitando(req, res, dirigente) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const autor = this._autorDoPedido(req, corpo, dirigente);
    if (!autor) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada." });
      return;
    }
    if (!this._silenciado(autor.id)) this._transmitirDigitando(autor, corpo.para);
    this._json(res, 200, { ok: true });
  }

  /** O aparelho diz de que equipe é (Som, Louvor, Pastor) — ou de nenhuma. */
  async _minhaEquipe(req, res) {
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
    const equipe = String(corpo.equipe || "");
    if (equipe && !EQUIPES_DE_APARELHO.includes(equipe)) {
      this._json(res, 400, { ok: false, erro: "Equipe desconhecida." });
      return;
    }
    disp.equipe = equipe;
    this._salvar();
    this._avisarPresenca();
    this._json(res, 200, { ok: true, equipe });
  }

  /**
   * O fluxo de recados para a página do dirigente.
   *
   * Separado do fluxo do celular porque a sessão é outra: aqui a porta é a
   * senha, lá é o nome na lista da cabine. O que passa pelo cano é o mesmo,
   * e por isso reaproveita `assinantes` — o `_paraToken` nunca vai casar
   * com um token de dirigente, então só chega o que é para todo mundo.
   *
   * O token vem na busca do endereço, não num cabeçalho, porque EventSource
   * não manda cabeçalho — é o mesmo caminho que a página do celular usa.
   */
  _sseDirigente(req, res, url) {
    const token = url.searchParams.get("token") || "";
    if (!this._sessaoDirigente(token)) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(":ok\n\n");
    const eu = this._dirigente(token, url.searchParams.get("nome"));
    res.write(
      `data: ${JSON.stringify({
        tipo: "inicio",
        eu: { id: eu.id, equipe: "pastor" },
        silenciadoAte: this._silenciado(eu.id) ? this.silenciados.get(eu.id) : 0,
        chat: this._chatPara(this._leitor(token)),
        presenca: this.presenca(),
      })}\n\n`,
    );
    this.assinantes.set(res, token);
    this._avisarPresenca();

    const ping = setInterval(() => {
      try {
        res.write(":ping\n\n");
      } catch {
        clearInterval(ping);
      }
    }, 15000);
    const encerrar = () => {
      clearInterval(ping);
      this.assinantes.delete(res);
      this._avisarPresenca();
    };
    req.on("close", encerrar);
    req.on("error", encerrar);
  }

  /**
   * Um aviso escrito, para virar texto projetável na cabine.
   *
   * Não é chat: chat é conversa entre a equipe, e isto vai para a
   * biblioteca de textos, onde o operador acha na hora de projetar.
   */
  async _avisoDirigente(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    if (!this._sessaoDirigente(req.headers["x-lumen-dirigente"])) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    const titulo = semControle(String(corpo.titulo || "")).trim().slice(0, 120);
    const texto = semControle(String(corpo.texto || ""), true).trim().slice(0, 4000);
    if (!titulo || !texto) {
      this._json(res, 400, { ok: false, erro: "Falta o título ou o texto." });
      return;
    }
    this.onEvento?.({ tipo: "aviso", titulo, texto, de: nomeLimpo(corpo.de, "Dirigente") });
    this._json(res, 200, { ok: true });
  }

  /** Recado escrito na página do dirigente — mesmo mural do celular. */
  async _chatDirigente(req, res) {
    let corpo;
    try {
      corpo = JSON.parse(await this._lerCorpo(req));
    } catch {
      corpo = {};
    }
    const autor = this._autorDoPedido(req, corpo, true);
    if (!autor) {
      this._json(res, 401, { ok: false, erro: "Sessão expirada. Entre novamente." });
      return;
    }
    if (this._silenciado(autor.id)) return this._calado(res);
    const msg = this._registrarChat({
      de: autor.nome,
      deId: autor.id,
      texto: corpo.texto,
      daCabine: false,
      para: corpo.para,
    });
    if (!msg) {
      this._json(res, 400, { ok: false, erro: "Mensagem vazia." });
      return;
    }
    this.onEvento?.({ tipo: "chat", mensagem: msg });
    this._json(res, 200, { ok: true, mensagem: msg });
  }
}

module.exports = { RemoteControl, ACOES_VALIDAS };
