import { Copy, Palette, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { nid } from "@/lib/fold";
import { useLumenStore } from "@/store/lumen-store";
import { briefingVazio, chaveDoProjeto, normalizar, soOQueOFormularioPede, type Briefing } from "../briefing.ts";
import { CONJUNTOS } from "../catalogo/tipografia.ts";
import type { DocumentoDeArte } from "../documento.ts";
import { useEditorDeArte } from "../editor-store.ts";
import { acharFormato } from "../formatos.ts";
import { adaptar, gerarLoteAos, regenerar, variacoesDe, type TipoDeRegeneracao } from "../gerador/lote.ts";
import { exportarArte, nomeDoArquivo } from "../konva/exportar.tsx";
import { garantirFontesDoCatalogo, medidorDeCanvas } from "../konva/recursos.ts";
import { useArtesStore } from "../store.ts";
import { EditorDeArte } from "./editor.tsx";
import { Formulario } from "./formulario.tsx";
import { Galeria, type OpcaoDaGaleria } from "./galeria.tsx";
import { logoDaIgreja } from "./imagens-do-briefing.ts";
import { Miniatura } from "./miniatura.tsx";

/**
 * A área de Artes: histórico, briefing, galeria e editor.
 *
 * Nada aqui usa inteligência artificial. O lote sai do gerador de regras
 * (`gerador/lote.ts`), a partir de tabelas, catálogos e uma semente — e a
 * mesma semente com o mesmo briefing dá o mesmo lote.
 */

type Tela = "inicio" | "briefing" | "galeria" | "editor";

const MARCA_DE_LOGO: NonNullable<Briefing["logo"]> = { src: "", largura: 1, altura: 1, luz: 0.5, transparente: true };

async function exportarParaArquivo(doc: DocumentoDeArte, formato: "png" | "jpeg"): Promise<void> {
  const r = await exportarArte(doc, formato);
  if (!r.ok || !r.blob) {
    toast.error(r.erro ?? "Não consegui exportar.");
    return;
  }
  const nome = nomeDoArquivo(doc, formato === "png" ? "png" : "jpg");
  const d = typeof window !== "undefined" ? window.lumenDesktop : undefined;
  if (d?.isDesktop && d.artesExportar) {
    const s = await d.artesExportar(nome, new Uint8Array(await r.blob.arrayBuffer()));
    if (!s.ok) {
      toast.error(s.error);
      return;
    }
    toast(`Arte exportada (${r.largura}×${r.altura}) em Imagens › Lúmen - Artes.`, {
      action: { label: "Mostrar", onClick: () => void d.artesMostrar(s.caminho) },
    });
  } else {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Arte exportada (${r.largura}×${r.altura}).`);
  }
  if (doc.avisos.length) toast(doc.avisos[0]);
}

function Inicio({ aoCriar, aoAbrir }: { aoCriar: (continuar: boolean) => void; aoAbrir: (doc: DocumentoDeArte) => void }) {
  const projetos = useArtesStore((s) => s.projetos);
  const ultimo = useArtesStore((s) => s.ultimoBriefing);
  const duplicar = useArtesStore((s) => s.duplicar);
  const excluir = useArtesStore((s) => s.excluir);
  const favoritar = useArtesStore((s) => s.alternarFavorito);
  const [busca, setBusca] = useState("");
  const [soFavoritas, setSoFavoritas] = useState(false);
  const lista = projetos.filter((p) => (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())) && (!soFavoritas || p.favorito));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => aoCriar(false)}>
          <Plus /> Criar nova arte
        </Button>
        {ultimo?.titulo && (
          <Button variant="secondary" onClick={() => aoCriar(true)}>
            Continuar “{ultimo.titulo}”
          </Button>
        )}
        <Input className="max-w-72" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar entre as artes salvas" aria-label="Procurar arte" />
        <Button size="sm" variant={soFavoritas ? "secondary" : "ghost"} aria-pressed={soFavoritas} onClick={() => setSoFavoritas((v) => !v)}>
          <Star /> Favoritas
        </Button>
      </div>
      {lista.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
          <Palette className="size-8 text-subtle" aria-hidden />
          <p className="text-body text-fg">{projetos.length === 0 ? "Nenhuma arte ainda." : "Nada por aqui."}</p>
          <p className="max-w-96 text-secondary text-muted">Conte sobre o evento uma vez e receba um lote de composições diferentes para escolher, editar e exportar.</p>
        </div>
      ) : (
        <ul className="lumen-scroll grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-5" aria-label="Artes salvas">
          {lista.map((p) => (
            <li key={p.id} className="group/arte grid content-start gap-1">
              <button type="button" className="block text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => aoAbrir(p)} aria-label={`Abrir ${p.nome}`}>
                <Miniatura doc={p} largura={300} className="shadow-[var(--shadow-border)]" />
              </button>
              <div className="flex items-center gap-0.5">
                <p className="min-w-0 flex-1 truncate text-secondary text-fg" title={p.nome}>
                  {p.nome} <span className="text-subtle">· {acharFormato(p.formatoId)?.nome ?? `${p.largura}×${p.altura}`}</span>
                </p>
                <Button size="iconSm" variant="ghost" aria-label={`Favoritar ${p.nome}`} aria-pressed={!!p.favorito} onClick={() => favoritar(p.id)}>
                  <Star className={p.favorito ? "fill-current text-[#e0b352]" : undefined} />
                </Button>
                <Hint label="Duplicar">
                  <Button size="iconSm" variant="ghost" aria-label={`Duplicar ${p.nome}`} onClick={() => duplicar(p.id)}>
                    <Copy />
                  </Button>
                </Hint>
                <Button size="iconSm" variant="ghost" aria-label={`Excluir ${p.nome}`} className="hover:text-danger" onClick={() => window.confirm(`Excluir “${p.nome}”? Não dá para voltar atrás.`) && excluir(p.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PainelDeArtes({ registrarGuarda }: { registrarGuarda: (guarda: () => boolean) => void }) {
  const [tela, setTela] = useState<Tela>("inicio");
  const logoUrl = useLumenStore((s) => s.settings.logoUrl);
  const ultimo = useArtesStore((s) => s.ultimoBriefing);
  const ajustes = useArtesStore((s) => s.ajustes);
  const salvarArte = useArtesStore((s) => s.salvarArte);
  const registrarLote = useArtesStore((s) => s.registrarLote);
  const ajustarCategoria = useArtesStore((s) => s.ajustarCategoria);
  const lembrarBriefing = useArtesStore((s) => s.lembrarBriefing);
  const abrirNoEditor = useEditorDeArte((s) => s.abrir);
  const fecharEditor = useEditorDeArte((s) => s.fechar);
  const marcarSalvo = useEditorDeArte((s) => s.marcarSalvo);

  const medidor = useMemo(() => medidorDeCanvas(), []);
  const fontes = useRef<Promise<void> | null>(null);
  const garantirFontes = () => (fontes.current ??= garantirFontesDoCatalogo(CONJUNTOS.flatMap((c) => [c.titulo, c.apoio, c.info, c.destaque, c.sobretitulo])));
  useEffect(() => {
    void garantirFontes();
  }, []);

  // Sem organização pré-preenchida: a arte leva só título e referência, e a
  // igreja aparece pela logo.
  const novoBriefing = (): Briefing => ({ ...briefingVazio(), logo: logoUrl ? MARCA_DE_LOGO : null });
  const [briefing, setBriefing] = useState<Briefing>(novoBriefing);
  const [base, setBase] = useState<DocumentoDeArte[]>([]);
  const [limitacoes, setLimitacoes] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState({ prontas: 0, total: 0 });
  const [formato, setFormato] = useState("quadrado");
  const [favoritas, setFavoritas] = useState<Set<string>>(new Set());
  const [origemDoEditor, setOrigemDoEditor] = useState<Tela>("inicio");
  const parar = useRef(false);
  const [emVariacoes, setEmVariacoes] = useState<string | null>(null);
  const loteGuardado = useRef<DocumentoDeArte[]>([]);
  const semente = useRef(0);

  // Fechar o diálogo com a arte alterada pede confirmação.
  useEffect(() => {
    registrarGuarda(() => !useEditorDeArte.getState().alterado || window.confirm("Fechar sem salvar as mudanças da arte?"));
  }, [registrarGuarda]);

  const gerar = async (novoLote: boolean) => {
    await garantirFontes();
    const logo = briefing.logo ? await logoDaIgreja(logoUrl) : null;
    const b = normalizar(soOQueOFormularioPede({ ...briefing, logo }));
    lembrarBriefing(b);
    semente.current = novoLote || !semente.current ? (Date.now() % 2147483647) + 1 : semente.current;
    parar.current = false;
    setBase([]);
    setLimitacoes([]);
    setFavoritas(new Set());
    setEmVariacoes(null);
    setFormato(b.formatos[0] ?? "quadrado");
    setProgresso({ prontas: 0, total: b.quantidade });
    setGerando(true);
    setTela("galeria");
    const chave = chaveDoProjeto(b);
    try {
      const r = await gerarLoteAos(
        {
          briefing: b,
          formatoId: b.formatos[0] ?? "quadrado",
          semente: semente.current,
          historico: useArtesStore.getState().historico[chave] ?? [],
          ajustes,
          medidor,
          deveParar: () => parar.current,
          aoAvancar: (prontas, total) => setProgresso({ prontas, total }),
        },
        (doc) => setBase((atual) => [...atual, doc]),
      );
      setLimitacoes(r.cancelado ? ["Lote interrompido: aqui estão as opções que já estavam prontas."] : r.limitacoes);
      if (r.opcoes.length) registrarLote(chave, r.opcoes.map((o) => o.assinatura));
    } finally {
      setGerando(false);
    }
  };

  // A mesma opção nos outros formatos pedidos, recomposta sob demanda.
  const adaptadas = useRef(new Map<string, DocumentoDeArte | null>());
  const opcoes: OpcaoDaGaleria[] = base.map((d) => {
    if (formato === d.formatoId) return { base: d, doc: d };
    const chave = `${d.id}:${formato}`;
    if (!adaptadas.current.has(chave)) adaptadas.current.set(chave, adaptar(d, formato, { medidor, ajustes }));
    return { base: d, doc: adaptadas.current.get(chave) ?? null };
  });

  const abrir = (doc: DocumentoDeArte, deOnde: Tela, nova: boolean) => {
    const aberto = nova ? { ...structuredClone(doc), id: nid(), criadoEm: 0, atualizadoEm: 0 } : doc;
    abrirNoEditor(aberto);
    setOrigemDoEditor(deOnde);
    setTela("editor");
  };

  const salvar = (doc: DocumentoDeArte) => {
    const salvo = salvarArte(doc);
    marcarSalvo(salvo);
    toast("Arte salva.");
  };

  if (tela === "inicio") {
    return (
      <Inicio
        aoCriar={(continuar) => {
          setBriefing(continuar && ultimo ? { ...ultimo, logo: ultimo.logo ? MARCA_DE_LOGO : null } : novoBriefing());
          setTela("briefing");
        }}
        aoAbrir={(doc) => abrir(doc, "inicio", false)}
      />
    );
  }

  if (tela === "briefing") {
    return (
      <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2">
          <Button size="sm" variant="ghost" onClick={() => setTela(base.length ? "galeria" : "inicio")}>
            Voltar
          </Button>
        </div>
        <Formulario
          b={briefing}
          aoMudar={setBriefing}
          temLogo={!!logoUrl}
          ajuste={ajustes[briefing.categoria] ?? {}}
          aoAjustar={(a) => ajustarCategoria(briefing.categoria, a)}
          aoGerar={() => void gerar(true)}
        />
      </div>
    );
  }

  if (tela === "galeria") {
    return (
      <Galeria
        opcoes={opcoes}
        formatos={briefing.formatos}
        formato={formato}
        aoTrocarFormato={setFormato}
        gerando={gerando}
        progresso={progresso}
        limitacoes={limitacoes}
        favoritas={favoritas}
        aoFavoritar={(id) => setFavoritas((f) => {
          const n = new Set(f);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        })}
        aoEditar={(doc) => abrir(doc, "galeria", true)}
        aoExportar={(doc, f) => void exportarParaArquivo(doc, f)}
        aoNovoLote={() => void gerar(true)}
        aoParar={() => (parar.current = true)}
        aoSalvarFavoritas={() => {
          for (const o of opcoes) if (favoritas.has(o.base.id) && o.doc) salvarArte({ ...structuredClone(o.doc), id: nid(), favorito: true, criadoEm: 0 });
          toast(`${favoritas.size} ${favoritas.size === 1 ? "arte salva" : "artes salvas"} nas favoritas.`);
          setFavoritas(new Set());
        }}
        aoVoltar={() => setTela("briefing")}
        aoInicio={() => setTela("inicio")}
        emVariacoes={emVariacoes}
        aoVariacoes={(doc) => {
          const vs = variacoesDe(doc, (Date.now() % 2147483647) + 1, { ajustes, medidor });
          if (!vs.length) {
            toast("Não achei variações que caibam com este conteúdo.");
            return;
          }
          if (!emVariacoes) loteGuardado.current = base;
          setBase([doc, ...vs]);
          setFormato(doc.formatoId);
          setEmVariacoes(doc.rotulo);
        }}
        aoVoltarAoLote={() => {
          setBase(loteGuardado.current);
          setEmVariacoes(null);
        }}
      />
    );
  }

  return (
    <EditorDeArte
      medidor={medidor}
      aoSalvar={salvar}
      aoFechar={() => {
        if (useEditorDeArte.getState().alterado && !window.confirm("Fechar sem salvar as mudanças da arte?")) return;
        fecharEditor();
        setTela(origemDoEditor === "galeria" && base.length ? "galeria" : "inicio");
      }}
      aoExportar={(doc, f) => void exportarParaArquivo(doc, f)}
      aoRegenerar={(doc, tipo: TipoDeRegeneracao) => regenerar(doc, tipo, (Date.now() % 2147483647) + 1, { ajustes, medidor })}
      aoAdaptar={(doc, formatoId) => {
        const novo = adaptar(doc, formatoId, { ajustes, medidor });
        if (!novo) {
          toast("Esta composição não se reorganiza bem nesse formato. Gere um lote nele.");
          return;
        }
        const salvo = salvarArte({ ...novo, id: nid(), nome: doc.nome });
        abrirNoEditor(salvo);
        toast(`Versão ${acharFormato(formatoId)?.nome ?? formatoId} criada e salva.`);
      }}
    />
  );
}

