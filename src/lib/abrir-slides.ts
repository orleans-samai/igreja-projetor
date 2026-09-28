/**
 * Quem abre as apresentações: a escolha do menu Slides da cabine.
 *
 * O Lúmen seguia sempre a mesma ordem — PowerPoint, senão LibreOffice,
 * senão o próprio desenho. A igreja pediu para escolher: o LibreOffice
 * mesmo tendo o Office, ou só o Lúmen, sem abrir programa nenhum. O
 * escolhido vai na frente e os outros ficam de reserva, porque escolher um
 * programa não pode deixar o culto sem os slides quando ele falta ou recusa
 * o arquivo. Quando a reserva é que desenha, a cabine diz quem foi e por quê.
 */

export type QuemAbreSlides = "automatico" | "office" | "libreoffice" | "lumen";

export const QUEM_ABRE_PADRAO: QuemAbreSlides = "automatico";

/** As opções do menu, na ordem em que aparecem. */
export const OPCOES_DE_ABERTURA: readonly { valor: QuemAbreSlides; rotulo: string; ajuda: string }[] = [
  { valor: "automatico", rotulo: "Automático", ajuda: "Office; sem ele, LibreOffice; sem os dois, o Lúmen" },
  { valor: "office", rotulo: "Office (PowerPoint)", ajuda: "Sai igual ao PowerPoint" },
  { valor: "libreoffice", rotulo: "LibreOffice", ajuda: "Gratuito, quase igual ao PowerPoint" },
  { valor: "lumen", rotulo: "O próprio Lúmen", ajuda: "Sem abrir programa nenhum; só .pptx e .ppsx" },
];

/** O que veio do disco, de uma versão antiga ou de mão errada, vira uma escolha que existe. */
export function quemAbreValido(valor: unknown): QuemAbreSlides {
  return valor === "office" || valor === "libreoffice" || valor === "lumen" ? valor : QUEM_ABRE_PADRAO;
}

/** Quem vai na frente no processo principal: só o LibreOffice muda a ordem de lá. */
export function primeiroConversor(quem: QuemAbreSlides): "powerpoint" | "libreoffice" {
  return quem === "libreoffice" ? "libreoffice" : "powerpoint";
}

const NOME_DE_QUEM: Record<Exclude<QuemAbreSlides, "automatico">, "PowerPoint" | "LibreOffice" | "Lúmen"> = {
  office: "PowerPoint",
  libreoffice: "LibreOffice",
  lumen: "Lúmen",
};

/**
 * O aviso de quando quem desenhou não foi o escolhido, ou nada.
 *
 * No automático não há o que avisar: qualquer um que desenhe está certo.
 *
 * @param motivo por que o escolhido não desenhou — do processo principal
 *   ("O LibreOffice não está instalado…") ou do desenho do Lúmen.
 */
export function avisoDaEscolha(
  quem: QuemAbreSlides,
  desenhou: "PowerPoint" | "LibreOffice" | "Lúmen",
  motivo?: string,
): string | undefined {
  if (quem === "automatico") return undefined;
  const escolhido = NOME_DE_QUEM[quem];
  if (escolhido === desenhou) return undefined;
  const porque = motivo ? `${motivo} ` : "";
  return `${porque}Desenhada pelo ${desenhou} no lugar do ${escolhido}, que está escolhido no menu Slides.`;
}
