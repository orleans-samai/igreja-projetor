import { ArrowLeft, Columns2, Download, Expand, Layers, Pencil, RefreshCw, Save, Square, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { DocumentoDeArte } from "../documento.ts";
import { acharFormato } from "../formatos.ts";
import { Miniatura } from "./miniatura.tsx";

/**
 * A galeria do lote: as opções lado a lado, já do tamanho real reduzido.
 *
 * O rótulo ("Editorial claro") ajuda a conversar sobre a opção; a
 * diferença entre elas tem de aparecer na miniatura, não no nome.
 */

export interface OpcaoDaGaleria {
  doc: DocumentoDeArte | null;
  /** A opção original do lote, no formato principal. */
  base: DocumentoDeArte;
}

export function Galeria({
  opcoes,
  formatos,
  formato,
  aoTrocarFormato,
  gerando,
  progresso,
  limitacoes,
  favoritas,
  aoFavoritar,
  aoEditar,
  aoExportar,
  aoNovoLote,
  aoParar,
  aoSalvarFavoritas,
  aoVoltar,
  aoInicio,
  aoVariacoes,
  emVariacoes,
  aoVoltarAoLote,
}: {
  opcoes: OpcaoDaGaleria[];
  formatos: string[];
  formato: string;
  aoTrocarFormato: (f: string) => void;
  gerando: boolean;
  progresso: { prontas: number; total: number };
  limitacoes: string[];
  favoritas: Set<string>;
  aoFavoritar: (id: string) => void;
  aoEditar: (doc: DocumentoDeArte) => void;
  aoExportar: (doc: DocumentoDeArte, formato: "png" | "jpeg") => void;
  aoNovoLote: () => void;
  aoParar: () => void;
  aoSalvarFavoritas: () => void;
  aoVoltar: () => void;
  aoInicio: () => void;
  aoVariacoes: (doc: DocumentoDeArte) => void;
  /** Mostrando variações de uma opção, e não o lote. */
  emVariacoes: string | null;
  aoVoltarAoLote: () => void;
}) {
  const [ampliada, setAmpliada] = useState<DocumentoDeArte | null>(null);
  const [comparar, setComparar] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);
  const docs = useMemo(() => opcoes.map((o) => o.doc).filter((d): d is DocumentoDeArte => !!d), [opcoes]);
  const emComparacao = docs.filter((d) => comparar.includes(d.id));

  const alternarComparar = (id: string) => setComparar((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4)));

  const acoes = (d: DocumentoDeArte, grande = false) => (
    <div className="flex items-center gap-0.5">
      <Hint label="Variações desta opção">
        <Button size={grande ? "sm" : "iconSm"} variant="ghost" aria-label={`Variações de ${d.rotulo}`} onClick={() => aoVariacoes(d)}>
          <Layers /> {grande && "Variações"}
        </Button>
      </Hint>
      <Hint label="Editar esta opção">
        <Button size={grande ? "sm" : "iconSm"} variant={grande ? "default" : "ghost"} aria-label={`Editar ${d.rotulo}`} onClick={() => aoEditar(d)}>
          <Pencil /> {grande && "Editar"}
        </Button>
      </Hint>
      <Menu>
        <MenuTrigger asChild>
          <Button size={grande ? "sm" : "iconSm"} variant={grande ? "secondary" : "ghost"} aria-label={`Exportar ${d.rotulo}`}>
            <Download /> {grande && "Exportar"}
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={() => aoExportar(d, "png")}>PNG · {d.largura}×{d.altura}</MenuItem>
          <MenuItem onSelect={() => aoExportar(d, "jpeg")}>JPEG · {d.largura}×{d.altura}</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );

  if (comparando && emComparacao.length >= 2) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setComparando(false)}>
            <ArrowLeft /> Voltar às opções
          </Button>
          <p className="text-secondary text-muted">Comparando {emComparacao.length} opções.</p>
        </div>
        <div className={cn("lumen-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto", emComparacao.length > 2 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
          {emComparacao.map((d) => (
            <figure key={d.id} className="grid content-start gap-2">
              <Miniatura doc={d} largura={720} className="shadow-[var(--shadow-border)]" />
              <figcaption className="flex items-center justify-between gap-2">
                <span className="text-body font-medium">{d.rotulo}</span>
                {acoes(d, true)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={aoVoltar}>
          <ArrowLeft /> Briefing
        </Button>
        <Button size="sm" variant="ghost" onClick={aoInicio}>
          Artes salvas
        </Button>
        {emVariacoes && (
          <>
            <span className="text-secondary text-muted">Variações de “{emVariacoes}”</span>
            <Button size="sm" variant="secondary" onClick={aoVoltarAoLote}>
              Voltar ao lote
            </Button>
          </>
        )}
        {formatos.length > 1 && (
          <Segmented
            label="Formato"
            items={formatos.map((f) => ({ value: f, label: acharFormato(f)?.nome ?? f }))}
            value={formato}
            onChange={aoTrocarFormato}
          />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {comparar.length >= 2 && (
            <Button size="sm" variant="secondary" onClick={() => setComparando(true)}>
              <Columns2 /> Comparar ({comparar.length})
            </Button>
          )}
          {favoritas.size > 0 && (
            <Button size="sm" variant="secondary" onClick={aoSalvarFavoritas}>
              <Save /> Salvar favoritas ({favoritas.size})
            </Button>
          )}
          {gerando ? (
            <Button size="sm" variant="secondary" onClick={aoParar}>
              <Square /> Parar ({progresso.prontas} de {progresso.total})
            </Button>
          ) : (
            <Button size="sm" onClick={aoNovoLote}>
              <RefreshCw /> Novo lote
            </Button>
          )}
        </div>
      </div>

      {limitacoes.length > 0 && (
        <div role="status" className="rounded-md bg-elevated px-3 py-2 text-secondary text-muted shadow-[var(--shadow-border)]">
          {limitacoes.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}

      <ul className="lumen-scroll grid min-h-0 flex-1 grid-cols-2 content-start gap-4 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" aria-label="Opções de arte">
        {opcoes.map(({ doc, base }) => (
          <li key={base.id} className="grid content-start gap-1.5" data-opcao-de-arte>
            {doc ? (
              <button type="button" className="block text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Ampliar ${doc.rotulo}`} onClick={() => setAmpliada(doc)}>
                <Miniatura doc={doc} className="shadow-[var(--shadow-border)]" />
              </button>
            ) : (
              <div className="grid aspect-square place-items-center rounded-md bg-elevated p-3 text-center text-secondary text-muted">
                Esta composição não se reorganiza bem neste formato.
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-secondary font-medium text-fg">{base.rotulo}</span>
              <Hint label={favoritas.has(base.id) ? "Tirar dos favoritos" : "Favoritar"}>
                <Button size="iconSm" variant="ghost" aria-pressed={favoritas.has(base.id)} aria-label={`Favoritar ${base.rotulo}`} onClick={() => aoFavoritar(base.id)}>
                  <Star className={favoritas.has(base.id) ? "fill-current text-[#e0b352]" : undefined} />
                </Button>
              </Hint>
              {doc && (
                <label className="inline-flex cursor-pointer items-center gap-1 px-1 text-caption text-muted" title="Comparar">
                  <input type="checkbox" checked={comparar.includes(doc.id)} onChange={() => alternarComparar(doc.id)} aria-label={`Comparar ${base.rotulo}`} />
                </label>
              )}
              {doc && acoes(doc)}
            </div>
            {doc && doc.avisos.length > 0 && <p className="text-caption text-danger">{doc.avisos[0]}</p>}
          </li>
        ))}
        {gerando &&
          Array.from({ length: Math.max(0, progresso.total - opcoes.length) }, (_, i) => (
            <li key={`vazia-${i}`} className="aspect-square animate-pulse rounded-md bg-elevated" aria-hidden />
          ))}
      </ul>

      {ampliada && (
        <div className="absolute inset-0 z-20 flex flex-col gap-2 rounded-lg bg-surface/95 p-3 backdrop-blur-sm" role="dialog" aria-label={`Opção ${ampliada.rotulo}`}>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-body font-semibold">{ampliada.rotulo}</p>
            {acoes(ampliada, true)}
            <Button size="iconSm" variant="ghost" aria-label="Fechar a ampliação" onClick={() => setAmpliada(null)}>
              <X />
            </Button>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center">
            <div style={{ height: "100%", aspectRatio: `${ampliada.largura} / ${ampliada.altura}`, maxWidth: "100%" }}>
              <Miniatura doc={ampliada} largura={1080} className="size-full shadow-[var(--shadow-border)]" />
            </div>
          </div>
          {ampliada.avisos.map((a) => (
            <p key={a} className="text-secondary text-danger">
              {a}
            </p>
          ))}
        </div>
      )}
      {!gerando && opcoes.length === 0 && (
        <div className="grid flex-1 place-items-center text-secondary text-muted">
          <Expand className="size-6" aria-hidden />
        </div>
      )}
    </div>
  );
}
