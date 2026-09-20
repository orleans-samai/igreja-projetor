const nodeCrypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

/**
 * O que o celular da equipe precisa que NÃO mude entre um culto e outro.
 *
 * Antes, cada vez que o controle remoto era ligado o app sorteava uma porta
 * nova (`listen(0)`), um PIN novo e esquecia todos os aparelhos pareados. O
 * endereço que o operador tinha mandado no grupo da igreja durante a semana
 * já não existia no domingo — e não havia jeito de a equipe adivinhar o novo.
 *
 * Aqui mora a parte estável: a porta escolhida e os aparelhos que já se
 * identificaram uma vez. Fica num arquivo só do processo principal, fora
 * do backup exportável — token de acesso não viaja dentro de um .lumen que a
 * igreja manda por e-mail.
 */

/**
 * 8787 não é usada por nada comum no Windows e é fácil de ditar por telefone.
 * Se estiver ocupada o app pega outra e passa a lembrar dessa outra.
 */
const PORTA_PADRAO = 8787;

/**
 * Noventa dias sem aparecer e o aparelho pede o PIN de novo.
 *
 * O pedido era "que passe uma semana e ela ainda consiga entrar"; noventa
 * dias cobre isso com folga, e ainda faz o celular que alguém trocou sumir
 * sozinho da lista em vez de ficar valendo para sempre.
 */
const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;

const MAX_DISPOSITIVOS = 50;

function texto(v, limite) {
  return typeof v === "string" ? v.slice(0, limite) : "";
}

function instante(v, padrao) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

/**
 * Lê o arquivo com desconfiança: ele pode ter sido editado à mão, truncado
 * por uma queda de energia ou vir de uma versão futura do Lúmen. Nada daqui
 * pode derrubar a abertura do app.
 */
/**
 * Guarda a senha do dirigente sem guardar a senha.
 *
 * A página de envio de arquivos é a única do Lúmen que pede senha, e por um
 * motivo: mandar arquivo para o computador da igreja é bem mais arriscado que
 * mandar recado no chat. Mas senha em texto claro num JSON do disco seria
 * pior que não ter senha nenhuma — quem lê o arquivo lê a senha.
 *
 * scrypt com sal por senha: conferir custa milissegundos, adivinhar custa
 * caro, e o que fica no disco não serve para entrar em mais lugar nenhum.
 */
function cozinharSenha(senha, sal = nodeCrypto.randomBytes(16).toString("hex")) {
  const chave = nodeCrypto.scryptSync(String(senha), sal, 32).toString("hex");
  return { sal, chave };
}

/** Comparação em tempo constante: desistir na primeira letra errada conta. */
function senhaConfere(guardada, tentativa) {
  if (!guardada || typeof guardada.sal !== "string" || typeof guardada.chave !== "string") {
    return false;
  }
  const feita = cozinharSenha(tentativa, guardada.sal).chave;
  const a = Buffer.from(feita, "hex");
  const b = Buffer.from(guardada.chave, "hex");
  return a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
}

function saneia(bruto, agora = Date.now(), permissoes = ["chat", "editor", "controle"]) {
  const d = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {};
  const porta =
    Number.isInteger(d.porta) && d.porta > 1024 && d.porta <= 65535 ? d.porta : PORTA_PADRAO;
  const dispositivos = (Array.isArray(d.dispositivos) ? d.dispositivos : [])
    .filter(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof x.token === "string" &&
        x.token.length >= 16 &&
        typeof x.id === "string" &&
        x.id.length > 0,
    )
    .map((x) => ({
      token: x.token,
      id: x.id,
      nome: texto(x.nome, 32) || "Celular",
      permissao: permissoes.includes(x.permissao) ? x.permissao : permissoes[0],
      criadoEm: instante(x.criadoEm, agora),
      ultimoVisto: instante(x.ultimoVisto, agora),
    }))
    .filter((x) => agora - x.ultimoVisto < VALIDADE_MS)
    .sort((a, b) => b.ultimoVisto - a.ultimoVisto)
    .slice(0, MAX_DISPOSITIVOS);
  const s = d.senhaDirigente;
  const senhaDirigente =
    s && typeof s === "object" && typeof s.sal === "string" && typeof s.chave === "string"
      ? { sal: s.sal, chave: s.chave }
      : null;
  return { porta, dispositivos, senhaDirigente };
}

class CofreRemoto {
  constructor(dir) {
    this.file = path.join(dir, "remote.json");
  }

  ler() {
    try {
      return saneia(JSON.parse(fs.readFileSync(this.file, "utf8")));
    } catch {
      // Arquivo ausente na primeira vez, ou ilegível: os padrões servem.
      return saneia(null);
    }
  }

  /** Grava por cima de um temporário: queda de energia no meio não deixa
   *  um arquivo pela metade que faria o app perder os pareamentos. */
  gravar(dados) {
    const limpo = saneia(dados);
    const tmp = this.file + ".tmp";
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(limpo));
      fs.renameSync(tmp, this.file);
    } catch {
      // Sem permissão de escrita o app segue funcionando; só volta a pedir o
      // PIN na próxima abertura, que é o comportamento antigo.
    }
    return limpo;
  }
}

module.exports = {
  CofreRemoto,
  saneia,
  cozinharSenha,
  senhaConfere,
  PORTA_PADRAO,
  VALIDADE_MS,
  MAX_DISPOSITIVOS,
};
