export interface Drill {
  id: string;
  title: string;
  prompt: string;
  hint: string;
  expect: "bible-rom828" | "black" | "next" | "chorus" | "present";
}

export const DRILLS: Drill[] = [
  {
    id: "rom",
    title: "Pedido do pastor",
    prompt: "Você está operando o culto. O pastor acaba de pedir Romanos 8:28.",
    hint: "Ctrl+K e digite “Rm 8:28”, ou Ctrl+B e toque Romanos.",
    expect: "bible-rom828",
  },
  {
    id: "black",
    title: "Tela preta",
    prompt: "O operador de som pediu tela preta agora.",
    hint: "Tecla B, ou comando “tela preta”.",
    expect: "black",
  },
  {
    id: "next",
    title: "Avançar slide",
    prompt: "A banda terminou o verso. Avance o slide.",
    hint: "Seta direita, Espaço ou “próximo slide”.",
    expect: "next",
  },
  {
    id: "chorus",
    title: "Refrão",
    prompt: "O líder de louvor pediu para voltar ao refrão.",
    hint: "No modo operador toque Coro, ou diga “refrão”.",
    expect: "chorus",
  },
  {
    id: "go",
    title: "Projetar",
    prompt: "O preview está certo. Mande para o telão.",
    hint: "F5 ou o botão Apresentar.",
    expect: "present",
  },
];

export interface DrillResult {
  ok: boolean;
  seconds: number;
  message: string;
}

export function gradeDrill(
  drill: Drill,
  ctx: {
    status: string;
    liveKind?: string;
    liveRef?: string;
    liveTitle?: string;
    liveLabel?: string;
    liveIndex?: number;
    prevIndex?: number;
  },
  elapsedMs: number,
): DrillResult {
  const seconds = Math.round(elapsedMs / 100) / 10;
  let ok = false;
  if (drill.expect === "bible-rom828") {
    ok =
      (ctx.liveKind === "bible" && (ctx.liveRef?.startsWith("45:8:28") ?? false)) ||
      (ctx.liveTitle ?? "").toLowerCase().includes("romanos 8:28");
  } else if (drill.expect === "black") {
    ok = ctx.status === "black";
  } else if (drill.expect === "next") {
    ok = (ctx.liveIndex ?? 0) > (ctx.prevIndex ?? 0) || ctx.status === "presenting";
  } else if (drill.expect === "chorus") {
    const label = (ctx.liveLabel ?? "").toLowerCase();
    ok = label.includes("coro") || label.includes("refr");
  } else if (drill.expect === "present") {
    ok = ctx.status === "presenting";
  }
  return {
    ok,
    seconds,
    message: ok
      ? `Correto em ${seconds.toString().replace(".", ",")}s`
      : "Ainda não. Tente o atalho da dica.",
  };
}
