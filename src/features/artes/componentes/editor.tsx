import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as IconeImagem,
  Lock,
  LockOpen,
  Redo2,
  RotateCcw,
  Save,
  Shapes,
  Shuffle,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { FONTES, acharFonte } from "../catalogo/tipografia.ts";
import {
  acharCamada,
  type Camada,
  type CamadaImagem,
  type CamadaTexto,
  type DocumentoDeArte,
  type Mascara,
} from "../documento.ts";
import { useEditorDeArte } from "../editor-store.ts";
import { FORMATOS } from "../formatos.ts";
import { acharVariante } from "../gerador/familias/index.ts";
import type { TipoDeRegeneracao } from "../gerador/lote.ts";
import { ajustar, type Medidor } from "../gerador/texto.ts";
import { ArteKonva } from "../konva/desenho.tsx";
import { carregarImagensDe, garantirFontesDe } from "../konva/recursos.ts";

/**
 * O editor de uma arte: o documento desenhado pelo Konva, as camadas e as
 * propriedades do que está selecionado.
 *
 * Mexer à mão marca a arte como ajustada; regenerar depois pede
 * confirmação e preserva o que estiver travado. Tudo tem desfazer.
 */

function iconeDe(c: Camada) {
  if (c.tipo === "texto") return Type;
  if (c.tipo === "imagem" || c.tipo === "logo") return IconeImagem;
  return Shapes;
}

/** Recalcula as quebras e a altura de um texto que mudou. */
function reajustarTexto(c: CamadaTexto, patch: Partial<CamadaTexto>, medidor: Medidor): Partial<CamadaTexto> {
  const n = { ...c, ...patch };
  const a = ajustar(
    {
      texto: n.texto,
      estilo: { fonte: n.fonte, peso: n.peso, estilo: n.estilo, maiusculas: n.maiusculas, espacamento: n.tamanho > 0 ? n.espacamento / n.tamanho : 0, entrelinha: n.entrelinha },
      larguraMax: n.largura,
      alturaMax: Infinity,
      tamanhoMax: n.tamanho,
      tamanhoMin: n.tamanho,
      maxLinhas: 60,
    },
    medidor,
  );
  if (!a) return { ...patch, quebras: undefined };
  return { ...patch, quebras: a.linhas.join("\n"), altura: Math.round(a.altura) };
}

function ListaDeCamadas({ camadas, nivel = 0 }: { camadas: Camada[]; nivel?: number }) {
  const selecionada = useEditorDeArte((s) => s.selecionada);
  const selecionar = useEditorDeArte((s) => s.selecionar);
  const mexer = useEditorDeArte((s) => s.mexer);
  return (
    <ul className="grid gap-0.5">
      {[...camadas].reverse().map((c) => {
        const Icone = iconeDe(c);
        return (
          <li key={c.id}>
            <div className={cn("flex items-center gap-0.5 rounded-md", selecionada === c.id && "bg-elevated")} style={{ paddingLeft: nivel * 12 }}>
              <button
                type="button"
                onClick={() => selecionar(c.tipo === "fundo" ? null : c.id)}
                aria-pressed={selecionada === c.id}
                className={cn("flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-secondary", selecionada === c.id ? "text-fg" : "text-muted hover:text-fg", c.oculta && "opacity-50")}
              >
                <Icone className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{c.tipo === "texto" ? c.texto || c.nome : c.nome}</span>
              </button>
              {c.tipo !== "fundo" && (
                <>
                  <Button size="iconSm" variant="ghost" aria-label={c.oculta ? `Mostrar ${c.nome}` : `Esconder ${c.nome}`} onClick={() => mexer(c.id, { oculta: !c.oculta })}>
                    {c.oculta ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button size="iconSm" variant="ghost" aria-label={c.travada ? `Destravar ${c.nome}` : `Travar ${c.nome}`} aria-pressed={!!c.travada} onClick={() => mexer(c.id, { travada: !c.travada })}>
                    {c.travada ? <Lock /> : <LockOpen className="opacity-40" />}
                  </Button>
                </>
              )}
            </div>
            {c.tipo === "grupo" && <ListaDeCamadas camadas={c.filhos} nivel={nivel + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

function Numero({ rotulo, valor, aoMudar, passo = 1, min, max }: { rotulo: string; valor: number; aoMudar: (v: number) => void; passo?: number; min?: number; max?: number }) {
  return (
    <label className="grid gap-0.5 text-caption text-muted">
      {rotulo}
      <Input type="number" value={Math.round(valor * 100) / 100} step={passo} min={min} max={max} aria-label={rotulo} onChange={(e) => Number.isFinite(Number(e.target.value)) && aoMudar(Number(e.target.value))} />
    </label>
  );
}

function Cor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-secondary text-muted">
      {rotulo}
      <input type="color" aria-label={rotulo} value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"} onChange={(e) => aoMudar(e.target.value)} className="h-7 w-12 cursor-pointer rounded-md bg-elevated p-0.5" />
    </label>
  );
}

function PropriedadesDoTexto({ c, medidor }: { c: CamadaTexto; medidor: Medidor }) {
  const mexer = useEditorDeArte((s) => s.mexer);
  const muda = (p: Partial<CamadaTexto>) => mexer(c.id, reajustarTexto(c, p, medidor));
  const fonte = acharFonte(c.fonte);
  return (
    <div className="grid gap-2">
      <Label htmlFor="texto-da-camada">Texto</Label>
      <Textarea id="texto-da-camada" rows={3} value={c.texto} onChange={(e) => muda({ texto: e.target.value })} aria-label="Conteúdo do texto" />
      <label className="grid gap-0.5 text-caption text-muted">
        Fonte
        <select className="field h-8" value={c.fonte} aria-label="Fonte" onChange={(e) => {
          const f = acharFonte(e.target.value);
          const peso = f && !f.pesos.includes(c.peso) ? f.pesos.reduce((a, b) => (Math.abs(b - c.peso) < Math.abs(a - c.peso) ? b : a)) : c.peso;
          muda({ fonte: e.target.value, peso, estilo: f?.italico ? c.estilo : "normal" });
        }}>
          {FONTES.map((f) => (
            <option key={f.familia} value={f.familia}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-0.5 text-caption text-muted">
          Peso
          <select className="field h-8" value={c.peso} aria-label="Peso da letra" onChange={(e) => muda({ peso: Number(e.target.value) })}>
            {(fonte?.pesos ?? [400, 700]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Numero rotulo="Tamanho (px)" valor={c.tamanho} min={8} max={600} aoMudar={(v) => muda({ tamanho: Math.max(8, v), espacamento: c.tamanho > 0 ? (c.espacamento / c.tamanho) * Math.max(8, v) : 0 })} />
        <Numero rotulo="Entrelinha" valor={c.entrelinha} passo={0.05} min={0.7} max={2.5} aoMudar={(v) => muda({ entrelinha: v })} />
        <Numero rotulo="Espaço entre letras (px)" valor={c.espacamento} passo={0.5} aoMudar={(v) => muda({ espacamento: v })} />
      </div>
      <Cor rotulo="Cor do texto" valor={c.cor} aoMudar={(v) => mexer(c.id, { cor: v })} />
      <div className="flex flex-wrap items-center gap-1">
        {(["left", "center", "right"] as const).map((a) => (
          <Button key={a} size="sm" variant={c.alinhamento === a ? "secondary" : "ghost"} aria-pressed={c.alinhamento === a} onClick={() => mexer(c.id, { alinhamento: a })}>
            {a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}
          </Button>
        ))}
        <Button size="sm" variant={c.maiusculas ? "secondary" : "ghost"} aria-pressed={c.maiusculas} onClick={() => muda({ maiusculas: !c.maiusculas })}>
          AA
        </Button>
        {fonte?.italico && (
          <Button size="sm" variant={c.estilo === "italic" ? "secondary" : "ghost"} aria-pressed={c.estilo === "italic"} onClick={() => muda({ estilo: c.estilo === "italic" ? "normal" : "italic" })}>
            <em>Itálico</em>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Recorte da imagem pelo ponto focal e pela aproximação. */
function recortar(c: CamadaImagem, zoom: number, foco: { x: number; y: number }): CamadaImagem["recorte"] {
  const razaoCaixa = c.largura / c.altura;
  const razaoFoto = c.larguraOriginal / c.alturaOriginal;
  let w = 1;
  let h = 1;
  if (razaoFoto > razaoCaixa) w = razaoCaixa / razaoFoto;
  else h = razaoFoto / razaoCaixa;
  w /= zoom;
  h /= zoom;
  return { x: Math.min(1 - w, Math.max(0, foco.x - w / 2)), y: Math.min(1 - h, Math.max(0, foco.y - h / 2)), largura: w, altura: h };
}

function zoomDe(c: CamadaImagem): number {
  const razaoCaixa = c.largura / c.altura;
  const razaoFoto = c.larguraOriginal / c.alturaOriginal;
  const base = razaoFoto > razaoCaixa ? razaoCaixa / razaoFoto : 1;
  return Math.max(1, base / Math.max(0.01, c.recorte.largura));
}

function PropriedadesDaImagem({ c, doc }: { c: CamadaImagem; doc: DocumentoDeArte }) {
  const mexer = useEditorDeArte((s) => s.mexer);
  const zoom = zoomDe(c);
  const foco = { x: c.recorte.x + c.recorte.largura / 2, y: c.recorte.y + c.recorte.altura / 2 };
  const ampliacao = c.origem === "usuario" ? c.largura / (c.recorte.largura * c.larguraOriginal) : 1;
  const fotos = doc.briefing.fotos;
  return (
    <div className="grid gap-2">
      {c.origem === "usuario" && (
        <>
          <label className="grid gap-0.5 text-caption text-muted">
            Aproximar ({zoom.toFixed(2)}×)
            <input type="range" min={1} max={3} step={0.05} value={zoom} aria-label="Aproximar a imagem" onChange={(e) => mexer(c.id, { recorte: recortar(c, Number(e.target.value), foco) })} />
          </label>
          <label className="grid gap-0.5 text-caption text-muted">
            Enquadrar na horizontal
            <input type="range" min={0} max={1} step={0.01} value={foco.x} aria-label="Enquadrar na horizontal" onChange={(e) => mexer(c.id, { recorte: recortar(c, zoom, { ...foco, x: Number(e.target.value) }) })} />
          </label>
          <label className="grid gap-0.5 text-caption text-muted">
            Enquadrar na vertical
            <input type="range" min={0} max={1} step={0.01} value={foco.y} aria-label="Enquadrar na vertical" onChange={(e) => mexer(c.id, { recorte: recortar(c, zoom, { ...foco, y: Number(e.target.value) }) })} />
          </label>
          {ampliacao > 1.25 && <p className="text-caption text-danger">A foto aparece {Math.round(ampliacao * 100)}% ampliada aqui e pode sair sem nitidez.</p>}
          {fotos.length > 1 && (
            <label className="grid gap-0.5 text-caption text-muted">
              Trocar por outra foto do briefing
              <select className="field h-8" value="" aria-label="Trocar a foto" onChange={(e) => {
                const f = fotos[Number(e.target.value)];
                if (!f) return;
                const nova: CamadaImagem = { ...c, src: f.src, recursoId: `usuario:${Number(e.target.value)}`, larguraOriginal: f.largura, alturaOriginal: f.altura, nome: f.nome };
                mexer(c.id, { src: nova.src, recursoId: nova.recursoId, larguraOriginal: f.largura, alturaOriginal: f.altura, nome: f.nome, recorte: recortar(nova, 1, f.pontoFocal) });
              }}>
                <option value="">Escolha…</option>
                {fotos.map((f, i) => (
                  <option key={f.src} value={i}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <label className="grid gap-0.5 text-caption text-muted">
        Forma
        <select className="field h-8" aria-label="Forma da imagem" value={c.mascara.tipo} onChange={(e) => {
          const t = e.target.value as Mascara["tipo"];
          const m: Mascara = t === "circulo" ? { tipo: "circulo" } : t === "arco" ? { tipo: "arco" } : t === "caminho" && c.mascara.tipo === "caminho" ? c.mascara : { tipo: "retangulo", raio: 0 };
          mexer(c.id, { mascara: m });
        }}>
          <option value="retangulo">Retângulo</option>
          <option value="circulo">Círculo</option>
          <option value="arco">Arco</option>
          {c.mascara.tipo === "caminho" && <option value="caminho">Forma livre</option>}
        </select>
      </label>
      {c.mascara.tipo === "retangulo" && <Numero rotulo="Cantos arredondados (px)" valor={c.mascara.raio} min={0} aoMudar={(v) => mexer(c.id, { mascara: { tipo: "retangulo", raio: Math.max(0, v) } })} />}
    </div>
  );
}

function PropriedadesComuns({ c }: { c: Camada }) {
  const mexer = useEditorDeArte((s) => s.mexer);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Numero rotulo="Esquerda" valor={c.x} aoMudar={(v) => mexer(c.id, { x: v })} />
      <Numero rotulo="Topo" valor={c.y} aoMudar={(v) => mexer(c.id, { y: v })} />
      <Numero rotulo="Largura" valor={c.largura} min={8} aoMudar={(v) => {
        const largura = Math.max(8, v);
        // A logo não estica: mudar a largura muda a altura junto.
        mexer(c.id, c.tipo === "logo" ? { largura, altura: (largura * c.alturaOriginal) / c.larguraOriginal } : { largura });
      }} />
      <Numero rotulo="Altura" valor={c.altura} min={8} aoMudar={(v) => {
        const altura = Math.max(8, v);
        mexer(c.id, c.tipo === "logo" ? { altura, largura: (altura * c.larguraOriginal) / c.alturaOriginal } : { altura });
      }} />
      <Numero rotulo="Giro (graus)" valor={c.rotacao} aoMudar={(v) => mexer(c.id, { rotacao: v })} />
      <label className="grid gap-0.5 text-caption text-muted">
        Opacidade
        <input type="range" min={0.05} max={1} step={0.05} value={c.opacidade} aria-label="Opacidade" onChange={(e) => mexer(c.id, { opacidade: Number(e.target.value) })} />
      </label>
    </div>
  );
}

export function EditorDeArte({
  medidor,
  aoSalvar,
  aoFechar,
  aoExportar,
  aoRegenerar,
  aoAdaptar,
}: {
  medidor: Medidor;
  aoSalvar: (doc: DocumentoDeArte) => void;
  aoFechar: () => void;
  aoExportar: (doc: DocumentoDeArte, formato: "png" | "jpeg") => void;
  aoRegenerar: (doc: DocumentoDeArte, tipo: TipoDeRegeneracao) => DocumentoDeArte | null;
  aoAdaptar: (doc: DocumentoDeArte, formatoId: string) => void;
}) {
  const doc = useEditorDeArte((s) => s.doc);
  const selecionada = useEditorDeArte((s) => s.selecionada);
  const selecionar = useEditorDeArte((s) => s.selecionar);
  const mexer = useEditorDeArte((s) => s.mexer);
  const trocar = useEditorDeArte((s) => s.trocar);
  const voltar = useEditorDeArte((s) => s.voltar);
  const avancar = useEditorDeArte((s) => s.avancar);
  const podeVoltar = useEditorDeArte((s) => s.desfazer.length > 0);
  const podeAvancar = useEditorDeArte((s) => s.refazer.length > 0);
  const restaurar = useEditorDeArte((s) => s.restaurarOriginal);
  const reordenar = useEditorDeArte((s) => s.reordenar);
  const duplicar = useEditorDeArte((s) => s.duplicarCamada);
  const excluir = useEditorDeArte((s) => s.excluirCamada);
  const alterado = useEditorDeArte((s) => s.alterado);
  const area = useRef<HTMLDivElement>(null);
  // O canvas não recebe foco; sem isto, Ctrl+Z depois de clicar na arte
  // iria para a página, e não para o editor.
  const raiz = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ w: 600, h: 500 });
  const [pronto, setPronto] = useState(false);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setTamanho({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    setTamanho({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!doc) return;
    let vivo = true;
    setPronto(false);
    void Promise.all([garantirFontesDe(doc.camadas), carregarImagensDe(doc.camadas)]).then(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
    // Só na troca de arte: mexer numa camada não recarrega fontes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const c = useMemo(() => (doc && selecionada ? acharCamada(doc.camadas, selecionada) : null), [doc, selecionada]);
  if (!doc) return null;
  const escala = Math.max(0.05, Math.min((tamanho.w - 16) / doc.largura, (tamanho.h - 16) / doc.altura));
  const podeRegenerarEstilo = !!acharVariante(doc.variante);
  const noTopo = doc.camadas.some((x) => x.id === selecionada);

  const regenerar = (tipo: TipoDeRegeneracao) => {
    if (doc.editadoManualmente && !window.confirm("Isso refaz a arte. As partes travadas ficam; os outros ajustes feitos à mão são substituídos (dá para desfazer). Continuar?")) return;
    const novo = aoRegenerar(doc, tipo);
    if (!novo) {
      toast("Não achei outra versão que caiba com este conteúdo.");
      return;
    }
    trocar(novo);
  };

  return (
    <div
      ref={raiz}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col gap-2 outline-none"
      onKeyDown={(e) => {
        const alvo = e.target as HTMLElement;
        const digitando = alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT";
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !digitando) {
          e.preventDefault();
          if (e.shiftKey) avancar();
          else voltar();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !digitando) {
          e.preventDefault();
          avancar();
        } else if (e.key === "Delete" && !digitando && selecionada) {
          excluir(selecionada);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => aoSalvar(doc)}>
          <Save /> Salvar
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <Download /> Exportar
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => aoExportar(doc, "png")}>PNG · {doc.largura}×{doc.altura}</MenuItem>
            <MenuItem onSelect={() => aoExportar(doc, "jpeg")}>JPEG · {doc.largura}×{doc.altura}</MenuItem>
          </MenuContent>
        </Menu>
        <Hint label="Desfazer" keys="Ctrl+Z">
          <Button size="iconSm" variant="ghost" aria-label="Desfazer" disabled={!podeVoltar} onClick={voltar}>
            <Undo2 />
          </Button>
        </Hint>
        <Hint label="Refazer" keys="Ctrl+Y">
          <Button size="iconSm" variant="ghost" aria-label="Refazer" disabled={!podeAvancar} onClick={avancar}>
            <Redo2 />
          </Button>
        </Hint>
        <Hint label="Voltar à composição como o gerador entregou">
          <Button size="sm" variant="ghost" onClick={() => window.confirm("Voltar a arte ao original? Dá para desfazer.") && restaurar()}>
            <RotateCcw /> Original
          </Button>
        </Hint>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <Shuffle /> Outra versão
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Mesmo conteúdo, outra…</MenuLabel>
            <MenuItem onSelect={() => regenerar("composicao")}>Composição</MenuItem>
            <MenuItem disabled={!podeRegenerarEstilo} onSelect={() => regenerar("paleta")}>Paleta de cores</MenuItem>
            <MenuItem disabled={!podeRegenerarEstilo} onSelect={() => regenerar("tipografia")}>Tipografia</MenuItem>
            <MenuItem disabled={!podeRegenerarEstilo} onSelect={() => regenerar("imagens")}>Imagens</MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost">
              Noutro formato
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Recompõe, não estica</MenuLabel>
            <MenuSeparator />
            {FORMATOS.filter((f) => f.id !== doc.formatoId).map((f) => (
              <MenuItem key={f.id} onSelect={() => aoAdaptar(doc, f.id)}>
                {f.nome} · {f.largura}×{f.altura}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <span className="ml-auto text-caption text-subtle">{alterado ? "Não salvo" : "Salvo"}</span>
        <Button size="sm" variant="ghost" aria-label="Fechar a arte" onClick={aoFechar}>
          <X /> Fechar
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="lumen-scroll hidden w-56 shrink-0 overflow-y-auto md:block" aria-label="Camadas">
          <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-subtle">Camadas</p>
          <ListaDeCamadas camadas={doc.camadas} />
        </aside>

        <div ref={area} className="relative grid min-h-0 min-w-0 flex-1 place-items-center rounded-lg bg-elevated" data-editor-de-arte onPointerDown={() => raiz.current?.focus({ preventScroll: true })}>
          {pronto ? (
            <ArteKonva doc={doc} escala={escala} editavel selecionada={selecionada} aoSelecionar={selecionar} aoMudar={mexer} className="shadow-[var(--shadow-pop)]" />
          ) : (
            <p className="text-secondary text-muted">Carregando fontes e imagens…</p>
          )}
        </div>

        <aside className="lumen-scroll w-64 shrink-0 overflow-y-auto" aria-label="Propriedades">
          {doc.avisos.length > 0 && (
            <div className="mb-3 grid gap-1 rounded-md bg-elevated p-2">
              {doc.avisos.map((a) => (
                <p key={a} className="text-caption text-danger">
                  {a}
                </p>
              ))}
            </div>
          )}
          {!c ? (
            <p className="text-secondary text-muted">Clique num elemento da arte ou na lista de camadas para mexer nele.</p>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center gap-1">
                <p className="min-w-0 flex-1 truncate text-body font-semibold">{c.nome}</p>
                {noTopo && (
                  <>
                    <Hint label="Para a frente">
                      <Button size="iconSm" variant="ghost" aria-label="Trazer para a frente" onClick={() => reordenar(c.id, "frente")}>
                        <ArrowUp />
                      </Button>
                    </Hint>
                    <Hint label="Para trás">
                      <Button size="iconSm" variant="ghost" aria-label="Mandar para trás" onClick={() => reordenar(c.id, "tras")}>
                        <ArrowDown />
                      </Button>
                    </Hint>
                    <Hint label="Duplicar">
                      <Button size="iconSm" variant="ghost" aria-label="Duplicar" onClick={() => duplicar(c.id)}>
                        <Copy />
                      </Button>
                    </Hint>
                  </>
                )}
                {c.opcional && (
                  <Hint label="Excluir (Delete)">
                    <Button size="iconSm" variant="ghost" aria-label="Excluir" className="hover:text-danger" onClick={() => excluir(c.id)}>
                      <Trash2 />
                    </Button>
                  </Hint>
                )}
              </div>
              {c.travada && <p className="text-caption text-muted">Travado: não se move e fica igual quando a arte é refeita.</p>}
              {c.tipo === "texto" && <PropriedadesDoTexto c={c} medidor={medidor} />}
              {c.tipo === "imagem" && <PropriedadesDaImagem c={c} doc={doc} />}
              {c.tipo === "logo" && (
                <label className="flex items-center gap-2 text-secondary">
                  <input type="checkbox" checked={!!c.placa} onChange={(e) => mexer(c.id, { placa: e.target.checked ? { cor: "#ffffff", raio: c.altura * 0.18, margem: c.altura * 0.16 } : undefined })} />
                  Placa atrás da logo
                </label>
              )}
              {c.tipo === "logo" && c.placa && <Cor rotulo="Cor da placa" valor={c.placa.cor} aoMudar={(v) => mexer(c.id, { placa: { ...c.placa!, cor: v } })} />}
              {c.tipo === "forma" && c.preenchimento?.tipo === "solido" && <Cor rotulo="Cor" valor={c.preenchimento.cor} aoMudar={(v) => mexer(c.id, { preenchimento: { tipo: "solido", cor: v } })} />}
              {c.tipo === "forma" && c.contorno && <Cor rotulo="Cor do contorno" valor={c.contorno.cor} aoMudar={(v) => mexer(c.id, { contorno: { ...c.contorno!, cor: v } })} />}
              <PropriedadesComuns c={c} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
