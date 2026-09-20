import { catalogoParaModelo } from "./ferramentas.ts";

/**
 * O que o modelo ouve, e o que ele nunca deve ouvir.
 *
 * Duas responsabilidades, e as duas importam. A primeira é montar a
 * instrução: um modelo pequeno acerta muito mais quando o pedido é curto,
 * literal e em português, com a lista do que existe logo ali.
 *
 * A segunda é o filtro. Nada de senha, chave ou token entra no prompt — nem
 * na conversa, nem no registro. Se o operador digitar uma senha, a intenção
 * é reconhecida e o valor fica de fora: quem pede senha abre formulário,
 * não manda o segredo para um modelo.
 */

export interface Fala {
  papel: "usuario" | "assistente";
  texto: string;
}

export interface MensagemModelo {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Quantas falas de trás vão junto. Contexto curto é o que o PC aguenta. */
export const LEMBRANCA = 6;

/**
 * O orçamento de contexto, em tokens.
 *
 * Tem que bater com CONTEXTO_PADRAO e MAX_TOKENS_RESPOSTA em desktop/ia.cjs —
 * há um teste de cada lado conferindo, porque os dois arquivos não se falam
 * (um é CommonJS do processo principal, o outro é a janela).
 *
 * A conta que importa: instrução + histórico + resposta tem que caber. Se a
 * instrução crescer além disso, o modelo passa a esquecer o começo da
 * conversa — e a saída é encurtar descrição de ferramenta, não aumentar o
 * contexto, que sai da memória da projeção.
 */
export const ORCAMENTO = {
  contexto: 2048,
  resposta: 320,
  /** Estimativa grosseira do que cada fala guardada ocupa. */
  tokensPorFala: 60,
  /** Português em UTF-8 dá mais ou menos isto por token. */
  caracteresPorToken: 4,
};

/** Quantos caracteres a instrução pode ter sem apertar a conversa. */
export function tetoDaInstrucao(): number {
  const sobra =
    ORCAMENTO.contexto - ORCAMENTO.resposta - LEMBRANCA * ORCAMENTO.tokensPorFala;
  return sobra * ORCAMENTO.caracteresPorToken;
}

export const AVISO_PRIVACIDADE = "Assistente local — nenhum dado é enviado para a internet";

/**
 * Frases que costumam vir acompanhadas de um segredo.
 *
 * Não é para bloquear o assunto: "como coloco senha no controle remoto?" é
 * pergunta legítima. É para reconhecer quando o valor veio junto, porque é
 * esse valor que não pode viajar.
 */
const PEDE_SEGREDO =
  /\b(senha|palavra-passe|password|pin|token|chave de acesso|api[\s-]?key|credencial)\b/i;

/** O valor colado depois da palavra: "senha: abc123", "senha é abc123". */
const VALOR_DO_SEGREDO =
  /\b(senha|password|pin|token|api[\s-]?key|credencial)\b\s*(?:é|eh|=|:|->|será|vai ser)?\s*["'“]?([^\s"'”]{3,})["'”]?/gi;

export interface Peneirada {
  /** O texto que pode ir ao modelo. */
  texto: string;
  /** Se algo foi tirado — a tela avisa, em vez de mandar calada. */
  tirouSegredo: boolean;
}

/**
 * Tira o segredo antes de o texto sair da janela.
 *
 * Substitui o valor, não a frase: o modelo continua entendendo que se falou
 * de senha — e portanto pode responder "abro o formulário?" — sem nunca ver
 * qual é.
 */
export function peneirarSegredos(bruto: string): Peneirada {
  const texto = String(bruto ?? "");
  if (!PEDE_SEGREDO.test(texto)) return { texto, tirouSegredo: false };
  let tirou = false;
  const limpo = texto.replace(VALOR_DO_SEGREDO, (inteiro, palavra, valor) => {
    // "qual a senha?" não tem valor para tirar; "senha abc123" tem.
    if (!valor || /^(do|da|de|no|na|para|pra|é|eh|dele|dela|nova|antiga)$/i.test(valor)) {
      return inteiro;
    }
    tirou = true;
    return `${palavra} [não enviada]`;
  });
  return { texto: limpo, tirouSegredo: tirou };
}

/**
 * A instrução do sistema.
 *
 * Curta de propósito. Cada linha a mais é contexto que um modelo de 0.6B
 * gasta antes de chegar ao pedido, e num PC de igreja esse contexto é tempo
 * que o operador espera olhando para a tela.
 */
export function instrucao(): string {
  return [
    "Você é o assistente do Lúmen, um programa de projeção para cultos.",
    "Responda sempre em português do Brasil, curto e direto.",
    "",
    "Você pode pedir UMA destas ações, e nenhuma outra:",
    catalogoParaModelo(),
    "",
    "Para pedir uma ação, responda SOMENTE um JSON:",
    '{"ferramenta":"nome_da_acao","argumentos":{}}',
    "",
    "Para responder uma pergunta, escreva a resposta em texto normal.",
    'Em dúvida sobre o que a pessoa quer, pergunte: {"pergunta":"sua pergunta aqui"}',
    "",
    "Regras:",
    "- Nunca invente música, versículo, id, tema ou playlist que não vieram de uma busca.",
    "- Para projetar uma música, primeiro use buscar_musica e use o id que voltar.",
    "- Se não souber, diga que não sabe. Não chute.",
    "- Nunca peça nem repita senhas.",
  ].join("\n");
}

/**
 * Monta as mensagens que vão ao modelo.
 *
 * Só as últimas falas: a conversa inteira não cabe no contexto, e o que
 * importa num culto é o que se acabou de pedir.
 */
export function montarMensagens(historico: readonly Fala[], pergunta: string): MensagemModelo[] {
  const recentes = historico.slice(-LEMBRANCA);
  return [
    { role: "system", content: instrucao() },
    ...recentes.map(
      (f): MensagemModelo => ({
        role: f.papel === "usuario" ? "user" : "assistant",
        content: f.texto,
      }),
    ),
    { role: "user", content: pergunta },
  ];
}
