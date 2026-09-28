import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FormatoJavaInvalido, lerSerializacaoJava } from "./serializacao-java.ts";

const CABECALHO = [0xac, 0xed, 0x00, 0x05];
const bytes = (...partes: number[][]) => new Uint8Array(partes.flat());
const utf = (s: string) => {
  const b = [...new TextEncoder().encode(s)];
  return [b.length >> 8, b.length & 0xff, ...b];
};
/** Descrição de classe sem campos nem superclasse. */
const classe = (nome: string, flags = 0x02) => [0x72, ...utf(nome), 0, 0, 0, 0, 0, 0, 0, 1, flags, 0, 0, 0x78, 0x70];

describe("leitor da serialização do Java", () => {
  it("texto em UTF-8 modificado: o NUL de dois bytes e o emoji em duas metades", () => {
    // U+0000 = C0 80; 🙏 (U+1F64F) = D83D DE4F, cada metade em 3 bytes.
    const r = lerSerializacaoJava(bytes(CABECALHO, [0x74, 0x00, 0x08, 0xc0, 0x80, 0xed, 0xa0, 0xbd, 0xed, 0xb9, 0x8f]));
    assert.deepEqual(r, ["\u0000🙏"]);
  });

  it("recusa o que não começa com a marca do Java", () => {
    assert.throws(() => lerSerializacaoJava(bytes([0x50, 0x4b, 0x03, 0x04])), FormatoJavaInvalido);
  });

  it("arquivo cortado no meio é recusado, sem ler além do fim", () => {
    assert.throws(() => lerSerializacaoJava(bytes(CABECALHO, [0x74, 0x00, 0x10, 0x41])), /acabou no meio/);
  });

  it("vetor que diz ter mais itens do que cabem no arquivo é mentira", () => {
    const vetor = [0x75, ...classe("[I"), 0x7f, 0xff, 0xff, 0xff];
    assert.throws(() => lerSerializacaoJava(bytes(CABECALHO, vetor)), /tamanho inválido/);
  });

  it("referência para algo que ainda não existe é recusada", () => {
    assert.throws(() => lerSerializacaoJava(bytes(CABECALHO, [0x71, 0x00, 0x7e, 0x00, 0x05])), /não existe/);
  });

  it("aninhamento sem fim não estoura a pilha: tem teto", () => {
    // Um vetor de Object com um vetor dentro, com outro dentro... 300 vezes.
    const primeiro = [0x75, ...classe("[Ljava.lang.Object;"), 0, 0, 0, 1];
    const seguinte = [0x75, 0x71, 0x00, 0x7e, 0x00, 0x00, 0, 0, 0, 1];
    const partes = [CABECALHO, primeiro];
    for (let i = 0; i < 300; i += 1) partes.push(seguinte);
    partes.push([0x70]);
    assert.throws(() => lerSerializacaoJava(bytes(...partes)), /aninhados demais/);
  });

  it("objeto com campos primitivos e de texto, e o que a classe escreveu depois", () => {
    // class Item { int n; String nome; } com writeObject que grava um texto a mais.
    const desc = [
      0x72, ...utf("x.Item"), 0, 0, 0, 0, 0, 0, 0, 1, 0x03, 0, 2,
      0x49, ...utf("n"),
      0x4c, ...utf("nome"), 0x74, ...utf("Ljava/lang/String;"),
      0x78, 0x70,
    ];
    const r = lerSerializacaoJava(
      bytes(CABECALHO, [0x73, ...desc, 0, 0, 0, 42, 0x74, ...utf("Coro"), 0x74, ...utf("extra"), 0x78]),
    );
    assert.deepEqual(r, [{ classe: "x.Item", campos: { n: 42, nome: "Coro" }, extras: ["extra"] }]);
  });
});
