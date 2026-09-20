import { ArrowLeft, Copy, Palette, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";
import { FORMATOS } from "../formatos.ts";
import { OPCOES_POR_VEZ, opcoesDe, useArtesStore } from "../store.ts";
import { dadosVazios, type DadosDoEvento, type Documento } from "../types.ts";
import { montar } from "../variacoes.ts";
import { EditorDeArte, Miniatura } from "./editor.tsx";

/**
 * A área de Artes.
 *
 * Quatro passos, na ordem em que a cabeça de quem organiza um culto trabalha:
 * o que é, o que está escrito, onde vai ser publicado, e qual desenho. Só
 * depois abre o editor — pedir para escolher fonte antes de saber o nome do
 * evento é o que faz programa de design assustar.
 */

type Passo = "lista" | "tipo" | "dados" | "formato" | "opcoes" | "editor";

const TIPOS = [
  "Culto", "Culto de domingo", "Conferência", "Congresso", "Campanha", "Vigília",
  "Santa Ceia", "Culto de jovens", "Culto infantil", "Culto de mulheres",
  "Culto de homens", "Escola bíblica", "Célula", "Encontro de casais", "Batismo",
  "Casamento", "Aniversário da igreja", "Natal", "Páscoa", "Evento musical",
  "Aviso", "Convite", "Publicação livre",
] as const;

const CAMPOS: { chave: keyof DadosDoEvento; rotulo: string; longo?: boolean }[] = [
  { chave: "titulo", rotulo: "Nome do evento" },
  { chave: "subtitulo", rotulo: "Subtítulo" },
  { chave: "tema", rotulo: "Tema" },
  { chave: "palavraBase", rotulo: "Palavra-base" },
  { chave: "referencia", rotulo: "Referência bíblica" },
  { chave: "textoBiblico", rotulo: "Texto bíblico", longo: true },
  { chave: "data", rotulo: "Data" },
  { chave: "horario", rotulo: "Horário" },
  { chave: "local", rotulo: "Local" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "pregador", rotulo: "Pregador" },
  { chave: "ministerio", rotulo: "Ministério de louvor" },
  { chave: "chamada", rotulo: "Chamada" },
  { chave: "informacoes", rotulo: "Informações", longo: true },
  { chave: "contato", rotulo: "Contato" },
  { chave: "redes", rotulo: "Redes sociais" },
];

export function ArtesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const projetos = useArtesStore((s) => s.projetos);
  const aberto = useArtesStore((s) => s.aberto);
  const criar = useArtesStore((s) => s.criar);
  const abrirProjeto = useArtesStore((s) => s.abrir);
  const fechar = useArtesStore((s) => s.fechar);
  const duplicar = useArtesStore((s) => s.duplicar);
  const excluir = useArtesStore((s) => s.excluir);
  const salvar = useArtesStore((s) => s.salvar);

  const igreja = useLumenStore((s) => s.settings.churchName);
  const logo = useLumenStore((s) => s.settings.logoUrl);
  const jumpRef = useLumenStore((s) => s.jumpRef);

  const [passo, setPasso] = useState<Passo>("lista");
  const [tipo, setTipo] = useState<string>("Culto");
  const [dados, setDados] = useState<DadosDoEvento>(dadosVazios());
  const [formatoId, setFormatoId] = useState("quadrado");
  const [base, setBase] = useState(1);
  const [busca, setBusca] = useState("");

  const lista = useMemo(
    () =>
      projetos.filter(
        (p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()),
      ),
    [projetos, busca],
  );

  const formato = FORMATOS.find((f) => f.id === formatoId) ?? FORMATOS[0];
  const sementes = useMemo(() => opcoesDe(base), [base]);
  const previas = useMemo(
    () =>
      sementes.map((s) =>
        montar({
          id: `previa-${s}`,
          nome: dados.titulo || tipo,
          dados,
          semente: s,
          formatoId: formato.id,
          largura: formato.largura,
          altura: formato.altura,
        }),
      ),
    [sementes, dados, formato, tipo],
  );

  const comecar = () => {
    // Nome e logo da igreja vêm das Configurações: ninguém deve digitar de
    // novo o que o app já sabe.
    setDados({ ...dadosVazios(), igreja, logo, titulo: "" });
    setTipo("Culto");
    setPasso("tipo");
  };

  const escolher = (doc: Documento) => {
    const criado = criar(doc.dados, formato.id, doc.semente, dados.titulo || tipo);
    if (criado) {
      salvar();
      setPasso("editor");
    }
  };

  const titulo =
    passo === "editor" && aberto ? aberto.nome : passo === "lista" ? "Artes" : "Criar uma arte";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          fechar();
          setPasso("lista");
        }
      }}
    >
      <DialogContent
        title={titulo}
        className="flex h-[min(44rem,calc(100vh-4rem))] w-[min(64rem,calc(100%-2rem))] flex-col"
      >
        {passo !== "lista" && passo !== "editor" && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() =>
              setPasso(passo === "tipo" ? "lista" : passo === "dados" ? "tipo" : passo === "formato" ? "dados" : "formato")
            }
          >
            <ArrowLeft /> Voltar
          </Button>
        )}

        {passo === "lista" && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button onClick={comecar}>
                <Plus /> Criar nova arte
              </Button>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Procurar entre as artes salvas"
                aria-label="Procurar arte"
              />
            </div>

            {lista.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                <Palette className="size-8 text-subtle" aria-hidden />
                <p className="text-body text-fg">
                  {projetos.length === 0 ? "Nenhuma arte ainda." : "Nada com esse nome."}
                </p>
                <p className="max-w-80 text-secondary text-muted">
                  Preencha os dados do evento uma vez e escolha entre doze desenhos prontos.
                </p>
              </div>
            ) : (
              <ul className="lumen-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                {lista.map((p) => (
                  <li key={p.id} className="group/arte">
                    <button
                      type="button"
                      className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => {
                        abrirProjeto(p.id);
                        setPasso("editor");
                      }}
                    >
                      <Miniatura
                        doc={p}
                        className="aspect-square bg-elevated shadow-[var(--shadow-border)]"
                      />
                      <p className="mt-1 truncate text-left text-secondary text-fg">{p.nome}</p>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/arte:opacity-100 focus-within:opacity-100">
                      <Button
                        size="iconSm"
                        variant="ghost"
                        aria-label={`Duplicar ${p.nome}`}
                        onClick={() => duplicar(p.id)}
                      >
                        <Copy />
                      </Button>
                      <Button
                        size="iconSm"
                        variant="ghost"
                        aria-label={`Excluir ${p.nome}`}
                        className="hover:text-danger"
                        onClick={() => {
                          if (window.confirm(`Excluir “${p.nome}”? Não dá para voltar atrás.`)) {
                            excluir(p.id);
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {passo === "tipo" && (
          <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
            <p className="text-secondary text-muted">O que é este evento?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => {
                    setTipo(t);
                    setDados((d) => ({ ...d, titulo: d.titulo || t }));
                    setPasso("dados");
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-secondary",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    tipo === t ? "bg-primary text-primary-fg" : "bg-elevated text-fg hover:bg-raised",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {passo === "dados" && (
          <div className="lumen-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            <p className="text-secondary text-muted">
              Preencha só o que importa. Campo em branco não aparece na arte.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <div key={c.chave} className={c.longo ? "sm:col-span-2" : undefined}>
                  <Label htmlFor={`campo-${c.chave}`}>{c.rotulo}</Label>
                  {c.longo ? (
                    <Textarea
                      id={`campo-${c.chave}`}
                      rows={2}
                      value={dados[c.chave]}
                      onChange={(e) => setDados({ ...dados, [c.chave]: e.target.value })}
                    />
                  ) : (
                    <Input
                      id={`campo-${c.chave}`}
                      value={dados[c.chave]}
                      onChange={(e) => setDados({ ...dados, [c.chave]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            {/* O texto bíblico vem da Bíblia local — nunca inventado. */}
            {dados.referencia.trim() && !dados.textoBiblico.trim() && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const achou = jumpRef(dados.referencia, false);
                  const preview = useLumenStore.getState().preview;
                  const texto = achou ? (preview?.slides[0]?.text ?? "") : "";
                  if (!texto) {
                    toast("Não achei essa passagem na Bíblia instalada.");
                    return;
                  }
                  setDados((d) => ({ ...d, textoBiblico: texto }));
                }}
              >
                Buscar “{dados.referencia}” na Bíblia do Lúmen
              </Button>
            )}
            <Button className="mt-1" onClick={() => setPasso("formato")} disabled={!dados.titulo.trim()}>
              Escolher o formato
            </Button>
          </div>
        )}

        {passo === "formato" && (
          <div className="lumen-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FORMATOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={formatoId === f.id}
                  onClick={() => {
                    setFormatoId(f.id);
                    setPasso("opcoes");
                  }}
                  className={cn(
                    "rounded-lg p-3 text-left",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    formatoId === f.id ? "bg-primary text-primary-fg" : "bg-elevated hover:bg-raised",
                  )}
                >
                  <p className="text-body font-medium">{f.nome}</p>
                  <p className="text-caption opacity-80">
                    {f.largura} × {f.altura} · {f.ajuda}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {passo === "opcoes" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-secondary text-muted">
                Doze desenhos com os mesmos dados. Clique no que gostar.
              </p>
              <Button size="sm" variant="secondary" onClick={() => setBase((b) => b + 1)}>
                <RefreshCw /> Gerar mais opções
              </Button>
            </div>
            <ul className="lumen-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {previas.map((p, i) => (
                <li key={p.semente}>
                  <button
                    type="button"
                    className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Escolher o desenho ${i + 1}`}
                    onClick={() => escolher(p)}
                  >
                    <Miniatura
                      doc={p}
                      className="bg-elevated shadow-[var(--shadow-border)]"
                    />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-caption text-subtle">
              {OPCOES_POR_VEZ} de {(11_250).toLocaleString("pt-BR")} combinações possíveis.
            </p>
          </div>
        )}

        {passo === "editor" && (
          <EditorDeArte
            aoSair={() => {
              fechar();
              setPasso("lista");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
