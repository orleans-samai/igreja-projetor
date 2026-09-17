import assert from "node:assert/strict";
import { test } from "node:test";
import dgram from "node:dgram";
import mdnsModule from "../desktop/mdns.cjs";

const {
  Anunciante,
  ehInterfaceVirtual,
  enderecosLan,
  escreverNome,
  lerNome,
  lerPerguntas,
  lerRespostaA,
  montarResposta,
  ordenarEnderecos,
  TTL_S,
  TTL_LEGADO_S,
} = mdnsModule;

/** Monta a pergunta que um celular faria: "quem é lumen.local?". */
function perguntaA(nome, { id = 0x1234, tipo = 1, unicast = false } = {}) {
  const cabecalho = Buffer.alloc(12);
  cabecalho.writeUInt16BE(id, 0);
  cabecalho.writeUInt16BE(1, 4);
  const cauda = Buffer.alloc(4);
  cauda.writeUInt16BE(tipo, 0);
  cauda.writeUInt16BE(unicast ? 0x8001 : 1, 2);
  return Buffer.concat([cabecalho, escreverNome(nome), cauda]);
}

test("o nome vai e volta do formato do DNS", () => {
  const buf = escreverNome("lumen.local");
  assert.deepEqual([...buf.subarray(0, 6)], [5, 108, 117, 109, 101, 110]);
  const lido = lerNome(buf, 0);
  assert.equal(lido.nome, "lumen.local");
  assert.equal(lido.fim, buf.length);
});

test("pacote torto não derruba nem prende o processo", () => {
  // O que chega aqui é um datagrama de qualquer um na rede.
  assert.equal(lerPerguntas(Buffer.alloc(0)), null);
  assert.equal(lerPerguntas(Buffer.from([1, 2, 3])), null);
  // Nome que aponta para si mesmo: um laço infinito, se ninguém contar saltos.
  const laco = Buffer.alloc(16);
  laco.writeUInt16BE(1, 4);
  laco[12] = 0xc0;
  laco[13] = 12;
  assert.equal(lerPerguntas(laco), null);
  // Rótulo que diz ser maior do que o pacote inteiro.
  const estoura = Buffer.alloc(16);
  estoura.writeUInt16BE(1, 4);
  estoura[12] = 60;
  assert.equal(lerPerguntas(estoura), null);
});

test("resposta de outra máquina não é pergunta para nós", () => {
  const resposta = Buffer.alloc(12);
  resposta.writeUInt16BE(0x8400, 2);
  resposta.writeUInt16BE(1, 4);
  assert.equal(lerPerguntas(resposta), null);
});

test("a pergunta traz o nome, o tipo e se quer resposta só para ela", () => {
  const simples = lerPerguntas(perguntaA("LUMEN.local"));
  // Nome de DNS não distingue maiúscula: quem pergunta em caixa alta é o mesmo.
  assert.equal(simples.perguntas[0].nome, "lumen.local");
  assert.equal(simples.perguntas[0].unicast, false);
  const qu = lerPerguntas(perguntaA("lumen.local", { unicast: true }));
  assert.equal(qu.perguntas[0].unicast, true);
  assert.equal(qu.perguntas[0].classe, 1);
});

test("a resposta carrega o IP, e a de perguntador antigo vive pouco", () => {
  const normal = lerRespostaA(montarResposta({ nome: "lumen.local", ips: ["192.168.0.42"] }));
  assert.equal(normal.id, 0);
  assert.deepEqual(normal.registros, [
    { nome: "lumen.local", ip: "192.168.0.42", ttl: TTL_S, limparCache: true },
  ]);

  const legado = montarResposta({
    nome: "lumen.local",
    ips: ["192.168.0.42"],
    id: 0x1234,
    legado: true,
    pergunta: { tipo: 1 },
  });
  const lido = lerRespostaA(legado);
  // Ecoa o número da pergunta, senão o resolvedor comum joga a resposta fora.
  assert.equal(lido.id, 0x1234);
  assert.equal(lido.registros[0].ttl, TTL_LEGADO_S);
  assert.equal(lido.registros[0].limparCache, false);
});

test("a despedida é um IP com validade zero", () => {
  const adeus = lerRespostaA(
    montarResposta({ nome: "lumen.local", ips: ["192.168.0.42"], ttl: 0 }),
  );
  assert.equal(adeus.registros[0].ttl, 0);
});

test("o IP do Wi-Fi vem antes do IP que não leva a lugar nenhum", () => {
  // 169.254 é o endereço de quem não conseguiu endereço: último de todos.
  assert.deepEqual(ordenarEnderecos(["169.254.1.2", "10.0.0.5", "192.168.0.7"]), [
    "192.168.0.7",
    "10.0.0.5",
    "169.254.1.2",
  ]);
  // Empate na mesma faixa preserva a ordem de quem chamou — é assim que a
  // preferência por placa de verdade sobrevive até o pacote.
  assert.deepEqual(ordenarEnderecos(["192.168.28.2", "192.168.56.1"]), [
    "192.168.28.2",
    "192.168.56.1",
  ]);
  assert.deepEqual(ordenarEnderecos(["192.168.56.1", "192.168.28.2"]), [
    "192.168.56.1",
    "192.168.28.2",
  ]);
  assert.deepEqual(ordenarEnderecos(["nem ip", "1.2.3.999"]), []);
});

test("adaptador de VirtualBox e de VPN não passa por placa de rede", () => {
  assert.equal(ehInterfaceVirtual("VirtualBox Host-Only Network"), true);
  assert.equal(ehInterfaceVirtual("vEthernet (Default Switch)"), true);
  assert.equal(ehInterfaceVirtual("VMware Network Adapter VMnet1"), true);
  assert.equal(ehInterfaceVirtual("Tailscale"), true);
  assert.equal(ehInterfaceVirtual("Wi-Fi"), false);
  assert.equal(ehInterfaceVirtual("Ethernet"), false);
  assert.equal(ehInterfaceVirtual(undefined), false);
});

test("os IPs desta máquina saem em ordem, sem o 127.0.0.1", () => {
  for (const ip of enderecosLan()) {
    assert.notEqual(ip, "127.0.0.1");
    assert.match(ip, /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/);
  }
});

/**
 * A ida e volta de verdade, por socket.
 *
 * Numa porta de teste, não na 5353: lá mora o mDNS do próprio Windows, e o
 * teste passaria a depender da máquina que o executa.
 */
async function comAnunciante(ips, tarefa) {
  const anunciante = new Anunciante({ nome: "lumen", porta: 0, enderecos: () => ips });
  // Porta 0 deixa o sistema escolher; descobrimos qual foi depois de subir.
  assert.equal(await anunciante.ligar(), true, "o anunciante não subiu");
  const porta = anunciante.socket.address().port;
  anunciante.porta = porta;
  try {
    return await tarefa(porta);
  } finally {
    anunciante.desligar();
  }
}

function perguntar(porta, pacote, esperaMs = 3000) {
  return new Promise((resolve, reject) => {
    const cliente = dgram.createSocket("udp4");
    const relogio = setTimeout(() => {
      cliente.close();
      reject(new Error("ninguém respondeu"));
    }, esperaMs);
    cliente.on("message", (msg) => {
      clearTimeout(relogio);
      cliente.close();
      resolve(msg);
    });
    cliente.bind(0, () => cliente.send(pacote, porta, "127.0.0.1"));
  });
}

test("o celular pergunta pelo nome e recebe o IP da cabine", async () => {
  await comAnunciante(["192.168.0.42"], async (porta) => {
    const resposta = lerRespostaA(await perguntar(porta, perguntaA("lumen.local")));
    assert.equal(resposta.id, 0x1234, "não ecoou o número da pergunta");
    assert.deepEqual(
      resposta.registros.map((r) => r.ip),
      ["192.168.0.42"],
    );
    assert.equal(resposta.registros[0].nome, "lumen.local");
  });
});

test("pergunta por ANY também é respondida; por outro nome, não", async () => {
  await comAnunciante(["10.0.0.9"], async (porta) => {
    const qualquer = lerRespostaA(await perguntar(porta, perguntaA("lumen.local", { tipo: 255 })));
    assert.equal(qualquer.registros[0].ip, "10.0.0.9");

    await assert.rejects(
      perguntar(porta, perguntaA("impressora.local"), 600),
      /ninguém respondeu/,
      "respondeu por um nome que não é dele",
    );
  });
});

test("o IP respondido é o de agora, não o de quando ligou", async () => {
  // É o defeito que este módulo veio curar: o roteador troca o IP no meio da
  // semana e o nome tem que continuar apontando para o lugar certo.
  let atual = ["192.168.0.42"];
  const anunciante = new Anunciante({ nome: "lumen", porta: 0, enderecos: () => atual });
  assert.equal(await anunciante.ligar(), true);
  const porta = anunciante.socket.address().port;
  anunciante.porta = porta;
  try {
    const antes = lerRespostaA(await perguntar(porta, perguntaA("lumen.local")));
    assert.equal(antes.registros[0].ip, "192.168.0.42");
    atual = ["192.168.0.77"];
    const depois = lerRespostaA(await perguntar(porta, perguntaA("lumen.local")));
    assert.equal(depois.registros[0].ip, "192.168.0.77");
  } finally {
    anunciante.desligar();
  }
});

test("sem IP nenhum ele fica calado em vez de responder bobagem", async () => {
  await comAnunciante([], async (porta) => {
    await assert.rejects(perguntar(porta, perguntaA("lumen.local"), 600), /ninguém respondeu/);
  });
});

test("desligar não deixa socket aberto, e ligar de novo funciona", async () => {
  const anunciante = new Anunciante({ nome: "lumen", porta: 0, enderecos: () => ["192.168.0.1"] });
  assert.equal(await anunciante.ligar(), true);
  assert.equal(anunciante.ativo, true);
  anunciante.desligar();
  assert.equal(anunciante.ativo, false);
  anunciante.desligar(); // duas vezes não pode explodir
  assert.equal(await anunciante.ligar(), true);
  anunciante.desligar();
});
