/** Client stub so the desktop bundle does not pull the Start server runtime. */
export function createServerFn(_opts?: unknown) {
  const run = async (_args?: unknown) => ({
    ok: false as const,
    error: "IA e busca na web ficam no Lúmen pela internet. Telão e Bíblia funcionam neste aplicativo.",
    hits: [] as unknown[],
    text: "",
  });
  const chain = {
    validator() {
      return chain;
    },
    handler() {
      return run;
    },
  };
  return chain;
}

export function createMiddleware() {
  return { middleware: () => undefined };
}
