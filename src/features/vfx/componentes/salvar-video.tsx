import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { humanSize } from "@/lib/media-library";
import { cn } from "@/lib/cn";
import {
  MAX_SEGUNDOS,
  MIN_SEGUNDOS,
  RESOLUCOES,
  RenderCancelado,
  cabeNaPasta,
  formatoDisponivel,
  nomeDoArquivo,
  renderizarVideo,
  tamanhoEstimado,
  type AndamentoDoRender,
} from "../exportar.ts";
import { ROTULO_QUALIDADE } from "../qualidade.ts";
import type { VfxProjeto, VfxQualidade } from "../tipos.ts";
import { useVfxStore } from "../store.ts";

/**
 * Salvar como vídeo.
 *
 * O botão que justifica a área. Confirma nome, resolução, duração e
 * qualidade; renderiza mostrando o andamento; guarda o arquivo na pasta de
 * vídeo da igreja, onde ele passa a ser um vídeo como qualquer outro.
 *
 * O projeto não é consumido: sai daqui do mesmo jeito que entrou, editável
 * para a próxima vez que a composição precisar mudar.
 */

const QUALIDADES: VfxQualidade[] = ["leve", "equilibrado", "alta"];

export function SalvarVideoDialog({
  projeto,
  open,
  onOpenChange,
  aoSalvar,
}: {
  projeto: VfxProjeto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Chamado quando o arquivo já está na pasta, para a aba Vídeos recarregar. */
  aoSalvar?: () => void;
}) {
  const registrarVideo = useVfxStore((s) => s.registrarVideo);
  const tetoDaCabine = useVfxStore((s) => s.qualidade);

  const [nome, setNome] = useState(projeto.nome);
  const [resolucao, setResolucao] = useState<string>("720");
  const [duracao, setDuracao] = useState(() =>
    Math.min(MAX_SEGUNDOS, Math.max(MIN_SEGUNDOS, Math.round(projeto.comp.duracao))),
  );
  const [qualidade, setQualidade] = useState<VfxQualidade>(tetoDaCabine);
  const [andamento, setAndamento] = useState<AndamentoDoRender | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const cancelador = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setNome(projeto.nome);
      setDuracao(Math.min(MAX_SEGUNDOS, Math.max(MIN_SEGUNDOS, Math.round(projeto.comp.duracao))));
      setAndamento(null);
      setErro(null);
    }
  }, [open, projeto]);

  const escolhida = RESOLUCOES.find((r) => r.id === resolucao) ?? RESOLUCOES[0];
  const peso = tamanhoEstimado(duracao, qualidade);
  const cabe = cabeNaPasta(duracao, qualidade);
  const podeGravar = formatoDisponivel() !== null;
  const rodando = andamento !== null;

  const cancelar = () => {
    cancelador.current?.abort();
  };

  const gravar = async () => {
    setErro(null);
    const controle = new AbortController();
    cancelador.current = controle;
    setAndamento({ pct: 0, feitos: 0, faltam: duracao });
    try {
      const blob = await renderizarVideo(
        {
          comp: projeto.comp,
          largura: escolhida.largura,
          altura: escolhida.altura,
          segundos: duracao,
          qualidade,
        },
        setAndamento,
        controle.signal,
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const r = await window.lumenDesktop?.mediaSave(nomeDoArquivo(nome), bytes);
      if (!r?.ok) {
        setErro(r?.error ?? "Não consegui guardar o vídeo na pasta da igreja.");
        setAndamento(null);
        return;
      }
      registrarVideo(projeto.id, {
        id: r.id ?? "",
        nome: r.nome ?? nomeDoArquivo(nome),
        emMs: Date.now(),
      });
      toast(`“${r.nome}” está pronto e já aparece em Vídeos.`);
      aoSalvar?.();
      setAndamento(null);
      onOpenChange(false);
    } catch (e) {
      setAndamento(null);
      if (e instanceof RenderCancelado) {
        toast("Renderização cancelada. O projeto continua como estava.");
        onOpenChange(false);
        return;
      }
      setErro(e instanceof Error ? e.message : "A renderização falhou.");
    } finally {
      cancelador.current = null;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Fechar no meio da gravação é cancelar, não abandonar um gravador
        // rodando atrás de uma janela fechada.
        if (!v && rodando) cancelar();
        else onOpenChange(v);
      }}
    >
      <DialogContent
        title="Salvar como vídeo"
        description="O arquivo vai para a pasta de vídeo da igreja e aparece na aba Vídeos."
        className="w-[min(520px,calc(100%-1.5rem))]"
      >
        <div className="grid gap-3">
          <Field label="Nome do vídeo">
            {(p) => (
              <Input
                {...p}
                value={nome}
                disabled={rodando}
                maxLength={80}
                onChange={(e) => setNome(e.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-1.5">
            <span className="text-caption font-medium text-muted">Resolução</span>
            <div className="grid grid-cols-3 gap-1.5">
              {RESOLUCOES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={rodando}
                  onClick={() => setResolucao(r.id)}
                  aria-pressed={r.id === resolucao}
                  className={cn(
                    "rounded-md px-2 py-2 text-caption",
                    r.id === resolucao
                      ? "bg-elevated text-fg shadow-[0_0_0_1px_var(--color-accent)]"
                      : "text-muted shadow-[var(--shadow-border)] hover:text-fg",
                  )}
                >
                  {r.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-caption font-medium text-muted">Duração</span>
              <span className="tnum text-caption text-subtle">{duracao}s</span>
            </div>
            <input
              type="range"
              min={MIN_SEGUNDOS}
              max={MAX_SEGUNDOS}
              value={duracao}
              disabled={rodando}
              onChange={(e) => setDuracao(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-caption font-medium text-muted">Qualidade de exportação</span>
            <div className="grid grid-cols-3 gap-1.5">
              {QUALIDADES.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={rodando}
                  onClick={() => setQualidade(q)}
                  aria-pressed={q === qualidade}
                  className={cn(
                    "rounded-md px-2 py-2 text-caption",
                    q === qualidade
                      ? "bg-elevated text-fg shadow-[0_0_0_1px_var(--color-accent)]"
                      : "text-muted shadow-[var(--shadow-border)] hover:text-fg",
                  )}
                >
                  {ROTULO_QUALIDADE[q]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-caption text-subtle">
            {escolhida.largura} × {escolhida.altura} · {duracao}s · cerca de {humanSize(peso)}. A
            gravação leva os mesmos {duracao} segundos — o vídeo é capturado no tempo real.
          </p>

          {!cabe && (
            <p className="rounded-md bg-elevated p-2.5 text-caption text-danger">
              Nesse tamanho o arquivo passa dos 64 MB que a pasta aceita. Baixe a duração ou a
              qualidade.
            </p>
          )}
          {!podeGravar && (
            <p className="rounded-md bg-elevated p-2.5 text-caption text-danger">
              Este computador não sabe gravar vídeo pelo navegador. A composição continua salva e
              editável.
            </p>
          )}
          {erro && <p className="text-caption text-danger">{erro}</p>}

          {rodando && (
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-caption text-muted">Renderizando…</span>
                <span className="tnum text-caption text-subtle">
                  {andamento.pct}% · faltam {Math.ceil(andamento.faltam)}s
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${andamento.pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            {rodando ? (
              <Button variant="ghost" onClick={cancelar}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Voltar
                </Button>
                <Button
                  disabled={!cabe || !podeGravar || !nome.trim()}
                  onClick={() => void gravar()}
                >
                  Renderizar e salvar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
