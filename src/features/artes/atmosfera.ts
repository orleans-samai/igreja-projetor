/**
 * A camada que faltava entre o fundo e o texto.
 *
 * Antes, um fundo só sabia ser sólido, degradê ou radial. Trocar a cor de
 * um retângulo chapado não faz uma arte diferente — faz o mesmo cartaz com
 * outra cor, e foi por isso que o acervo parecia todo igual.
 *
 * O que separa um fundo de igreja bonito de um retângulo colorido é sempre
 * a mesma coisa: luz e profundidade. Raio de sol entrando pela lateral,
 * névoa baixa, brasa subindo, uma silhueta de montanha no terço de baixo.
 * São doze tratamentos aqui, desenhados em SVG, e é isso que dá para a
 * mesma paleta render vinte artes diferentes.
 *
 * Regra que governa todos: **o meio da tela fica livre**. Estas artes
 * carregam texto por cima — em cartaz é o tema, no telão é a letra da
 * música. Atmosfera que enche o centro é atmosfera que some debaixo da
 * primeira linha de texto. Por isso tudo acontece nas bordas, nos cantos,
 * no alto ou no rodapé.
 */

/** Um tratamento de luz e profundidade sobre o fundo. */
export type Atmosfera =
  | "nenhuma"
  | "raios"
  | "nevoa"
  | "bokeh"
  | "grao"
  | "vinheta"
  | "aurora"
  | "horizonte"
  | "montanhas"
  | "ondas"
  | "brasa"
  | "malha"
  | "poeira";

export const ATMOSFERAS: readonly Atmosfera[] = [
  "nenhuma",
  "raios",
  "nevoa",
  "bokeh",
  "grao",
  "vinheta",
  "aurora",
  "horizonte",
  "montanhas",
  "ondas",
  "brasa",
  "malha",
  "poeira",
] as const;

export const NOME_ATMOSFERA: Record<Atmosfera, string> = {
  nenhuma: "Sem atmosfera",
  raios: "Raios de luz",
  nevoa: "Névoa",
  bokeh: "Bokeh",
  grao: "Grão de filme",
  vinheta: "Vinheta",
  aurora: "Aurora",
  horizonte: "Horizonte",
  montanhas: "Montanhas",
  ondas: "Ondas",
  brasa: "Brasa",
  malha: "Degradê em malha",
  poeira: "Poeira de luz",
};

/**
 * Quanto do centro cada tratamento ocupa, de 0 a 1.
 *
 * Serve para escolher atmosfera quando a arte é fundo de letra: ali o
 * centro tem que estar vazio, e "vazio" precisa ser um número, não uma
 * opinião.
 */
export const OCUPA_O_CENTRO: Record<Atmosfera, number> = {
  nenhuma: 0,
  vinheta: 0,
  grao: 0.05,
  poeira: 0.1,
  montanhas: 0.1,
  horizonte: 0.15,
  ondas: 0.15,
  brasa: 0.2,
  nevoa: 0.25,
  raios: 0.3,
  bokeh: 0.3,
  aurora: 0.35,
  malha: 0.4,
};

/** As que deixam o meio livre o bastante para uma letra de música. */
export const LIMITE_PARA_LETRA = 0.2;

export function serveParaLetra(a: Atmosfera): boolean {
  return OCUPA_O_CENTRO[a] <= LIMITE_PARA_LETRA;
}

function nAleatorio(semente: number): number {
  const x = Math.sin(semente * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Cor hex com alfa, no formato que o SVG entende. */
function comAlfa(cor: string, alfa: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(String(cor || ""));
  if (!m) return `rgba(255,255,255,${alfa})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

export interface PinturaDeAtmosfera {
  /** O que entra no `<defs>` — gradientes e filtros, com ids únicos. */
  defs: string;
  /** O que é desenhado, na ordem em que vem. */
  corpo: string;
}

const VAZIA: PinturaDeAtmosfera = { defs: "", corpo: "" };

/**
 * Desenha a atmosfera.
 *
 * `id` prefixa todo gradiente e filtro. Sem isso, duas camadas na mesma
 * arte disputariam o mesmo `id="g"` e a segunda venceria — que é o tipo de
 * defeito que só aparece quando alguém junta dois elementos.
 *
 * @param clara quando o fundo é claro: a luz passa a escurecer em vez de
 *              clarear, senão o efeito some no papel branco.
 */
export function pintarAtmosfera(
  a: Atmosfera,
  L: number,
  A: number,
  cor: string,
  semente: number,
  id: string,
  clara = false,
): PinturaDeAtmosfera {
  const luz = clara ? "#0b0d12" : "#ffffff";
  const r = (n: number) => nAleatorio(semente + n);

  switch (a) {
    case "nenhuma":
      return VAZIA;

    case "raios": {
      // Um leque de faixas saindo de um ponto alto, fora do quadro. É o
      // efeito de sol entrando por uma janela alta — que é literalmente a
      // luz de um templo.
      const ox = L * (0.16 + r(1) * 0.16);
      const oy = -A * 0.12;
      const feixes = Array.from({ length: 7 }, (_, i) => {
        const ang = -0.5 + (i / 6) * 1.5 + r(i + 2) * 0.06;
        const larg = L * (0.045 + r(i + 20) * 0.05);
        const alcance = A * 1.5;
        const px = ox + Math.sin(ang) * alcance;
        const py = oy + Math.cos(ang) * alcance;
        const op = 0.05 + r(i + 40) * 0.09;
        return (
          `<polygon points="${ox.toFixed(1)},${oy.toFixed(1)} ` +
          `${(px - larg).toFixed(1)},${py.toFixed(1)} ${(px + larg).toFixed(1)},${py.toFixed(1)}" ` +
          `fill="${comAlfa(luz, op)}"/>`
        );
      }).join("");
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(L * 0.02).toFixed(1)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${feixes}</g>`,
      };
    }

    case "nevoa": {
      // Faixas baixas e largas, só no terço de baixo: névoa que sobe do
      // chão nunca cobre o rosto de quem está no palco.
      const faixas = Array.from({ length: 3 }, (_, i) => {
        const cy = A * (0.72 + i * 0.1);
        const rx = L * (0.7 + r(i) * 0.3);
        const ry = A * (0.07 + r(i + 5) * 0.05);
        return (
          `<ellipse cx="${(L * (0.3 + r(i + 9) * 0.4)).toFixed(1)}" cy="${cy.toFixed(1)}" ` +
          `rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${comAlfa(luz, 0.09 + r(i + 3) * 0.06)}"/>`
        );
      }).join("");
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(A * 0.045).toFixed(1)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${faixas}</g>`,
      };
    }

    case "bokeh": {
      // Círculos desfocados nas bordas. O centro recebe só os pequenos, e
      // bem apagados, para não competir com o texto.
      const bolas = Array.from({ length: 16 }, (_, i) => {
        const bx = r(i) * L;
        const by = r(i + 30) * A;
        const meio = Math.abs(bx / L - 0.5) < 0.22 && Math.abs(by / A - 0.5) < 0.22;
        const raio = (meio ? 0.012 : 0.02 + r(i + 60) * 0.045) * L;
        const op = (meio ? 0.05 : 0.1 + r(i + 90) * 0.14) * 1;
        return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${raio.toFixed(1)}" fill="${comAlfa(cor, op)}"/>`;
      }).join("");
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(L * 0.012).toFixed(1)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${bolas}</g>`,
      };
    }

    case "grao": {
      // Grão de filme. Disfarça a faixa que todo degradê grande cria em
      // projetor barato, e é o que separa "degradê de editor" de "imagem".
      return {
        defs:
          `<filter id="${id}g"><feTurbulence type="fractalNoise" baseFrequency="0.85" ` +
          `numOctaves="3" seed="${Math.floor(semente % 100)}"/>` +
          `<feColorMatrix type="saturate" values="0"/></filter>`,
        corpo:
          `<rect x="0" y="0" width="${L}" height="${A}" filter="url(#${id}g)" ` +
          `opacity="0.07" style="mix-blend-mode:overlay"/>`,
      };
    }

    case "vinheta": {
      return {
        defs:
          `<radialGradient id="${id}v" cx="50%" cy="48%" r="72%">` +
          `<stop offset="55%" stop-color="rgba(0,0,0,0)"/>` +
          `<stop offset="100%" stop-color="rgba(0,0,0,0.55)"/></radialGradient>`,
        corpo: `<rect x="0" y="0" width="${L}" height="${A}" fill="url(#${id}v)"/>`,
      };
    }

    case "aurora": {
      // Duas fitas largas atravessando o alto, como céu de madrugada.
      const fita = (i: number, op: number) => {
        const y = A * (0.1 + i * 0.16);
        const h = A * (0.16 + r(i) * 0.1);
        return (
          `<path d="M -${L * 0.1} ${y.toFixed(1)} ` +
          `C ${(L * 0.3).toFixed(1)} ${(y - h).toFixed(1)}, ${(L * 0.7).toFixed(1)} ${(y + h).toFixed(1)}, ` +
          `${(L * 1.1).toFixed(1)} ${(y - h * 0.3).toFixed(1)} ` +
          `L ${(L * 1.1).toFixed(1)} ${(y + h).toFixed(1)} L -${L * 0.1} ${(y + h * 1.4).toFixed(1)} Z" ` +
          `fill="${comAlfa(i === 0 ? luz : cor, op)}"/>`
        );
      };
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(A * 0.05).toFixed(1)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${fita(0, 0.16)}${fita(1, 0.2)}</g>`,
      };
    }

    case "horizonte": {
      // Uma linha de luz no terço de baixo, com brilho por cima dela. É o
      // amanhecer, e é o enquadramento mais usado em fundo de louvor.
      const y = A * (0.66 + r(1) * 0.08);
      return {
        defs:
          `<linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0%" stop-color="${comAlfa(cor, 0)}"/>` +
          `<stop offset="100%" stop-color="${comAlfa(cor, 0.5)}"/></linearGradient>` +
          `<filter id="${id}b"><feGaussianBlur stdDeviation="${(A * 0.02).toFixed(1)}"/></filter>`,
        corpo:
          `<rect x="0" y="${(y - A * 0.3).toFixed(1)}" width="${L}" height="${(A * 0.3).toFixed(1)}" fill="url(#${id}h)"/>` +
          `<rect x="0" y="${y.toFixed(1)}" width="${L}" height="${(A * 0.006).toFixed(1)}" ` +
          `fill="${comAlfa(luz, 0.55)}" filter="url(#${id}b)"/>`,
      };
    }

    case "montanhas": {
      // Silhuetas em camadas no rodapé. Dá escala e profundidade sem tocar
      // no centro — o texto continua pousando no vazio de cima.
      const camada = (i: number) => {
        const base = A * (0.84 - i * 0.07);
        const alt = A * (0.1 + r(i) * 0.08);
        const meio = L * (0.2 + r(i + 4) * 0.6);
        return (
          `<path d="M 0 ${A} L 0 ${base.toFixed(1)} ` +
          `L ${(meio - L * 0.25).toFixed(1)} ${(base - alt * 0.4).toFixed(1)} ` +
          `L ${meio.toFixed(1)} ${(base - alt).toFixed(1)} ` +
          `L ${(meio + L * 0.3).toFixed(1)} ${(base - alt * 0.3).toFixed(1)} ` +
          `L ${L} ${(base - alt * 0.5).toFixed(1)} L ${L} ${A} Z" ` +
          `fill="rgba(0,0,0,${(0.22 + i * 0.16).toFixed(2)})"/>`
        );
      };
      return { defs: "", corpo: `${camada(0)}${camada(1)}${camada(2)}` };
    }

    case "ondas": {
      const onda = (i: number) => {
        const y = A * (0.7 + i * 0.075);
        const amp = A * (0.02 + r(i) * 0.02);
        return (
          `<path d="M 0 ${y.toFixed(1)} ` +
          `Q ${(L * 0.25).toFixed(1)} ${(y - amp).toFixed(1)} ${(L * 0.5).toFixed(1)} ${y.toFixed(1)} ` +
          `T ${L} ${y.toFixed(1)} L ${L} ${A} L 0 ${A} Z" ` +
          `fill="${comAlfa(i % 2 ? luz : cor, 0.1 + i * 0.05)}"/>`
        );
      };
      return { defs: "", corpo: `${onda(0)}${onda(1)}${onda(2)}` };
    }

    case "brasa": {
      // Pontinhos quentes subindo do rodapé, mais densos embaixo.
      const fagulhas = Array.from({ length: 34 }, (_, i) => {
        const px = r(i) * L;
        const alturaRelativa = Math.pow(r(i + 50), 1.8);
        const py = A - alturaRelativa * A * 0.85;
        const raio = L * (0.0016 + r(i + 80) * 0.004);
        const op = 0.25 + (1 - alturaRelativa) * 0.55;
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${raio.toFixed(2)}" fill="${comAlfa(cor, op)}"/>`;
      }).join("");
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(L * 0.0035).toFixed(2)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${fagulhas}</g>`,
      };
    }

    case "malha": {
      // Três manchas de cor bem desfocadas, nos cantos. É o degradê em
      // malha que toda identidade moderna usa, e que um gradiente linear
      // de duas paradas nunca alcança.
      const mancha = (i: number) => {
        const cx = L * (i === 0 ? 0.12 : i === 1 ? 0.88 : 0.5);
        const cy = A * (i === 0 ? 0.16 : i === 1 ? 0.4 : 0.92);
        const raio = Math.max(L, A) * (0.34 + r(i) * 0.16);
        return (
          `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${raio.toFixed(1)}" ` +
          `fill="${comAlfa(i === 1 ? luz : cor, 0.3 - i * 0.06)}"/>`
        );
      };
      return {
        defs: `<filter id="${id}b"><feGaussianBlur stdDeviation="${(Math.max(L, A) * 0.12).toFixed(1)}"/></filter>`,
        corpo: `<g filter="url(#${id}b)">${mancha(0)}${mancha(1)}${mancha(2)}</g>`,
      };
    }

    case "poeira": {
      // Partículas finas espalhadas, densas nas bordas. O centro recebe
      // pouquíssimas, e é de propósito.
      const graos = Array.from({ length: 60 }, (_, i) => {
        const px = r(i) * L;
        const py = r(i + 200) * A;
        const meio = Math.abs(px / L - 0.5) < 0.24 && Math.abs(py / A - 0.5) < 0.24;
        if (meio && r(i + 400) > 0.25) return "";
        const raio = L * (0.0008 + r(i + 300) * 0.0022);
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${raio.toFixed(2)}" fill="${comAlfa(luz, 0.15 + r(i + 500) * 0.35)}"/>`;
      }).join("");
      return { defs: "", corpo: graos };
    }
  }
}
