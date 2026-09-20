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
    listarMidia: async () => [{ id: "midia:video:x.mp4", titulo: "Chamada", tipo: "video" }],
    projetarMidia: async (id) => {
      feito.push("midia:" + id);
      return id === "midia:video:x.mp4";
    },
    controlarVideo: (acao) => {
      feito.push("video:" + acao);
      return acao !== "parar";
    },
    volumeDoVideo: (p) => {
      feito.push("vol:" + p);
      return true;
    },
    repetirVideo: (l) => {
      feito.push("laco:" + l);
      return true;
    },
    projetarYoutube: (endereco, titulo) => {
      feito.push(`yt:${endereco}:${titulo}`);
      return endereco.includes("youtu");
    },
    controlarYoutube: (acao) => {
      feito.push("ytc:" + acao);
      return true;
    },
    listarVersoesBiblia: () => [{ id: "almeida-1819", nome: "Almeida 1819" }],
    trocarVersaoBiblia: (id) => {
      feito.push("versao:" + id);
      return id === "almeida-1819";
    },
    tamanhoDaLetra: (passos) => {
      feito.push("letra:" + passos);
      return 1.3;
    },
    mostrarRelogio: (l) => feito.push("relogio:" + l),
    mostrarPapelDeParede: (l) => feito.push("fundo:" + l),
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
  test("o pedido do exemplo do prompt funciona de ponta a ponta", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({
      ferramenta: "create_recurring_service",
      argumentos: { nome: "Culto da Benção", weekday: undefined, diaDaSemana: 3, recorrencia: "semanal" },
    });
    assert.equal(p.ok, true);
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.deepEqual(acoes.feito, ["culto:Culto da Benção:3"]);
  });

  test("a mensagem conta o que aconteceu, não o que se queria", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "projetar_musica", argumentos: { id: "nao-existe" } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Não achei/);
  });

  test("busca sem resultado não mente dizendo que achou", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "buscar_musica", argumentos: { termo: "inexistente" } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
  });

  test("ferramenta que explode não derruba a cabine", async () => {
    const acoes = acoesDeMentira();
    acoes.telaPreta = () => {
      throw new Error("placa de vídeo sumiu");
    };
    const p = planejar({ ferramenta: "tela_preta", argumentos: {} });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Não consegui/);
  });

  test("culto repetido é recusado pela cabine, não pelo modelo", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({
      ferramenta: "criar_culto_recorrente",
      argumentos: { nome: "Repetido", diaDaSemana: 0, recorrencia: "semanal" },
    });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
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

  test("as posições que o operador conta viram as que o código usa", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "mover_item_do_culto", argumentos: { de: 1, para: 2 } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
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

  test("posição que não existe é recusada pela cabine, não pelo modelo", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "remover_do_culto", argumentos: { posicao: 9 } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
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

  test("ver a letra é consulta: acontece sem perguntar", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "ver_letra", argumentos: {} });
    assert.equal(p.ok && p.precisaConfirmar, false);
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.equal((r.dados as { slideId: string }[])[0].slideId, "sl1");
  });
});

/** Um argumento plausível por ferramenta, para percorrer o catálogo inteiro. */
const ARGUMENTOS_VALIDOS: Record<string, Record<string, unknown>> = {
  buscar_musica: { termo: "vale" },
  projetar_musica: { id: "s1" },
  preparar_musica: { id: "s1" },
  versiculo: { referencia: "João 3:16" },
  criar_aviso: { texto: "oi" },
  contagem_regressiva: { segundos: 60 },
  linhas_por_slide: { quantas: 4 },
  criar_culto_recorrente: { nome: "Culto", diaDaSemana: 3 },
  aplicar_tema: { id: "t1" },
  ajustar_tema: { tamanho: 72 },
  adicionar_ao_culto: { id: "s1" },
  mover_item_do_culto: { de: 1, para: 2 },
  remover_do_culto: { posicao: 1 },
  criar_playlist: { nome: "Domingo" },
  editar_letra: { slideId: "sl1", texto: "nova" },
  dividir_slide: { slideId: "sl1", naLinha: 2 },
  projetar_midia: { id: "midia:video:x.mp4" },
  controlar_video: { acao: "tocar" },
  volume_do_video: { porcento: 50 },
  repetir_video: { ligado: true },
  projetar_youtube: { endereco: "https://youtu.be/abc" },
  controlar_youtube: { acao: "tocar" },
  trocar_versao_biblia: { id: "almeida-1819" },
  tamanho_da_letra: { passos: 1 },
  relogio_no_telao: { ligado: true },
  papel_de_parede: { ligado: false },
};

describe("o catálogo ampliado continua fechado", () => {
  test("o risco declarado é o que o planejador aplica", () => {
    // Confere o caminho inteiro, não a definição: é `planejar` que a cabine
    // consulta antes de agir, e é ele que pode divergir do que a ferramenta
    // diz de si mesma.
    for (const f of FERRAMENTAS) {
      const p = planejar({ ferramenta: f.nome, argumentos: ARGUMENTOS_VALIDOS[f.nome] ?? {} });
      if (!p.ok) continue;
      const deveriaPerguntar = f.risco === "edit" || f.risco === "destructive";
      assert.equal(p.precisaConfirmar, deveriaPerguntar, f.nome);
    }
  });

  test("toda ferramenta que apaga ou tira tem risco de mexer no guardado", () => {
    // Um verbo de perda classificado como "live" passaria sem perguntar.
    for (const f of FERRAMENTAS) {
      if (!/^(remover|apagar|excluir|limpar)/.test(f.nome)) continue;
      assert.ok(
        f.risco === "edit" || f.risco === "destructive",
        `${f.nome} tira alguma coisa e não pergunta antes`,
      );
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

describe("mídia da pasta", () => {
  test("listar a pasta é consulta, e é assíncrono porque é disco", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "listar_midia", argumentos: {} });
    assert.equal(p.ok && p.precisaConfirmar, false);
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.equal((r.dados as { tipo: string }[])[0].tipo, "video");
  });

  test("arquivo que não está na pasta não vai ao telão", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "projetar_midia", argumentos: { id: "midia:video:some.mp4" } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /pasta/i);
  });

  test("mandar parar sem vídeo no ar diz a verdade", async () => {
    // O dublê devolve falso para "parar": é o caso de não haver vídeo.
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "controlar_video", argumentos: { acao: "parar" } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /Não há vídeo/);
  });

  test("ação de vídeo fora das três não existe", () => {
    assert.equal(planejar({ ferramenta: "controlar_video", argumentos: { acao: "rebobinar" } }).ok, false);
  });

  test("volume vive entre 0 e 100", () => {
    assert.equal(planejar({ ferramenta: "volume_do_video", argumentos: { porcento: 101 } }).ok, false);
    assert.equal(planejar({ ferramenta: "volume_do_video", argumentos: { porcento: -1 } }).ok, false);
    assert.equal(planejar({ ferramenta: "volume_do_video", argumentos: { porcento: 0 } }).ok, true);
  });
});

describe("YouTube", () => {
  test("endereço que não é do YouTube é recusado pela cabine", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({
      ferramenta: "projetar_youtube",
      argumentos: { endereco: "https://exemplo.com/video" },
    });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /YouTube/);
  });

  test("o título é opcional, e o endereço não", () => {
    assert.equal(planejar({ ferramenta: "projetar_youtube", argumentos: {} }).ok, false);
    assert.equal(
      planejar({ ferramenta: "projetar_youtube", argumentos: { endereco: "https://youtu.be/a" } }).ok,
      true,
    );
  });
});

describe("Bíblia e telão", () => {
  test("trocar a tradução pergunta antes: muda o texto que a igreja lê", () => {
    const p = planejar({ ferramenta: "trocar_versao_biblia", argumentos: { id: "almeida-1819" } });
    assert.equal(p.ok && p.precisaConfirmar, true);
  });

  test("aumentar e diminuir a letra não interrompe ninguém para confirmar", async () => {
    // Um passo se desfaz com o passo contrário.
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "tamanho_da_letra", argumentos: { passos: 1 } });
    assert.equal(p.ok && p.precisaConfirmar, false);
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, true);
    assert.match(r.mensagem, /130%/);
  });

  test("zero passos não é aumentar nem diminuir", async () => {
    const acoes = acoesDeMentira();
    const p = planejar({ ferramenta: "tamanho_da_letra", argumentos: { passos: 0 } });
    const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
    assert.equal(r.ok, false);
    assert.match(r.mensagem, /aumentar ou diminuir/);
  });

  test("relógio e fundo são interruptores, não decisões", async () => {
    const acoes = acoesDeMentira();
    for (const nome of ["relogio_no_telao", "papel_de_parede"]) {
      const p = planejar({ ferramenta: nome, argumentos: { ligado: false } });
      assert.equal(p.ok && p.precisaConfirmar, false, nome);
      const r = await executarPlano(p as Extract<typeof p, { ok: true }>, acoes);
      assert.equal(r.ok, true, nome);
    }
    assert.ok(acoes.feito.includes("relogio:false"));
    assert.ok(acoes.feito.includes("fundo:false"));
  });
});
