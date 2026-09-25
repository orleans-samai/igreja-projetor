import zlib from "node:zlib";

/**
 * Um ZIP de verdade, montado aqui.
 *
 * Os testes não dependem de um .pptx guardado no repositório: cada caso
 * monta exatamente as peças que quer provar, e o arquivo que sai é lido
 * pelo mesmo leitor que lê o do dirigente.
 */
export function zip(arquivos, { compactar = true } = {}) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, "utf8");
    const guardado = compactar ? zlib.deflateRawSync(dados) : dados;
    const metodo = compactar ? 8 : 0;
    const crc = zlib.crc32(dados);
    const n = Buffer.from(nome, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(guardado.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(n.length, 26);
    locais.push(local, n, guardado);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(guardado.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, n);

    deslocamento += 30 + n.length + guardado.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, dir, fim]);
}

