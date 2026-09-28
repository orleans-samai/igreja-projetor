/**
 * Biblioteca de mídia em pasta de verdade.
 *
 * Cada tipo tem a sua pasta — vídeo, áudio e imagem — para a igreja largar os
 * arquivos ali pelo Explorer e o Lúmen enxergar. Antes só existia importação
 * por sessão: fechava o app, perdia tudo.
 *
 * A pasta padrão fica nos dados do usuário, mas o operador pode apontar para
 * onde o material já estiver (um pendrive, uma pasta da rede). Só as pastas
 * escolhidas são servidas, e sempre com o caminho preso dentro delas.
 */
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { shell, dialog } = require("electron");

/** Extensões que o Chromium do Electron consegue exibir. */
const KINDS = {
  video: [".mp4", ".webm", ".m4v", ".ogv"],
  audio: [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"],
  image: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"],
};
const PASTA_PADRAO = { video: "video", audio: "audio", image: "imagem" };
/**
 * Apresentação e documento: o Lúmen ainda não projeta estes arquivos, mas
 * recebe e guarda, para o operador achá-los na hora do culto. Ver `receber`.
 */
const DOCUMENTOS = [".pptx", ".ppsx", ".ppt", ".pps", ".odp", ".pdf"];
const PASTA_RECEBIDOS = "recebidos";
/**
 * O que não é mídia nem apresentação e alguém trouxe mesmo assim: a igreja
 * pediu para aceitar qualquer arquivo, mesmo que o Lúmen não o projete. Fica
 * guardado aqui e aparece em Mídia › Arquivos — o Lúmen nunca abre nem
 * executa estes arquivos; no máximo mostra onde estão.
 */
const PASTA_ARQUIVOS = "arquivos";
/** Uma pasta com milhares de arquivos é descuido; a lista tem teto. */
const MAX_LISTA_DE_ARQUIVOS = 2000;
/** Teto do que a rede pode largar no computador da igreja de uma vez. */
const MAX_ARQUIVO = 64 * 1024 * 1024;

let dataDir = "";
let configFile = "";
/** @type {Record<string, string>} */
let pastas = {};

/** @param {string} dir */
function init(dir) {
  dataDir = dir;
  configFile = path.join(dir, "media-folders.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configFile, "utf8"));
    for (const kind of Object.keys(KINDS)) {
      if (typeof raw?.[kind] === "string" && raw[kind]) pastas[kind] = raw[kind];
    }
  } catch {
    /* primeira execução */
  }
}

/** @param {string} kind */
function dirFor(kind) {
  if (!KINDS[kind]) throw new Error("Tipo de mídia desconhecido.");
  return pastas[kind] || path.join(dataDir, "midia", PASTA_PADRAO[kind]);
}

/**
 * Grava a escolha e diz se conseguiu.
 *
 * Antes engolia o erro: o operador trocava a pasta, via a lista nova, fechava
 * o app e no domingo a pasta era a antiga de novo, sem nada explicando.
 */
function save() {
  try {
    fs.writeFileSync(configFile, JSON.stringify(pastas, null, 2));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Não consegui guardar a escolha da pasta: ${error?.message || error}` };
  }
}

/**
 * A pasta serve? Existe, é pasta, dá para ler e dá para escrever.
 *
 * O teste de escrita é um arquivo de verdade, criado e apagado: no Windows,
 * perguntar a permissão de uma pasta responde "pode" para lugares onde
 * gravar falha na hora — pasta de rede sem credencial, unidade só de leitura.
 */
async function validar(dir) {
  if (typeof dir !== "string" || !dir.trim()) return { ok: false, error: "Caminho de pasta vazio." };
  let st;
  try {
    st = await fsp.stat(dir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      try {
        await fsp.mkdir(dir, { recursive: true });
        st = await fsp.stat(dir);
      } catch {
        return { ok: false, error: `A pasta ${dir} não existe e não consegui criá-la.` };
      }
    } else {
      return { ok: false, error: `Não consegui abrir ${dir}. Ela pode estar desconectada.` };
    }
  }
  if (!st.isDirectory()) return { ok: false, error: `${dir} não é uma pasta.` };
  try {
    await fsp.readdir(dir);
  } catch {
    return { ok: false, error: `Sem permissão de leitura em ${dir}.` };
  }
  const teste = path.join(dir, `.lumen-teste-${process.pid}-${Date.now()}`);
  try {
    await fsp.writeFile(teste, "");
    await fsp.rm(teste, { force: true });
  } catch {
    return { ok: false, error: `Sem permissão de gravação em ${dir}. Escolha outra pasta.` };
  }
  return { ok: true };
}

/** Quantos arquivos daquele tipo moram numa pasta — para saber se vale perguntar. */
async function contarMidias(dir, kind) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries.filter(
      (e) => e.isFile() && KINDS[kind].includes(path.extname(e.name).toLowerCase()),
    ).length;
  } catch {
    return 0;
  }
}

/** Cria as três pastas na primeira execução, para o operador já achar onde pôr. */
async function ensure() {
  for (const kind of Object.keys(KINDS)) {
    try {
      await fsp.mkdir(dirFor(kind), { recursive: true });
    } catch {
      /* pasta da rede fora do ar: listar vai avisar */
    }
  }
  return folders();
}

function folders() {
  return Object.fromEntries(Object.keys(KINDS).map((k) => [k, dirFor(k)]));
}

/**
 * Identidade estável do arquivo, para favorito e seleção sobreviverem ao
 * atualizar. O nome basta: dois arquivos com o mesmo nome na mesma pasta não
 * existem.
 */
function idFor(kind, name) {
  return `midia:${kind}:${name}`;
}

/** @param {string} kind */
async function list(kind) {
  const dir = dirFor(kind);
  const exts = KINDS[kind];
  if (!exts) return { ok: false, error: "Tipo de mídia desconhecido." };
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await fsp.mkdir(dir, { recursive: true }).catch(() => {});
      return { ok: true, dir, items: [] };
    }
    return { ok: false, error: `Não consegui ler ${dir}.`, dir };
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.includes(ext)) continue;
    let size = 0;
    let at = 0;
    try {
      const st = await fsp.stat(path.join(dir, entry.name));
      size = st.size;
      at = st.mtimeMs;
    } catch {
      continue;
    }
    items.push({
      id: idFor(kind, entry.name),
      kind,
      name: entry.name,
      title: entry.name.replace(/\.[^.]+$/, ""),
      url: `lumen://app/__midia/${kind}/${encodeURIComponent(entry.name)}`,
      size,
      at,
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  return { ok: true, dir, items };
}

/** Abre a pasta no Explorer, que é como a igreja vai pôr arquivo lá. */
async function open(kind) {
  const dir = dirFor(kind);
  await fsp.mkdir(dir, { recursive: true }).catch(() => {});
  const problema = await shell.openPath(dir);
  return problema ? { ok: false, error: problema } : { ok: true, dir };
}

/**
 * Abre o seletor de pasta e devolve o que foi escolhido — sem aplicar ainda.
 *
 * Quem aplica é `apply`, depois de a cabine perguntar o que fazer com o que
 * já estava na pasta antiga. Assim "Cancelar" naquela pergunta cancela de
 * verdade, em vez de deixar a pasta trocada pela metade.
 *
 * A janela-mãe importa: sem ela o diálogo do Windows não é modal e abre atrás
 * do telão em tela cheia, que é o motivo de "trocar a pasta não funciona".
 *
 * @param {string} kind
 * @param {import("electron").BrowserWindow | null} janela
 */
async function choose(kind, janela) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const titulo = `Pasta de ${kind === "video" ? "vídeos" : kind === "audio" ? "áudios" : "imagens"}`;
  const opcoes = {
    title: titulo,
    defaultPath: dirFor(kind),
    properties: ["openDirectory", "createDirectory"],
  };
  let escolha;
  try {
    escolha = janela && !janela.isDestroyed()
      ? await dialog.showOpenDialog(janela, opcoes)
      : await dialog.showOpenDialog(opcoes);
  } catch (error) {
    return { ok: false, error: `Não consegui abrir o seletor de pastas: ${error?.message || error}` };
  }
  if (escolha.canceled || !escolha.filePaths[0]) return { ok: false, canceled: true };

  const destino = path.resolve(escolha.filePaths[0]);
  const atual = path.resolve(dirFor(kind));
  if (destino === atual) return { ok: false, mesmaPasta: true, dir: atual };

  const teste = await validar(destino);
  if (!teste.ok) return teste;

  return { ok: true, dir: destino, anterior: atual, pendentes: await contarMidias(atual, kind) };
}

/**
 * Move um arquivo para a pasta nova.
 *
 * `rename` resolve quando é o mesmo disco; entre discos (um pendrive, uma
 * pasta de rede) ele falha com EXDEV e aí é copiar e apagar. Nunca sobrescreve
 * um arquivo que já exista lá: material de igreja não se perde em silêncio.
 */
async function moverArquivo(de, para) {
  try {
    await fsp.access(para);
    return { ok: false, erro: "já existe um arquivo com esse nome na pasta nova" };
  } catch {
    /* não existe: pode mover */
  }
  try {
    await fsp.rename(de, para);
    return { ok: true };
  } catch (error) {
    if (error?.code !== "EXDEV") return { ok: false, erro: error?.message || String(error) };
  }
  try {
    await fsp.copyFile(de, para);
    await fsp.rm(de, { force: true });
    return { ok: true };
  } catch (error) {
    await fsp.rm(para, { force: true }).catch(() => {});
    return { ok: false, erro: error?.message || String(error) };
  }
}

/**
 * Aplica a pasta escolhida, movendo o acervo antigo se for o caso.
 *
 * @param {string} kind
 * @param {string} dir
 * @param {boolean} mover
 */
async function apply(kind, dir, mover) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const destino = path.resolve(String(dir || ""));
  const teste = await validar(destino);
  if (!teste.ok) return teste;

  const anterior = path.resolve(dirFor(kind));
  let movidos = 0;
  /** @type {{ nome: string; erro: string }[]} */
  const falhas = [];

  if (mover && anterior !== destino) {
    let entries = [];
    try {
      entries = await fsp.readdir(anterior, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!KINDS[kind].includes(path.extname(entry.name).toLowerCase())) continue;
      const r = await moverArquivo(path.join(anterior, entry.name), path.join(destino, entry.name));
      if (r.ok) movidos += 1;
      else falhas.push({ nome: entry.name, erro: r.erro });
    }
  }

  // A pasta só passa a valer depois de mover: se a gravação da escolha
  // falhar, os arquivos já estão no lugar novo e a mensagem diz o que houve.
  pastas[kind] = destino;
  const gravou = save();
  rearmar();
  return {
    ok: true,
    dir: destino,
    anterior,
    movidos,
    falhas,
    aviso: gravou.ok ? null : gravou.error,
  };
}

/** Volta a pasta do tipo para o padrão dentro dos dados do usuário. */
async function reset(kind) {
  if (!KINDS[kind]) return { ok: false, error: "Tipo de mídia desconhecido." };
  const anterior = dirFor(kind);
  delete pastas[kind];
  const gravou = save();
  const padrao = dirFor(kind);
  try {
    await fsp.mkdir(padrao, { recursive: true });
  } catch (error) {
    pastas[kind] = anterior;
    save();
    return { ok: false, error: `Não consegui criar a pasta padrão: ${error?.message || error}` };
  }
  rearmar();
  return { ok: true, dir: padrao, aviso: gravou.ok ? null : gravou.error };
}

/**
 * Traduz `lumen://app/__midia/<tipo>/<arquivo>` num caminho de disco.
 *
 * Só resolve dentro da pasta configurada para aquele tipo e só para as
 * extensões daquele tipo — o renderer não tem como pedir um arquivo qualquer
 * da máquina por este caminho.
 *
 * @param {string} pathname já decodificado, começando com /__midia/
 */
async function resolveMedia(pathname) {
  const partes = pathname.split("/").filter(Boolean); // ["__midia", kind, name]
  if (partes.length !== 3 || partes[0] !== "__midia") return null;
  const [, kind, name] = partes;
  if (!KINDS[kind]) return null;
  if (name.includes("\\") || name.includes("\0") || name === "." || name === "..") return null;
  if (!KINDS[kind].includes(path.extname(name).toLowerCase())) return null;
  const dir = path.resolve(dirFor(kind));
  const file = path.resolve(dir, name);
  if (file !== path.join(dir, name) || !file.startsWith(dir + path.sep)) return null;
  try {
    return (await fsp.stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

/**
 * Um nome de arquivo que veio da rede, seguro para virar caminho no disco.
 *
 * Tira diretório, tira o que o Windows recusa e tira ponto do começo. O que
 * chega aqui foi digitado por alguém num celular da igreja, e "../../" num
 * nome de arquivo é o jeito mais antigo de escrever fora da pasta.
 */
function nomeSeguro(bruto) {
  // Caractere de controle e os que o Windows recusa saem por codepoint: uma
  // classe de regex com eles dentro é ilegível e o lint reclama com razão.
  const proibidos = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);
  const so = [...path.basename(String(bruto || ""))]
    .map((c) => (c.codePointAt(0) < 0x20 || proibidos.has(c) ? "_" : c))
    .join("");
  const limpo = so.replace(/^\.+/, "").trim().slice(0, 120);
  return limpo || "arquivo";
}

/**
 * Guarda um arquivo que chegou pela rede.
 *
 * Vídeo, áudio e imagem vão para a pasta de mídia da igreja e já servem para
 * projetar. Apresentação e PDF vão para "recebidos": o Lúmen ainda não sabe
 * desenhá-los no telão, e fingir que sabe seria pior — o operador precisa
 * saber que o arquivo chegou e onde ele está.
 *
 * Extensão fora das duas listas não entra: o computador da cabine não é
 * depósito de arquivo qualquer que estiver na Wi-Fi.
 */
async function receber(nomeBruto, dados) {
  if (!Buffer.isBuffer(dados) || dados.length === 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (dados.length > MAX_ARQUIVO) {
    return { ok: false, error: "Arquivo grande demais (máximo 64 MB)." };
  }
  const nome = nomeSeguro(nomeBruto);
  const ext = path.extname(nome).toLowerCase();
  const kind = Object.keys(KINDS).find((k) => KINDS[k].includes(ext)) || null;
  const documento = DOCUMENTOS.includes(ext);
  if (!kind && !documento) {
    return { ok: false, error: "Tipo de arquivo não aceito." };
  }
  const dir = kind ? dirFor(kind) : path.join(dataDir, PASTA_RECEBIDOS);
  await fsp.mkdir(dir, { recursive: true });
  // Nome repetido não sobrescreve o que já está lá: no domingo, dois "culto.pptx"
  // de pessoas diferentes seriam um arquivo só, e o primeiro sumiria.
  let destino = path.join(dir, nome);
  const base = nome.slice(0, nome.length - ext.length);
  for (let n = 2; n < 100; n += 1) {
    try {
      await fsp.access(destino);
      destino = path.join(dir, `${base} (${n})${ext}`);
    } catch {
      break;
    }
  }
  await fsp.writeFile(destino, dados);
  const final = path.basename(destino);
  return {
    ok: true,
    nome: final,
    caminho: destino,
    kind,
    projetavel: Boolean(kind),
    id: kind ? idFor(kind, final) : null,
    // O mesmo endereço que a listagem da pasta dá: a cabine registra a
    // mídia com ele antes de pôr o item no culto.
    url: kind ? `lumen://app/__midia/${kind}/${encodeURIComponent(final)}` : null,
  };
}

/**
 * O caminho de um arquivo daquele tipo, preso dentro da pasta dele.
 *
 * Tudo que chega aqui veio da janela, e a janela recebe nome de arquivo de
 * lista que veio do disco — mas o caminho é montado aqui, uma vez, em vez
 * de confiar que ninguém vai mandar "..\\..\\Windows\\System32" um dia.
 */
function dentroDaPasta(kind, nome) {
  if (!KINDS[kind]) return null;
  const dir = dirFor(kind);
  const limpo = nomeSeguro(nome);
  const alvo = path.join(dir, limpo);
  if (path.dirname(alvo) !== dir) return null;
  if (!KINDS[kind].includes(path.extname(limpo).toLowerCase())) return null;
  return alvo;
}

/** Um nome livre na pasta, a partir do que se pediu. */
async function nomeLivre(dir, nome) {
  const ext = path.extname(nome);
  const base = nome.slice(0, nome.length - ext.length);
  let destino = path.join(dir, nome);
  for (let n = 2; n < 100; n += 1) {
    try {
      await fsp.access(destino);
      destino = path.join(dir, `${base} (${n})${ext}`);
    } catch {
      return destino;
    }
  }
  return destino;
}

/**
 * Troca o nome de um arquivo da pasta de mídia.
 *
 * A extensão é do arquivo, não do nome novo: quem renomeia "Fundo" para
 * "Abertura" não quer descobrir que o vídeo virou um arquivo sem tipo.
 */
async function renomear(kind, nome, novoNome) {
  const de = dentroDaPasta(kind, nome);
  if (!de) return { ok: false, error: "Arquivo fora da pasta de mídia." };
  const ext = path.extname(de);
  const pedido = nomeSeguro(String(novoNome || "").trim());
  const semExt = pedido.toLowerCase().endsWith(ext.toLowerCase())
    ? pedido.slice(0, pedido.length - ext.length)
    : pedido;
  if (!semExt.trim()) return { ok: false, error: "Escreva um nome." };
  const para = dentroDaPasta(kind, `${semExt}${ext}`);
  if (!para) return { ok: false, error: "Nome inválido." };
  if (para === de) return { ok: true, nome: path.basename(de), id: idFor(kind, path.basename(de)) };
  const livre = await nomeLivre(path.dirname(para), path.basename(para));
  try {
    await fsp.rename(de, livre);
  } catch (error) {
    return { ok: false, error: `Não consegui renomear: ${error?.message || error}` };
  }
  const final = path.basename(livre);
  return { ok: true, nome: final, id: idFor(kind, final) };
}

/** Uma cópia do arquivo, ao lado do original. */
async function duplicar(kind, nome) {
  const de = dentroDaPasta(kind, nome);
  if (!de) return { ok: false, error: "Arquivo fora da pasta de mídia." };
  const ext = path.extname(de);
  const base = path.basename(de, ext);
  const livre = await nomeLivre(path.dirname(de), `${base} (cópia)${ext}`);
  try {
    await fsp.copyFile(de, livre);
  } catch (error) {
    return { ok: false, error: `Não consegui duplicar: ${error?.message || error}` };
  }
  const final = path.basename(livre);
  return { ok: true, nome: final, id: idFor(kind, final) };
}

/** O que a janela precisa para mostrar e projetar um arquivo da pasta. */
function itemDaPasta(kind, nome) {
  return {
    id: idFor(kind, nome),
    kind,
    name: nome,
    title: nome.replace(/\.[^.]+$/, ""),
    url: `lumen://app/__midia/${kind}/${encodeURIComponent(nome)}`,
  };
}

/**
 * Copia para a pasta de mídia os arquivos que o operador arrastou ou
 * escolheu no "Importar".
 *
 * Antes o "Importar" criava um endereço de sessão (`blob:`): o arquivo só
 * existia naquela janela, sumia ao fechar o app e o celular nunca o via.
 * Agora ele entra na pasta, como o que chega pela rede — e o que está na
 * pasta, o celular enxerga.
 *
 * Os caminhos vêm do preload, tirados dos próprios arquivos soltos na janela
 * (`webUtils.getPathForFile`); a página não tem como inventar um. Vídeo,
 * áudio e imagem vão para a pasta do tipo; apresentação vai para
 * "recebidos" e vira slides na cabine; qualquer outro arquivo fica em
 * Arquivos, a pedido da igreja. O destino é sempre um nome livre: nada é
 * sobrescrito.
 *
 * Sem teto de tamanho, ao contrário da rede: é um arquivo do próprio
 * computador da igreja, e vídeo de culto passa fácil de 64 MB.
 *
 * @param {unknown} caminhos
 */
async function importarCaminhos(caminhos) {
  /** @type {ReturnType<typeof itemDaPasta>[]} */
  const importados = [];
  /** @type {{ nome: string; erro: string }[]} */
  const recusados = [];
  /** @type {{ nome: string }[]} */
  const apresentacoes = [];
  /** @type {{ nome: string }[]} */
  const arquivos = [];
  const lista = Array.isArray(caminhos) ? caminhos.slice(0, 200) : [];
  for (const bruto of lista) {
    if (typeof bruto !== "string" || !bruto || !path.isAbsolute(bruto)) continue;
    const origem = path.resolve(bruto);
    const nome = nomeSeguro(path.basename(origem));
    const ext = path.extname(nome).toLowerCase();
    const kind = Object.keys(KINDS).find((k) => KINDS[k].includes(ext));
    if (!kind) {
      const r = await guardarForaDaMidia(origem, nome, ext);
      if (!r.ok) recusados.push({ nome, erro: r.erro });
      else if (r.apresentacao) apresentacoes.push({ nome: r.nome });
      else arquivos.push({ nome: r.nome });
      continue;
    }
    let st;
    try {
      st = await fsp.stat(origem);
    } catch {
      recusados.push({ nome, erro: "o arquivo não foi encontrado" });
      continue;
    }
    if (!st.isFile()) {
      recusados.push({ nome, erro: "não é um arquivo" });
      continue;
    }
    const dir = path.resolve(dirFor(kind));
    // Já mora na pasta (arrastado da própria lista, ou da pasta pelo
    // Explorer): nada a copiar, só usar.
    if (path.dirname(origem).toLowerCase() === dir.toLowerCase()) {
      importados.push(itemDaPasta(kind, path.basename(origem)));
      continue;
    }
    try {
      await fsp.mkdir(dir, { recursive: true });
      const destino = await nomeLivre(dir, nome);
      await fsp.copyFile(origem, destino, fs.constants.COPYFILE_EXCL);
      importados.push(itemDaPasta(kind, path.basename(destino)));
    } catch (error) {
      recusados.push({ nome, erro: `não consegui copiar (${error?.code || error?.message || error})` });
    }
  }
  return { ok: true, importados, recusados, apresentacoes, arquivos };
}

/** A pasta de Arquivos (ver PASTA_ARQUIVOS). */
function dirDosArquivos() {
  return path.join(dataDir, "midia", PASTA_ARQUIVOS);
}

/** Um arquivo da pasta de Arquivos, com o caminho preso dentro dela. */
function dentroDosArquivos(nome) {
  const dir = dirDosArquivos();
  const alvo = path.join(dir, nomeSeguro(nome));
  return path.dirname(alvo) === dir ? alvo : null;
}

/**
 * Apresentação vai para "recebidos", de onde a cabine a transforma em
 * slides — o mesmo caminho do menu. O resto vai para Arquivos. Copiar,
 * nunca mover: o original fica onde a igreja o deixou.
 *
 * @param {string} origem
 * @param {string} nome
 * @param {string} ext
 */
async function guardarForaDaMidia(origem, nome, ext) {
  let st;
  try {
    st = await fsp.stat(origem);
  } catch {
    return { ok: false, erro: "o arquivo não foi encontrado" };
  }
  if (!st.isFile()) return { ok: false, erro: "não é um arquivo" };
  const apresentacao = DOCUMENTOS.includes(ext);
  if (apresentacao && st.size > MAX_ARQUIVO) {
    return { ok: false, erro: "apresentação grande demais (máximo 64 MB)" };
  }
  const dir = apresentacao ? path.join(dataDir, PASTA_RECEBIDOS) : dirDosArquivos();
  try {
    await fsp.mkdir(dir, { recursive: true });
    const destino = await nomeLivre(dir, nome);
    await fsp.copyFile(origem, destino, fs.constants.COPYFILE_EXCL);
    return { ok: true, apresentacao, nome: path.basename(destino) };
  } catch (error) {
    return { ok: false, erro: `não consegui copiar (${error?.code || error?.message || error})` };
  }
}

/** O que está guardado em Arquivos: nome, tamanho e quando mudou. */
async function listarArquivos() {
  const dir = dirDosArquivos();
  try {
    await fsp.mkdir(dir, { recursive: true });
    const entradas = await fsp.readdir(dir, { withFileTypes: true });
    const itens = [];
    for (const e of entradas) {
      if (!e.isFile() || e.name.startsWith(".")) continue;
      if (itens.length >= MAX_LISTA_DE_ARQUIVOS) break;
      try {
        const st = await fsp.stat(path.join(dir, e.name));
        itens.push({ nome: e.name, bytes: st.size, modificado: st.mtimeMs });
      } catch {
        /* sumiu enquanto a lista era montada */
      }
    }
    itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { ok: true, dir, itens };
  } catch (error) {
    return { ok: false, dir, itens: [], error: `Não consegui ler a pasta de arquivos: ${error?.message || error}` };
  }
}

/** Abre o Explorer com o arquivo selecionado. Só isso: o arquivo não é aberto. */
function mostrarArquivo(nome) {
  const alvo = dentroDosArquivos(nome);
  if (!alvo || !fs.existsSync(alvo)) return { ok: false, error: "O arquivo não está mais na pasta." };
  shell.showItemInFolder(alvo);
  return { ok: true };
}

/** Manda para a Lixeira do Windows (volta de lá se foi engano). */
async function excluirArquivo(nome) {
  const alvo = dentroDosArquivos(nome);
  if (!alvo || !fs.existsSync(alvo)) return { ok: false, error: "O arquivo não está mais na pasta." };
  try {
    await shell.trashItem(alvo);
    return { ok: true };
  } catch {
    return { ok: false, error: "Não consegui mandar para a lixeira. O arquivo continua na pasta." };
  }
}

async function abrirPastaDosArquivos() {
  const dir = dirDosArquivos();
  await fsp.mkdir(dir, { recursive: true });
  const problema = await shell.openPath(dir);
  return problema ? { ok: false, error: problema } : { ok: true, dir };
}

/**
 * Vigia as três pastas e avisa quando algo muda nelas.
 *
 * É o que faz o celular ver na hora o arquivo novo — venha ele do "Importar",
 * de um arrastar, do dirigente ou do Explorer. Antes a cabine só relia a
 * pasta ao trocar o item no ar, e a mídia recém-chegada ficava invisível
 * no celular até lá.
 *
 * O aviso espera a pasta sossegar (`ESPERA_VIGIA`): copiar um vídeo grande
 * dispara dezenas de eventos, e o celular não precisa de dezenas de listas.
 */
const ESPERA_VIGIA = 350;
/** @type {Map<string, import("node:fs").FSWatcher>} */
const vigias = new Map();
/** @type {((kinds: string[]) => void) | null} */
let aoMudar = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let esperaDoAviso = null;
const mudados = new Set();

/** @param {((kinds: string[]) => void) | null} fn */
function vigiar(fn) {
  aoMudar = fn;
  rearmar();
}

/** Troca de pasta muda o que se vigia. */
function rearmar() {
  for (const w of vigias.values()) {
    try {
      w.close();
    } catch {
      /* já fechado */
    }
  }
  vigias.clear();
  if (!aoMudar) return;
  for (const kind of Object.keys(KINDS)) {
    try {
      // O caminho longo, de verdade: vigiar uma pasta escrita no formato
      // curto do Windows ("ORLEAN~1") derruba o processo inteiro numa
      // asserção da libuv quando o primeiro evento chega com o nome longo.
      const dir = fs.realpathSync.native(dirFor(kind));
      const w = fs.watch(dir, { persistent: false }, (_evento, nome) => {
        // Sem nome (acontece no Windows) avisa mesmo assim; com nome, só o
        // que é daquele tipo — o arquivo de teste de gravação não conta.
        if (nome && !KINDS[kind].includes(path.extname(String(nome)).toLowerCase())) return;
        avisarMudanca(kind);
      });
      w.on("error", () => {
        try {
          w.close();
        } catch {
          /* já fechado */
        }
        vigias.delete(kind);
      });
      vigias.set(kind, w);
    } catch {
      /* pasta de rede fora do ar: listar vai avisar */
    }
  }
}

/** @param {string} kind */
function avisarMudanca(kind) {
  mudados.add(kind);
  if (esperaDoAviso) clearTimeout(esperaDoAviso);
  esperaDoAviso = setTimeout(() => {
    esperaDoAviso = null;
    const kinds = [...mudados];
    mudados.clear();
    aoMudar?.(kinds);
  }, ESPERA_VIGIA);
}

/**
 * Manda o arquivo para a lixeira do Windows, não o apaga.
 *
 * Um clique errado no domingo de manhã não pode ser definitivo: da
 * lixeira volta, do `unlink` não volta.
 */
async function excluir(kind, nome) {
  const alvo = dentroDaPasta(kind, nome);
  if (!alvo) return { ok: false, error: "Arquivo fora da pasta de mídia." };
  try {
    await shell.trashItem(alvo);
    return { ok: true };
  } catch {
    // Sem lixeira (pasta de rede, por exemplo) não se apaga escondido: o
    // operador precisa saber que o arquivo continua lá.
    return { ok: false, error: "Não consegui mandar para a lixeira. O arquivo continua na pasta." };
  }
}

module.exports = {
  init,
  renomear,
  duplicar,
  excluir,
  ensure,
  folders,
  list,
  open,
  choose,
  apply,
  reset,
  resolveMedia,
  receber,
  importarCaminhos,
  listarArquivos,
  mostrarArquivo,
  excluirArquivo,
  abrirPastaDosArquivos,
  vigiar,
  avisarMudanca,
  KINDS,
  DOCUMENTOS,
  MAX_ARQUIVO,
};
