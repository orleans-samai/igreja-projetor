import { ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { PUBLICOS, QUANTIDADE_MAXIMA, type Briefing, type CampoDeTexto, type ImagemDoUsuario } from "../briefing.ts";
import { CATEGORIAS, acharCategoria, type AjusteDeCategoria } from "../catalogo/categorias.ts";
import { ILUSTRACOES } from "../catalogo/ilustracoes.ts";
import type { FamiliaId } from "../documento.ts";
import { FORMATOS } from "../formatos.ts";
import { FAMILIAS } from "../gerador/familias/index.ts";
import { importarImagem } from "./imagens-do-briefing.ts";

/**
 * O briefing: o que é, o que está escrito, que imagens, que cara.
 *
 * Só o nome do evento é obrigatório. Campo em branco não aparece na arte e
 * não deixa buraco — por isso nenhum campo vem preenchido com texto de
 * exemplo: o que está aqui é o que a igreja escreveu.
 */

const CAMPOS: { chave: CampoDeTexto; rotulo: string; longo?: boolean; dica?: string }[] = [
  { chave: "titulo", rotulo: "Nome do evento" },
  { chave: "subtitulo", rotulo: "Subtítulo" },
  { chave: "mensagem", rotulo: "Mensagem ou chamada", dica: "Ex.: o convite, numa frase." },
  { chave: "data", rotulo: "Data" },
  { chave: "horario", rotulo: "Horário" },
  { chave: "local", rotulo: "Local" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "organizacao", rotulo: "Organização" },
  { chave: "tema", rotulo: "Tema" },
  { chave: "pregador", rotulo: "Pregador" },
  { chave: "ministerio", rotulo: "Ministério de louvor" },
  { chave: "palavraBase", rotulo: "Palavra-base" },
  { chave: "referencia", rotulo: "Referência bíblica" },
  { chave: "textoBiblico", rotulo: "Texto bíblico", longo: true },
  { chave: "informacoes", rotulo: "Informações", longo: true },
  { chave: "contato", rotulo: "Contato" },
  { chave: "redes", rotulo: "Redes sociais" },
];

const PRINCIPAIS = ["quadrado", "retrato", "story", "projecao"];

const NOMES_DE_ASSUNTO = [...new Set(ILUSTRACOES.flatMap((i) => i.assuntos))].sort();

function Secao({ titulo, children, aberta = true }: { titulo: string; children: React.ReactNode; aberta?: boolean }) {
  return (
    <details open={aberta} className="group rounded-lg bg-surface shadow-[var(--shadow-border)]">
      <summary className="cursor-pointer select-none px-3 py-2 text-body font-semibold text-fg">{titulo}</summary>
      <div className="grid gap-3 px-3 pb-3">{children}</div>
    </details>
  );
}

function Cores({ rotulo, cores, aoMudar }: { rotulo: string; cores: string[]; aoMudar: (c: string[]) => void }) {
  return (
    <div>
      <Label>{rotulo}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {cores.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-elevated p-1 shadow-[var(--shadow-border)]">
            <input type="color" value={c} aria-label={`${rotulo} ${i + 1}`} className="h-6 w-8 cursor-pointer rounded" onChange={(e) => aoMudar(cores.map((x, k) => (k === i ? e.target.value : x)))} />
            <button type="button" aria-label="Remover cor" className="rounded p-0.5 text-muted hover:text-danger" onClick={() => aoMudar(cores.filter((_, k) => k !== i))}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {cores.length < 4 && (
          <Button size="sm" variant="ghost" onClick={() => aoMudar([...cores, "#2f6fa8"])}>
            <Plus /> Cor
          </Button>
        )}
      </div>
    </div>
  );
}

function Foto({ f, aoMudar, aoRemover }: { f: ImagemDoUsuario; aoMudar: (f: ImagemDoUsuario) => void; aoRemover: () => void }) {
  return (
    <li className="grid gap-1">
      {/* Clicar na foto marca o assunto: o recorte nunca corta esse ponto. */}
      <button
        type="button"
        className="relative block overflow-hidden rounded-md bg-elevated shadow-[var(--shadow-border)]"
        style={{ aspectRatio: `${f.largura} / ${f.altura}` }}
        aria-label={`Marcar o assunto da foto ${f.nome}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          aoMudar({ ...f, pontoFocal: { x: Math.round(((e.clientX - r.left) / r.width) * 100) / 100, y: Math.round(((e.clientY - r.top) / r.height) * 100) / 100 } });
        }}
      >
        <img src={f.src} alt="" className="size-full object-cover" draggable={false} />
        <span
          aria-hidden
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#e0b352] shadow"
          style={{ left: `${f.pontoFocal.x * 100}%`, top: `${f.pontoFocal.y * 100}%` }}
        />
      </button>
      <div className="flex items-center gap-1">
        <select
          className="field h-7 min-w-0 flex-1 text-secondary"
          aria-label={`Tipo de ${f.nome}`}
          value={f.tipo}
          onChange={(e) => aoMudar({ ...f, tipo: e.target.value as ImagemDoUsuario["tipo"] })}
        >
          <option value="foto">Foto</option>
          <option value="ilustracao">Ilustração</option>
        </select>
        <Button size="iconSm" variant="ghost" aria-label={`Tirar ${f.nome}`} onClick={aoRemover}>
          <Trash2 />
        </Button>
      </div>
      {Math.max(f.largura, f.altura) < 1200 && <p className="text-caption text-danger">Foto pequena: pode sair sem nitidez.</p>}
    </li>
  );
}

export function Formulario({
  b,
  aoMudar,
  temLogo,
  ajuste,
  aoAjustar,
  aoGerar,
  buscarVersiculo,
}: {
  b: Briefing;
  aoMudar: (b: Briefing) => void;
  temLogo: boolean;
  ajuste: AjusteDeCategoria;
  aoAjustar: (a: AjusteDeCategoria) => void;
  aoGerar: () => void;
  buscarVersiculo: (referencia: string) => string | null;
}) {
  const [importando, setImportando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const categoria = acharCategoria(b.categoria);
  const muda = (patch: Partial<Briefing>) => aoMudar({ ...b, ...patch });

  const adicionarFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setImportando(true);
    const novas: ImagemDoUsuario[] = [];
    for (const f of Array.from(lista).slice(0, 8)) {
      try {
        novas.push(await importarImagem(f, "foto"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não consegui usar essa imagem.");
      }
    }
    setImportando(false);
    if (novas.length) aoMudar({ ...b, fotos: [...b.fotos, ...novas] });
  };

  const familiasDesligadas = new Set(ajuste.familiasDesligadas ?? []);
  const assuntosDaCategoria = new Set([...categoria.assuntos, ...(ajuste.assuntosExtras ?? [])].filter((a) => !(ajuste.assuntosRemovidos ?? []).includes(a)));

  return (
    <div className="grid gap-3">
      <Secao titulo="O evento">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={b.categoria === c.id}
              onClick={() => muda({ categoria: c.id })}
              className={cn(
                "rounded-md px-3 py-1.5 text-secondary",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                b.categoria === c.id ? "bg-primary text-primary-fg" : "bg-elevated text-fg hover:bg-raised",
              )}
            >
              {c.nome}
            </button>
          ))}
        </div>
        <div className="grid gap-1 sm:max-w-60">
          <Label htmlFor="arte-publico">Público</Label>
          <select id="arte-publico" className="field h-8" value={b.publico} onChange={(e) => muda({ publico: e.target.value as Briefing["publico"] })}>
            <option value="">O de sempre da categoria</option>
            {PUBLICOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </Secao>

      <Secao titulo="O que a arte diz">
        <p className="text-secondary text-muted">Só o nome é obrigatório. Campo em branco não aparece na arte.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.chave} className={c.longo ? "sm:col-span-2" : undefined}>
              <Label htmlFor={`arte-${c.chave}`}>{c.rotulo}</Label>
              {c.longo ? (
                <Textarea id={`arte-${c.chave}`} rows={2} value={b[c.chave]} onChange={(e) => muda({ [c.chave]: e.target.value } as Partial<Briefing>)} />
              ) : (
                <Input id={`arte-${c.chave}`} value={b[c.chave]} placeholder={c.dica} onChange={(e) => muda({ [c.chave]: e.target.value } as Partial<Briefing>)} />
              )}
            </div>
          ))}
        </div>
        {/* O texto bíblico vem da Bíblia do Lúmen — nunca inventado. */}
        {b.referencia.trim() && !b.textoBiblico.trim() && (
          <Button
            size="sm"
            variant="secondary"
            className="justify-self-start"
            onClick={() => {
              const t = buscarVersiculo(b.referencia);
              if (!t) toast("Não achei essa passagem na Bíblia instalada.");
              else muda({ textoBiblico: t });
            }}
          >
            Buscar “{b.referencia}” na Bíblia do Lúmen
          </Button>
        )}
      </Secao>

      <Secao titulo="Imagens">
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={!!b.logo} disabled={!temLogo} onChange={(e) => muda({ logo: e.target.checked ? ({ src: "", largura: 1, altura: 1, luz: 0.5, transparente: true } as Briefing["logo"]) : null })} />
          Usar a logo da igreja {!temLogo && <span className="text-secondary text-muted">(defina em Logo, na barra de cima)</span>}
        </label>
        <div>
          <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void adicionarFotos(e.target.files).finally(() => (e.target.value = ""))} />
          <Button size="sm" variant="secondary" onClick={() => arquivo.current?.click()} disabled={importando}>
            {importando ? <Loader2 className="animate-spin" /> : <ImagePlus />} Adicionar fotos ou ilustrações
          </Button>
          <p className="mt-1 text-caption text-subtle">Toque numa foto para marcar o assunto — o recorte nunca corta esse ponto. Sem foto, as artes usam desenhos do assunto do evento.</p>
        </div>
        {b.fotos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {b.fotos.map((f, i) => (
              <Foto key={f.src + i} f={f} aoMudar={(nova) => muda({ fotos: b.fotos.map((x, k) => (k === i ? nova : x)) })} aoRemover={() => muda({ fotos: b.fotos.filter((_, k) => k !== i) })} />
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Estilo">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label>Luz</Label>
            <Segmented label="Luz" full items={[{ value: "claro", label: "Claro" }, { value: "misto", label: "Misto" }, { value: "escuro", label: "Escuro" }] as const} value={b.preferencias.luz} onChange={(v) => muda({ preferencias: { ...b.preferencias, luz: v } })} />
          </div>
          <div className="grid gap-1">
            <Label>Linguagem</Label>
            <Segmented label="Linguagem" full items={[{ value: "fotografico", label: "Foto" }, { value: "ilustrado", label: "Ilustrado" }, { value: "tipografico", label: "Tipográfico" }, { value: "misto", label: "Misto" }] as const} value={b.preferencias.linguagem} onChange={(v) => muda({ preferencias: { ...b.preferencias, linguagem: v } })} />
          </div>
          <div className="grid gap-1">
            <Label>Intensidade</Label>
            <Segmented label="Intensidade" full items={[{ value: "discreto", label: "Discreto" }, { value: "equilibrado", label: "Equilibrado" }, { value: "expressivo", label: "Expressivo" }] as const} value={b.preferencias.intensidade} onChange={(v) => muda({ preferencias: { ...b.preferencias, intensidade: v } })} />
          </div>
          <div className="grid gap-1">
            <Label>Cores</Label>
            <Segmented label="Identidade visual" full items={[{ value: "seguir", label: "Seguir a identidade" }, { value: "explorar", label: "Explorar" }] as const} value={b.preferencias.identidade} onChange={(v) => muda({ preferencias: { ...b.preferencias, identidade: v } })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Cores rotulo="Cores obrigatórias" cores={b.coresObrigatorias} aoMudar={(c) => muda({ coresObrigatorias: c })} />
          <Cores rotulo="Cores proibidas" cores={b.coresProibidas} aoMudar={(c) => muda({ coresProibidas: c })} />
        </div>
      </Secao>

      <Secao titulo="Formatos e quantidade">
        <div className="flex flex-wrap gap-1.5">
          {[...FORMATOS].sort((a, z) => (PRINCIPAIS.includes(z.id) ? 1 : 0) - (PRINCIPAIS.includes(a.id) ? 1 : 0)).map((f) => {
            const on = b.formatos.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const lista = on ? b.formatos.filter((x) => x !== f.id) : [...b.formatos, f.id];
                  muda({ formatos: lista.length ? lista : [f.id] });
                }}
                className={cn("rounded-md px-2.5 py-1.5 text-left text-secondary", on ? "bg-primary text-primary-fg" : "bg-elevated text-fg hover:bg-raised")}
              >
                {f.nome} <span className="opacity-70">{f.largura}×{f.altura}</span>
              </button>
            );
          })}
        </div>
        <div className="grid max-w-60 gap-1">
          <Label htmlFor="arte-quantidade">Quantas opções</Label>
          <Input id="arte-quantidade" type="number" min={1} max={QUANTIDADE_MAXIMA} value={b.quantidade} onChange={(e) => muda({ quantidade: Math.max(1, Math.min(QUANTIDADE_MAXIMA, Number(e.target.value) || 8)) })} />
        </div>
      </Secao>

      <Secao titulo={`Ajustar o estilo de “${categoria.nome}”`} aberta={false}>
        <p className="text-secondary text-muted">
          Vale para todas as artes desta categoria. Desligue composições que não combinam com a igreja e escolha os assuntos dos desenhos.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FAMILIAS.map((f) => {
            const desligada = familiasDesligadas.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={!desligada}
                onClick={() => {
                  const lista = new Set<FamiliaId>(familiasDesligadas);
                  if (desligada) lista.delete(f.id);
                  else lista.add(f.id);
                  aoAjustar({ ...ajuste, familiasDesligadas: [...lista] });
                }}
                className={cn("rounded-md px-2.5 py-1 text-secondary", desligada ? "bg-elevated text-subtle line-through" : "bg-raised text-fg")}
              >
                {f.nome}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {NOMES_DE_ASSUNTO.map((a) => {
            const on = assuntosDaCategoria.has(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const extras = new Set(ajuste.assuntosExtras ?? []);
                  const removidos = new Set(ajuste.assuntosRemovidos ?? []);
                  if (on) {
                    extras.delete(a);
                    if (categoria.assuntos.includes(a)) removidos.add(a);
                  } else {
                    removidos.delete(a);
                    if (!categoria.assuntos.includes(a)) extras.add(a);
                  }
                  aoAjustar({ ...ajuste, assuntosExtras: [...extras], assuntosRemovidos: [...removidos] });
                }}
                className={cn("rounded px-2 py-0.5 text-caption", on ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg")}
              >
                {a}
              </button>
            );
          })}
        </div>
      </Secao>

      <div className="sticky bottom-0 flex items-center gap-2 bg-surface py-2">
        <Button onClick={aoGerar} disabled={!b.titulo.trim()}>
          <Sparkles /> Gerar artes
        </Button>
        {!b.titulo.trim() && <span className="text-secondary text-muted">Escreva o nome do evento para gerar.</span>}
      </div>
    </div>
  );
}
