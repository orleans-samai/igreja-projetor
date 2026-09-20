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

  // ─── culto e repertório ───
  listarTemas(): { id: string; nome: string }[];
  aplicarTema(id: string): boolean;
  ajustarTema(patch: AjusteDeTema): boolean;
  listarCulto(): { indice: number; titulo: string; tipo: string }[];
  adicionarAoCulto(tipo: "song" | "text" | "media", refId: string): boolean;
  removerDoCulto(indice: number): { ok: boolean; titulo?: string };
  moverItemDoCulto(de: number, para: number): boolean;
  criarPlaylist(nome: string): boolean;
  /** A letra que está no preview, para a IA poder mostrar antes de mudar. */
  letraDoPreview(): { slideId: string; rotulo: string; texto: string }[] | null;
  editarSlide(slideId: string, texto: string): boolean;
  dividirSlide(slideId: string, naLinha: number): boolean;
  abrirProjecao(): void;
  desfazer(): boolean;

  // ─── mídia, YouTube e telão ───
  listarMidia(): Promise<{ id: string; titulo: string; tipo: string }[]>;
  projetarMidia(id: string): Promise<boolean>;
  controlarVideo(acao: "tocar" | "pausar" | "parar"): boolean;
  volumeDoVideo(porcento: number): boolean;
  repetirVideo(ligado: boolean): boolean;
  projetarYoutube(endereco: string, titulo: string): boolean;
  controlarYoutube(acao: "tocar" | "pausar" | "parar"): boolean;
  listarVersoesBiblia(): { id: string; nome: string }[];
  trocarVersaoBiblia(id: string): boolean;
  tamanhoDaLetra(passos: number): number;
  mostrarRelogio(ligado: boolean): void;
  mostrarPapelDeParede(ligado: boolean): void;
}

/** Só o que faz sentido a IA mexer — nada de id de tema nem de arquivo. */
export interface AjusteDeTema {
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  alignH?: "left" | "center" | "right";
  alignV?: "top" | "center" | "bottom";
  lineHeight?: number;
  margin?: number;
  uppercase?: boolean;
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
  /**
   * Pode devolver promessa: ler a pasta de mídia é ida ao disco, e fingir
   * que não é obrigaria a manter uma cópia da pasta em memória só para o
   * catálogo parecer síncrono.
   */
  executar: (args: never, acoes: AcoesIA) => ResultadoFerramenta | Promise<ResultadoFerramenta>;
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
  executar: (
    args: z.infer<T>,
    acoes: AcoesIA,
  ) => ResultadoFerramenta | Promise<ResultadoFerramenta>;
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

  umBotao("proximo_slide", "Avança para o próximo slide da letra no telão.", "avançar um slide", (a) => a.proximoSlide()),
  umBotao("slide_anterior", "Volta para o slide anterior da letra no telão.", "voltar um slide", (a) => a.slideAnterior()),
  umBotao("tela_preta", "Apaga o telão e deixa a tela preta para a igreja.", "apagar o telão", (a) => a.telaPreta()),
  umBotao("mostrar_logo", "Põe a logo da igreja no telão, no lugar da letra.", "mostrar a logo", (a) => a.mostrarLogo()),
  umBotao("ocultar_texto", "Mantém o fundo no telão e tira só a letra.", "ocultar a letra", (a) => a.ocultarTexto()),
  umBotao("parar_projecao", "Para de apresentar e volta o telão ao repouso.", "parar a projeção", (a) => a.pararProjecao()),

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

  // ─────────────────────────── temas

  ferramenta({
    nome: "listar_temas",
    apelidos: ["list_themes"],
    descricao: "Lista os temas de fundo disponíveis, com o id de cada um.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver os temas disponíveis",
    executar: (_a, acoes) => {
      const temas = acoes.listarTemas();
      return temas.length === 0
        ? { ok: false, mensagem: "Não achei tema nenhum." }
        : { ok: true, mensagem: `${temas.length} tema(s).`, dados: temas };
    },
  }),

  ferramenta({
    nome: "aplicar_tema",
    apelidos: ["apply_theme", "set_theme"],
    descricao: "Troca o tema das músicas. Use o id vindo de listar_temas.",
    // Muda como toda música vai aparecer no telão, e fica guardado.
    risco: "edit",
    entrada: z.object({ id: z.string().min(1).max(80) }).strict(),
    podeDesfazer: true,
    previa: (a) => `trocar o tema das músicas para ${a.id}`,
    executar: (a, acoes) =>
      acoes.aplicarTema(a.id)
        ? { ok: true, mensagem: "Tema trocado." }
        : { ok: false, mensagem: "Não achei esse tema." },
  }),

  ferramenta({
    nome: "ajustar_tema",
    apelidos: ["adjust_theme", "set_font"],
    descricao:
      "Ajusta a letra do telão: tamanho, peso, cor, alinhamento, entrelinha, margem e caixa alta.",
    risco: "edit",
    entrada: z
      .object({
        tamanho: z.number().int().min(24).max(160).optional(),
        peso: z.number().int().min(300).max(900).optional(),
        // Só hexadecimal. Aceitar cor por nome deixaria qualquer string do
        // modelo chegar a um `style`, e essa é superfície que não precisa
        // existir para o operador pedir "deixe o texto amarelo".
        cor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "use uma cor no formato #rrggbb")
          .optional(),
        alinhamento: z.enum(["left", "center", "right"]).optional(),
        vertical: z.enum(["top", "center", "bottom"]).optional(),
        entrelinha: z.number().min(0.9).max(2).optional(),
        margem: z.number().int().min(0).max(25).optional(),
        maiuscula: z.boolean().optional(),
      })
      .strict()
      .refine((v) => Object.values(v).some((x) => x !== undefined), {
        message: "diga o que mudar",
      }),
    podeDesfazer: true,
    previa: (a) => {
      const partes: string[] = [];
      if (a.tamanho) partes.push(`letra ${a.tamanho}`);
      if (a.peso) partes.push(`peso ${a.peso}`);
      if (a.cor) partes.push(`cor ${a.cor}`);
      if (a.alinhamento) partes.push(`alinhada à ${a.alinhamento}`);
      if (a.vertical) partes.push(`na parte de ${a.vertical}`);
      if (a.entrelinha) partes.push(`entrelinha ${a.entrelinha}`);
      if (a.margem !== undefined) partes.push(`margem ${a.margem}`);
      if (a.maiuscula !== undefined) partes.push(a.maiuscula ? "em maiúsculas" : "sem maiúsculas");
      return `deixar o telão com ${partes.join(", ")}`;
    },
    executar: (a, acoes) =>
      acoes.ajustarTema({
        fontSize: a.tamanho,
        fontWeight: a.peso,
        textColor: a.cor,
        alignH: a.alinhamento,
        alignV: a.vertical,
        lineHeight: a.entrelinha,
        margin: a.margem,
        uppercase: a.maiuscula,
      })
        ? { ok: true, mensagem: "Telão ajustado." }
        : { ok: false, mensagem: "Não consegui ajustar o tema." },
  }),

  // ─────────────────────────── programação do culto

  ferramenta({
    nome: "ver_culto",
    apelidos: ["list_service", "ver_programacao"],
    descricao: "Mostra a programação do culto de hoje, com a posição de cada item.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver a programação do culto",
    executar: (_a, acoes) => {
      const itens = acoes.listarCulto();
      return itens.length === 0
        ? { ok: true, mensagem: "A programação está vazia." }
        : { ok: true, mensagem: `${itens.length} item(ns) no culto.`, dados: itens };
    },
  }),

  ferramenta({
    nome: "adicionar_ao_culto",
    apelidos: ["add_to_service"],
    descricao: "Põe uma música, aviso ou mídia na programação do culto. Use o id de uma busca.",
    // Acrescentar não faz ninguém perder nada: tirar é um clique.
    risco: "live",
    entrada: z
      .object({
        tipo: z.enum(["song", "text", "media"]).default("song"),
        id: z.string().min(1).max(80),
      })
      .strict(),
    podeDesfazer: true,
    previa: (a) => `pôr ${a.id} na programação`,
    executar: (a, acoes) =>
      acoes.adicionarAoCulto(a.tipo, a.id)
        ? { ok: true, mensagem: "Entrou na programação." }
        : { ok: false, mensagem: "Não achei esse item." },
  }),

  ferramenta({
    nome: "mover_item_do_culto",
    apelidos: ["move_service_item"],
    descricao: "Muda um item de lugar na programação. As posições começam em 1.",
    risco: "live",
    entrada: z
      .object({ de: z.number().int().min(1).max(200), para: z.number().int().min(1).max(200) })
      .strict(),
    podeDesfazer: true,
    previa: (a) => `mover o item ${a.de} para a posição ${a.para}`,
    executar: (a, acoes) =>
      acoes.moverItemDoCulto(a.de - 1, a.para - 1)
        ? { ok: true, mensagem: "Item movido." }
        : { ok: false, mensagem: "Essa posição não existe na programação." },
  }),

  ferramenta({
    nome: "remover_do_culto",
    apelidos: ["remove_from_service"],
    descricao: "Tira um item da programação pela posição, começando em 1.",
    // Tirar obriga o operador a achar de novo: pergunta antes.
    risco: "edit",
    entrada: z.object({ posicao: z.number().int().min(1).max(200) }).strict(),
    podeDesfazer: true,
    previa: (a) => `tirar o item ${a.posicao} da programação`,
    executar: (a, acoes) => {
      const r = acoes.removerDoCulto(a.posicao - 1);
      return r.ok
        ? { ok: true, mensagem: `“${r.titulo}” saiu da programação.` }
        : { ok: false, mensagem: "Essa posição não existe na programação." };
    },
  }),

  ferramenta({
    nome: "criar_playlist",
    apelidos: ["create_playlist"],
    descricao: "Cria uma programação nova com o nome dado, a partir da de hoje.",
    risco: "live",
    entrada: z.object({ nome: z.string().min(2).max(60) }).strict(),
    podeDesfazer: true,
    previa: (a) => `criar a programação “${a.nome}”`,
    executar: (a, acoes) =>
      acoes.criarPlaylist(a.nome)
        ? { ok: true, mensagem: `Programação “${a.nome}” criada.` }
        : { ok: false, mensagem: "Não consegui criar a programação." },
  }),

  // ─────────────────────────── letra

  ferramenta({
    nome: "ver_letra",
    apelidos: ["read_lyrics"],
    descricao: "Mostra a letra que está preparada, slide por slide, com o id de cada um.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver a letra preparada",
    executar: (_a, acoes) => {
      const slides = acoes.letraDoPreview();
      return slides && slides.length > 0
        ? { ok: true, mensagem: `${slides.length} slide(s).`, dados: slides }
        : { ok: false, mensagem: "Não há letra preparada agora." };
    },
  }),

  ferramenta({
    nome: "editar_letra",
    apelidos: ["edit_lyrics"],
    descricao: "Troca o texto de um slide. Use o slideId vindo de ver_letra.",
    // Reescreve a música no repertório: mostra o texto novo e pergunta.
    risco: "edit",
    entrada: z
      .object({ slideId: z.string().min(1).max(80), texto: z.string().min(1).max(1200) })
      .strict(),
    podeDesfazer: true,
    previa: (a) => `reescrever o slide para:\n${a.texto}`,
    executar: (a, acoes) =>
      acoes.editarSlide(a.slideId, a.texto)
        ? { ok: true, mensagem: "Letra corrigida." }
        : { ok: false, mensagem: "Não achei esse slide." },
  }),

  ferramenta({
    nome: "dividir_slide",
    apelidos: ["split_slide"],
    descricao: "Parte um slide em dois, a partir da linha indicada (a primeira linha é 1).",
    risco: "edit",
    entrada: z
      .object({ slideId: z.string().min(1).max(80), naLinha: z.number().int().min(2).max(40) })
      .strict(),
    podeDesfazer: true,
    previa: (a) => `partir o slide a partir da linha ${a.naLinha}`,
    executar: (a, acoes) =>
      acoes.dividirSlide(a.slideId, a.naLinha)
        ? { ok: true, mensagem: "Slide dividido." }
        : { ok: false, mensagem: "Não deu para dividir nessa linha." },
  }),

  // ─────────────────────────── janelas e desfazer

  umBotao("abrir_projecao", "Abre a janela de projeção no segundo monitor.", "abrir a janela de projeção", (a) =>
    a.abrirProjecao(),
  ),

  ferramenta({
    nome: "desfazer",
    apelidos: ["undo"],
    descricao: "Desfaz a última alteração feita na programação do culto.",
    risco: "live",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "desfazer a última alteração",
    executar: (_a, acoes) =>
      acoes.desfazer()
        ? { ok: true, mensagem: "Desfeito." }
        : { ok: false, mensagem: "Não há nada para desfazer." },
  }),


  // ─────────────────────────── mídia da pasta

  ferramenta({
    nome: "listar_midia",
    apelidos: ["list_media"],
    descricao: "Lista os vídeos, áudios e imagens da pasta de mídia da igreja.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver a pasta de mídia",
    executar: async (_a, acoes) => {
      const itens = await acoes.listarMidia();
      return itens.length === 0
        ? { ok: false, mensagem: "A pasta de mídia está vazia." }
        : { ok: true, mensagem: `${itens.length} arquivo(s) na pasta.`, dados: itens.slice(0, 20) };
    },
  }),

  ferramenta({
    nome: "projetar_midia",
    apelidos: ["project_media"],
    descricao: "Manda um arquivo da pasta de mídia para o telão. Use o id de listar_midia.",
    risco: "live",
    entrada: z.object({ id: z.string().min(1).max(200) }).strict(),
    podeDesfazer: false,
    previa: (a) => `projetar a mídia ${a.id}`,
    executar: async (a, acoes) =>
      (await acoes.projetarMidia(a.id))
        ? { ok: true, mensagem: "Mídia no telão." }
        : { ok: false, mensagem: "Não achei esse arquivo na pasta." },
  }),

  ferramenta({
    nome: "controlar_video",
    apelidos: ["control_video", "media_transport"],
    descricao: "Toca, pausa ou para o vídeo que está no telão.",
    risco: "live",
    entrada: z.object({ acao: z.enum(["tocar", "pausar", "parar"]) }).strict(),
    podeDesfazer: false,
    previa: (a) => `${a.acao} o vídeo do telão`,
    executar: (a, acoes) =>
      acoes.controlarVideo(a.acao)
        ? { ok: true, mensagem: `Vídeo: ${a.acao}.` }
        : { ok: false, mensagem: "Não há vídeo no telão agora." },
  }),

  ferramenta({
    nome: "volume_do_video",
    apelidos: ["set_volume"],
    descricao: "Muda o volume do vídeo do telão, de 0 a 100.",
    risco: "live",
    entrada: z.object({ porcento: z.number().int().min(0).max(100) }).strict(),
    podeDesfazer: false,
    previa: (a) => `pôr o volume em ${a.porcento}%`,
    executar: (a, acoes) =>
      acoes.volumeDoVideo(a.porcento)
        ? { ok: true, mensagem: `Volume em ${a.porcento}%.` }
        : { ok: false, mensagem: "Não há vídeo no telão agora." },
  }),

  ferramenta({
    nome: "repetir_video",
    apelidos: ["loop_video"],
    descricao: "Liga ou desliga o laço do vídeo, para ele recomeçar sozinho.",
    risco: "live",
    entrada: z.object({ ligado: z.boolean() }).strict(),
    podeDesfazer: false,
    previa: (a) => (a.ligado ? "repetir o vídeo em laço" : "parar de repetir o vídeo"),
    executar: (a, acoes) =>
      acoes.repetirVideo(a.ligado)
        ? { ok: true, mensagem: a.ligado ? "Vídeo em laço." : "Laço desligado." }
        : { ok: false, mensagem: "Não há vídeo no telão agora." },
  }),

  // ─────────────────────────── YouTube

  ferramenta({
    nome: "projetar_youtube",
    apelidos: ["project_youtube"],
    descricao: "Projeta um vídeo do YouTube a partir do endereço colado pelo operador.",
    risco: "live",
    entrada: z
      .object({
        endereco: z.string().min(8).max(300),
        titulo: z.string().max(120).default(""),
      })
      .strict(),
    podeDesfazer: false,
    previa: (a) => `projetar o vídeo do YouTube${a.titulo ? ` “${a.titulo}”` : ""}`,
    executar: (a, acoes) =>
      acoes.projetarYoutube(a.endereco, a.titulo)
        ? { ok: true, mensagem: "Vídeo do YouTube preparado no telão." }
        : { ok: false, mensagem: "Não reconheci um vídeo do YouTube nesse endereço." },
  }),

  ferramenta({
    nome: "controlar_youtube",
    apelidos: ["control_youtube"],
    descricao: "Toca, pausa ou para o vídeo do YouTube que está no telão.",
    risco: "live",
    entrada: z.object({ acao: z.enum(["tocar", "pausar", "parar"]) }).strict(),
    podeDesfazer: false,
    previa: (a) => `${a.acao} o vídeo do YouTube`,
    executar: (a, acoes) =>
      acoes.controlarYoutube(a.acao)
        ? { ok: true, mensagem: `YouTube: ${a.acao}.` }
        : { ok: false, mensagem: "Não há vídeo do YouTube no telão." },
  }),

  // ─────────────────────────── Bíblia e telão

  ferramenta({
    nome: "listar_versoes_biblia",
    apelidos: ["list_bible_versions"],
    descricao: "Lista as traduções da Bíblia instaladas, com o id de cada uma.",
    risco: "read",
    entrada: semArgumentos,
    podeDesfazer: false,
    previa: () => "ver as traduções da Bíblia",
    executar: (_a, acoes) => {
      const v = acoes.listarVersoesBiblia();
      return v.length === 0
        ? { ok: false, mensagem: "Nenhuma tradução instalada." }
        : { ok: true, mensagem: `${v.length} tradução(ões).`, dados: v };
    },
  }),

  ferramenta({
    nome: "trocar_versao_biblia",
    apelidos: ["set_bible_version"],
    descricao: "Troca a tradução da Bíblia usada na projeção. Use o id de listar_versoes_biblia.",
    // Muda o texto que a igreja vai ler, e fica guardado.
    risco: "edit",
    entrada: z.object({ id: z.string().min(1).max(60) }).strict(),
    podeDesfazer: true,
    previa: (a) => `passar a projetar a Bíblia na tradução ${a.id}`,
    executar: (a, acoes) =>
      acoes.trocarVersaoBiblia(a.id)
        ? { ok: true, mensagem: "Tradução trocada." }
        : { ok: false, mensagem: "Não achei essa tradução." },
  }),

  ferramenta({
    nome: "tamanho_da_letra",
    apelidos: ["font_scale"],
    descricao: "Aumenta ou diminui a letra no telão. Use 1 para aumentar e -1 para diminuir.",
    // Um passo de letra se desfaz com o passo contrário: não vale interromper
    // o operador para confirmar.
    risco: "live",
    entrada: z.object({ passos: z.number().int().min(-5).max(5) }).strict(),
    podeDesfazer: false,
    previa: (a) => (a.passos > 0 ? "aumentar a letra do telão" : "diminuir a letra do telão"),
    executar: (a, acoes) => {
      if (a.passos === 0) return { ok: false, mensagem: "Diga se é para aumentar ou diminuir." };
      const agora = acoes.tamanhoDaLetra(a.passos);
      return { ok: true, mensagem: `Letra do telão em ${Math.round(agora * 100)}%.` };
    },
  }),

  ferramenta({
    nome: "relogio_no_telao",
    apelidos: ["show_clock"],
    descricao: "Liga ou desliga o relógio no canto do telão.",
    risco: "live",
    entrada: z.object({ ligado: z.boolean() }).strict(),
    podeDesfazer: false,
    previa: (a) => (a.ligado ? "mostrar o relógio no telão" : "tirar o relógio do telão"),
    executar: (a, acoes) => {
      acoes.mostrarRelogio(a.ligado);
      return { ok: true, mensagem: a.ligado ? "Relógio ligado." : "Relógio desligado." };
    },
  }),

  ferramenta({
    nome: "papel_de_parede",
    apelidos: ["show_wallpaper"],
    descricao: "Liga ou desliga o fundo do telão, deixando o texto sobre cor sólida.",
    risco: "live",
    entrada: z.object({ ligado: z.boolean() }).strict(),
    podeDesfazer: false,
    previa: (a) => (a.ligado ? "mostrar o fundo do telão" : "tirar o fundo do telão"),
    executar: (a, acoes) => {
      acoes.mostrarPapelDeParede(a.ligado);
      return { ok: true, mensagem: a.ligado ? "Fundo ligado." : "Fundo desligado." };
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
export async function executarPlano(
  plano: Extract<Plano, { ok: true }>,
  acoes: AcoesIA,
): Promise<ResultadoFerramenta> {
  try {
    return await (
      plano.ferramenta.executar as (
        a: unknown,
        ac: AcoesIA,
      ) => ResultadoFerramenta | Promise<ResultadoFerramenta>
    )(plano.argumentos, acoes);
  } catch {
    // Uma ferramenta que explode não pode derrubar a cabine no meio do culto.
    return { ok: false, mensagem: "Não consegui fazer isso agora." };
  }
}

/**
 * O catálogo em texto, para o modelo saber o que pode pedir.
 *
 * Compacto de propósito. Com contexto de 1024 tokens, uma linha explicada
 * por ferramenta comeria quase tudo antes de o modelo chegar ao pedido — e o
 * que sobra de contexto é o que ele usa para entender o operador.
 *
 * Quem não tem argumento dispensa explicação: `tela_preta` e `proximo_slide`
 * se explicam pelo nome. Quem tem argumento ganha a frase inteira, porque é
 * aí que o modelo erra.
 */
export function catalogoParaModelo(): string {
  const simples: string[] = [];
  const explicadas: string[] = [];
  for (const f of FERRAMENTAS) {
    if (f.entrada === semArgumentos) simples.push(f.nome);
    else explicadas.push(`- ${f.nome}: ${f.descricao}`);
  }
  if (simples.length > 0) explicadas.push(`- sem argumentos: ${simples.join(", ")}`);
  return explicadas.join("\n");
}
