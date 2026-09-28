import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { lerArquivoDoHolyrics, MUF_CIFRADO, musicasDoTxt } from "./holyrics.ts";
import { escreverMuf, lerMuf } from "./muf.ts";

// Arquivos gravados pelo próprio Holyrics 2.29, pelo exportador dele, com
// letras inventadas (ver scripts/holyrics-amostras.jjs).
const amostra = (nome: string) => new Uint8Array(readFileSync(new URL(`./amostras-holyrics/${nome}`, import.meta.url)));

describe("músicas exportadas do Holyrics", () => {
  it("o .mufl (exportação em lote com Arquivo único) traz todas, na ordem", () => {
    const r = lerArquivoDoHolyrics(amostra("lote.mufl"), "lote.mufl");
    assert.ok(r.ok, r.ok ? "" : r.erro);
    assert.deepEqual(
      r.musicas.map((m) => m.titulo),
      ["Canção da Manhã", "Hino de Teste", "Coração Grato"],
    );
    const [primeira, segunda, terceira] = r.musicas;
    assert.equal(primeira.artista, "Coral da Vila");
    assert.equal(primeira.copyright, "Domínio público");
    // O emoji vem em UTF-8 "modificado" do Java: duas metades de 3 bytes.
    assert.equal(
      primeira.letra,
      "Primeira linha do verso\nSegunda linha com ação\n\nRefrão de louvor\nCantamos juntos 🙏",
    );
    assert.equal(segunda.artista, "");
    // Letra gravada com fim de linha do Windows chega com o do Lúmen.
    assert.equal(terceira.letra, "Verso um\nlinha dois\n\nVerso dois\nlinha quatro");
    assert.equal(terceira.artista, "Ministério Alvorada");
  });

  it("o tom e o copyright vêm dos parâmetros da música", () => {
    const r = lerArquivoDoHolyrics(amostra("tom.mufl"), "tom.mufl");
    assert.ok(r.ok);
    assert.deepEqual(r.musicas, [
      { titulo: "Tom de Teste", artista: "Banda", tom: "E", copyright: "© Teste", letra: "Linha um\nLinha dois" },
    ]);
  });

  it("o .muf de uma música por arquivo, que vem cifrado, explica como exportar certo", () => {
    const r = lerArquivoDoHolyrics(amostra("uma-musica-cifrada.muf"), "Canção da Manhã.muf");
    assert.deepEqual(r, { ok: false, erro: MUF_CIFRADO });
    assert.match(MUF_CIFRADO, /Exportação em lote/);
    assert.match(MUF_CIFRADO, /Arquivo único/);
    assert.match(MUF_CIFRADO, /\.mufl/);
  });

  it("o .json do Holyrics, com a letra dentro de lyrics.full_text", () => {
    const r = lerArquivoDoHolyrics(amostra("lote.json"), "lote.json");
    assert.ok(r.ok, r.ok ? "" : r.erro);
    assert.deepEqual(
      r.musicas.map((m) => [m.titulo, m.artista, m.copyright]),
      [
        ["Canção da Manhã", "Coral da Vila", "Domínio público"],
        ["Hino de Teste", "", ""],
      ],
    );
    assert.equal(r.musicas[0].letra, "Primeira linha do verso\nSegunda linha com ação\n\nRefrão de louvor\nCantamos juntos");
  });

  it("o .txt do Holyrics, com cabeçalho e a linha de sinais de igual entre as músicas", () => {
    const r = lerArquivoDoHolyrics(amostra("lote.txt"), "lote.txt");
    assert.ok(r.ok, r.ok ? "" : r.erro);
    assert.deepEqual(r.musicas, [
      {
        titulo: "Canção da Manhã",
        artista: "Coral da Vila",
        tom: "",
        copyright: "Domínio público",
        letra: "Primeira linha do verso\nSegunda linha com ação\n\nRefrão de louvor\nCantamos juntos",
      },
      { titulo: "Hino de Teste", artista: "", tom: "", copyright: "", letra: "Só uma estrofe\ncom duas linhas" },
    ]);
  });

  it(".txt sem cabeçalho vira uma música com o nome do arquivo", () => {
    assert.deepEqual(musicasDoTxt("Linha um\nLinha dois\n", "Aleluia.txt"), [
      { titulo: "Aleluia", artista: "", tom: "", copyright: "", letra: "Linha um\nLinha dois" },
    ]);
  });

  it("texto solto não vira música; o .txt escolhido de propósito vira", () => {
    const solto = new TextEncoder().encode("isto não é nada");
    const r = lerArquivoDoHolyrics(solto, "repertorio.muf");
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.erro, /não é um pacote de letras do Lúmen nem uma exportação do Holyrics/);
    const txt = lerArquivoDoHolyrics(new TextEncoder().encode(["Linha um", "Linha dois"].join("\n")), "Aleluia.txt");
    assert.ok(txt.ok);
    assert.equal(txt.musicas[0].titulo, "Aleluia");
  });

  it("o item de pacote em lote do Lúmen também aceita o .mufl do Holyrics", async () => {
    const r = await lerMuf(amostra("lote.mufl"), "lote.mufl");
    assert.ok(r.ok, r.ok ? "" : r.erro);
    assert.equal(r.musicas.length, 3);
    const cifrado = await lerMuf(amostra("uma-musica-cifrada.muf"), "Canção.muf");
    assert.deepEqual(cifrado, { ok: false, erro: MUF_CIFRADO });
  });

  it("e o pacote do próprio Lúmen continua entrando como antes", async () => {
    const musica = { titulo: "Nossa", artista: "Nós", tom: "G", copyright: "", letra: "Uma\nDuas" };
    const r = await lerMuf(await escreverMuf([musica]), "repertorio.muf");
    assert.deepEqual(r, { ok: true, musicas: [musica] });
  });
});
