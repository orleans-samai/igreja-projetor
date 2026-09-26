import {
  caixaVisual,
  todasAsCamadas,
  type Assinatura,
  type Camada,
  type Celula,
  type Densidade,
  type FamiliaId,
  type Luminosidade,
} from "../documento.ts";
import { intersecao, uniao, type Ret } from "./compositor.ts";

/**
 * A assinatura estrutural: o que diz se duas opções são a mesma arte.
 *
 * Mede onde as coisas estão (título, informação, logo, imagens numa grade
 * 3×3), quanto espaço a imagem toma, o tamanho do título, quantos painéis,
 * a densidade — e deixa a cor de fora de propósito. Duas opções com o
 * título no mesmo lugar e a foto no mesmo lugar são a mesma composição em
 * azul e em verde, e o lote não aceita isso como variedade.
 */

function celulas(r: Ret, L: number, A: number): Celula[] {
  const saida: Celula[] = [];
  const area = r.w * r.h;
  for (let i = 0; i < 9; i++) {
    const cel = { x: (i % 3) * (L / 3), y: Math.floor(i / 3) * (A / 3), w: L / 3, h: A / 3 };
    const inter = intersecao(r, cel);
    if (inter >= cel.w * cel.h * 0.2 || (area > 0 && inter >= area * 0.35)) saida.push(i as Celula);
  }
  return saida;
}

function juntar(rets: Ret[]): Ret | null {
  return rets.reduce<Ret | null>((acc, r) => (acc ? uniao(acc, r) : r), null);
}

function recortar(r: Ret, L: number, A: number): Ret {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  return { x, y, w: Math.max(0, Math.min(L, r.x + r.w) - x), h: Math.max(0, Math.min(A, r.y + r.h) - y) };
}

export function assinar(
  camadas: Camada[],
  L: number,
  A: number,
  familia: FamiliaId,
  variante: string,
  centralizadaPorDesenho: boolean,
  luminosidade: Luminosidade,
): Assinatura {
  const titulo: Ret[] = [];
  const info: Ret[] = [];
  const logo: Ret[] = [];
  const imagens: { r: Ret; id: string }[] = [];
  let paineis = 0;
  let visiveis = 0;
  let caracteres = 0;
  let alinhamento: Assinatura["alinhamento"] = "left";
  let temAlinhamento = false;
  const recursos = new Set<string>();

  for (const { camada, x, y } of todasAsCamadas(camadas)) {
    if (camada.oculta || camada.tipo === "grupo" || camada.tipo === "fundo") continue;
    visiveis += 1;
    const r = recortar(caixaVisual({ ...camada, x, y }), L, A);
    if (camada.tipo === "texto") {
      caracteres += camada.texto.length;
      if (camada.papel === "titulo") {
        titulo.push(r);
        if (!temAlinhamento) {
          alinhamento = camada.alinhamento;
          temAlinhamento = true;
        }
      } else if (camada.papel === "info" || camada.papel === "data") info.push(r);
    } else if (camada.tipo === "logo") logo.push(r);
    else if (camada.tipo === "imagem") {
      recursos.add(camada.recursoId);
      if (r.w * r.h >= L * A * 0.04) imagens.push({ r, id: camada.recursoId });
    } else if (camada.tipo === "forma" && camada.papel === "painel") paineis += 1;
  }

  const t = juntar(titulo);
  const areaImagens = imagens.reduce((s, i) => s + i.r.w * i.r.h, 0) / (L * A);
  const maior = imagens.reduce<{ r: Ret; id: string } | null>((a, b) => (!a || b.r.w * b.r.h > a.r.w * a.r.h ? b : a), null);
  const escala = t ? t.h / A : 0;
  const centroTitulo = t ? t.x + t.w / 2 : 0;
  const densidade: Densidade = visiveis + caracteres / 140 <= 8 ? "baixa" : visiveis + caracteres / 140 <= 15 ? "media" : "alta";

  return {
    familia,
    variante,
    titulo: t ? celulas(t, L, A) : [],
    info: info.length ? celulas(juntar(info)!, L, A) : [],
    logo: logo.length ? celulas(juntar(logo)!, L, A) : [],
    imagens: imagens.length ? [...new Set(imagens.flatMap((i) => celulas(i.r, L, A)))].sort((a, b) => a - b) : [],
    alinhamento,
    centralizada: centralizadaPorDesenho || (alinhamento === "center" && Math.abs(centroTitulo - L / 2) < L * 0.05),
    pesoDaImagem: areaImagens === 0 ? 0 : areaImagens < 0.15 ? 1 : areaImagens < 0.4 ? 2 : 3,
    escalaDoTitulo: escala < 0.12 ? 0 : escala < 0.22 ? 1 : escala < 0.34 ? 2 : 3,
    paineis,
    densidade,
    luminosidade,
    imagemDominante: maior && (maior.r.w * maior.r.h) / (L * A) >= 0.15 ? maior.id : null,
    recursos: [...recursos].sort(),
  };
}

function jaccard(a: Celula[], b: Celula[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  return inter / (sa.size + b.length - inter);
}

/**
 * Quão parecidas são duas composições, de 0 a 15. Cor não entra.
 *
 * Os pesos dizem o que o olho percebe primeiro numa miniatura: onde está o
 * título, onde está a imagem, e quanto ela ocupa. Alinhamento e densidade
 * vêm depois.
 */
export function semelhanca(a: Assinatura, b: Assinatura): number {
  let s = 0;
  if (a.familia === b.familia) s += 2.5;
  s += jaccard(a.titulo, b.titulo) * 3;
  s += (a.imagens.length === 0 && b.imagens.length === 0 ? 0.6 : jaccard(a.imagens, b.imagens)) * 2.5;
  s += jaccard(a.info, b.info) * 1.5;
  if (a.alinhamento === b.alinhamento) s += 1;
  if (a.pesoDaImagem === b.pesoDaImagem) s += 1;
  if (a.escalaDoTitulo === b.escalaDoTitulo) s += 1;
  if (a.paineis === b.paineis) s += 0.5;
  if (a.densidade === b.densidade) s += 0.5;
  if (a.imagemDominante && a.imagemDominante === b.imagemDominante) s += 1.5;
  return s;
}

/** A partir daqui, é a mesma arte com outra roupa. */
export const LIMITE_DE_SEMELHANCA = 10;

export function parecidas(a: Assinatura, b: Assinatura, limite = LIMITE_DE_SEMELHANCA): boolean {
  if (a.familia === b.familia && a.variante === b.variante) return true;
  return semelhanca(a, b) >= limite;
}
