import { createServerFn } from "@tanstack/react-start";

export type AiSlide = { label?: string; text: string };

export type AiOptimizeResult =
  | { ok: true; slides: AiSlide[] }
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

function asSlides(raw: unknown): AiSlide[] {
  if (!raw || typeof raw !== "object") return [];
  const slides = (raw as { slides?: unknown }).slides;
  if (!Array.isArray(slides)) return [];
  const out: AiSlide[] = [];
  for (const row of slides) {
    if (!row || typeof row !== "object") continue;
    const text = String((row as { text?: unknown }).text ?? "").replace(/\r/g, "").trim();
    if (!text) continue;
    const label = String((row as { label?: unknown }).label ?? "").trim();
    out.push({ label: label || undefined, text });
  }
  return out;
}

export const refineProjectionSlides = createServerFn({ method: "POST" })
  .validator((input: { text: string; kind?: string }) => ({
    text: String(input.text ?? "").trim().slice(0, 6000),
    kind: input.kind === "bible" ? "bible" : input.kind === "text" ? "text" : "song",
  }))
  .handler(async ({ data }): Promise<AiOptimizeResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "IA indisponível neste ambiente" };
    if (data.text.length < 40) return { ok: false, error: "Texto curto demais" };

    const kindLabel =
      data.kind === "bible" ? "versículo bíblico" : data.kind === "text" ? "aviso no telão" : "letra de música";

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.1,
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content:
              "Você formata texto para telão de igreja 16:9. Responda só JSON válido.",
          },
          {
            role: "user",
            content: `Reescreva este ${kindLabel} em slides de projeção.

Regras rígidas:
- NÃO altere, omita, traduza nem adicione palavras. Só quebras de linha.
- 1 ou 2 linhas por slide (3 só se inevitável).
- Cada linha entre 16 e 40 caracteres, se o português permitir.
- Quebre em frases naturais. Não deixe uma linha com uma palavra curta.
- Mantenha juntos: Espírito Santo, Filho unigênito, vida eterna, Jesus Cristo.
- Pontuação original permanece.

Texto:
${data.text}

JSON: {"slides":[{"label":"Verso 1","text":"linha um\\nlinha dois"}]}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return { ok: false, error: `xAI ${res.status}` };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const slides = asSlides(extractJson(body.choices?.[0]?.message?.content ?? ""));
    if (!slides.length) return { ok: false, error: "A IA não devolveu slides" };
    return { ok: true, slides };
  });
