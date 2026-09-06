/**
 * Local natural-language copilot for the cabine.
 * Parses Portuguese operator speech/typed commands instantly.
 * Ambiguous queries fall through to AI (copilot-ai.ts) only when asked.
 */

import { parseBibleRef } from "./bible-ref.ts";
import { fold } from "./fold.ts";

export type CopilotIntent =
  | { type: "bible"; query: string; present: boolean }
  | { type: "next" }
  | { type: "prev" }
  | { type: "black" }
  | { type: "logo" }
  | { type: "clear" }
  | { type: "stop" }
  | { type: "present" }
  | { type: "section"; label: string }
  | { type: "nextItem" }
  | { type: "prepareNext" }
  | { type: "countdown"; seconds: number; label: string }
  | { type: "overlay"; delta: number }
  | { type: "optimize" }
  | { type: "emergency" }
  | { type: "liveMode"; on: boolean }
  | { type: "undo" }
  | { type: "song"; query: string; present: boolean }
  | { type: "search"; query: string }
  | { type: "alert"; text: string }
  | { type: "unknown"; query: string };

const NUM: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
};

function stripDecor(raw: string): string {
  return raw
    .replace(/\bna\s+(nvi|ntlh|arc|ara|aa|almeida)\b/gi, "")
    .replace(/\b(nvi|ntlh|arc|ara|almeida)\b/gi, "")
    .replace(
      /\b(por favor|pfv|agora|ai|aí|copiloto|lumen|lúmen)\b/gi,
      "",
    )
    .replace(/[.?!,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBible(raw: string): string | null {
  const cleaned = stripDecor(raw)
    .replace(
      /\b(coloque|coloca|abra|abre|projetar|projete|projetar|mostre|mostra|prepare|carregue|puxe|jogue|joga)\b/gi,
      "",
    )
    .replace(/\b(o|a|os|as)?\s*(versiculo|versículo|passagem|texto)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (parseBibleRef(cleaned)) return cleaned;
  if (parseBibleRef(raw)) return raw;
  const m = raw.match(
    /([1-3]?\s*[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]+)?\s+\d+[.:]\d+(?:\s*[-–]\s*\d+)?)/,
  );
  if (m && parseBibleRef(m[1])) return m[1].trim();
  const loose = raw.match(/([1-3]?\s*[A-Za-zÀ-ÿ]{2,}\s+\d+\s+\d+)/);
  if (loose && parseBibleRef(loose[1])) return loose[1].trim();
  return null;
}

function parseMinutes(q: string): number | null {
  const digits = q.match(/(\d+)\s*(min|minuto)/);
  if (digits) return Number(digits[1]) * 60;
  const secs = q.match(/(\d+)\s*(s|seg)/);
  if (secs) return Number(secs[1]);
  for (const [word, n] of Object.entries(NUM)) {
    if (q.includes(word + " minuto") || q.includes(word + " min")) return n * 60;
  }
  return null;
}

export function parseCommand(raw: string): CopilotIntent {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "unknown", query: raw };
  const q = fold(stripDecor(trimmed));

  if (/^(emergencia|emergência|sos|panic)/.test(q) || q.includes("modo emergencia")) {
    return { type: "emergency" };
  }
  if (/otimiz/.test(q) || q.includes("corrigir slide") || q.includes("corrigir letra")) {
    return { type: "optimize" };
  }
  if (q.includes("desfazer") || q === "undo" || q.includes("voltar atras") || q.includes("voltar atrás")) {
    return { type: "undo" };
  }
  if (
    q.includes("modo operador") ||
    q.includes("modo culto") ||
    q.includes("sair da cabine avancada")
  ) {
    return { type: "liveMode", on: true };
  }
  if (q.includes("voltar a cabine") || q.includes("modo console") || q.includes("sair do modo operador")) {
    return { type: "liveMode", on: false };
  }

  if (
    /tela preta/.test(q) ||
    q === "preto" ||
    q === "black" ||
    q === "escurece" ||
    q.includes("tela negra")
  ) {
    return { type: "black" };
  }
  if (q === "logo" || q.includes("mostra logo") || q.includes("logo da igreja")) {
    return { type: "logo" };
  }
  if (q.includes("ocultar texto") || q === "fundo" || q.includes("esconder letra")) {
    return { type: "clear" };
  }
  if (q === "parar" || q === "stop" || q.includes("encerrar apresent") || q === "esc") {
    return { type: "stop" };
  }

  if (q.includes("fundo mais escuro") || q.includes("deixa o fundo mais escuro") || q.includes("escurecer fundo")) {
    return { type: "overlay", delta: 0.12 };
  }
  if (q.includes("fundo mais claro") || q.includes("clarear fundo") || q.includes("menos overlay")) {
    return { type: "overlay", delta: -0.12 };
  }

  if (q.includes("contagem") || q.includes("countdown") || q.includes("cronometro") || q.includes("cronômetro")) {
    const seconds = parseMinutes(q) ?? 300;
    return { type: "countdown", seconds, label: "Início do culto" };
  }

  if (
    q.includes("prepare a proxima") ||
    q.includes("prepare a próxima") ||
    q.includes("prepara a proxima") ||
    q.includes("carregar proxima") ||
    q.includes("prepare a proxima musica")
  ) {
    return { type: "prepareNext" };
  }
  if (
    q.includes("proxima musica") ||
    q.includes("próxima música") ||
    q.includes("proximo item") ||
    q.includes("próximo item")
  ) {
    return { type: "nextItem" };
  }

  if (
    q.includes("volte para o refrao") ||
    q.includes("voltar para o refrao") ||
    q.includes("volta o refrao") ||
    q === "refrao" ||
    q === "refrão" ||
    q === "coro" ||
    q.includes("repetir refrao") ||
    q.includes("repetir coro")
  ) {
    return { type: "section", label: "coro" };
  }
  if (q === "ponte" || q.includes("vai para a ponte") || q.includes("repetir ponte")) {
    return { type: "section", label: "ponte" };
  }
  const versoN = q.match(/verso\s*(\d+)/);
  if (versoN) return { type: "section", label: `verso ${versoN[1]}` };
  if (q === "verso" || q.includes("voltar ao verso") || q.includes("repetir verso")) {
    return { type: "section", label: "verso" };
  }
  if (q === "final" || q.includes("vai para o final")) {
    return { type: "section", label: "final" };
  }

  if (
    q === "proximo" ||
    q === "próximo" ||
    q.includes("proximo slide") ||
    q.includes("próximo slide") ||
    q === "avanca" ||
    q === "avança" ||
    q === "frente"
  ) {
    return { type: "next" };
  }
  if (
    q === "anterior" ||
    q === "voltar" ||
    q.includes("slide anterior") ||
    q === "volta"
  ) {
    return { type: "prev" };
  }

  if (q === "apresentar" || q === "projetar" || q === "vai" || q === "play" || q.includes("manda para o telao")) {
    return { type: "present" };
  }

  const alertM = trimmed.match(/^(alerta|aviso de rodape|rodapé)[:\s]+(.+)/i);
  if (alertM) return { type: "alert", text: alertM[2].trim() };

  const bible = extractBible(trimmed);
  if (bible) {
    const present = !/prepare|carregue|so o preview|só o preview/.test(q);
    return { type: "bible", query: bible, present };
  }

  const songLead = trimmed.match(
    /^(?:projetar|coloque|coloca|toca|tocar|abre|abra|busca|buscar)\s+(?:a\s+m[uú]sica\s+)?(.+)$/i,
  );
  if (songLead && songLead[1].trim().length >= 2) {
    return { type: "song", query: songLead[1].trim(), present: !q.startsWith("busca") };
  }
  if (q.includes("musica que fala") || q.includes("música que fala") || q.includes("cancao sobre") || q.includes("canção sobre")) {
    const rest = trimmed.replace(/.*(?:fala|sobre)\s+/i, "").trim();
    return { type: "search", query: rest || trimmed };
  }

  if (trimmed.length >= 2) return { type: "search", query: trimmed };
  return { type: "unknown", query: trimmed };
}

export function describeIntent(intent: CopilotIntent): string {
  switch (intent.type) {
    case "bible":
      return intent.present ? `Projetar ${intent.query}` : `Preparar ${intent.query}`;
    case "next":
      return "Próximo slide";
    case "prev":
      return "Slide anterior";
    case "black":
      return "Tela preta";
    case "logo":
      return "Logo da igreja";
    case "clear":
      return "Ocultar texto";
    case "stop":
      return "Parar apresentação";
    case "present":
      return "Apresentar o preview";
    case "section":
      return `Ir para ${intent.label}`;
    case "nextItem":
      return "Próximo item da playlist";
    case "prepareNext":
      return "Preparar próxima música";
    case "countdown":
      return `Contagem de ${Math.round(intent.seconds / 60)} min`;
    case "overlay":
      return intent.delta > 0 ? "Fundo mais escuro" : "Fundo mais claro";
    case "optimize":
      return "Otimizar apresentação";
    case "emergency":
      return "Modo emergência";
    case "liveMode":
      return intent.on ? "Entrar no modo operador" : "Voltar à cabine";
    case "undo":
      return "Desfazer último passo do culto";
    case "song":
      return `${intent.present ? "Projetar" : "Buscar"} “${intent.query}”`;
    case "search":
      return `Buscar “${intent.query}”`;
    case "alert":
      return `Alerta: ${intent.text}`;
    default:
      return "Não entendi — tente um versículo, música ou comando";
  }
}

export function intentIsImmediate(intent: CopilotIntent): boolean {
  return intent.type !== "unknown" && intent.type !== "search" && intent.type !== "song";
}
