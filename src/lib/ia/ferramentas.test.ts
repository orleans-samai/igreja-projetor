import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FERRAMENTAS,
  acharFerramenta,
  catalogoParaModelo,
  executarPlano,
  planejar,
  type AcoesIA,
} from "./ferramentas.ts";

function acoesDeMentira(): AcoesIA & { feito: string[] } {
  const feito: string[] = [];
  return {
    feito,
    buscarMusicas: (t) =>
      t.includes("vale") ? [{ id: "s1", titulo: "Luz sobre o vale", artista: "Lúmen" }] : [],
    projetarMusica: (id) => {
      feito.push("projetar:" + id);
      return id === "s1";
    },
    prepararMusica: (id) => {
      feito.push("preparar:" + id);
      return id === "s1";
    },
    versiculo: (r, p) => {
      feito.push(`versiculo:${r}:${p}`);
      return r.toLowerCase().startsWith("joão");
    },
    proximoSlide: () => feito.push("proximo"),
    slideAnterior: () => feito.push("anterior"),
    telaPreta: () => feito.push("preto"),
    mostrarLogo: () => feito.push("logo"),
    ocultarTexto: () => feito.push("ocultar"),
    pararProjecao: () => feito.push("parar"),
    criarAviso: (t, s) => feito.push(`aviso:${t}:${s}`),
    contagemRegressiva: (r, s) => feito.push(`contagem:${r}:${s}`),
    linhasPorSlide: (n) => feito.push("linhas:" + n),
    historicoDeHoje: () => [{ titulo: "Castelo forte", hora: "19:12" }],
    criarCultoRecorrente: (nome, dia) => {
      feito.push(`culto:${nome}:${dia}`);
      return nome === "Repetido" ? { ok: false, motivo: "Já existe um culto com esse nome." } : { ok: true };
    },
  };
}

describe("o catálogo é fechado", () => {
  test("ferramenta inventada não existe", () => {
    // É o que modelo pequeno mais faz quando não sabe: inventa um nome.
    for (const nome of ["rodar_comando", "ler_arquivo", "eval", "apagar_tudo", ""]) {
      assert.equal(acharFerramenta(nome), null, nome);
      const p = planejar({ ferramenta: nome, argumentos: {} });
      assert.equal(p.ok, false);
      assert.match(p.ok === false ? p.erro : "", /Não existe uma ação/);
    }
  });

  test("nenhuma ferramenta abre terminal, arquivo ou código", () => {
    const proibido = /terminal|shell|comando|exec|arquivo|file|script|sql|eval/i;
    for (const f of FERRAMENTAS) {
      assert.ok(!proibido.test(f.nome), `${f.nome} parece perigosa demais para existir`);
    }
  });

  test("o inglês que o modelo às vezes usa também acha", () => {
    assert.equal(acharFerramenta("create_recurring_service")?.nome, "criar_culto_recorrente");
    assert.equal(acharFerramenta("search_song")?.nome, "buscar_musica");
  });

  test("o catálogo que vai ao modelo lista tudo, e só isso", () => {
    const texto = catalogoParaModelo();
    for (const f of FERRAMENTAS) assert.match(texto, new RegExp(f.nome));
  });
});

describe("argumentos são conferidos, não confiados", () => {
  test("argumento faltando não vira execução", () => {
    const p = planejar({ ferramenta: "projetar_musica", argumentos: {} });
    assert.equal(p.ok, false);
  });

  test("argumento a mais é recusado, não ignorado", () => {
    // Um campo inventado costuma ser o modelo tentando outra coisa.
    const p = planejar({
      ferramenta: "tela_preta",
      argumentos: { tambem: "apagar o repertório" },
    });
    assert.equal(p.ok, false);
  });

  test("número fora da faixa não passa", () => {
    assert.equal(planejar({ ferramenta: "linhas_por_slide", argumentos: { quantas: 400 } }).ok, false);
    assert.equal(planejar({ ferramenta: "linhas_por_slide", argumentos: { quantas: 0 } }).ok, false);
    assert.equal(planejar({ ferramenta: "linhas_por_slide", argumentos: { quantas: 4 } }).ok, true);
  });

  test("dia da semana só existe de 0 a 6", () => {
    const base = { nome: "Culto da Benção", recorrencia: "semanal" };
    assert.equal(planejar({ ferramenta: "criar_culto_recorrente", argumentos: { ...base, diaDaSemana: 9 } }).ok, false);
    assert.equal(planejar({ ferramenta: "criar_culto_recorrente", argumentos: { ...base, diaDaSemana: 3 } }).ok, true);
  });

  test("texto gigante não entra num aviso", () => {
    assert.equal(planejar({ ferramenta: "criar_aviso", argumentos: { texto: "x".repeat(500) } }).ok, false);
  });
});

describe("risco decide se pergunta antes", () => {
  test("consulta e comando ao vivo acontecem na hora", () => {
    for (const nome of ["buscar_musica", "tela_preta", "proximo_slide"]) {
      const args = nome === "buscar_musica" ? { termo: "vale" } : {};
      const p = planejar({ ferramenta: nome, argumentos: args });
      assert.equal(p.ok && p.precisaConfirmar, false, nome);
    }
  });

  test("mexer no guardado pergunta antes, com a frase pronta", () => {
    const p = planejar({
      ferramenta: "create_recurring_service",
      argumentos: { nome: "Culto da Benção", diaDaSemana: 3, recorrencia: "semanal" },
    });
    assert.equal(p.ok && p.precisaConfirmar, true);
    // A frase é o que o operador aprova; "executar criar_culto_recorrente" não é.
    assert.equal(p.ok && p.previa, "criar o culto “Culto da Benção” toda quarta-feira");
  });

  test("trocar linhas por slide também pergunta", () => {
    const p = planejar({ ferramenta: "linhas_por_slide", argumentos: { quantas: 3 } });
    assert.equal(p.ok && p.precisaConfirmar, true);
    assert.match(p.ok ? p.previa : "", /3 linhas por slide/);
  });
});

describe("executar", () => {
  test("o pedido do exemplo do prompt funciona de ponta a ponta", () => {
    const acoes = acoesDeMentira();
    const p = planejar({
      ferramenta: "create_recurring_service",
      argumentos: { nome: "Culto da Benção", weekday: undefined, diaDaSemana: 3, recorrencia: "semanal" },
    });
    assert.equal(p.ok, true);
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.deepEqual(acoes.feito, ["culto:Culto da Benção:3"]);
  });

  test("a mensagem conta o que aconteceu, não o que se queria", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "projetar_musica", argumentos: { id: "nao-existe" } });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Não achei/);
  });

  test("busca sem resultado não mente dizendo que achou", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "buscar_musica", argumentos: { termo: "inexistente" } });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
  });

  test("ferramenta que explode não derruba a cabine", () => {
    const acoes = acoesDeMentira();
    acoes.telaPreta = () => {
      throw new Error("placa de vídeo sumiu");
    };
    const p = planejar({ ferramenta: "tela_preta", argumentos: {} });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Não consegui/);
  });

  test("culto repetido é recusado pela cabine, não pelo modelo", () => {
    const acoes = acoesDeMentira();
    const p = planejar({
      ferramenta: "criar_culto_recorrente",
      argumentos: { nome: "Repetido", diaDaSemana: 0, recorrencia: "semanal" },
    });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Já existe/);
  });
});
