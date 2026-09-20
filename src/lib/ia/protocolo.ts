/**
 * O que o modelo diz, e o que o Lúmen aceita ouvir.
 *
 * Esta é a fronteira. Tudo que vem do modelo é texto — texto de um programa
 * que roda na máquina da igreja, escrito por gente que nunca viu este código,
 * capaz de inventar nome de função, de argumento e de música com a mesma
 * naturalidade com que acerta. Nada daqui é executado: é lido, conferido
 * contra um catálogo fechado e, só então, virado em pedido.
 *
 * Nunca use `eval`, `Function`, `import()` dinâmico ou qualquer coisa que
 * transforme string em código. O modelo não escolhe o que roda; ele escolhe
 * qual dos pedidos que já existem quer fazer, e com quais valores.
 */

/** Um pedido de ferramenta, ainda sem saber se a ferramenta existe. */
export interface PedidoBruto {
  ferramenta: string;
  argumentos: Record<string, unknown>;
}

export type LeituraDoModelo =
  /** O modelo quer usar uma ferramenta. */
  | { tipo: "pedido"; pedido: PedidoBruto; texto: string }
  /** O modelo só respondeu em palavras. */
  | { tipo: "fala"; texto: string }
  /** O modelo quer saber algo antes de agir. */
  | { tipo: "pergunta"; texto: string };

const MAX_TEXTO = 4000;
const MAX_ARGUMENTOS = 20;

/**
 * Acha o JSON no meio do que o modelo escreveu.
 *
 * Modelo pequeno quase nunca responde só o JSON: embrulha em ```json, escreve
 * "Claro! Aqui está:" antes, ou comenta depois. Recusar tudo isso seria jogar
 * fora resposta boa por causa de enfeite.
 *
 * Varre de fora para dentro procurando um objeto que faça sentido, e desiste
 * em silêncio se não achar — não achar JSON é o caso comum quando a pessoa só
 * fez uma pergunta.
 */
export function acharJson(bruto: string): unknown {
  const texto = String(bruto ?? "");
  const cercado = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const corpo = cercado?.[1] ?? texto;
  const inicio = corpo.indexOf("{");
  if (inicio < 0) return null;
  // Do último fecha-chaves para trás: um objeto com objeto dentro tem mais de
  // um "}", e parar no primeiro cortaria o pedido ao meio.
  for (let fim = corpo.lastIndexOf("}"); fim > inicio; fim = corpo.lastIndexOf("}", fim - 1)) {
    try {
      return JSON.parse(corpo.slice(inicio, fim + 1));
    } catch {
      /* tenta um fecha-chaves antes */
    }
  }
  return null;
}

function limparTexto(bruto: unknown): string {
  return String(bruto ?? "")
    // Caractere de controle não tem uso legítimo numa resposta e atrapalha
    // tudo que for mostrado ou registrado depois.
    .split("")
    .filter((c) => c === "\n" || c === "\t" || c.codePointAt(0)! >= 0x20)
    .join("")
    .trim()
    .slice(0, MAX_TEXTO);
}

/**
 * O texto que sobra quando se tira o JSON — é o que a pessoa lê.
 *
 * Sem isto, ou a conversa mostraria chaves e aspas, ou perderia a explicação
 * que o modelo escreveu junto do pedido.
 */
function textoSemJson(bruto: string): string {
  return limparTexto(
    String(bruto ?? "")
      .replace(/```(?:json)?[\s\S]*?```/gi, " ")
      .replace(/\{[\s\S]*\}/, " "),
  );
}

/**
 * Lê a resposta do modelo.
 *
 * Nunca lança: uma resposta truncada, em outro idioma ou sem sentido nenhum
 * é o caso comum com modelo pequeno, e não pode derrubar a cabine no meio de
 * um culto.
 */
export function lerResposta(bruto: string): LeituraDoModelo {
  const texto = limparTexto(bruto);
  const achado = acharJson(bruto);
  if (!achado || typeof achado !== "object" || Array.isArray(achado)) {
    return { tipo: "fala", texto };
  }
  const obj = achado as Record<string, unknown>;

  // "pergunta" antes de "ferramenta": o modelo que pede esclarecimento não
  // deve agir, mesmo que tenha escrito um palpite de ferramenta junto.
  const pergunta = obj.pergunta ?? obj.question;
  if (typeof pergunta === "string" && pergunta.trim()) {
    return { tipo: "pergunta", texto: limparTexto(pergunta) };
  }

  const nome = obj.ferramenta ?? obj.tool ?? obj.acao;
  if (typeof nome !== "string" || !nome.trim()) {
    const resposta = obj.resposta ?? obj.texto ?? obj.answer;
    return { tipo: "fala", texto: typeof resposta === "string" ? limparTexto(resposta) : texto };
  }

  const cru = obj.argumentos ?? obj.arguments ?? obj.args ?? obj.parametros ?? {};
  const argumentos: Record<string, unknown> = {};
  if (cru && typeof cru === "object" && !Array.isArray(cru)) {
    // Teto de argumentos: um modelo em laço pode devolver um objeto enorme, e
    // o que vem depois vai virar mensagem na tela e linha de registro.
    for (const [k, v] of Object.entries(cru).slice(0, MAX_ARGUMENTOS)) argumentos[k] = v;
  }

  return {
    tipo: "pedido",
    pedido: { ferramenta: nome.trim().slice(0, 64), argumentos },
    texto: textoSemJson(bruto),
  };
}
