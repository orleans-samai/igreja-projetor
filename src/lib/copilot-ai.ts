import { createServerFn } from "@tanstack/react-start";
import type { CopilotIntent } from "./copilot.ts";

export type CopilotAiResult =
  | { ok: true; intent: CopilotIntent }
  | { ok: false; error: string };

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

const ALLOWED = new Set([
  "bible",
  "next",
  "prev",
  "black",
  "logo",
  "clear",
  "stop",
  "present",
  "section",
  "nextItem",
  "prepareNext",
  "countdown",
  "overlay",
  "optimize",
  "emergency",
  "liveMode",
  "undo",
  "song",
  "search",
  "alert",
  "unknown",
]);

function asIntent(raw: unknown, fallback: string): CopilotIntent {
  if (!raw || typeof raw !== "object") return { type: "unknown", query: fallback };
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? "");
  if (!ALLOWED.has(type)) return { type: "search", query: fallback };
  switch (type) {
    case "bible":
      return { type: "bible", query: String(o.query ?? fallback), present: o.present !== false };
    case "section":
      return { type: "section", label: String(o.label ?? "coro") };
    case "countdown":
      return {
        type: "countdown",
        seconds: Math.max(30, Number(o.seconds) || 300),
        label: String(o.label ?? "Início do culto"),
      };
    case "overlay":
      return { type: "overlay", delta: Number(o.delta) || 0.1 };
    case "liveMode":
      return { type: "liveMode", on: o.on !== false };
    case "song":
      return { type: "song", query: String(o.query ?? fallback), present: o.present !== false };
    case "search":
      return { type: "search", query: String(o.query ?? fallback) };
    case "alert":
      return { type: "alert", text: String(o.text ?? fallback) };
    case "unknown":
      return { type: "unknown", query: fallback };
    default:
      return { type: type as CopilotIntent["type"] } as CopilotIntent;
  }
}

export const interpretCopilot = createServerFn({ method: "POST" })
  .validator((input: { query: string; catalog: string }) => ({
    query: String(input.query ?? "").trim().slice(0, 280),
    catalog: String(input.catalog ?? "").slice(0, 1200),
  }))
  .handler(async ({ data }): Promise<CopilotAiResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "IA indisponível neste ambiente" };
    if (data.query.length < 3) return { ok: false, error: "Comando curto demais" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content:
                "Você é o copiloto da cabine Lúmen (projeção de culto). Responda SOMENTE um JSON de intent.",
            },
            {
              role: "user",
              content: `Comando do operador: "${data.query}"

Catálogo de músicas (título — artista):
${data.catalog || "(vazio)"}

Tipos permitidos:
bible {query, present}, song {query, present}, search {query},
next, prev, black, logo, clear, stop, present,
section {label}, nextItem, prepareNext,
countdown {seconds, label}, overlay {delta},
optimize, emergency, liveMode {on}, undo, alert {text}, unknown {query}

Regras:
- Versículo (João 3:16, Rm 8.28, sl 23) → bible present:true
- "prepare" sem projetar → present:false
- Refrão/coro → section label "coro"
- Música pelo título aproximado → song
- Tema/letra ("música que fala graça") → search
JSON:`,
            },
          ],
        }),
      });
      if (!res.ok) return { ok: false, error: `xAI ${res.status}` };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      return { ok: true, intent: asIntent(extractJson(text), data.query) };
    } catch {
      return { ok: false, error: "Copiloto ocupado — use o comando local" };
    } finally {
      clearTimeout(timer);
    }
  });
