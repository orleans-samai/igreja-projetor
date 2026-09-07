import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizar, palavras, parecidas } from "./normalize.ts";
import { pontuar, prepararSlides } from "./matcher.ts";
import { AutoSlideEngine, PERFIS } from "./engine.ts";

/**
 * Letra de teste inventada aqui, de propósito.
 *
 * O motor precisa de estrofes distintas, um refrão que repete e uma ponte que
 * reusa palavras das estrofes — é justamente aí que um casador ingênuo erra.
 * Escrever a letra à mão dá controle sobre esses casos e deixa o teste
 * independente de qualquer música real.
 */
const SLIDES = [
  "Verso 1\nA manha desce sobre o vale\nE a neblina se levanta devagar",
  "Coro\nCanta comigo a mesma cancao\nQue atravessa a noite inteira",
  "Verso 2\nO rio corre firme entre as pedras\nE nao se cansa de seguir",
  "Coro\nCanta comigo a mesma cancao\nQue atravessa a noite inteira",
  "Ponte\nEntre as pedras e o vale\nA cancao ainda se levanta",
];

describe("normalizar", () => {
  it("tira acento, pontuacao e caixa", () => {
    assert.equal(normalizar("Então,  minh'alma CANTA!"), "entao minh alma canta");
  });

  it("apóstrofo vira espaço, para reencontrar a palavra inteira", () => {
    assert.deepEqual(palavras("minh'alma"), ["minh", "alma"]);
  });

  it("marcação de seção não conta como letra cantada", () => {
    assert.deepEqual(palavras("[Coro]\nO rio corre"), ["o", "rio", "corre"]);
  });
});

describe("parecidas", () => {
  it("aceita a palavra cortada pelo reconhecimento", () => {
    assert.ok(parecidas("cantando", "cantan"));
  });

  it("aceita uma letra trocada", () => {
    assert.ok(parecidas("neblina", "nebrina"));
  });

  it("não junta palavras curtas diferentes", () => {
    assert.ok(!parecidas("vale", "noite"));
  });
});

describe("pontuar", () => {
  const preparados = prepararSlides(SLIDES);

  it("acha o slide do trecho cantado", () => {
    const notas = pontuar("o rio corre firme entre as pedras", preparados);
    const ordenadas = [...notas].sort((a, b) => b.score - a.score);
    assert.equal(ordenadas[0]?.index, 2);
    assert.ok(ordenadas[0]!.score > 0.9, `esperava nota alta, veio ${ordenadas[0]?.score}`);
  });

  it("aguenta a transcrição imperfeita", () => {
    const notas = pontuar("a manha dese sobre o vali", preparados);
    const ordenadas = [...notas].sort((a, b) => b.score - a.score);
    assert.equal(ordenadas[0]?.index, 0);
    assert.ok(ordenadas[0]!.score > 0.75);
  });

  it("trecho curto demais não vale palpite", () => {
    assert.deepEqual(pontuar("e o", preparados), []);
  });

  it("vocabulário repetido não vence a frase inteira", () => {
    // A ponte reusa "pedras", "vale" e "cancao", mas a frase contínua é do coro.
    const notas = pontuar("canta comigo a mesma cancao", preparados);
    const ponte = notas.find((n) => n.index === 4)!;
    const coro = notas.find((n) => n.index === 1)!;
    assert.ok(coro.score > ponte.score);
  });

  it("devolve o trecho reconhecido, para explicar a decisão", () => {
    const notas = pontuar("que atravessa a noite inteira", preparados);
    assert.match(notas.find((n) => n.index === 1)!.trecho, /atravessa a noite inteira/);
  });
});

describe("AutoSlideEngine", () => {
  const motor = () => {
    const e = new AutoSlideEngine({ ...PERFIS.equilibrado });
    e.carregar(SLIDES);
    return e;
  };

  it("sem antecipacao, exige duas janelas concordando", () => {
    const e = new AutoSlideEngine({ ...PERFIS.equilibrado, antecipar: false });
    e.carregar(SLIDES);
    const um = e.decidir("o rio corre firme entre as pedras", 0, 10_000);
    assert.equal(um.trocar, false);
    assert.equal(um.motivo, "aguardando-confirmacao");
    const dois = e.decidir("o rio corre firme entre as pedras", 0, 12_000);
    assert.equal(dois.trocar, true);
    assert.equal(dois.index, 2);
  });

  it("com antecipacao, nota altissima troca na primeira janela", () => {
    const e = motor();
    const d = e.decidir("o rio corre firme entre as pedras", 0, 10_000);
    assert.equal(d.trocar, true, "a frase inteira nao deixa duvida; esperar seria atraso");
    assert.equal(d.index, 2);
  });

  it("não troca com confiança baixa", () => {
    const e = motor();
    const d = e.decidir("palavras que nao estao em lugar nenhum", 0, 10_000);
    assert.equal(d.trocar, false);
    assert.equal(d.motivo, "confianca-baixa");
    assert.equal(d.index, 0, "sem confiança, fica onde está");
  });

  it("refrão idêntico dá empate, e empate não troca", () => {
    const e = motor();
    // Slides 1 e 3 são o mesmo coro e, vistos do slide 0, estão os dois à
    // frente e valem o mesmo: nenhum pode ganhar sozinho.
    const d = e.decidir("canta comigo a mesma cancao que atravessa", 0, 10_000);
    assert.equal(d.trocar, false);
    assert.equal(d.motivo, "empate");
  });

  it("respeita o tempo mínimo entre trocas", () => {
    const e = motor();
    e.decidir("o rio corre firme entre as pedras", 0, 10_000);
    const trocou = e.decidir("o rio corre firme entre as pedras", 0, 10_100);
    assert.equal(trocou.trocar, false);
    assert.equal(trocou.motivo, "cooldown");
  });

  it("o operador manda: troca manual segura o motor", () => {
    const e = motor();
    e.decidir("o rio corre firme entre as pedras", 0, 10_000);
    e.marcarManual(10_500);
    const d = e.decidir("o rio corre firme entre as pedras", 0, 11_000);
    assert.equal(d.trocar, false, "logo depois da mão do operador, o motor espera");
  });

  it("perfil conservador não volta slide", () => {
    const e = new AutoSlideEngine({ ...PERFIS.conservador });
    e.carregar(SLIDES);
    const d = e.decidir("a manha desce sobre o vale e a neblina", 2, 10_000);
    assert.equal(d.trocar, false);
    assert.equal(d.motivo, "volta-bloqueada");
  });

  it("perfil equilibrado volta quando a evidência é do trecho anterior", () => {
    const e = motor();
    e.decidir("a manha desce sobre o vale e a neblina se levanta", 2, 10_000);
    const d = e.decidir("a manha desce sobre o vale e a neblina se levanta", 2, 20_000);
    assert.equal(d.trocar, true);
    assert.equal(d.index, 0);
  });

  it("já estando no slide certo, não faz nada", () => {
    const e = motor();
    const d = e.decidir("o rio corre firme entre as pedras", 2, 10_000);
    assert.equal(d.trocar, false);
    assert.equal(d.motivo, "ja-esta-nele");
  });

  it("áudio curto não vira palpite", () => {
    const e = motor();
    assert.equal(e.decidir("o rio", 0, 10_000).motivo, "audio-curto");
  });

  it("trocar de música limpa o contexto anterior", () => {
    const e = motor();
    e.decidir("o rio corre firme entre as pedras", 0, 10_000);
    e.carregar(["Outra letra inteiramente diferente aqui"]);
    const d = e.decidir("o rio corre firme entre as pedras", 0, 12_000);
    assert.equal(d.trocar, false);
  });
});
