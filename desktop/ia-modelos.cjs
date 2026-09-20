const fsp = require("node:fs/promises");
const path = require("node:path");

/**
 * Os modelos locais que o Lúmen sabe usar.
 *
 * Nada é baixado sozinho e nada roda sem o operador escolher. Um arquivo
 * `.gguf` que veio de qualquer lugar é conferido antes de virar opção: cabeçalho
 * de verdade, tamanho plausível, e uma estimativa honesta de memória — porque
 * o computador que roda isto também está projetando o culto, e ficar sem RAM
 * no meio do louvor é pior do que não ter IA nenhuma.
 *
 * Não prometemos compatibilidade com todo modelo que existe. Prometemos dizer
 * quando não dá.
 */

/** "GGUF" — os quatro primeiros bytes de todo arquivo do formato. */
const MAGICA = Buffer.from([0x47, 0x47, 0x55, 0x46]);
/** Abaixo disto não é modelo, é arquivo truncado ou trocado. */
const MENOR_PLAUSIVEL = 8 * 1024 * 1024;
/** Acima disto não roda num PC de igreja, e tentar só trava a projeção. */
const MAIOR_PLAUSIVEL = 24 * 1024 * 1024 * 1024;
/** Versões do formato que o llama.cpp atual lê. */
const VERSOES = new Set([1, 2, 3]);

/**
 * Perfis sugeridos, do mais leve ao mais pesado.
 *
 * São sugestões de tamanho, não downloads: o operador traz o arquivo. Q4 em
 * todos porque é o que cabe num PC que também está projetando.
 */
const PERFIS = [
  {
    id: "leve",
    nome: "Leve",
    exemplo: "Qwen3 0.6B Q4 (ou equivalente)",
    parametrosB: 0.6,
    ramGB: 1.2,
    contexto: 1024,
    recomendacao: "Serve em PC com 4 GB de RAM. Entende comandos curtos.",
  },
  {
    id: "equilibrado",
    nome: "Equilibrado",
    exemplo: "Gemma 3 1B Q4 (ou equivalente)",
    parametrosB: 1,
    ramGB: 1.8,
    contexto: 1024,
    recomendacao: "Pede 8 GB de RAM. Conversa melhor e erra menos comando.",
  },
  {
    id: "avancado",
    nome: "Avançado",
    exemplo: "Modelos de 3B a 8B Q4",
    parametrosB: 4,
    ramGB: 5,
    contexto: 2048,
    recomendacao: "Só com 16 GB de RAM e placa dedicada. Pode atrapalhar a projeção.",
  },
];

/**
 * Lê o cabeçalho do arquivo e diz se dá para usar.
 *
 * Não tenta carregar o modelo para descobrir: carregar é o que consome a
 * memória que se quer proteger. O cabeçalho basta para separar "não é GGUF"
 * de "é GGUF mas grande demais para esta máquina".
 */
async function inspecionar(caminho) {
  let arquivo;
  try {
    arquivo = await fsp.open(caminho, "r");
  } catch {
    return { ok: false, erro: "Não achei esse arquivo." };
  }
  try {
    const info = await arquivo.stat();
    if (!info.isFile()) return { ok: false, erro: "Isso não é um arquivo." };
    if (info.size < MENOR_PLAUSIVEL) {
      return { ok: false, erro: "Arquivo pequeno demais para ser um modelo — veio truncado?" };
    }
    if (info.size > MAIOR_PLAUSIVEL) {
      return { ok: false, erro: "Modelo grande demais para rodar junto com a projeção." };
    }
    const cabecalho = Buffer.alloc(8);
    await arquivo.read(cabecalho, 0, 8, 0);
    if (!cabecalho.subarray(0, 4).equals(MAGICA)) {
      return { ok: false, erro: "Não é um arquivo GGUF. Procure a versão .gguf do modelo." };
    }
    const versao = cabecalho.readUInt32LE(4);
    if (!VERSOES.has(versao)) {
      return { ok: false, erro: `Formato GGUF versão ${versao}, que este Lúmen não lê.` };
    }
    return {
      ok: true,
      nome: path.basename(caminho),
      caminho,
      bytes: info.size,
      versao,
      quantizacao: quantizacaoPeloNome(path.basename(caminho)),
      ramEstimadaGB: ramEstimadaGB(info.size),
    };
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo." };
  } finally {
    await arquivo.close().catch(() => {});
  }
}

/**
 * A quantização, lida do nome do arquivo.
 *
 * Está no cabeçalho também, mas atrás de um mapa de metadados de tamanho
 * variável que não vale desenrolar para mostrar uma etiqueta. Todo mundo que
 * publica GGUF põe no nome; quando não põe, dizemos que não sabemos.
 */
function quantizacaoPeloNome(nome) {
  const m = String(nome).match(/\b(IQ\d[A-Z_]*|Q\d(?:_[A-Z0-9]+)*|F16|BF16|F32)\b/i);
  return m ? m[1].toUpperCase() : "desconhecida";
}

/**
 * Quanto de RAM o modelo vai querer.
 *
 * Os pesos mais o que o contexto e o próprio runtime ocupam. É estimativa, e
 * a tela diz que é — mas uma estimativa por cima é o que evita o operador
 * escolher um modelo que trava a máquina no domingo.
 */
function ramEstimadaGB(bytes) {
  const pesos = bytes / (1024 * 1024 * 1024);
  return Math.round((pesos * 1.25 + 0.4) * 10) / 10;
}

/**
 * O veredito de hardware, em palavras que o operador entende.
 *
 * Compara com a memória livre, não com a total: o que importa é o que sobra
 * depois do Windows, do navegador e da própria projeção.
 */
function veredito(ramEstimadaGB, livreGB) {
  if (!Number.isFinite(livreGB) || livreGB <= 0) return "desconhecido";
  const folga = livreGB - ramEstimadaGB;
  if (folga >= 3) return "otimo";
  if (folga >= 1.5) return "adequado";
  if (folga >= 0.4) return "pode-travar";
  return "nao-recomendado";
}

const ROTULO_VEREDITO = {
  otimo: "Ótimo",
  adequado: "Adequado",
  "pode-travar": "Pode causar lentidão",
  "nao-recomendado": "Não recomendado",
  desconhecido: "Não deu para medir",
};

module.exports = {
  PERFIS,
  inspecionar,
  quantizacaoPeloNome,
  ramEstimadaGB,
  veredito,
  ROTULO_VEREDITO,
  MENOR_PLAUSIVEL,
  MAIOR_PLAUSIVEL,
};
