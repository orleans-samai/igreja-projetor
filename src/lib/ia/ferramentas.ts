import { z } from "zod";

/**
 * O catálogo fechado: tudo que a IA pode pedir, e nada além.
 *
 * O modelo não chama funções — ele escreve o nome de uma ferramenta desta
 * lista. Nome que não está aqui não existe, argumento que não passa pelo
 * schema não vira valor, e o que roda é sempre código escrito por gente.
 *
 * Cada ferramenta declara o risco do que faz, e o risco decide se a cabine
 * pergunta antes:
 *
 *   read        consulta; nada muda no telão nem no disco
 *   live        muda o que a igreja vê agora, e se desfaz sozinho
 *   edit        mexe em conteúdo ou configuração guardada — pergunta antes
 *   destructive apaga ou substitui em massa — sempre pergunta
 *
 * `previa` existe para a pergunta ter conteúdo: "criar o culto X toda
 * quarta" é uma frase que o operador consegue aprovar ou recusar; "executar
 * criar_culto_recorrente" não é.
 */

export type NivelRisco = "read" | "live" | "edit" | "destructive";

export interface ResultadoFerramenta {
  ok: boolean;
  /** O que dizer ao operador — sempre sobre o que aconteceu, nunca sobre o
   *  que se pretendia. */
  mensagem: string;
  /** Dados de consulta, quando a ferramenta é `read`. */
  dados?: unknown;
}

/**
 * O que a IA pode mandar a cabine fazer.
 *
 * É uma interface, e não a store direto, por dois motivos: o catálogo fica
 * testável sem navegador, e fica visível numa página só tudo que a IA
 * alcança. Crescer essa lista é uma decisão, não um descuido.
 */
export interface AcoesIA {
  buscarMusicas(termo: string): { id: string; titulo: string; artista: string }[];
  projetarMusica(id: string): boolean;
  prepararMusica(id: string): boolean;
  versiculo(referencia: string, projetar: boolean): boolean;
  proximoSlide(): void;
  slideAnterior(): void;
  telaPreta(): void;
  mostrarLogo(): void;
  ocultarTexto(): void;
  pararProjecao(): void;
  criarAviso(texto: string, segundos: number): void;
  contagemRegressiva(rotulo: string, segundos: number): void;
  linhasPorSlide(quantas: number): void;
  historicoDeHoje(): { titulo: string; hora: string }[];
  criarCultoRecorrente(nome: string, diaDaSemana: number): { ok: boolean; motivo?: string };
}

export interface Ferramenta {
  nome: string;
  /** Nomes que o modelo às vezes usa em vez do certo. */
  apelidos?: readonly string[];
  descricao: string;
  risco: NivelRisco;
  entrada: z.ZodType;
  podeDesfazer: boolean;
  /**
   * Traduz o que o modelo escreveu para o que o schema espera.
   *
   * Modelo pequeno troca de idioma sozinho e escreve `weekday` onde o
   * catálogo diz `diaDaSemana`. Recusar isso seria recusar o pedido certo
   * por causa da palavra — e o schema continua sendo o juiz depois daqui.
   */
  antes?: (args: Record<string, unknown>) => Record<string, unknown>;
  previa: (args: never) => string;
  executar: (args: never, acoes: AcoesIA) => ResultadoFerramenta;
}

function ferramenta<T extends z.ZodType>(f: {
  nome: string;
  apelidos?: readonly string[];
  descricao: string;
  risco: NivelRisco;
  entrada: T;
  podeDesfazer: boolean;
  antes?: (args: Record<string, unknown>) => Record<string, unknown>;
  previa: (args: z.infer<T>) => string;
  executar: (args: z.infer<T>, acoes: AcoesIA) => ResultadoFerramenta;
}): Ferramenta {
  return f as unknown as Ferramenta;
}

const semArgumentos = z.object({}).strict();

/** Dia da semana como a igreja fala, e como o JS conta (0 = domingo). */
export const DIAS_DA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const umBotao = (
  nome: string,
  descricao: string,
  fala: string,
  fazer: (a: AcoesIA) => void,
): Ferramenta =>
  ferramenta({
    nome,
    descricao,
    risco: "live",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => fala,
    executar: (_args, acoes) => {
      fazer(acoes);
      return { ok: true, mensagem: fala };
    },
  });

export const FERRAMENTAS: readonly Ferramenta[] = [
  ferramenta({
    nome: "buscar_musica",
    apelidos: ["search_song", "procurar_musica"],
    descricao: "Procura músicas no repertório da igreja por nome, autor ou trecho da letra.",
    risco: "read",
    entrada: z.object({ termo: z.string().min(2).max(120) }).strict(),
    antes: (a) => ({ termo: a.termo ?? a.query ?? a.term ?? a.busca }),
    podeDesfazer: false,
    previa: (a) => `procurar “${a.termo}” no repertório`,
    executar: (a, acoes) => {
      const achados = acoes.buscarMusicas(a.termo).slice(0, 8);
      if (achados.length === 0) {
        return { ok: false, mensagem: `Não achei nada com “${a.termo}” no repertório.` };
      }
      return {
        ok: true,
        mensagem: `${achados.length} música(s) com “${a.termo}”.`,
        dados: achados,
      };
    },
  }),

  ferramenta({
    nome: "projetar_musica",
    apelidos: ["project_song"],
    descricao: "Manda uma música do repertório para o telão agora. Use o id vindo de buscar_musica.",
    risco: "live",
    entrada: z.object({ id: z.string().min(1).max(80) }).strict(),
    podeDesfazer: false,
    previa: (a) => `projetar a música ${a.id}`,
    executar: (a, acoes) =>
      acoes.projetarMusica(a.id)
        ? { ok: true, mensagem: "Música no telão." }
        : { ok: false, mensagem: "Não achei essa música no repertório." },
  }),

  ferramenta({
    nome: "preparar_musica",
    apelidos: ["prepare_song"],
    descricao: "Deixa a música pronta para entrar, sem mandar para o telão.",
    risco: "live",
    entrada: z.object({ id: z.string().min(1).max(80) }).strict(),
    podeDesfazer: false,
    previa: (a) => `preparar a música ${a.id}`,
    executar: (a, acoes) =>
      acoes.prepararMusica(a.id)
        ? { ok: true, mensagem: "Música preparada." }
        : { ok: false, mensagem: "Não achei essa música no repertório." },
  }),

  ferramenta({
    nome: "versiculo",
    apelidos: ["bible", "projetar_versiculo"],
    descricao:
      "Abre uma passagem da Bíblia local. Com projetar=true vai para o telão; false só prepara.",
    risco: "live",
    entrada: z
      .object({
        referencia: z.string().min(2).max(60),
        projetar: z.boolean().default(false),
      })
      .strict(),
    podeDesfazer: false,
    previa: (a) => `${a.projetar ? "projetar" : "preparar"} ${a.referencia}`,
    executar: (a, acoes) =>
      acoes.versiculo(a.referencia, a.projetar)
        ? { ok: true, mensagem: `${a.referencia} ${a.projetar ? "no telão" : "preparado"}.` }
        : { ok: false, mensagem: `Não reconheci a passagem “${a.referencia}”.` },
  }),

  umBotao("proximo_slide", "Avança um slide no telão.", "avançar um slide", (a) => a.proximoSlide()),
  umBotao("slide_anterior", "Volta um slide no telão.", "voltar um slide", (a) => a.slideAnterior()),
  umBotao("tela_preta", "Apaga o telão.", "apagar o telão", (a) => a.telaPreta()),
  umBotao("mostrar_logo", "Põe a logo da igreja no telão.", "mostrar a logo", (a) => a.mostrarLogo()),
  umBotao("ocultar_texto", "Mantém o fundo e tira a letra.", "ocultar a letra", (a) => a.ocultarTexto()),
  umBotao("parar_projecao", "Para de apresentar.", "parar a projeção", (a) => a.pararProjecao()),

  ferramenta({
    nome: "criar_aviso",
    apelidos: ["alert", "mostrar_aviso"],
    descricao: "Escreve um aviso curto no rodapé do telão por alguns segundos.",
    risco: "live",
    entrada: z
      .object({
        texto: z.string().min(1).max(160),
        segundos: z.number().int().min(3).max(300).default(15),
      })
      .strict(),
    podeDesfazer: false,
    antes: (a) => ({ texto: a.texto ?? a.text, segundos: a.segundos ?? a.seconds ?? 15 }),
    previa: (a) => `mostrar “${a.texto}” por ${a.segundos}s`,
    executar: (a, acoes) => {
      acoes.criarAviso(a.texto, a.segundos);
      return { ok: true, mensagem: `Aviso no telão por ${a.segundos}s.` };
    },
  }),

  ferramenta({
    nome: "contagem_regressiva",
    apelidos: ["countdown"],
    descricao: "Põe uma contagem regressiva no telão.",
    risco: "live",
    entrada: z
      .object({
        segundos: z.number().int().min(5).max(7200),
        rotulo: z.string().max(60).default(""),
      })
      .strict(),
    podeDesfazer: false,
    previa: (a) => `contagem de ${a.segundos}s${a.rotulo ? ` — ${a.rotulo}` : ""}`,
    executar: (a, acoes) => {
      acoes.contagemRegressiva(a.rotulo, a.segundos);
      return { ok: true, mensagem: `Contagem de ${a.segundos}s no telão.` };
    },
  }),

  ferramenta({
    nome: "historico_de_hoje",
    apelidos: ["history_today"],
    descricao: "Diz o que já foi projetado hoje.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver o que já foi projetado hoje",
    executar: (_a, acoes) => {
      const lista = acoes.historicoDeHoje();
      return lista.length === 0
        ? { ok: true, mensagem: "Nada foi projetado hoje ainda." }
        : { ok: true, mensagem: `${lista.length} item(ns) hoje.`, dados: lista };
    },
  }),

  ferramenta({
    nome: "linhas_por_slide",
    apelidos: ["set_lines_per_slide"],
    descricao: "Muda quantas linhas de letra cabem em cada slide do telão.",
    // Mexe numa configuração guardada, e muda como toda música vai aparecer:
    // o operador confirma antes.
    risco: "edit",
    entrada: z.object({ quantas: z.number().int().min(3).max(8) }).strict(),
    podeDesfazer: true,
    previa: (a) => `passar para ${a.quantas} linhas por slide em todo o telão`,
    executar: (a, acoes) => {
      acoes.linhasPorSlide(a.quantas);
      return { ok: true, mensagem: `Agora são ${a.quantas} linhas por slide.` };
    },
  }),

  ferramenta({
    nome: "criar_culto_recorrente",
    apelidos: ["create_recurring_service"],
    descricao:
      "Cria um culto que se repete toda semana no mesmo dia. 0 é domingo, 3 é quarta-feira.",
    risco: "edit",
    entrada: z
      .object({
        nome: z.string().min(2).max(60),
        diaDaSemana: z.number().int().min(0).max(6),
        recorrencia: z.literal("semanal").default("semanal"),
      })
      .strict(),
    podeDesfazer: true,
    // O exemplo do pedido usa `name`, `weekday` e `recurrence`; o catálogo
    // fala português. Os dois chegam ao mesmo lugar.
    antes: (a) => ({
      nome: a.nome ?? a.name,
      diaDaSemana: a.diaDaSemana ?? a.weekday ?? a.dia,
      recorrencia:
        a.recorrencia === "semanal" || a.recurrence === "weekly" || a.recorrencia === undefined
          ? "semanal"
          : a.recorrencia,
    }),
    previa: (a) => `criar o culto “${a.nome}” toda ${DIAS_DA_SEMANA[a.diaDaSemana]}`,
    executar: (a, acoes) => {
      const r = acoes.criarCultoRecorrente(a.nome, a.diaDaSemana);
      return r.ok
        ? { ok: true, mensagem: `Culto “${a.nome}” criado para toda ${DIAS_DA_SEMANA[a.diaDaSemana]}.` }
        : { ok: false, mensagem: r.motivo ?? "Não consegui criar o culto." };
    },
  }),
] as const;

/** O inglês do prompt também é aceito: modelo pequeno troca de idioma sozinho. */
const POR_NOME = new Map<string, Ferramenta>();
for (const f of FERRAMENTAS) {
  POR_NOME.set(f.nome, f);
  for (const apelido of f.apelidos ?? []) POR_NOME.set(apelido, f);
}

export function acharFerramenta(nome: string): Ferramenta | null {
  return POR_NOME.get(String(nome ?? "").trim().toLowerCase()) ?? null;
}

export type Plano =
  | {
      ok: true;
      ferramenta: Ferramenta;
      argumentos: unknown;
      /** Frase que o operador lê antes de aprovar. */
      previa: string;
      /** Se precisa de um sim antes de acontecer. */
      precisaConfirmar: boolean;
    }
  | { ok: false; erro: string };

/**
 * Do pedido do modelo a um plano conferido — ou a um erro em português.
 *
 * O erro é para o operador, não para o modelo: "não existe ferramenta
 * chamada X" é o que se lê na conversa quando o modelo inventa, e inventar é
 * o que modelo pequeno faz quando não sabe.
 */
export function planejar(pedido: { ferramenta: string; argumentos: unknown }): Plano {
  const f = acharFerramenta(pedido.ferramenta);
  if (!f) {
    return { ok: false, erro: `Não existe uma ação chamada “${pedido.ferramenta}”.` };
  }
  const crus = (pedido.argumentos ?? {}) as Record<string, unknown>;
  // Traduz, depois confere. A tradução é generosa com o nome do campo; o
  // schema continua implacável com o valor.
  const arrumados = f.antes ? f.antes(crus) : crus;
  const semVazios = Object.fromEntries(
    Object.entries(arrumados).filter(([, v]) => v !== undefined),
  );
  const lido = f.entrada.safeParse(semVazios);
  if (!lido.success) {
    const problema = lido.error.issues[0];
    const onde = problema?.path.join(".") || "os valores";
    return { ok: false, erro: `“${f.nome}” recebeu ${onde} fora do esperado.` };
  }
  return {
    ok: true,
    ferramenta: f,
    argumentos: lido.data,
    previa: (f.previa as (a: unknown) => string)(lido.data),
    precisaConfirmar: f.risco === "edit" || f.risco === "destructive",
  };
}

/** Executa um plano já conferido. Nunca recebe texto do modelo. */
export function executarPlano(plano: Extract<Plano, { ok: true }>, acoes: AcoesIA): ResultadoFerramenta {
  try {
    return (plano.ferramenta.executar as (a: unknown, ac: AcoesIA) => ResultadoFerramenta)(
      plano.argumentos,
      acoes,
    );
  } catch {
    // Uma ferramenta que explode não pode derrubar a cabine no meio do culto.
    return { ok: false, mensagem: "Não consegui fazer isso agora." };
  }
}

/** O catálogo em texto, para o modelo saber o que pode pedir. */
export function catalogoParaModelo(): string {
  return FERRAMENTAS.map((f) => `- ${f.nome}: ${f.descricao}`).join("\n");
}
