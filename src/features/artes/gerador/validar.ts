import type { Briefing } from "../briefing.ts";
import { contrasteDeLuz, contrasteMinimo, luminancia } from "../catalogo/cores.ts";
import type { Paleta } from "../catalogo/paletas.ts";
import { caixaVisual, todasAsCamadas, type Camada, type CamadaTexto } from "../documento.ts";
import { intersecao, sobDe, type Ret } from "./compositor.ts";

/**
 * A conferência de cada composição, antes de ela entrar no lote.
 *
 * "Erro" tira a opção do lote; "aviso" vai junto com ela para a pessoa ver.
 * O que se confere é o que estraga uma arte impressa: texto fora da área
 * segura, texto trombando em texto, letra pequena demais, contraste baixo,
 * texto por cima de desenho, logo deformada. Sobreposição planejada (título
 * sobre painel, texto sobre foto com proteção) não é erro — é desenho.
 */

export interface Problema {
  gravidade: "erro" | "aviso";
  texto: string;
  camadaId?: string;
}

export interface Quadro {
  L: number;
  A: number;
  u: number;
  seg: Ret;
  paleta: Paleta;
  briefing: Briefing;
}

/** O menor corpo aceitável por papel, em unidades do quadro. */
const MINIMO: Record<string, number> = {
  titulo: 4.2,
  data: 2.2,
  info: 2.2,
  subtitulo: 2.4,
  mensagem: 2.4,
  versiculo: 2.1,
  kicker: 2.0,
  organizacao: 2.0,
};

function caixaAbsoluta(c: Camada, x: number, y: number): Ret {
  return caixaVisual({ ...c, x, y });
}

export function validar(camadas: Camada[], q: Quadro): Problema[] {
  const problemas: Problema[] = [];
  const folga = q.u * 1.8;
  const textos: { c: CamadaTexto; r: Ret }[] = [];
  const conteudo: { c: Camada; r: Ret }[] = [];
  const desenhos: { c: Camada; r: Ret }[] = [];

  for (const { camada, x, y } of todasAsCamadas(camadas)) {
    if (camada.oculta || camada.tipo === "grupo") continue;
    const r = caixaAbsoluta(camada, x, y);
    if (camada.tipo === "texto") {
      textos.push({ c: camada, r });
      conteudo.push({ c: camada, r });
    } else if (camada.tipo === "logo") {
      conteudo.push({ c: camada, r });
      const razao = camada.largura / camada.altura;
      const original = camada.larguraOriginal / camada.alturaOriginal;
      if (Math.abs(razao / original - 1) > 0.01) problemas.push({ gravidade: "erro", texto: "A logo foi deformada.", camadaId: camada.id });
      if (r.x < -1 || r.y < -1 || r.x + r.w > q.L + 1 || r.y + r.h > q.A + 1) problemas.push({ gravidade: "erro", texto: "A logo saiu do quadro.", camadaId: camada.id });
    } else if (camada.tipo === "imagem" && camada.origem === "catalogo") desenhos.push({ c: camada, r });
  }

  for (const { c, r } of textos) {
    const s = q.seg;
    if (r.x < s.x - folga || r.y < s.y - folga || r.x + r.w > s.x + s.w + folga || r.y + r.h > s.y + s.h + folga) {
      problemas.push({ gravidade: "erro", texto: `“${c.nome}” saiu da área segura.`, camadaId: c.id });
    }
    const minimo = (MINIMO[c.papel] ?? 2) * q.u;
    if (c.tamanho < minimo - 0.5) problemas.push({ gravidade: "erro", texto: `“${c.nome}” ficou pequeno demais para ler.`, camadaId: c.id });
    const sob = sobDe(camadas, r, q.paleta, q.briefing);
    if (sob.tipo === "ilustracao") {
      problemas.push({ gravidade: "erro", texto: `“${c.nome}” está por cima de um desenho.`, camadaId: c.id });
      continue;
    }
    const exigido = contrasteMinimo(c.tamanho, Math.min(q.L, q.A));
    const obtido = contrasteDeLuz(luminancia(c.cor), sob.luz);
    if (obtido < exigido - 0.05) {
      problemas.push({ gravidade: "erro", texto: `“${c.nome}” tem contraste ${obtido.toFixed(1)}:1 — o mínimo é ${exigido}:1.`, camadaId: c.id });
    }
    for (const d of desenhos) {
      if (intersecao(r, d.r) > r.w * r.h * 0.15) problemas.push({ gravidade: "erro", texto: `“${c.nome}” encosta no desenho.`, camadaId: c.id });
    }
  }

  for (let i = 0; i < conteudo.length; i++) {
    for (let j = i + 1; j < conteudo.length; j++) {
      const a = conteudo[i];
      const b = conteudo[j];
      const inter = intersecao(a.r, b.r);
      if (inter <= 0) continue;
      const menor = Math.min(a.r.w * a.r.h, b.r.w * b.r.h);
      if (inter < menor * 0.03) continue;
      if (a.c.sobrepoe?.includes(b.c.id) || b.c.sobrepoe?.includes(a.c.id)) continue;
      problemas.push({ gravidade: "erro", texto: `“${a.c.nome}” e “${b.c.nome}” se sobrepõem.`, camadaId: a.c.id });
    }
  }
  return problemas;
}
