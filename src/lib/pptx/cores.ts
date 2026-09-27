import { descer, filho, numero, type No } from "./xml.ts";

/**
 * As cores de um PowerPoint.
 *
 * Quase nenhuma cor de um slide é escrita por extenso: o texto é "Texto 1",
 * o fundo é "Destaque 1, 25% mais escuro". O nome passa pelo mapa do
 * mestre (Texto 1 → Escuro 1), pelo tema (Escuro 1 → preto) e pelas
 * transformações (mais claro, mais escuro, transparente). Errar um passo
 * desses é o slide azul que sai cinza — por isso cada passo segue o que o
 * PowerPoint faz, e os testes conferem com as contas dele.
 */

export interface Rgba {
  /** 0 a 255. */
  r: number;
  g: number;
  b: number;
  /** 0 a 1. */
  a: number;
}

export interface Tema {
  cores: Record<string, Rgba>;
  fonteTitulo: string;
  fonteCorpo: string;
  /** As listas de estilo do tema, que `fillRef`, `lnRef` e `bgRef` apontam por número. */
  preenchimentos: No[];
  linhas: No[];
  efeitos: No[];
  fundos: No[];
}

export type MapaDeCores = Record<string, string>;

export interface ContextoDeCor {
  tema: Tema;
  mapa: MapaDeCores;
  /** A cor do "phClr": a que um `fillRef`/`fontRef` entrega ao estilo do tema. */
  phClr?: Rgba | null;
}

export const NOMES_DE_COR = ["srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr", "hslClr"] as const;

export const MAPA_PADRAO: MapaDeCores = {
  bg1: "lt1",
  tx1: "dk1",
  bg2: "lt2",
  tx2: "dk2",
  accent1: "accent1",
  accent2: "accent2",
  accent3: "accent3",
  accent4: "accent4",
  accent5: "accent5",
  accent6: "accent6",
  hlink: "hlink",
  folHlink: "folHlink",
};

function hex(v: string): Rgba | null {
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16), a: 1 };
}

/** O tema do Office, para o arquivo que não traz o seu. */
export const TEMA_PADRAO: Tema = {
  cores: Object.fromEntries(
    Object.entries({
      dk1: "000000",
      lt1: "FFFFFF",
      dk2: "44546A",
      lt2: "E7E6E6",
      accent1: "4472C4",
      accent2: "ED7D31",
      accent3: "A5A5A5",
      accent4: "FFC000",
      accent5: "5B9BD5",
      accent6: "70AD47",
      hlink: "0563C1",
      folHlink: "954F72",
    }).map(([k, v]) => [k, hex(v) as Rgba]),
  ),
  fonteTitulo: "Calibri Light",
  fonteCorpo: "Calibri",
  preenchimentos: [],
  linhas: [],
  efeitos: [],
  fundos: [],
};

// As cores com nome do DrawingML são as do CSS; o PowerPoint só abrevia
// "dark", "light" e "medium" (dkBlue, ltGray, medPurple).
const NOMEADAS = new Map(
  (
    "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 " +
    "black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 " +
    "chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff " +
    "darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 " +
    "darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 " +
    "darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f " +
    "darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 " +
    "dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc " +
    "ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 " +
    "honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa " +
    "lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff " +
    "lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 " +
    "lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 " +
    "lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 " +
    "mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 " +
    "mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 " +
    "midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 " +
    "oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa " +
    "palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f " +
    "pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 red ff0000 rosybrown bc8f8f royalblue 4169e1 " +
    "saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 " +
    "skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f " +
    "steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee " +
    "wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
  )
    .split(" ")
    .reduce<[string, string][]>((pares, v, i, todos) => (i % 2 ? pares : [...pares, [v, todos[i + 1]]]), []),
);

function nomeada(nome: string): Rgba | null {
  const n = nome
    .replace(/^dk/, "dark")
    .replace(/^lt/, "light")
    .replace(/^med/, "medium")
    .toLowerCase();
  const v = NOMEADAS.get(n);
  return v ? hex(v) : null;
}

// ─────────────────────────────────────────────── contas de cor

function paraLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function deLinear(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
}

function paraHsl({ r, g, b }: Rgba): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
}

function deHsl(h: number, s: number, l: number, a: number): Rgba {
  const H = (((h % 360) + 360) % 360) / 360;
  const S = Math.max(0, Math.min(1, s));
  const L = Math.max(0, Math.min(1, l));
  if (S === 0) return { r: L * 255, g: L * 255, b: L * 255, a };
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const canal = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: canal(H + 1 / 3) * 255, g: canal(H) * 255, b: canal(H - 1 / 3) * 255, a };
}

/**
 * As transformações que vêm dentro do elemento da cor, na ordem em que
 * aparecem. "Mais claro 40%" é `lumMod 60% + lumOff 40%` na luminância
 * HSL; tint e shade misturam com branco e preto na luz linear, como o
 * PowerPoint (e o LibreOffice, que copia as contas dele).
 */
function transformar(base: Rgba, mods: No[]): Rgba {
  let c = { ...base };
  for (const m of mods) {
    const v = numero(m, "val", 0) / 100000;
    switch (m.nome) {
      case "alpha":
        c.a = v;
        break;
      case "alphaMod":
        c.a *= v;
        break;
      case "alphaOff":
        c.a += v;
        break;
      case "lumMod":
      case "lumOff":
      case "satMod":
      case "satOff":
      case "hueMod":
      case "hueOff": {
        let [h, s, l] = paraHsl(c);
        if (m.nome === "lumMod") l *= v;
        else if (m.nome === "lumOff") l += v;
        else if (m.nome === "satMod") s *= v;
        else if (m.nome === "satOff") s += v;
        else if (m.nome === "hueMod") h *= v;
        else h += numero(m, "val", 0) / 60000;
        c = deHsl(h, s, l, c.a);
        break;
      }
      case "tint":
        c = {
          r: deLinear(paraLinear(c.r) * v + (1 - v)),
          g: deLinear(paraLinear(c.g) * v + (1 - v)),
          b: deLinear(paraLinear(c.b) * v + (1 - v)),
          a: c.a,
        };
        break;
      case "shade":
        c = { r: deLinear(paraLinear(c.r) * v), g: deLinear(paraLinear(c.g) * v), b: deLinear(paraLinear(c.b) * v), a: c.a };
        break;
      case "inv":
        c = { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a };
        break;
      case "gray": {
        const y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        c = { r: y, g: y, b: y, a: c.a };
        break;
      }
      case "comp": {
        const [h, s, l] = paraHsl(c);
        c = deHsl(h + 180, s, l, c.a);
        break;
      }
      default:
        break;
    }
  }
  c.a = Math.max(0, Math.min(1, c.a));
  return c;
}

/** A cor de um elemento de cor (`a:srgbClr`, `a:schemeClr`…), já transformada. */
export function corDe(no: No | null | undefined, ctx: ContextoDeCor): Rgba | null {
  if (!no) return null;
  let base: Rgba | null = null;
  switch (no.nome) {
    case "srgbClr":
      base = hex(no.attrs.val ?? "");
      break;
    case "sysClr":
      base = hex(no.attrs.lastClr ?? "") ?? (no.attrs.val === "window" ? hex("FFFFFF") : hex("000000"));
      break;
    case "prstClr":
      base = nomeada(no.attrs.val ?? "");
      break;
    case "scrgbClr":
      base = {
        r: deLinear(numero(no, "r", 0) / 100000),
        g: deLinear(numero(no, "g", 0) / 100000),
        b: deLinear(numero(no, "b", 0) / 100000),
        a: 1,
      };
      break;
    case "hslClr":
      base = deHsl(numero(no, "hue", 0) / 60000, numero(no, "sat", 0) / 100000, numero(no, "lum", 0) / 100000, 1);
      break;
    case "schemeClr": {
      const val = no.attrs.val ?? "";
      if (val === "phClr") base = ctx.phClr ? { ...ctx.phClr } : null;
      else {
        const nome = ctx.mapa[val] ?? val;
        base = ctx.tema.cores[nome] ?? TEMA_PADRAO.cores[nome] ?? null;
      }
      break;
    }
    default:
      return null;
  }
  return base ? transformar(base, no.filhos) : null;
}

/** A primeira cor dentro de um elemento (o `a:solidFill`, o `a:gs`, o `a:fontRef`). */
export function corDentro(no: No | null | undefined, ctx: ContextoDeCor): Rgba | null {
  if (!no) return null;
  for (const f of no.filhos) if ((NOMES_DE_COR as readonly string[]).includes(f.nome)) return corDe(f, ctx);
  return null;
}

export function css(c: Rgba): string {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round(c.a * 1000) / 1000})`;
}

/** O mapa de cores do mestre (`p:clrMap`), ou o do Office. */
export function lerMapa(no: No | null | undefined): MapaDeCores {
  if (!no) return { ...MAPA_PADRAO };
  return { ...MAPA_PADRAO, ...no.attrs };
}

/** O tema de `ppt/theme/themeN.xml`: cores, fontes e listas de estilo. */
export function lerTema(raiz: No | null | undefined): Tema {
  const elementos = descer(raiz, "themeElements");
  if (!elementos) return TEMA_PADRAO;
  const cores: Record<string, Rgba> = { ...TEMA_PADRAO.cores };
  const esquema = filho(elementos, "clrScheme");
  const semTema: ContextoDeCor = { tema: TEMA_PADRAO, mapa: MAPA_PADRAO };
  for (const f of esquema?.filhos ?? []) {
    const c = corDentro(f, semTema);
    if (c) cores[f.nome] = c;
  }
  const fontes = filho(elementos, "fontScheme");
  const latina = (qual: string) => descer(fontes, qual, "latin")?.attrs.typeface || "";
  const formato = filho(elementos, "fmtScheme");
  return {
    cores,
    fonteTitulo: latina("majorFont") || TEMA_PADRAO.fonteTitulo,
    fonteCorpo: latina("minorFont") || TEMA_PADRAO.fonteCorpo,
    preenchimentos: filho(formato, "fillStyleLst")?.filhos ?? [],
    linhas: filho(formato, "lnStyleLst")?.filhos ?? [],
    efeitos: filho(formato, "effectStyleLst")?.filhos ?? [],
    fundos: filho(formato, "bgFillStyleLst")?.filhos ?? [],
  };
}
