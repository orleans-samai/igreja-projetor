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
    listarTemas: () => [{ id: "t1", nome: "Escuro" }],
    aplicarTema: (id) => {
      feito.push("tema:" + id);
      return id === "t1";
    },
    ajustarTema: (patch) => {
      feito.push("ajuste:" + JSON.stringify(patch));
      return true;
    },
    listarCulto: () => [
      { indice: 1, titulo: "Boas-vindas", tipo: "text" },
      { indice: 2, titulo: "Castelo forte", tipo: "song" },
    ],
    adicionarAoCulto: (tipo, refId) => {
      feito.push(`add:${tipo}:${refId}`);
      return refId === "s1";
    },
    removerDoCulto: (i) => {
      feito.push("rm:" + i);
      return i === 0 ? { ok: true, titulo: "Boas-vindas" } : { ok: false };
    },
    moverItemDoCulto: (de, para) => {
      feito.push(`mv:${de}:${para}`);
      return de === 0 && para === 1;
    },
    criarPlaylist: (nome) => {
      feito.push("playlist:" + nome);
      return true;
    },
    letraDoPreview: () => [{ slideId: "sl1", rotulo: "Verso 1", texto: "uma linha\noutra linha" }],
    editarSlide: (id, texto) => {
      feito.push(`editar:${id}:${texto}`);
      return id === "sl1";
    },
    dividirSlide: (id, linha) => {
      feito.push(`dividir:${id}:${linha}`);
      return id === "sl1" && linha === 2;
    },
    abrirProjecao: () => feito.push("projecao"),
    desfazer: () => {
      feito.push("desfazer");
      return true;
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

describe("temas", () => {
  test("cor só entra em hexadecimal", () => {
    // Aceitar cor por nome deixaria qualquer string do modelo chegar a um
    // `style`. É superfície que não precisa existir para pedir "amarelo".
    for (const cor of ["amarelo", "red", "javascript:alert(1)", "#ggg", "url(x)"]) {
      assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { cor } }).ok, false, cor);
    }
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { cor: "#ffcc00" } }).ok, true);
  });

  test("ajuste vazio não é ajuste", () => {
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: {} }).ok, false);
  });

  test("tamanho e entrelinha ficam na faixa que o telão aguenta", () => {
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { tamanho: 5 } }).ok, false);
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { tamanho: 900 } }).ok, false);
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { entrelinha: 9 } }).ok, false);
    assert.equal(planejar({ ferramenta: "ajustar_tema", argumentos: { tamanho: 72 } }).ok, true);
  });

  test("mexer no tema pergunta antes, e a frase diz o que muda", () => {
    const p = planejar({
      ferramenta: "ajustar_tema",
      argumentos: { tamanho: 80, alinhamento: "center" },
    });
    assert.equal(p.ok && p.precisaConfirmar, true);
    assert.match(p.ok ? p.previa : "", /letra 80/);
    assert.match(p.ok ? p.previa : "", /center/);
  });

  test("o ajuste chega às ações só com o que foi pedido", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "ajustar_tema", argumentos: { maiuscula: true } });
    executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.match(acoes.feito[0], /"uppercase":true/);
    assert.ok(!acoes.feito[0].includes("fontSize"), acoes.feito[0]);
  });
});

describe("programação do culto", () => {
  test("acrescentar acontece na hora; tirar pergunta antes", () => {
    // Acrescentar não faz ninguém perder nada; tirar obriga a achar de novo.
    const add = planejar({ ferramenta: "adicionar_ao_culto", argumentos: { id: "s1" } });
    assert.equal(add.ok && add.precisaConfirmar, false);
    const rm = planejar({ ferramenta: "remover_do_culto", argumentos: { posicao: 1 } });
    assert.equal(rm.ok && rm.precisaConfirmar, true);
  });

  test("as posições que o operador conta viram as que o código usa", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "mover_item_do_culto", argumentos: { de: 1, para: 2 } });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.ok(acoes.feito.includes("mv:0:1"), acoes.feito.join(" | "));
  });

  test("posição zero não existe na tela nem aqui", () => {
    assert.equal(planejar({ ferramenta: "remover_do_culto", argumentos: { posicao: 0 } }).ok, false);
    assert.equal(
      planejar({ ferramenta: "mover_item_do_culto", argumentos: { de: 0, para: 1 } }).ok,
      false,
    );
  });

  test("posição que não existe é recusada pela cabine, não pelo modelo", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "remover_do_culto", argumentos: { posicao: 9 } });
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /não existe/i);
  });

  test("tipo de item fora dos três não passa", () => {
    assert.equal(
      planejar({ ferramenta: "adicionar_ao_culto", argumentos: { tipo: "arquivo", id: "x" } }).ok,
      false,
    );
  });
});

describe("letra", () => {
  test("reescrever mostra o texto novo antes de perguntar", () => {
    const p = planejar({
      ferramenta: "editar_letra",
      argumentos: { slideId: "sl1", texto: "Tua graça me basta" },
    });
    assert.equal(p.ok && p.precisaConfirmar, true);
    // O operador aprova o texto, não um id de slide.
    assert.match(p.ok ? p.previa : "", /Tua graça me basta/);
  });

  test("dividir na primeira linha não é dividir", () => {
    assert.equal(
      planejar({ ferramenta: "dividir_slide", argumentos: { slideId: "sl1", naLinha: 1 } }).ok,
      false,
    );
    assert.equal(
      planejar({ ferramenta: "dividir_slide", argumentos: { slideId: "sl1", naLinha: 2 } }).ok,
      true,
    );
  });

  test("ver a letra é consulta: acontece sem perguntar", () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "ver_letra", argumentos: {} });
    assert.equal(p.ok && p.precisaConfirmar, false);
    const r = executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.equal((r.dados as { slideId: string }[])[0].slideId, "sl1");
  });
});

describe("o catálogo ampliado continua fechado", () => {
  test("toda ferramenta que mexe no guardado pede confirmação", () => {
    for (const f of FERRAMENTAS) {
      const pede = f.risco === "edit" || f.risco === "destructive";
      const confirma = f.risco === "edit" || f.risco === "destructive";
      assert.equal(pede, confirma, f.nome);
    }
  });

  test("toda ferramenta que mexe no guardado sabe ser desfeita", () => {
    // Sem isto, "Desfazer" seria um botão que às vezes mente.
    for (const f of FERRAMENTAS) {
      if (f.risco !== "edit" && f.risco !== "destructive") continue;
      assert.equal(f.podeDesfazer, true, `${f.nome} altera e não pode ser desfeita`);
    }
  });

  test("toda ferramenta tem descrição que serve de instrução ao modelo", () => {
    for (const f of FERRAMENTAS) {
      assert.ok(f.descricao.length > 15, f.nome);
      assert.ok(f.descricao.endsWith("."), `${f.nome}: descrição sem ponto final`);
    }
  });

  test("nome de ferramenta é minúsculo com sublinhado, sem surpresa", () => {
    for (const f of FERRAMENTAS) {
      assert.match(f.nome, /^[a-z][a-z_]*$/, f.nome);
    }
  });
});
