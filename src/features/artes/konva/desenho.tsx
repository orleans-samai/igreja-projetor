import type Konva from "konva";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { Ellipse, Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from "react-konva";
import { comAlfa } from "../catalogo/cores.ts";
import {
  textoDesenhado,
  type Camada,
  type CamadaImagem,
  type DocumentoDeArte,
  type Mascara,
  type Preenchimento,
  type Protecao,
} from "../documento.ts";
import { escalarCaminho } from "./caminhos.ts";
import { useImagem } from "./recursos.ts";

/**
 * O documento desenhado com Konva.
 *
 * Um componente só para a miniatura, o editor e o arquivo exportado: a
 * exportação monta este mesmo componente fora da tela e pede o canvas a
 * ele. Se a prévia e o arquivo tivessem desenhos próprios, iam divergir, e
 * a pessoa só descobriria depois de imprimir.
 *
 * Toda camada vira um grupo posicionado no canto dela, girado em torno
 * desse canto (como o documento guarda), com o desenho em coordenadas
 * locais de 0 à largura. Arrastar, girar e redimensionar mexem no grupo —
 * o mesmo jeito para foto, texto, forma e logo.
 */

const ARCO = "M0 1 L0 0.5 C0 0.22 0.22 0 0.5 0 C0.78 0 1 0.22 1 0.5 L1 1 Z";

function propsDePreenchimento(p: Preenchimento | null, w: number, h: number): Record<string, unknown> {
  if (!p) return {};
  if (p.tipo === "solido") return { fill: p.cor };
  const paradas = p.cores.flatMap((cor, i) => [p.cores.length === 1 ? 0 : i / (p.cores.length - 1), cor]);
  if (p.tipo === "linear") {
    const ang = (p.angulo * Math.PI) / 180;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const meio = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    return {
      fillLinearGradientStartPoint: { x: w / 2 - dx * meio, y: h / 2 - dy * meio },
      fillLinearGradientEndPoint: { x: w / 2 + dx * meio, y: h / 2 + dy * meio },
      fillLinearGradientColorStops: paradas,
    };
  }
  const centro = { x: p.centro.x * w, y: p.centro.y * h };
  return {
    fillRadialGradientStartPoint: centro,
    fillRadialGradientEndPoint: centro,
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: p.raio * Math.max(w, h),
    fillRadialGradientColorStops: paradas,
  };
}

function caminhoDaMascara(m: Mascara, w: number, h: number): Path2D {
  const p = new Path2D();
  if (m.tipo === "circulo") p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (m.tipo === "arco") return new Path2D(escalarCaminho(ARCO, w, h));
  else if (m.tipo === "caminho") return new Path2D(escalarCaminho(m.d, w, h));
  else if (m.raio > 0) p.roundRect(0, 0, w, h, Math.min(m.raio, w / 2, h / 2));
  else p.rect(0, 0, w, h);
  return p;
}

function formaDaMascara(m: Mascara, w: number, h: number, extra: Record<string, unknown>): ReactNode {
  if (m.tipo === "circulo") return <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} {...extra} />;
  if (m.tipo === "arco") return <Path data={escalarCaminho(ARCO, w, h)} {...extra} />;
  if (m.tipo === "caminho") return <Path data={escalarCaminho(m.d, w, h)} {...extra} />;
  return <Rect width={w} height={h} cornerRadius={m.raio} {...extra} />;
}

/** A proteção como gradiente: cheia até o platô, esmaecendo até o alcance. */
function propsDaProtecao(pr: Protecao, w: number, h: number): Record<string, unknown> {
  if (pr.lado === "tudo") return { fill: comAlfa(pr.cor, pr.forca) };
  const pontos = {
    baixo: [{ x: 0, y: h }, { x: 0, y: 0 }],
    cima: [{ x: 0, y: 0 }, { x: 0, y: h }],
    esquerda: [{ x: 0, y: 0 }, { x: w, y: 0 }],
    direita: [{ x: w, y: 0 }, { x: 0, y: 0 }],
  }[pr.lado];
  const plato = Math.max(0, Math.min(0.98, pr.plato ?? 0));
  const alcance = Math.max(plato + 0.01, Math.min(1, pr.alcance));
  const cheio = comAlfa(pr.cor, pr.forca);
  const vazio = comAlfa(pr.cor, 0);
  const paradas: (number | string)[] = [0, cheio];
  if (plato > 0) paradas.push(plato, cheio);
  paradas.push(alcance, vazio);
  if (alcance < 1) paradas.push(1, vazio);
  return { fillLinearGradientStartPoint: pontos[0], fillLinearGradientEndPoint: pontos[1], fillLinearGradientColorStops: paradas };
}

function Imagem({ c }: { c: CamadaImagem }) {
  const img = useImagem(c.src);
  const w = c.largura;
  const h = c.altura;
  const nw = img?.naturalWidth || c.larguraOriginal;
  const nh = img?.naturalHeight || c.alturaOriginal;
  const crop = { x: c.recorte.x * nw, y: c.recorte.y * nh, width: c.recorte.largura * nw, height: c.recorte.altura * nh };
  return (
    <>
      {c.sombra &&
        formaDaMascara(c.mascara, w, h, {
          fill: "#000000",
          opacity: 0.999,
          shadowColor: c.sombra.cor,
          shadowBlur: c.sombra.desfoque,
          shadowOffset: { x: c.sombra.x, y: c.sombra.y },
          shadowOpacity: c.sombra.opacidade,
        })}
      <Group clipFunc={() => [caminhoDaMascara(c.mascara, w, h)]}>
        {img && <KImage image={img} width={w} height={h} crop={crop} />}
        {c.protecao && <Rect width={w} height={h} listening={false} {...propsDaProtecao(c.protecao, w, h)} />}
      </Group>
      {c.contorno && formaDaMascara(c.mascara, w, h, { stroke: c.contorno.cor, strokeWidth: c.contorno.espessura, listening: false })}
    </>
  );
}

function Logo({ c }: { c: Extract<Camada, { tipo: "logo" }> }) {
  const img = useImagem(c.src);
  const pl = c.placa;
  return (
    <>
      {pl && <Rect x={-pl.margem} y={-pl.margem} width={c.largura + pl.margem * 2} height={c.altura + pl.margem * 2} cornerRadius={pl.raio} fill={pl.cor} />}
      {img && <KImage image={img} width={c.largura} height={c.altura} />}
    </>
  );
}

function Textura({ c }: { c: Extract<Camada, { tipo: "textura" }> }) {
  const img = useImagem(c.src);
  if (!img) return null;
  return <Rect width={c.largura} height={c.altura} fillPatternImage={img} fillPatternRepeat="repeat" listening={false} />;
}

/** O desenho de uma camada em coordenadas locais (0 à largura). */
function Conteudo({ c }: { c: Camada }): ReactNode {
  const w = c.largura;
  const h = c.altura;
  switch (c.tipo) {
    case "fundo":
      return <Rect width={w} height={h} {...propsDePreenchimento(c.preenchimento, w, h)} />;
    case "forma": {
      const contorno = c.contorno ? { stroke: c.contorno.cor, strokeWidth: c.contorno.espessura, dash: c.contorno.tracejado, strokeScaleEnabled: false } : {};
      const sombra = c.sombra ? { shadowColor: c.sombra.cor, shadowBlur: c.sombra.desfoque, shadowOffset: { x: c.sombra.x, y: c.sombra.y }, shadowOpacity: c.sombra.opacidade } : {};
      const fill = propsDePreenchimento(c.preenchimento, w, h);
      if (c.forma === "elipse" || c.forma === "circulo") return <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} {...fill} {...contorno} {...sombra} />;
      if (c.forma === "caminho") return <Path data={escalarCaminho(c.d ?? "", w, h)} {...fill} {...contorno} {...sombra} />;
      if (c.forma === "linha") {
        const pts = (c.pontos ?? [0, 0, 1, 1]).map((v, i) => v * (i % 2 === 0 ? w : h));
        return <Line points={pts} lineCap="round" hitStrokeWidth={16} {...contorno} />;
      }
      return <Rect width={w} height={h} cornerRadius={c.raio ?? 0} {...fill} {...contorno} {...sombra} />;
    }
    case "textura":
      return <Textura c={c} />;
    case "imagem":
      return <Imagem c={c} />;
    case "logo":
      return <Logo c={c} />;
    case "texto": {
      // Com as quebras escolhidas, o Konva desliga a quebra automática — e
      // corta o caractere que passar da largura. Uma folga de 3% na caixa do
      // desenho (compensada no deslocamento, para o alinhamento não mudar)
      // absorve a diferença mínima entre a medida do gerador e a do canvas.
      const folga = c.quebras ? Math.max(4, w * 0.03) : 0;
      const deslocamento = c.alinhamento === "left" ? 0 : c.alinhamento === "center" ? -folga / 2 : -folga;
      return (
        <Text
          text={textoDesenhado(c)}
          x={deslocamento}
          width={w + folga}
          fontFamily={c.fonte}
          fontStyle={`${c.estilo === "italic" ? "italic " : ""}${c.peso}`}
          fontSize={c.tamanho}
          lineHeight={c.entrelinha}
          letterSpacing={c.espacamento}
          align={c.alinhamento}
          fill={c.cor}
          wrap={c.quebras ? "none" : "word"}
          {...(c.sombra ? { shadowColor: c.sombra.cor, shadowBlur: c.sombra.desfoque, shadowOffset: { x: c.sombra.x, y: c.sombra.y }, shadowOpacity: c.sombra.opacidade } : {})}
        />
      );
    }
    case "grupo":
      return (
        <>
          {c.filhos.map((f) => (
            <NoDaCamada key={f.id} c={f} />
          ))}
        </>
      );
  }
}

interface Interacao {
  editavel: boolean;
  aoSelecionar?: (id: string | null) => void;
  aoMudar?: (id: string, patch: Partial<Camada>) => void;
  registrar?: (id: string, no: Konva.Group | null) => void;
}

function NoDaCamada({ c, interacao }: { c: Camada; interacao?: Interacao }) {
  const ed = interacao?.editavel && c.tipo !== "fundo";
  return (
    <Group
      id={c.id}
      x={c.x}
      y={c.y}
      rotation={c.rotacao}
      opacity={c.opacidade}
      visible={!c.oculta}
      listening={!!interacao?.editavel}
      draggable={!!ed && !c.travada}
      ref={(no) => interacao?.registrar?.(c.id, no)}
      onMouseDown={(e) => {
        if (!interacao?.editavel) return;
        e.cancelBubble = true;
        interacao.aoSelecionar?.(c.tipo === "fundo" ? null : c.id);
      }}
      onTap={(e) => {
        if (!interacao?.editavel) return;
        e.cancelBubble = true;
        interacao.aoSelecionar?.(c.tipo === "fundo" ? null : c.id);
      }}
      onDragEnd={(e) => {
        if (!ed) return;
        interacao?.aoMudar?.(c.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
      }}
      onTransformEnd={(e) => {
        if (!ed) return;
        const no = e.target;
        const sx = no.scaleX();
        const sy = no.scaleY();
        no.scaleX(1);
        no.scaleY(1);
        const patch: Partial<Camada> = {
          x: Math.round(no.x()),
          y: Math.round(no.y()),
          rotacao: Math.round(no.rotation() * 10) / 10,
          largura: Math.max(8, Math.round(c.largura * sx)),
          altura: Math.max(8, Math.round(c.altura * sy)),
        };
        // Texto redimensionado muda a medida, não o corpo; as quebras
        // escolhidas pelo gerador deixam de valer e o Konva quebra de novo.
        if (c.tipo === "texto") Object.assign(patch, { altura: c.altura, quebras: undefined });
        interacao?.aoMudar?.(c.id, patch);
      }}
    >
      <Conteudo c={c} />
    </Group>
  );
}

export interface PropsDaArte {
  doc: Pick<DocumentoDeArte, "largura" | "altura" | "camadas">;
  /** Px da tela por px da arte. */
  escala: number;
  editavel?: boolean;
  selecionada?: string | null;
  aoSelecionar?: (id: string | null) => void;
  aoMudar?: (id: string, patch: Partial<Camada>) => void;
  className?: string;
}

export interface AlcaDaArte {
  stage: () => Konva.Stage | null;
}

export const ArteKonva = forwardRef<AlcaDaArte, PropsDaArte>(function ArteKonva(
  { doc, escala, editavel = false, selecionada = null, aoSelecionar, aoMudar, className },
  ref,
) {
  const stageRef = useRef<Konva.Stage>(null);
  const nos = useRef(new Map<string, Konva.Group>());
  const trRef = useRef<Konva.Transformer>(null);
  useImperativeHandle(ref, () => ({ stage: () => stageRef.current }), []);

  const sel = editavel && selecionada ? doc.camadas.find((c) => c.id === selecionada) ?? null : null;
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const no = sel ? nos.current.get(sel.id) : null;
    tr.nodes(no ? [no] : []);
    tr.getLayer()?.batchDraw();
  }, [sel, doc]);

  const interacao: Interacao | undefined = editavel
    ? { editavel, aoSelecionar, aoMudar, registrar: (id, no) => (no ? nos.current.set(id, no) : nos.current.delete(id)) }
    : undefined;

  return (
    <Stage
      ref={stageRef}
      width={Math.round(doc.largura * escala)}
      height={Math.round(doc.altura * escala)}
      scaleX={escala}
      scaleY={escala}
      className={className}
      onMouseDown={(e) => {
        if (editavel && e.target === e.target.getStage()) aoSelecionar?.(null);
      }}
    >
      <Layer listening={editavel}>
        {doc.camadas.map((c) => (
          <NoDaCamada key={c.id} c={c} interacao={interacao} />
        ))}
        {editavel && (
          <Transformer
            ref={trRef}
            rotateEnabled={!!sel && !sel.travada}
            resizeEnabled={!!sel && !sel.travada}
            keepRatio={sel?.tipo === "logo" ? true : undefined}
            enabledAnchors={
              sel?.travada
                ? []
                : sel?.tipo === "logo" || (sel?.tipo === "imagem" && sel.mascara.tipo === "circulo")
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : sel?.tipo === "texto"
                    ? ["middle-left", "middle-right"]
                    : undefined
            }
            borderStroke={sel?.travada ? "#9aa0a6" : "#e0b352"}
            borderDash={sel?.travada ? [6, 4] : undefined}
            anchorStroke="#e0b352"
            anchorFill="#ffffff"
            anchorSize={10}
            ignoreStroke
            boundBoxFunc={(antigo, novo) => (novo.width < 12 || novo.height < 12 ? antigo : novo)}
          />
        )}
      </Layer>
    </Stage>
  );
});
