import { pintarAtmosfera } from "./atmosfera.ts";
import { briefingVazio, type Briefing } from "./briefing.ts";
import { luminosidadeDe, PALETAS } from "./catalogo/paletas.ts";
import {
  VERSAO_ESQUEMA,
  type Camada,
  type CamadaTexto,
  type DocumentoDeArte,
  type Preenchimento,
} from "./documento.ts";
import { assinar } from "./gerador/assinatura.ts";
import { larguraMediaDoCaractere } from "./largura-do-texto.ts";
import { quebrarTexto } from "./render.ts";
import type { Documento as DocumentoV1, Elemento as ElementoV1 } from "./types.ts";

/**
 * As artes salvas na versão anterior, trazidas para o documento em camadas.
 *
 * Nada se perde: cada elemento vira a camada equivalente, na mesma
 * posição e no mesmo tamanho, e o texto mantém as quebras de linha que
 * tinha — a arte reaberta tem a cara que tinha quando foi salva. A luz de
 * atmosfera vira uma imagem pronta, desenhada pelo mesmo código de antes.
 */

const FONTES: Record<string, string> = {
  display: "Fraunces Variable",
  sans: "Instrument Sans Variable",
  mono: "IBM Plex Mono",
};

function briefingDe(d: DocumentoV1["dados"]): Briefing {
  return {
    ...briefingVazio(),
    titulo: d.titulo ?? "",
    subtitulo: d.subtitulo ?? "",
    tema: d.tema ?? "",
    palavraBase: d.palavraBase ?? "",
    referencia: d.referencia ?? "",
    textoBiblico: d.textoBiblico ?? "",
    data: d.data ?? "",
    horario: d.horario ?? "",
    local: d.local ?? "",
    endereco: d.endereco ?? "",
    pregador: d.pregador ?? "",
    ministerio: d.ministerio ?? "",
    mensagem: d.chamada ?? "",
    informacoes: d.informacoes ?? "",
    contato: d.contato ?? "",
    redes: d.redes ?? "",
    organizacao: d.igreja ?? "",
  };
}

const svgUrl = (L: number, A: number, corpo: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">${corpo}</svg>`)}`;

function camadaDe(el: ElementoV1, L: number, A: number): Camada[] {
  const base = { rotacao: 0, opacidade: 1, oculta: "oculto" in el ? el.oculto : undefined, travada: "travado" in el ? el.travado : undefined };
  switch (el.tipo) {
    case "fundo": {
      const [a, b] = [el.cores[0] ?? "#000000", el.cores[1] ?? el.cores[0] ?? "#000000"];
      if (el.estilo === "foto" && el.src) {
        return [
          { tipo: "fundo", id: "fundo", nome: "Fundo", papel: "fundo", x: 0, y: 0, largura: L, altura: A, rotacao: 0, opacidade: 1, preenchimento: { tipo: "solido", cor: "#000000" } },
          { tipo: "imagem", id: "foto-de-fundo", nome: "Foto de fundo", papel: "imagem", src: el.src, recursoId: "v1:foto", origem: "usuario", larguraOriginal: L, alturaOriginal: A, recorte: { x: 0, y: 0, largura: 1, altura: 1 }, pontoFocal: { x: 0.5, y: 0.5 }, mascara: { tipo: "retangulo", raio: 0 }, x: 0, y: 0, largura: L, altura: A, rotacao: 0, opacidade: 1, protecao: el.veu > 0 ? { cor: "#000000", lado: "tudo", forca: el.veu, alcance: 1 } : undefined },
        ];
      }
      const preenchimento: Preenchimento =
        el.estilo === "gradiente"
          ? { tipo: "linear", cores: [a, b], angulo: el.angulo }
          : el.estilo === "radial"
            ? { tipo: "radial", cores: [b, a], centro: { x: 0.5, y: 0.38 }, raio: 0.78 }
            : { tipo: "solido", cor: a };
      return [{ tipo: "fundo", id: "fundo", nome: "Fundo", papel: "fundo", x: 0, y: 0, largura: L, altura: A, rotacao: 0, opacidade: 1, preenchimento }];
    }
    case "atmosfera": {
      if (el.atmosfera === "nenhuma") return [];
      const marca = el.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "atm";
      const p = pintarAtmosfera(el.atmosfera, L, A, el.cor, el.semente, `a${marca}`, el.clara);
      if (!p.corpo) return [];
      const src = svgUrl(L, A, `${p.defs ? `<defs>${p.defs}</defs>` : ""}${p.corpo}`);
      return [{ ...base, tipo: "imagem", id: el.id, nome: "Luz e atmosfera", papel: "decoracao", src, recursoId: `atmosfera:${el.atmosfera}`, origem: "catalogo", larguraOriginal: L, alturaOriginal: A, recorte: { x: 0, y: 0, largura: 1, altura: 1 }, pontoFocal: { x: 0.5, y: 0.5 }, mascara: { tipo: "retangulo", raio: 0 }, x: 0, y: 0, largura: L, altura: A, opcional: true }];
    }
    case "forma": {
      const r = { x: el.caixa.x * L, y: el.caixa.y * A, largura: el.caixa.largura * L, altura: el.caixa.altura * A };
      if (el.forma === "circulo") {
        const d = Math.min(r.largura, r.altura);
        return [{ ...base, tipo: "forma", id: el.id, nome: "Enfeite", papel: "decoracao", forma: "elipse", x: r.x + (r.largura - d) / 2, y: r.y + (r.altura - d) / 2, largura: d, altura: d, opacidade: el.opacidade, preenchimento: { tipo: "solido", cor: el.cor }, opcional: true }];
      }
      return [{ ...base, tipo: "forma", id: el.id, nome: "Enfeite", papel: "decoracao", forma: "retangulo", ...r, opacidade: el.opacidade, raio: (el.raio * Math.min(r.largura, r.altura)) / 2, preenchimento: { tipo: "solido", cor: el.cor }, opcional: true }];
    }
    case "imagem": {
      const r = { x: el.caixa.x * L, y: el.caixa.y * A, largura: el.caixa.largura * L, altura: el.caixa.altura * A };
      if (el.id === "logo") {
        return [{ ...base, tipo: "logo", id: "logo", nome: "Logo", papel: "logo", src: el.src, larguraOriginal: r.largura, alturaOriginal: r.altura, manterProporcao: true, ...r, opacidade: el.opacidade }];
      }
      return [{ ...base, tipo: "imagem", id: el.id, nome: "Imagem", papel: "imagem", src: el.src, recursoId: "v1:imagem", origem: "usuario", larguraOriginal: r.largura, alturaOriginal: r.altura, recorte: { x: 0, y: 0, largura: 1, altura: 1 }, pontoFocal: { x: 0.5, y: 0.5 }, mascara: { tipo: "retangulo", raio: (el.raio * Math.min(r.largura, r.altura)) / 2 }, ...r, opacidade: el.opacidade }];
    }
    case "texto": {
      const tamanho = el.tamanho * A;
      const texto = el.maiuscula ? el.texto.toLocaleUpperCase("pt-BR") : el.texto;
      const linhas = quebrarTexto(texto, el.caixa.largura * L, tamanho, larguraMediaDoCaractere(el.fonte, el.peso, el.maiuscula, el.espacamento));
      const altura = linhas.length * tamanho * el.entrelinha;
      // A v1 centralizava o bloco na caixa; aqui a caixa já nasce do
      // tamanho do bloco, no mesmo lugar.
      const y = (el.caixa.y + el.caixa.altura / 2) * A - altura / 2;
      const papel = el.campo === "titulo" ? "titulo" : el.campo === "data" || el.campo === "horario" ? "data" : el.campo === "subtitulo" ? "subtitulo" : "info";
      const c: CamadaTexto = {
        ...base,
        tipo: "texto",
        id: el.id,
        nome: el.campo ? el.campo : "Texto",
        papel,
        campo: el.campo === "chamada" ? "mensagem" : el.campo === "igreja" ? "organizacao" : el.campo,
        texto: el.texto,
        quebras: linhas.join("\n"),
        fonte: FONTES[el.fonte] ?? FONTES.sans,
        peso: el.peso,
        estilo: "normal",
        tamanho,
        entrelinha: el.entrelinha,
        espacamento: el.espacamento * tamanho,
        alinhamento: el.alinhamento,
        alinhamentoVertical: "top",
        cor: el.cor,
        maiusculas: el.maiuscula,
        sombra: el.sombra ? { cor: "#000000", desfoque: tamanho * 0.12, x: 0, y: tamanho * 0.03, opacidade: 0.55 } : undefined,
        x: el.caixa.x * L,
        y,
        largura: el.caixa.largura * L,
        altura,
        opcional: papel !== "titulo",
      };
      return [c];
    }
  }
}

export function ehDocumentoV1(d: unknown): d is DocumentoV1 {
  return !!d && typeof d === "object" && (d as { v?: unknown }).v === 1 && Array.isArray((d as { elementos?: unknown }).elementos);
}

export function migrarV1(d: DocumentoV1): DocumentoDeArte {
  const L = d.largura;
  const A = d.altura;
  const camadas = d.elementos.flatMap((el) => camadaDe(el, L, A));
  const paleta = PALETAS[0];
  return {
    v: VERSAO_ESQUEMA,
    id: d.id,
    nome: d.nome,
    formatoId: d.formatoId,
    largura: L,
    altura: A,
    briefing: briefingDe(d.dados),
    semente: d.semente,
    versaoGerador: 0,
    versaoCatalogo: 0,
    familia: "editorial",
    variante: "v1-importada",
    rotulo: "Arte da versão anterior",
    direcao: { paletaId: "", tipografiaId: "", luminosidade: luminosidadeDe(paleta), densidade: "media", imagens: [] },
    recursos: [],
    camadas,
    original: structuredClone(camadas),
    assinatura: assinar(camadas, L, A, "editorial", "v1-importada", false, "media"),
    exportacao: { formato: "png", qualidade: 0.92 },
    avisos: [],
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm,
  };
}
