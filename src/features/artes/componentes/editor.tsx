import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Download,
  Eye,
  EyeOff,
  Image as Icone,
  Lock,
  Save,
  Shuffle,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { FORMATOS } from "../formatos.ts";
import { nomeDeArquivo, paraPng } from "../exportar.ts";
import { paraSvg } from "../render.ts";
import { useArtesStore } from "../store.ts";
import type { Documento, Elemento, ElementoTexto } from "../types.ts";
import { conferir, consertar } from "../validacao.ts";
import { montar } from "../variacoes.ts";

/**
 * O editor da arte.
 *
 * Mostra o mesmo SVG que vai virar arquivo, uma lista de camadas e as
 * propriedades do que está selecionado. Não tenta ser um editor gráfico
 * completo: quem usa isto quer ajustar um texto e exportar, não desenhar.
 *
 * A verificação fica sempre à vista, e o botão de consertar só aparece
 * quando há o que consertar — avisar sem oferecer a saída seria só reclamar.
 */

function rotuloDoElemento(el: Elemento): string {
  if (el.tipo === "fundo") return "Fundo";
  if (el.tipo === "imagem") return el.id === "logo" ? "Logo" : "Imagem";
  if (el.tipo === "forma") return "Enfeite";
  return el.texto.slice(0, 28) || "Texto";
}

export function EditorDeArte({ aoSair }: { aoSair: () => void }) {
  const doc = useArtesStore((s) => s.aberto);
  const selecionado = useArtesStore((s) => s.elementoSelecionado);
  const selecionar = useArtesStore((s) => s.selecionar);
  const mexer = useArtesStore((s) => s.mexer);
  const trocarDocumento = useArtesStore((s) => s.trocarDocumento);
  const desfazer = useArtesStore((s) => s.desfazer);
  const salvar = useArtesStore((s) => s.salvar);
  const adaptar = useArtesStore((s) => s.adaptar);
  const [exportando, setExportando] = useState(false);

  const svg = useMemo(() => (doc ? paraSvg(doc) : ""), [doc]);
  const achados = useMemo(() => (doc ? conferir(doc) : []), [doc]);
  if (!doc) return null;

  const el = doc.elementos.find((e) => e.id === selecionado) ?? null;
  const texto = el?.tipo === "texto" ? el : null;

  const exportar = async (tipo: "image/png" | "image/jpeg") => {
    setExportando(true);
    try {
      const r = await paraPng(doc, { tipo, escala: 1 });
      if (!r.ok || !r.blob) {
        toast(r.erro ?? "Não consegui exportar.");
        return;
      }
      const url = URL.createObjectURL(r.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDeArquivo(doc, tipo === "image/png" ? "png" : "jpg");
      a.click();
      URL.revokeObjectURL(url);
      toast("Arte exportada.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {/* Prévia: é o mesmo SVG do arquivo, não uma aproximação. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-elevated p-3">
          <div
            className="max-h-full max-w-full overflow-hidden rounded-md shadow-[var(--shadow-border)] [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[52vh] [&>svg]:w-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        {achados.length > 0 && (
          <div className="rounded-md bg-elevated p-2">
            <ul className="space-y-0.5">
              {achados.slice(0, 4).map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-secondary",
                    a.gravidade === "erro" ? "text-danger" : "text-muted",
                  )}
                >
                  {a.texto}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="secondary"
              className="mt-1.5"
              onClick={() => trocarDocumento(consertar(doc))}
            >
              <Wand2 /> Consertar o que dá
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => { salvar(); toast("Arte salva."); }}>
            <Save /> Salvar
          </Button>
          <Button size="sm" variant="secondary" loading={exportando} onClick={() => void exportar("image/png")}>
            <Download /> PNG
          </Button>
          <Button size="sm" variant="ghost" loading={exportando} onClick={() => void exportar("image/jpeg")}>
            JPEG
          </Button>
          <Hint label="Voltar a última mudança">
            <Button size="iconSm" variant="ghost" aria-label="Desfazer" onClick={desfazer}>
              <Undo2 />
            </Button>
          </Hint>
          <Hint label="Outra combinação, mesmos dados">
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Trocar a combinação"
              onClick={() =>
                trocarDocumento(
                  montar({
                    id: doc.id,
                    nome: doc.nome,
                    dados: doc.dados,
                    semente: Math.floor(Math.random() * 1_000_000) + 1,
                    formatoId: doc.formatoId,
                    largura: doc.largura,
                    altura: doc.altura,
                  }),
                )
              }
            >
              <Shuffle />
            </Button>
          </Hint>
          <select
            className="field ml-auto h-8 max-w-44"
            aria-label="Gerar noutro formato"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              adaptar(e.target.value);
              toast("Versão nova criada neste formato.");
            }}
          >
            <option value="">Gerar noutro formato…</option>
            {FORMATOS.filter((f) => f.id !== doc.formatoId).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={aoSair}>
            Fechar
          </Button>
        </div>
      </div>

      {/* Camadas e propriedades */}
      <div className="lumen-scroll flex w-64 shrink-0 flex-col gap-3 overflow-y-auto">
        <div>
          <Label>Camadas</Label>
          <ul className="mt-1 space-y-0.5">
            {[...doc.elementos].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selecionar(e.id)}
                  aria-pressed={selecionado === e.id}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-secondary",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    selecionado === e.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {e.tipo === "texto" ? (
                    <Type className="size-3 shrink-0" aria-hidden />
                  ) : (
                    <Icone className="size-3 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{rotuloDoElemento(e)}</span>
                </button>
                {e.tipo !== "fundo" && (
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={e.oculto ? `Mostrar ${rotuloDoElemento(e)}` : `Esconder ${rotuloDoElemento(e)}`}
                    onClick={() => mexer(e.id, { oculto: !e.oculto } as Partial<Elemento>)}
                  >
                    {e.oculto ? <EyeOff /> : <Eye />}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {texto && <PropriedadesDoTexto el={texto} aoMudar={(p) => mexer(texto.id, p)} />}
        {el && el.tipo !== "texto" && el.tipo !== "fundo" && (
          <Posicao el={el} aoMudar={(p) => mexer(el.id, p)} />
        )}
      </div>
    </div>
  );
}

function PropriedadesDoTexto({
  el,
  aoMudar,
}: {
  el: ElementoTexto;
  aoMudar: (p: Partial<ElementoTexto>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Texto</Label>
      <Textarea
        value={el.texto}
        rows={3}
        aria-label="Conteúdo do texto"
        onChange={(e) => aoMudar({ texto: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Tamanho</Label>
          <Input
            type="number"
            min={1}
            max={20}
            step={0.2}
            aria-label="Tamanho da letra"
            value={Math.round(el.tamanho * 1000) / 10}
            onChange={(e) => aoMudar({ tamanho: Number(e.target.value) / 100 })}
          />
        </div>
        <div>
          <Label>Cor</Label>
          <input
            type="color"
            className="field h-8 w-full p-0.5"
            aria-label="Cor do texto"
            value={el.cor}
            onChange={(e) => aoMudar({ cor: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {([
          ["left", AlignLeft, "à esquerda"],
          ["center", AlignCenter, "ao centro"],
          ["right", AlignRight, "à direita"],
        ] as const).map(([valor, Icone2, nome]) => (
          <Button
            key={valor}
            size="iconSm"
            variant={el.alinhamento === valor ? "secondary" : "ghost"}
            aria-label={`Alinhar ${nome}`}
            aria-pressed={el.alinhamento === valor}
            onClick={() => aoMudar({ alinhamento: valor })}
          >
            <Icone2 />
          </Button>
        ))}
        <Button
          size="iconSm"
          variant={el.maiuscula ? "secondary" : "ghost"}
          aria-label="Tudo em maiúsculas"
          aria-pressed={el.maiuscula}
          onClick={() => aoMudar({ maiuscula: !el.maiuscula })}
        >
          <Check />
        </Button>
        <Button
          size="iconSm"
          variant={el.travado ? "secondary" : "ghost"}
          aria-label="Travar este elemento"
          aria-pressed={Boolean(el.travado)}
          onClick={() => aoMudar({ travado: !el.travado })}
        >
          <Lock />
        </Button>
      </div>

      <Posicao el={el} aoMudar={aoMudar as (p: Partial<Elemento>) => void} />
    </div>
  );
}

/** Posição em porcento do quadro — é assim que o documento guarda. */
function Posicao({ el, aoMudar }: { el: Elemento; aoMudar: (p: Partial<Elemento>) => void }) {
  if (el.tipo === "fundo") return null;
  const campos = [
    ["x", "Esquerda"],
    ["y", "Topo"],
    ["largura", "Largura"],
    ["altura", "Altura"],
  ] as const;
  return (
    <div>
      <Label>Posição (% do quadro)</Label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {campos.map(([chave, nome]) => (
          <Input
            key={chave}
            type="number"
            min={-20}
            max={140}
            step={1}
            aria-label={nome}
            value={Math.round(el.caixa[chave] * 100)}
            onChange={(e) =>
              aoMudar({ caixa: { ...el.caixa, [chave]: Number(e.target.value) / 100 } } as Partial<Elemento>)
            }
          />
        ))}
      </div>
    </div>
  );
}

/** A miniatura de uma arte, desenhada pelo mesmo renderizador do arquivo. */
export function Miniatura({ doc, className }: { doc: Documento; className?: string }) {
  const svg = useMemo(() => paraSvg(doc, 320 / Math.max(doc.largura, doc.altura)), [doc]);
  return (
    <div
      aria-hidden
      className={cn("overflow-hidden rounded-md [&>svg]:block [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
