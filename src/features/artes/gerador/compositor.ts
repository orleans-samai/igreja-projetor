import type { Analise, Briefing, ImagemDoUsuario, PreferenciaDeIntensidade } from "../briefing.ts";
import type { Categoria } from "../catalogo/categorias.ts";
import { comAlfa, contrasteDeLuz, distancia, luminancia, melhorContraste, misturar } from "../catalogo/cores.ts";
import { ladrilho } from "../catalogo/formas.ts";
import { ilustracaoComoUrl, type CoresDoDesenho, type Ilustracao } from "../catalogo/ilustracoes.ts";
import type { Paleta } from "../catalogo/paletas.ts";
import type { ConjuntoTipografico, EstiloDeTexto } from "../catalogo/tipografia.ts";
import { todasAsCamadas } from "../documento.ts";
import type {
  Alinhamento,
  Camada,
  CamadaForma,
  CamadaImagem,
  CamadaTexto,
  Mascara,
  Papel,
  Preenchimento,
  Protecao,
  TipoDeTextura,
} from "../documento.ts";
import type { Conteudo } from "./conteudo.ts";
import { ajustar, escalonar, type Medidor } from "./texto.ts";

/**
 * O compositor: as ferramentas com que cada variante monta a arte.
 *
 * Uma variante diz *onde* as coisas ficam; o compositor sabe *como* pôr cada
 * coisa lá sem estragar — foto recortada pelo ponto focal, logo sem esticar,
 * texto no maior tamanho que cabe, cor de texto escolhida pelo que está
 * embaixo dele. Se um texto não cabe, a variante recebe `null` e desiste:
 * quem decide trocar de desenho é o gerador, nunca o compositor encolhendo
 * letra até sumir.
 */

export type Proporcao = "quadrado" | "retrato" | "vertical" | "paisagem";

export function proporcaoDe(largura: number, altura: number): Proporcao {
  const r = largura / altura;
  if (r > 1.25) return "paisagem";
  if (r < 0.7) return "vertical";
  if (r < 0.9) return "retrato";
  return "quadrado";
}

export interface Ret {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Visual =
  | { tipo: "foto"; id: string; foto: ImagemDoUsuario; indice: number }
  | { tipo: "ilustracao"; id: string; il: Ilustracao };

export interface Ambiente {
  L: number;
  A: number;
  prop: Proporcao;
  /** 1% do menor lado: a régua de tudo que é tamanho. */
  u: number;
  /** Margem de segurança em px. */
  m: number;
  /** A área segura: nada de texto fora dela. */
  seg: Ret;
  paleta: Paleta;
  tipo: ConjuntoTipografico;
  categoria: Categoria;
  briefing: Briefing;
  conteudo: Conteudo;
  analise: Analise;
  intensidade: PreferenciaDeIntensidade;
  /** Imagens desta opção, na ordem de preferência. */
  visuais: Visual[];
  /** Ilustrações do assunto, para apoio e ícones. */
  apoios: Ilustracao[];
  r: () => number;
  medidor: Medidor;
  semente: number;
}

export interface ItemDeTexto {
  papel: Papel;
  nome: string;
  campo?: string;
  texto: string;
  estilo: EstiloDeTexto;
  max: number;
  min: number;
  linhas: number;
  /** Cor fixa; sem ela, a cor sai do papel e do que está embaixo. */
  cor?: string;
  /** Espaço antes deste item, em px. */
  antes?: number;
  opcional?: boolean;
  alinhamento?: Alinhamento;
}

export interface Sob {
  tipo: "cor" | "foto" | "ilustracao";
  cor: string | null;
  luz: number;
  camadaId: string | null;
}

export function dentro(r: Ret, margem = 0): Ret {
  return { x: r.x + margem, y: r.y + margem, w: r.w - margem * 2, h: r.h - margem * 2 };
}

export function intersecao(a: Ret, b: Ret): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function retDe(c: { x: number; y: number; largura: number; altura: number }): Ret {
  return { x: c.x, y: c.y, w: c.largura, h: c.altura };
}

export function coresDoDesenho(p: Paleta, sobreClaro: boolean): CoresDoDesenho {
  return {
    a: p.destaque,
    b: sobreClaro ? p.superficie : p.acento,
    p: sobreClaro ? misturar(p.fundo, "#ffffff", 0.6) : misturar(p.texto, p.fundo, 0.1),
    // Em fundo escuro a tinta clareia: óculos, calendário e linhas de
    // caderno são desenhados quase só com ela, e sumiriam no escuro.
    e: sobreClaro ? p.texto : misturar(p.texto, p.fundo, 0.3),
    t: p.acento,
  };
}

export class Compositor {
  readonly amb: Ambiente;
  camadas: Camada[] = [];
  avisos: string[] = [];
  private contador = 0;
  /** Quantas vezes cada imagem foi usada nesta arte. */
  usadas = new Map<string, number>();

  constructor(amb: Ambiente) {
    this.amb = amb;
  }

  private id(prefixo: string): string {
    this.contador += 1;
    return `${prefixo}-${this.contador}`;
  }

  get p(): Paleta {
    return this.amb.paleta;
  }

  get t(): ConjuntoTipografico {
    return this.amb.tipo;
  }

  // ───────────────────────────── formas

  fundo(preenchimento: Preenchimento): void {
    this.camadas.unshift({
      tipo: "fundo",
      id: "fundo",
      nome: "Fundo",
      papel: "fundo",
      x: 0,
      y: 0,
      largura: this.amb.L,
      altura: this.amb.A,
      rotacao: 0,
      opacidade: 1,
      preenchimento,
    });
  }

  bloco(
    r: Ret,
    preenchimento: Preenchimento | string | null,
    o: { raio?: number; papel?: Papel; nome?: string; opacidade?: number; rotacao?: number; opcional?: boolean; contorno?: CamadaForma["contorno"] } = {},
  ): CamadaForma {
    const c: CamadaForma = {
      tipo: "forma",
      id: this.id(o.papel === "painel" ? "painel" : "forma"),
      nome: o.nome ?? (o.papel === "painel" ? "Painel" : "Forma"),
      papel: o.papel ?? "decoracao",
      forma: "retangulo",
      x: r.x,
      y: r.y,
      largura: r.w,
      altura: r.h,
      rotacao: o.rotacao ?? 0,
      opacidade: o.opacidade ?? 1,
      preenchimento: typeof preenchimento === "string" ? { tipo: "solido", cor: preenchimento } : preenchimento,
      raio: o.raio ?? 0,
      contorno: o.contorno,
      opcional: o.opcional ?? o.papel !== "painel",
    };
    this.camadas.push(c);
    return c;
  }

  circulo(r: Ret, cor: string | null, o: { papel?: Papel; nome?: string; opacidade?: number; contorno?: CamadaForma["contorno"] } = {}): CamadaForma {
    const c: CamadaForma = {
      tipo: "forma",
      id: this.id("circulo"),
      nome: o.nome ?? "Círculo",
      papel: o.papel ?? "decoracao",
      forma: "elipse",
      x: r.x,
      y: r.y,
      largura: r.w,
      altura: r.h,
      rotacao: 0,
      opacidade: o.opacidade ?? 1,
      preenchimento: cor ? { tipo: "solido", cor } : null,
      contorno: o.contorno,
      opcional: o.papel !== "painel",
    };
    this.camadas.push(c);
    return c;
  }

  caminho(
    r: Ret,
    d: string,
    cor: string | null,
    o: { papel?: Papel; nome?: string; opacidade?: number; rotacao?: number; contorno?: CamadaForma["contorno"] } = {},
  ): CamadaForma {
    const c: CamadaForma = {
      tipo: "forma",
      id: this.id("caminho"),
      nome: o.nome ?? "Forma",
      papel: o.papel ?? "decoracao",
      forma: "caminho",
      d,
      x: r.x,
      y: r.y,
      largura: r.w,
      altura: r.h,
      rotacao: o.rotacao ?? 0,
      opacidade: o.opacidade ?? 1,
      preenchimento: cor ? { tipo: "solido", cor } : null,
      contorno: o.contorno,
      opcional: o.papel !== "painel",
    };
    this.camadas.push(c);
    return c;
  }

  /** Linha reta: horizontal, vertical ou inclinada, em px. */
  linha(x1: number, y1: number, x2: number, y2: number, cor: string, espessura: number, o: { nome?: string; opacidade?: number; tracejado?: number[] } = {}): CamadaForma {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.max(1, Math.abs(x2 - x1));
    const h = Math.max(1, Math.abs(y2 - y1));
    const c: CamadaForma = {
      tipo: "forma",
      id: this.id("linha"),
      nome: o.nome ?? "Linha",
      papel: "decoracao",
      forma: "linha",
      pontos: [(x1 - x) / w, (y1 - y) / h, (x2 - x) / w, (y2 - y) / h],
      x,
      y,
      largura: w,
      altura: h,
      rotacao: 0,
      opacidade: o.opacidade ?? 1,
      preenchimento: null,
      contorno: { cor, espessura, tracejado: o.tracejado },
      opcional: true,
    };
    this.camadas.push(c);
    return c;
  }

  textura(r: Ret, textura: TipoDeTextura, cor: string, escala: number, opacidade: number, nome = "Textura"): void {
    this.camadas.push({
      tipo: "textura",
      id: this.id("textura"),
      nome,
      papel: "textura",
      textura,
      cor,
      escala,
      src: ladrilho(textura, cor, escala, opacidade),
      x: r.x,
      y: r.y,
      largura: r.w,
      altura: r.h,
      rotacao: 0,
      opacidade: 1,
      opcional: true,
    });
  }

  // ───────────────────────────── imagens

  /**
   * Uma imagem na caixa.
   *
   * Foto cobre a caixa e é recortada em volta do ponto focal — o rosto não
   * sai do quadro. Ilustração é contida: encolhe até caber inteira, alinhada
   * como a variante pediu, porque desenho cortado ao meio parece erro.
   */
  visual(
    r: Ret,
    v: Visual,
    o: {
      mascara?: Mascara;
      alinhar?: { x: number; y: number };
      protecao?: Protecao;
      papel?: Papel;
      nome?: string;
      rotacao?: number;
      contorno?: { cor: string; espessura: number };
      sombra?: boolean;
      /** Aproximação da foto: 1 = o recorte mínimo que cobre; 1.3 = mais perto. */
      zoom?: number;
      sobreClaro?: boolean;
      /** `false` usa exatamente a ilustração pedida, sem trocar pelo formato. */
      ajustar?: boolean;
    } = {},
  ): { camada: CamadaImagem; ret: Ret } {
    if (v.tipo === "ilustracao" && o.ajustar !== false) v = this.ilustracaoPara(r, v);
    this.usadas.set(v.id, (this.usadas.get(v.id) ?? 0) + 1);
    const base = {
      tipo: "imagem" as const,
      rotacao: o.rotacao ?? 0,
      opacidade: 1,
      mascara: o.mascara ?? { tipo: "retangulo" as const, raio: 0 },
      contorno: o.contorno,
      sombra: o.sombra ? { cor: "#000000", desfoque: this.amb.u * 2.4, x: 0, y: this.amb.u * 0.8, opacidade: 0.22 } : undefined,
    };
    if (v.tipo === "foto") {
      const f = v.foto;
      const zoom = Math.max(1, o.zoom ?? 1);
      // Recorte com a proporção da caixa, o maior possível, centrado no foco.
      const razaoCaixa = r.w / r.h;
      const razaoFoto = f.largura / f.altura;
      let w = 1;
      let h = 1;
      if (razaoFoto > razaoCaixa) w = razaoCaixa / razaoFoto;
      else h = razaoFoto / razaoCaixa;
      w /= zoom;
      h /= zoom;
      const x = Math.min(1 - w, Math.max(0, f.pontoFocal.x - w / 2));
      const y = Math.min(1 - h, Math.max(0, f.pontoFocal.y - h / 2));
      const camada: CamadaImagem = {
        ...base,
        id: this.id("imagem"),
        nome: o.nome ?? f.nome ?? "Foto",
        papel: o.papel ?? "imagem",
        src: f.src,
        recursoId: v.id,
        origem: "usuario",
        larguraOriginal: f.largura,
        alturaOriginal: f.altura,
        recorte: { x, y, largura: w, altura: h },
        pontoFocal: f.pontoFocal,
        protecao: o.protecao,
        x: r.x,
        y: r.y,
        largura: r.w,
        altura: r.h,
      };
      // Resolução: quantos px da foto viram um px da arte.
      const ampliacao = r.w / (w * f.largura);
      if (ampliacao > 1.25) {
        this.avisos.push(
          `A foto “${f.nome}” aparece ${Math.round(ampliacao * 100)}% ampliada nesta arte e pode sair sem nitidez. ` +
            "Uma foto maior resolve; exportar em tamanho maior não recupera detalhe.",
        );
      }
      this.camadas.push(camada);
      return { camada, ret: r };
    }
    const il = v.il;
    const escala = Math.min(r.w / il.largura, r.h / il.altura);
    const w = il.largura * escala;
    const h = il.altura * escala;
    const al = o.alinhar ?? { x: 0.5, y: 0.5 };
    const ret = { x: r.x + (r.w - w) * al.x, y: r.y + (r.h - h) * al.y, w, h };
    const sobreClaro = o.sobreClaro ?? luminancia(this.sob(ret).cor ?? this.p.fundo) > 0.35;
    const camada: CamadaImagem = {
      ...base,
      id: this.id("ilustracao"),
      nome: o.nome ?? il.nome,
      papel: o.papel ?? "ilustracao",
      src: ilustracaoComoUrl(il, coresDoDesenho(this.p, sobreClaro)),
      recursoId: il.id,
      origem: "catalogo",
      larguraOriginal: il.largura,
      alturaOriginal: il.altura,
      recorte: { x: 0, y: 0, largura: 1, altura: 1 },
      pontoFocal: il.pontoFocal,
      x: ret.x,
      y: ret.y,
      largura: ret.w,
      altura: ret.h,
    };
    this.camadas.push(camada);
    return { camada, ret };
  }

  /**
   * A ilustração do assunto que melhor ocupa a região.
   *
   * Cena larga numa coluna alta vira miniatura perdida no meio do painel;
   * objeto solto numa faixa larga fica pequeno e sozinho. A preferida da
   * opção entra na frente, e só perde para uma de formato bem melhor —
   * sempre entre as do assunto do evento, nunca uma qualquer.
   */
  ilustracaoPara(r: Ret, preferida: Extract<Visual, { tipo: "ilustracao" }>): Extract<Visual, { tipo: "ilustracao" }> {
    const lista: Ilustracao[] = [preferida.il];
    for (const v of this.amb.visuais) if (v.tipo === "ilustracao" && !lista.includes(v.il)) lista.push(v.il);
    for (const il of this.amb.apoios) if (!lista.includes(il)) lista.push(il);
    const razao = r.w / Math.max(1, r.h);
    const fracao = (r.w * r.h) / (this.amb.L * this.amb.A);
    let melhor = preferida.il;
    let nota = Infinity;
    lista.slice(0, 12).forEach((il, i) => {
      let n = Math.abs(Math.log(razao / (il.largura / il.altura))) * 1.2 + i * 0.12;
      if (fracao < 0.06 && il.tipo === "cena") n += 1.5;
      if (fracao > 0.2 && il.tipo === "icone") n += 0.6;
      if (this.usadas.has(il.id)) n += 2;
      if (n < nota) {
        nota = n;
        melhor = il;
      }
    });
    return melhor === preferida.il ? preferida : { tipo: "ilustracao", id: melhor.id, il: melhor };
  }

  /** Uma cor da paleta que não se confunda com a vizinha. */
  corDiferenteDe(vizinha: string): string {
    const p = this.p;
    return [p.destaque, p.fundo2, p.acento, p.texto].find((x) => distancia(x, vizinha) > 28) ?? p.fundo2;
  }

  /**
   * A logo, inteira e na proporção dela.
   *
   * Se ela não contrasta com o que está embaixo (logo escura em fundo
   * escuro), ganha uma plaquinha da cor que contrasta — nunca é recolorida:
   * a logo é da igreja, não da arte.
   */
  logo(r: Ret, alinhar: { x: number; y: number } = { x: 0, y: 0.5 }): Ret | null {
    const lg = this.amb.briefing.logo;
    if (!lg) return null;
    const escala = Math.min(r.w / lg.largura, r.h / lg.altura);
    const w = lg.largura * escala;
    const h = lg.altura * escala;
    const ret = { x: r.x + (r.w - w) * alinhar.x, y: r.y + (r.h - h) * alinhar.y, w, h };
    const sob = this.sob(ret);
    let placa: { cor: string; raio: number; margem: number } | undefined;
    if (contrasteDeLuz(lg.luz, sob.luz) < 2.2 || sob.tipo === "foto") {
      const cor = lg.luz > 0.5 ? melhorContraste("#ffffff", [this.p.superficie, this.p.texto, "#161616"]) : melhorContraste("#000000", [this.p.fundo, this.p.superficie, "#fbfaf7"]);
      placa = { cor, raio: h * 0.18, margem: h * 0.16 };
    }
    this.camadas.push({
      tipo: "logo",
      id: "logo",
      nome: "Logo",
      papel: "logo",
      src: lg.src,
      larguraOriginal: lg.largura,
      alturaOriginal: lg.altura,
      manterProporcao: true,
      placa,
      x: ret.x,
      y: ret.y,
      largura: ret.w,
      altura: ret.h,
      rotacao: 0,
      opacidade: 1,
    });
    return ret;
  }

  /**
   * Agrupa o que `montar` puser na arte e gira o grupo em torno do centro.
   *
   * Um cartão de colagem é papel, foto e fita — girados juntos, arrastados
   * juntos no editor. As camadas são postas soltas (com a cor calculada pelo
   * que está embaixo delas) e só depois viram filhos do grupo.
   */
  grupo(nome: string, graus: number, montar: () => boolean): boolean {
    const inicio = this.camadas.length;
    if (!montar()) return false;
    const filhos = this.camadas.splice(inicio);
    if (filhos.length === 0) return true;
    let caixa: Ret = { x: filhos[0].x, y: filhos[0].y, w: filhos[0].largura, h: filhos[0].altura };
    for (const f of filhos) caixa = uniao(caixa, { x: f.x, y: f.y, w: f.largura, h: f.altura });
    const pos = girarNoCentro(caixa, graus);
    this.camadas.push({
      tipo: "grupo",
      id: this.id("grupo"),
      nome,
      papel: "decoracao",
      x: pos.x,
      y: pos.y,
      largura: caixa.w,
      altura: caixa.h,
      rotacao: graus,
      opacidade: 1,
      opcional: filhos.every((f) => f.opcional),
      filhos: filhos.map((f) => ({ ...f, x: f.x - caixa.x, y: f.y - caixa.y })) as Camada[],
    });
    return true;
  }

  // ───────────────────────────── o que está embaixo

  /**
   * O que fica embaixo de um retângulo: a cor, ou a luz da foto.
   *
   * Percorre as camadas de cima para baixo e fica com a primeira que cobre
   * o centro do retângulo com tinta cheia. Foto responde com a luminância
   * média daquele pedaço (do mapa de luz medido na importação), já contando
   * a proteção que a variante pôs.
   */
  sob(r: Ret, ignorar?: string): Sob {
    return sobDe(this.camadas, r, this.p, this.amb.briefing, ignorar);
  }

  /** A cor de texto para um papel, lendo o que está embaixo. */
  corPara(papel: Papel, r: Ret, tamanho = 0): string {
    const s = this.sob(r);
    const p = this.p;
    if (s.tipo === "foto") return contrasteDeLuz(1, s.luz) >= contrasteDeLuz(luminancia("#141414"), s.luz) ? "#ffffff" : "#141414";
    const fundo = s.cor ?? p.fundo;
    const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    let desejada: string;
    if (igual(fundo, p.superficie)) desejada = p.textoSobreSuperficie;
    else if (igual(fundo, p.destaque)) desejada = p.textoSobreDestaque;
    else if (papel === "kicker" || papel === "data") desejada = p.destaque;
    else if (papel === "info" || papel === "mensagem" || papel === "organizacao") desejada = p.textoSuave;
    else desejada = p.texto;
    // O mínimo depende do corpo, não do papel: data miúda precisa de
    // 4,5:1 como qualquer informação.
    const minimo = tamanho >= Math.min(this.amb.L, this.amb.A) * 0.04 ? 3 : 4.5;
    if (contrasteDeLuz(luminancia(desejada), luminancia(fundo)) >= minimo) return desejada;
    return melhorContraste(fundo, [p.texto, p.textoSobreSuperficie, p.textoSobreDestaque, "#ffffff", "#141414"]);
  }

  // ───────────────────────────── texto

  /** Ajusta sem pôr na arte: para a variante decidir antes. */
  medir(item: ItemDeTexto, largura: number, altura = Infinity) {
    return ajustar(
      {
        texto: item.texto,
        estilo: item.estilo,
        larguraMax: largura,
        alturaMax: altura,
        tamanhoMax: item.max,
        tamanhoMin: item.min,
        maxLinhas: item.linhas,
      },
      this.amb.medidor,
    );
  }

  /** Põe um texto já ajustado na arte. */
  private porTexto(item: ItemDeTexto, x: number, y: number, larguraCaixa: number, alinhamento: Alinhamento, tamanho: number, linhas: string[], larguraTinta: number): Ret {
    const altura = linhas.length * tamanho * item.estilo.entrelinha;
    const folga = Math.max(4, tamanho * 0.06);
    const w = Math.min(larguraCaixa, larguraTinta + folga);
    const xTinta = alinhamento === "left" ? x : alinhamento === "right" ? x + larguraCaixa - w : x + (larguraCaixa - w) / 2;
    const ret = { x: xTinta, y, w, h: altura };
    const camada: CamadaTexto = {
      tipo: "texto",
      id: this.idDoTexto(item),
      nome: item.nome,
      papel: item.papel,
      campo: item.campo,
      texto: item.texto,
      quebras: linhas.join("\n"),
      fonte: item.estilo.fonte,
      peso: item.estilo.peso,
      estilo: item.estilo.estilo,
      // Arredonda para baixo: para cima, a linha passaria da caixa.
      tamanho: Math.floor(tamanho * 10) / 10,
      entrelinha: item.estilo.entrelinha,
      espacamento: Math.round(item.estilo.espacamento * tamanho * 100) / 100,
      alinhamento,
      alinhamentoVertical: "top",
      cor: item.cor ?? this.corPara(item.papel, ret, tamanho),
      maiusculas: item.estilo.maiusculas,
      x: ret.x,
      y: ret.y,
      largura: ret.w,
      altura: ret.h,
      rotacao: 0,
      opacidade: 1,
      opcional: item.opcional ?? (item.papel !== "titulo"),
    };
    this.camadas.push(camada);
    return ret;
  }

  private idDoTexto(item: ItemDeTexto): string {
    const base = item.papel === "titulo" ? "titulo" : item.campo ? `texto-${item.campo}` : `texto-${item.papel}`;
    return this.camadas.some((c) => c.id === base) ? this.id(base) : base;
  }

  /** Um texto sozinho numa caixa. `null` se não couber. */
  texto(r: Ret, item: ItemDeTexto, o: { alinhamento?: Alinhamento; vertical?: "top" | "middle" | "bottom" } = {}): Ret | null {
    const a = this.medir(item, r.w, r.h);
    if (!a) return null;
    const vert = o.vertical ?? "top";
    const y = vert === "top" ? r.y : vert === "bottom" ? r.y + r.h - a.altura : r.y + (r.h - a.altura) / 2;
    return this.porTexto(item, r.x, y, r.w, o.alinhamento ?? item.alinhamento ?? "left", a.tamanho, a.linhas, a.largura);
  }

  /**
   * Uma pilha de textos numa caixa, de cima para baixo.
   *
   * Tenta todos no tamanho máximo; se a pilha não cabe na altura, encolhe
   * primeiro o título (até o mínimo dele), depois o resto, de pouco em
   * pouco. Se nem assim couber, devolve `null` — e a variante sai do lote.
   */
  pilha(
    r: Ret,
    itens: (ItemDeTexto | null)[],
    o: { alinhamento?: Alinhamento; vertical?: "top" | "middle" | "bottom"; espaco?: number } = {},
  ): Ret | null {
    if (r.w <= 0 || r.h <= 0) return null;
    const lista = itens.filter((i): i is ItemDeTexto => !!i && !!i.texto.trim());
    if (lista.length === 0) return { ...r, h: 0 };
    const maximos = lista.map((i) => i.max);
    const espaco = o.espaco ?? this.amb.u * 1.8;
    for (let volta = 0; volta < 30; volta++) {
      const ajustes = lista.map((it, k) => this.medir({ ...it, max: maximos[k] }, r.w));
      if (ajustes.some((a) => !a)) return null;
      const alturas = ajustes.map((a) => a!.altura);
      const vaos = lista.map((it, k) => (k === 0 ? 0 : it.antes ?? espaco));
      const total = alturas.reduce((s, h) => s + h, 0) + vaos.reduce((s, v) => s + v, 0);
      if (total <= r.h) {
        const vert = o.vertical ?? "top";
        let y = vert === "top" ? r.y : vert === "bottom" ? r.y + r.h - total : r.y + (r.h - total) / 2;
        let ocupado: Ret | null = null;
        lista.forEach((it, k) => {
          y += vaos[k];
          const a = ajustes[k]!;
          const ret = this.porTexto(it, r.x, y, r.w, it.alinhamento ?? o.alinhamento ?? "left", a.tamanho, a.linhas, a.largura);
          ocupado = ocupado ? uniao(ocupado, ret) : ret;
          y += a.altura;
        });
        return ocupado;
      }
      // Encolhe quem ainda pode: o título primeiro, que é o que mais ocupa.
      let mexeu = false;
      const ordem = lista.map((_, k) => k).sort((a, b) => (lista[a].papel === "titulo" ? -1 : 0) - (lista[b].papel === "titulo" ? -1 : 0));
      for (const k of ordem) {
        if (maximos[k] > lista[k].min * 1.001) {
          maximos[k] = Math.max(lista[k].min, maximos[k] * 0.92);
          mexeu = true;
          if (lista[k].papel === "titulo" || volta > 12) break;
        }
      }
      if (!mexeu) return null;
    }
    return null;
  }

  /**
   * Um texto girado 90°, lendo de baixo para cima, numa faixa em pé.
   *
   * O Konva gira em torno do canto de cima à esquerda da caixa; por isso a
   * camada nasce com o canto no pé da faixa — girada, ela sobe.
   */
  textoGirado(r: Ret, item: ItemDeTexto): Ret | null {
    const a = this.medir(item, r.h, r.w);
    if (!a) return null;
    const folga = Math.max(4, a.tamanho * 0.06);
    const largura = Math.min(r.h, a.largura + folga);
    const camada: CamadaTexto = {
      tipo: "texto",
      id: this.idDoTexto(item),
      nome: item.nome,
      papel: item.papel,
      campo: item.campo,
      texto: item.texto,
      quebras: a.linhas.join("\n"),
      fonte: item.estilo.fonte,
      peso: item.estilo.peso,
      estilo: item.estilo.estilo,
      tamanho: Math.floor(a.tamanho * 10) / 10,
      entrelinha: item.estilo.entrelinha,
      espacamento: Math.round(item.estilo.espacamento * a.tamanho * 100) / 100,
      alinhamento: "left",
      alinhamentoVertical: "top",
      cor: item.cor ?? this.corPara(item.papel, { x: r.x, y: r.y + r.h - largura, w: a.altura, h: largura }, a.tamanho),
      maiusculas: item.estilo.maiusculas,
      x: r.x,
      y: r.y + r.h,
      largura,
      altura: a.altura,
      rotacao: -90,
      opacidade: 1,
      opcional: item.opcional ?? item.papel !== "titulo",
    };
    this.camadas.push(camada);
    return { x: r.x, y: r.y + r.h - largura, w: a.altura, h: largura };
  }

  /** Título em linhas escalonadas, cada uma enchendo a largura. */
  tituloEscalonado(r: Ret, linhasMax: number, alinhamento: Alinhamento = "left"): Ret | null {
    const est = this.t.titulo;
    const partes = escalonar(this.amb.conteudo.titulo, est, r.w, this.amb.u * 5, this.amb.u * 22, linhasMax, this.amb.medidor);
    if (!partes) return null;
    const alturas = partes.map((p) => p.tamanho * est.entrelinha);
    const total = alturas.reduce((s, h) => s + h, 0);
    if (total > r.h) return null;
    let y = r.y;
    let ocupado: Ret | null = null;
    partes.forEach((p, k) => {
      const item: ItemDeTexto = {
        papel: "titulo",
        nome: k === 0 ? "Título" : `Título, linha ${k + 1}`,
        campo: "titulo",
        texto: p.linha,
        estilo: { ...est, maiusculas: false },
        max: p.tamanho,
        min: p.tamanho,
        linhas: 1,
      };
      const ret = this.porTexto(item, r.x, y, r.w, alinhamento, p.tamanho, [p.linha], p.largura);
      ocupado = ocupado ? uniao(ocupado, ret) : ret;
      y += alturas[k];
    });
    return ocupado;
  }

  // ───────────────────────────── itens prontos

  /** Os tamanhos de referência de cada papel, em unidades do quadro. */
  tamanhos() {
    const u = this.amb.u;
    const expressivo = this.amb.intensidade === "expressivo" ? 1.12 : this.amb.intensidade === "discreto" ? 0.9 : 1;
    return {
      titulo: { max: u * 13 * expressivo, min: u * 5 },
      tituloGrande: { max: u * 20 * expressivo, min: u * 6.5 },
      apoio: { max: u * 4.2, min: u * 2.8 },
      info: { max: u * 3.2, min: u * 2.35 },
      sobretitulo: { max: u * 2.6, min: u * 2.1 },
      destaque: { max: u * 5, min: u * 3 },
    };
  }

  itemTitulo(max?: number, min?: number, linhas = 4): ItemDeTexto {
    const t = this.tamanhos();
    return {
      papel: "titulo",
      nome: "Título",
      campo: "titulo",
      texto: this.amb.conteudo.titulo,
      estilo: this.t.titulo,
      max: max ?? t.titulo.max,
      min: min ?? t.titulo.min,
      linhas,
    };
  }

  itemSobretitulo(): ItemDeTexto | null {
    const c = this.amb.conteudo.sobretitulo;
    if (!c) return null;
    const t = this.tamanhos();
    return { papel: "kicker", nome: "Tema", campo: c.campo, texto: c.texto, estilo: this.t.sobretitulo, ...t.sobretitulo, linhas: 2 };
  }

  itensDeApoio(o: { versiculo?: boolean; informacoes?: boolean } = {}): ItemDeTexto[] {
    const c = this.amb.conteudo;
    const t = this.tamanhos();
    const itens: ItemDeTexto[] = [];
    if (c.subtitulo) itens.push({ papel: "subtitulo", nome: "Subtítulo", campo: c.subtitulo.campo, texto: c.subtitulo.texto, estilo: this.t.apoio, ...t.apoio, linhas: 3 });
    if (c.mensagem)
      itens.push({ papel: "mensagem", nome: "Mensagem", campo: c.mensagem.campo, texto: c.mensagem.texto, estilo: this.t.apoio, max: t.apoio.max * 0.9, min: t.apoio.min, linhas: 4 });
    if (o.versiculo !== false && c.versiculo) {
      if (c.versiculo.texto)
        itens.push({ papel: "versiculo", nome: "Texto bíblico", campo: "textoBiblico", texto: c.versiculo.texto, estilo: { ...this.t.apoio, estilo: "italic" }, max: t.apoio.max * 0.85, min: t.info.min, linhas: 6 });
      if (c.versiculo.referencia)
        itens.push({ papel: "versiculo", nome: "Referência", campo: this.amb.briefing.referencia ? "referencia" : "palavraBase", texto: c.versiculo.referencia, estilo: this.t.sobretitulo, ...t.sobretitulo, linhas: 2 });
    }
    if (o.informacoes !== false && c.informacoes)
      itens.push({ papel: "info", nome: "Informações", campo: "informacoes", texto: c.informacoes.texto, estilo: this.t.info, ...t.info, linhas: 6 });
    return itens;
  }

  itensDeInfo(o: { quandoEmDestaque?: boolean; contato?: boolean } = {}): ItemDeTexto[] {
    const c = this.amb.conteudo;
    const t = this.tamanhos();
    const itens: ItemDeTexto[] = [];
    if (c.quando) {
      itens.push(
        o.quandoEmDestaque
          ? { papel: "data", nome: "Data e horário", campo: c.quando.campo, texto: c.quando.texto, estilo: this.t.destaque, max: t.destaque.max * 0.8, min: t.info.min, linhas: 2 }
          : { papel: "info", nome: "Data e horário", campo: c.quando.campo, texto: c.quando.texto, estilo: { ...this.t.info, peso: Math.min(800, this.t.info.peso + 100) }, ...t.info, linhas: 2 },
      );
    }
    const resto = [c.onde, c.endereco, ...c.pessoas, o.contato === false ? null : c.contato].filter((l): l is NonNullable<typeof l> => !!l);
    for (const l of resto) {
      itens.push({
        papel: "info",
        nome: NOMES[l.campo] ?? "Informação",
        campo: l.campo,
        texto: l.texto,
        estilo: this.t.info,
        max: l.campo === "endereco" || l.campo.startsWith("contato") || l.campo === "redes" ? t.info.max * 0.9 : t.info.max,
        min: t.info.min,
        linhas: 2,
        antes: this.amb.u * 0.7,
      });
    }
    return itens;
  }

  itemOrganizacao(): ItemDeTexto | null {
    const c = this.amb.conteudo.organizacao;
    if (!c) return null;
    const t = this.tamanhos();
    return { papel: "organizacao", nome: "Organização", campo: "organizacao", texto: c.texto, estilo: this.t.sobretitulo, ...t.sobretitulo, linhas: 2 };
  }

  /** Assinatura da igreja no pé: logo e nome, onde houver. */
  rodapeDeMarca(r: Ret, alinhamento: Alinhamento = "left", o: { semNome?: boolean } = {}): Ret | null {
    const temLogo = !!this.amb.briefing.logo;
    const org = o.semNome ? null : this.itemOrganizacao();
    if (!temLogo && !org) return { ...r, h: 0 };
    const alturaLogo = Math.min(r.h, this.amb.u * 7);
    let ocupado: Ret | null = null;
    if (temLogo) {
      const caixa =
        alinhamento === "right"
          ? { x: r.x + r.w - alturaLogo * 3, y: r.y + r.h - alturaLogo, w: alturaLogo * 3, h: alturaLogo }
          : alinhamento === "center"
            ? { x: r.x + r.w / 2 - alturaLogo * 1.5, y: r.y + r.h - alturaLogo, w: alturaLogo * 3, h: alturaLogo }
            : { x: r.x, y: r.y + r.h - alturaLogo, w: alturaLogo * 3, h: alturaLogo };
      const al = alinhamento === "right" ? { x: 1, y: 0.5 } : alinhamento === "center" ? { x: 0.5, y: 0.5 } : { x: 0, y: 0.5 };
      ocupado = this.logo(caixa, al);
    }
    if (org) {
      const gap = this.amb.u * 1.6;
      const livre =
        ocupado && alinhamento !== "center"
          ? alinhamento === "right"
            ? { x: r.x, y: r.y, w: ocupado.x - gap - r.x, h: r.h }
            : { x: ocupado.x + ocupado.w + gap, y: r.y, w: r.x + r.w - (ocupado.x + ocupado.w + gap), h: r.h }
          : ocupado
            ? { x: r.x, y: r.y, w: r.w, h: ocupado.y - r.y - gap }
            : r;
      if (livre.w > this.amb.u * 12 && livre.h > this.amb.u * 2.5) {
        const t = this.texto(livre, org, { alinhamento, vertical: "bottom" });
        if (t) ocupado = ocupado ? uniao(ocupado, t) : t;
      }
    }
    return ocupado;
  }
}

const NOMES: Record<string, string> = {
  local: "Local",
  endereco: "Endereço",
  pregador: "Pregador",
  ministerio: "Ministério",
  contato: "Contato",
  redes: "Redes sociais",
  "contato+redes": "Contato e redes",
};

export function uniao(a: Ret, b: Ret): Ret {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/**
 * O que fica embaixo de um retângulo: a cor, ou a luz da foto.
 *
 * Percorre as camadas de cima para baixo — entrando nos grupos, que é onde
 * moram os painéis das colagens — e fica com a primeira que cobre o centro
 * do retângulo com tinta cheia. Foto responde com a luminância média
 * daquele pedaço (do mapa de luz medido na importação), já contando a
 * proteção que a variante pôs.
 */
export function sobDe(camadas: Camada[], r: Ret, p: Paleta, b: Briefing, ignorar?: string): Sob {
  const planas: Camada[] = [];
  for (const { camada, x, y } of todasAsCamadas(camadas)) {
    if (camada.tipo === "grupo") continue;
    planas.push({ ...camada, x, y } as Camada);
  }
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const pontos: [number, number][] = [
    [cx, cy],
    [r.x + r.w * 0.2, r.y + r.h * 0.25],
    [r.x + r.w * 0.8, r.y + r.h * 0.25],
    [r.x + r.w * 0.2, r.y + r.h * 0.75],
    [r.x + r.w * 0.8, r.y + r.h * 0.75],
  ];
  for (let i = planas.length - 1; i >= 0; i--) {
    const c = planas[i];
    if (c.id === ignorar || c.oculta) continue;
    if (c.tipo === "texto" || c.tipo === "logo" || c.tipo === "textura") continue;
    const caixa = retDe(c);
    if (c.tipo !== "fundo") {
      if (cx < caixa.x || cx > caixa.x + caixa.w || cy < caixa.y || cy > caixa.y + caixa.h) continue;
      // A forma, não a caixa: numa diagonal ou numa bolha, a caixa cobre
      // a página inteira e a tinta só metade.
      if (!cobre(c, cx, cy)) continue;
      if (pontos.filter(([px, py]) => cobre(c, px, py)).length < 4) continue;
    }
    if (c.tipo === "fundo" || c.tipo === "forma") {
      if (!c.preenchimento || c.opacidade < 0.85) continue;
      if (c.tipo === "forma" && c.forma === "linha") continue;
      const cor = corNoPonto(c.preenchimento, (cx - caixa.x) / caixa.w, (cy - caixa.y) / caixa.h);
      return { tipo: "cor", cor, luz: luminancia(cor), camadaId: c.id };
    }
    if (c.tipo === "imagem") {
      if (c.origem === "catalogo") return { tipo: "ilustracao", cor: null, luz: 0.5, camadaId: c.id };
      return { tipo: "foto", cor: null, luz: luzDaFoto(c, r, b), camadaId: c.id };
    }
  }
  return { tipo: "cor", cor: p.fundo, luz: luminancia(p.fundo), camadaId: null };
}

/** Os polígonos de um path (M, L, C, Q, Z absolutos), curvas amostradas. */
export function poligonosDoCaminho(d: string): [number, number][][] {
  const tokens = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const saida: [number, number][][] = [];
  let atual: [number, number][] = [];
  let i = 0;
  let cmd = "";
  let px = 0;
  let py = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === "M") {
      if (atual.length) saida.push(atual);
      px = num();
      py = num();
      atual = [[px, py]];
      cmd = "L";
    } else if (cmd === "L") {
      px = num();
      py = num();
      atual.push([px, py]);
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const a = (1 - t) ** 3;
        const b = 3 * (1 - t) ** 2 * t;
        const cc = 3 * (1 - t) * t * t;
        const dd = t ** 3;
        atual.push([a * px + b * x1 + cc * x2 + dd * x, a * py + b * y1 + cc * y2 + dd * y]);
      }
      px = x;
      py = y;
    } else if (cmd === "Q") {
      const [x1, y1, x, y] = [num(), num(), num(), num()];
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        atual.push([(1 - t) ** 2 * px + 2 * (1 - t) * t * x1 + t * t * x, (1 - t) ** 2 * py + 2 * (1 - t) * t * y1 + t * t * y]);
      }
      px = x;
      py = y;
    } else if (cmd === "Z") {
      if (atual.length) saida.push(atual);
      atual = [];
    } else i++;
  }
  if (atual.length) saida.push(atual);
  return saida;
}

function dentroDoPoligono(pols: [number, number][][], x: number, y: number): boolean {
  let dentro = false;
  for (const pol of pols) {
    for (let a = 0, b = pol.length - 1; a < pol.length; b = a++) {
      const [xa, ya] = pol[a];
      const [xb, yb] = pol[b];
      if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) dentro = !dentro;
    }
  }
  return dentro;
}

const ARCO_JANELA = "M0 1 L0 0.5 C0 0.22 0.22 0 0.5 0 C0.78 0 1 0.22 1 0.5 L1 1 Z";

/** Se um ponto (em px) cai na tinta da camada — não só na caixa dela. */
export function cobre(c: Camada, x: number, y: number): boolean {
  const fx = (x - c.x) / c.largura;
  const fy = (y - c.y) / c.altura;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;
  const elipse = () => (fx - 0.5) ** 2 / 0.25 + (fy - 0.5) ** 2 / 0.25 <= 1;
  if (c.tipo === "forma") {
    if (c.forma === "elipse" || c.forma === "circulo") return elipse();
    if (c.forma === "caminho" && c.d) return dentroDoPoligono(poligonosDoCaminho(c.d), fx, fy);
    if (c.forma === "linha") return false;
    return true;
  }
  if (c.tipo === "imagem") {
    const m = c.mascara;
    if (m.tipo === "circulo") return elipse();
    if (m.tipo === "arco") return dentroDoPoligono(poligonosDoCaminho(ARCO_JANELA), fx, fy);
    if (m.tipo === "caminho") return dentroDoPoligono(poligonosDoCaminho(m.d), fx, fy);
    return true;
  }
  return true;
}

/**
 * Onde pôr o canto de uma caixa girada para o centro dela não sair do
 * lugar. O Konva gira em torno do canto de cima à esquerda; sem isto, um
 * cartão girado 6° escorregaria meia largura para o lado.
 */
export function girarNoCentro(r: Ret, graus: number): { x: number; y: number } {
  const ang = (graus * Math.PI) / 180;
  const cx = r.w / 2;
  const cy = r.h / 2;
  return {
    x: r.x + cx - (cx * Math.cos(ang) - cy * Math.sin(ang)),
    y: r.y + cy - (cx * Math.sin(ang) + cy * Math.cos(ang)),
  };
}

/** A cor de um preenchimento num ponto (fração da caixa). */
export function corNoPonto(p: Preenchimento, fx: number, fy: number): string {
  if (p.tipo === "solido") return p.cor;
  const cores = p.cores.length ? p.cores : ["#000000"];
  if (cores.length === 1) return cores[0];
  let t: number;
  if (p.tipo === "linear") {
    const ang = (p.angulo * Math.PI) / 180;
    t = (fx - 0.5) * Math.cos(ang) + (fy - 0.5) * Math.sin(ang) + 0.5;
  } else {
    t = Math.hypot(fx - p.centro.x, fy - p.centro.y) / Math.max(0.01, p.raio);
  }
  t = Math.max(0, Math.min(1, t)) * (cores.length - 1);
  const i = Math.min(cores.length - 2, Math.floor(t));
  return misturar(cores[i], cores[i + 1], t - i);
}

/**
 * A luz média da foto debaixo de um retângulo, com a proteção aplicada.
 *
 * Usa o mapa 8×8 medido quando a foto entrou. Não é exato ao pixel, e não
 * precisa ser: decide entre letra clara e escura e quanta proteção pôr.
 */
export function luzDaFoto(c: CamadaImagem, r: Ret, b: Briefing): number {
  const indice = Number(c.recursoId.split(":")[1] ?? -1);
  const foto = b.fotos[indice];
  const mapa = foto?.mapaDeLuz;
  let luz = 0.5;
  if (mapa && mapa.length === 64) {
    const fx0 = c.recorte.x + ((r.x - c.x) / c.largura) * c.recorte.largura;
    const fx1 = c.recorte.x + ((r.x + r.w - c.x) / c.largura) * c.recorte.largura;
    const fy0 = c.recorte.y + ((r.y - c.y) / c.altura) * c.recorte.altura;
    const fy1 = c.recorte.y + ((r.y + r.h - c.y) / c.altura) * c.recorte.altura;
    let soma = 0;
    let n = 0;
    for (let yy = 0; yy < 8; yy++) {
      for (let xx = 0; xx < 8; xx++) {
        const cx = (xx + 0.5) / 8;
        const cy = (yy + 0.5) / 8;
        if (cx >= fx0 - 0.07 && cx <= fx1 + 0.07 && cy >= fy0 - 0.07 && cy <= fy1 + 0.07) {
          soma += mapa[yy * 8 + xx];
          n++;
        }
      }
    }
    if (n) luz = soma / n;
  }
  if (c.protecao) {
    const pr = c.protecao;
    const cx = (r.x + r.w / 2 - c.x) / c.largura;
    const cy = (r.y + r.h / 2 - c.y) / c.altura;
    const dist = pr.lado === "baixo" ? 1 - cy : pr.lado === "cima" ? cy : pr.lado === "esquerda" ? cx : pr.lado === "direita" ? 1 - cx : 0;
    const forca = pr.lado === "tudo" ? pr.forca : forcaDaProtecao(pr, dist);
    luz = luz * (1 - forca) + luminancia(pr.cor) * forca;
  }
  return luz;
}

/** A força da proteção a uma distância da borda forte (fração da caixa). */
export function forcaDaProtecao(pr: Protecao, dist: number): number {
  const plato = pr.plato ?? 0;
  if (dist <= plato) return pr.forca;
  const resto = Math.max(0.01, pr.alcance - plato);
  return Math.max(0, pr.forca * (1 - (dist - plato) / resto));
}

/**
 * Proteção do lado do texto, na força que a foto pede.
 *
 * A conta é para a luz sob o texto cair a ~0,1 — onde letra clara lê a
 * mais de 7:1. Foto já escura ali recebe pouco; foto clara recebe muito,
 * mas só do lado do texto: o resto da foto fica como veio.
 */
export function protecaoPara(lado: Protecao["lado"], luzDaRegiao: number, cor = "#0b0b0d", alcance = 0.7, plato = 0): Protecao {
  const forca = Math.max(0.3, Math.min(0.9, 1 - 0.1 / Math.max(0.1, luzDaRegiao)));
  return { cor, lado, forca: Math.round(forca * 1000) / 1000, alcance: Math.max(alcance, plato + 0.15), plato };
}

export { comAlfa };
