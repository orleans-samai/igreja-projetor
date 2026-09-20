import { Film, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { MAX_SEGUNDOS, MIN_SEGUNDOS } from "../exportar.ts";
import { ROTULO_QUALIDADE, avisoDePeso, foiAparada, pesoDa, qualidadeDoPeso } from "../qualidade.ts";
import { useQualidadeEfetiva } from "../usar-vfx.ts";
import { useVfxStore } from "../store.ts";
import type { VfxComposicao, VfxEntrada, VfxProjeto, VfxRitmo } from "../tipos.ts";
import { limitarPorQualidade } from "../qualidade.ts";
import { Cor, Escolha, Faixa, Gaveta, Liga } from "./controles.tsx";
import { SalvarVideoDialog } from "./salvar-video.tsx";
import { TelaVfx } from "./tela-vfx.tsx";

/**
 * O editor de vídeos dinâmicos.
 *
 * Abre em janela e não na coluna da direita por um motivo de espaço: são
 * vinte controles e uma pré-visualização, e a coluna tem trezentos pixels.
 * Espremer isso ali daria sete categorias em sanfona que ninguém abre.
 *
 * A pré-visualização mostra a composição já aparada pelo modo de qualidade
 * que vale agora — se o "Leve" vai zerar o desfoque no culto, ele tem que
 * aparecer zerado aqui, e não só na hora que a projeção começar.
 */

const ENTRADAS: { value: VfxEntrada; label: string }[] = [
  { value: "surgir", label: "Surgir" },
  { value: "subir", label: "Subir" },
  { value: "escala", label: "Crescer" },
  { value: "nenhuma", label: "Nenhuma" },
];

const RITMOS: { value: VfxRitmo; label: string }[] = [
  { value: "lenta", label: "Lenta" },
  { value: "normal", label: "Normal" },
  { value: "rapida", label: "Rápida" },
  { value: "manual", label: "Manual" },
];

export function EditorVfx({
  projeto,
  open,
  onOpenChange,
  aoSalvarVideo,
}: {
  projeto: VfxProjeto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aoSalvarVideo?: () => void;
}) {
  const mexer = useVfxStore((s) => s.mexer);
  const restaurar = useVfxStore((s) => s.restaurar);
  const renomear = useVfxStore((s) => s.renomear);
  const { qualidade, auto, caiu, registrarQuadro } = useQualidadeEfetiva();
  const [salvando, setSalvando] = useState(false);

  const comp = projeto.comp;
  const mostrada = limitarPorQualidade(comp, qualidade);
  const peso = pesoDa(comp);
  const aviso = avisoDePeso(comp, qualidade);
  const aparada = foiAparada(comp, qualidade);

  const p = <K extends keyof VfxComposicao>(campo: K) => (v: VfxComposicao[K]) =>
    mexer({ [campo]: v } as Partial<VfxComposicao>);
  const travado = (campo: keyof VfxComposicao) =>
    (mostrada[campo] as number) !== (comp[campo] as number);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title="Vídeos dinâmicos"
          description="Monte a composição, veja rodando e salve como vídeo para o culto."
          className="w-[min(1040px,calc(100%-1.5rem))]"
          scrollBody={false}
        >
          <div className="flex h-[min(74dvh,660px)] min-h-0 gap-3">
            {/* Esquerda: o que se vê. */}
            <div className="flex min-w-0 flex-[1.15] flex-col gap-2">
              <Input
                value={projeto.nome}
                maxLength={80}
                aria-label="Nome da composição"
                onChange={(e) => renomear(projeto.id, e.target.value)}
              />
              <div className="aspect-video w-full overflow-hidden rounded-lg shadow-[var(--shadow-border)]">
                <TelaVfx comp={mostrada} aoQuadro={registrarQuadro} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-caption">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    peso <= 22
                      ? "bg-elevated text-muted"
                      : peso <= 55
                        ? "bg-elevated text-fg"
                        : "bg-elevated text-danger",
                  )}
                  title="Quanto esta composição custa por quadro"
                >
                  {ROTULO_QUALIDADE[qualidadeDoPeso(peso)]} · {peso}%
                </span>
                {auto && (
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-muted">
                    Automático: {ROTULO_QUALIDADE[qualidade]}
                    {caiu && " (reduzido)"}
                  </span>
                )}
                {aparada && (
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-muted">
                    Alguns efeitos estão limitados pelo modo de qualidade.
                  </span>
                )}
              </div>

              {aviso && (
                <p className="rounded-md bg-elevated p-2.5 text-caption text-muted">{aviso}</p>
              )}

              <div className="mt-auto flex gap-2">
                <Button variant="ghost" onClick={restaurar} className="shrink-0">
                  <RotateCcw />
                  Restaurar padrão
                </Button>
                <Button className="flex-1" onClick={() => setSalvando(true)}>
                  <Film />
                  Salvar como vídeo
                </Button>
              </div>
            </div>

            {/* Direita: o que se mexe. */}
            <div className="lumen-scroll min-w-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-2.5">
                <Gaveta titulo="Luz e brilho" dica="Quanta luz a composição emite.">
                  <Faixa rotulo="Brilho" valor={comp.brilho} onChange={p("brilho")} max={200} />
                  <Faixa
                    rotulo="Glow"
                    valor={comp.glow}
                    onChange={p("glow")}
                    pesado
                    travado={travado("glow")}
                  />
                </Gaveta>

                <Gaveta titulo="Partículas" dica="Pontinhos que flutuam no fundo.">
                  <Faixa
                    rotulo="Quantidade"
                    valor={comp.particulas}
                    onChange={p("particulas")}
                    pesado
                    travado={travado("particulas")}
                  />
                  <Faixa
                    rotulo="Tamanho"
                    valor={comp.particulaTamanho}
                    onChange={p("particulaTamanho")}
                  />
                </Gaveta>

                <Gaveta titulo="Movimento" dica="O que se mexe, e em que ritmo.">
                  <Escolha rotulo="Ritmo" valor={comp.ritmo} onChange={p("ritmo")} opcoes={RITMOS} />
                  {comp.ritmo === "manual" && (
                    <Faixa
                      rotulo="Velocidade"
                      valor={comp.velocidade}
                      onChange={p("velocidade")}
                      min={0.1}
                      max={3}
                      passo={0.1}
                      sufixo="×"
                    />
                  )}
                  <Faixa rotulo="Pulsação" valor={comp.pulsacao} onChange={p("pulsacao")} />
                  <Faixa rotulo="Zoom suave" valor={comp.zoom} onChange={p("zoom")} />
                  <Faixa
                    rotulo="Movimento de fundo"
                    valor={comp.movimentoFundo}
                    onChange={p("movimentoFundo")}
                  />
                </Gaveta>

                <Gaveta titulo="Cor e atmosfera" dica="As duas cores e o ar da cena.">
                  <Cor rotulo="Cor principal" valor={comp.corPrimaria} onChange={p("corPrimaria")} />
                  <Cor
                    rotulo="Cor secundária"
                    valor={comp.corSecundaria}
                    onChange={p("corSecundaria")}
                  />
                  <Faixa rotulo="Vinheta" valor={comp.vinheta} onChange={p("vinheta")} />
                  <Faixa
                    rotulo="Granulação"
                    valor={comp.granulacao}
                    onChange={p("granulacao")}
                    pesado
                    travado={travado("granulacao")}
                  />
                </Gaveta>

                <Gaveta titulo="Distorções" dica="O que deforma a imagem. Pesa mais.">
                  <Faixa
                    rotulo="Ondulação"
                    valor={comp.ondulacao}
                    onChange={p("ondulacao")}
                    pesado
                    travado={travado("ondulacao")}
                  />
                  <Faixa
                    rotulo="Desfoque"
                    valor={comp.desfoque}
                    onChange={p("desfoque")}
                    pesado
                    travado={travado("desfoque")}
                  />
                  <Faixa
                    rotulo="Glitch"
                    valor={comp.glitch}
                    onChange={p("glitch")}
                    pesado
                    travado={travado("glitch")}
                  />
                  <Faixa
                    rotulo="Separação RGB"
                    valor={comp.separacaoRgb}
                    onChange={p("separacaoRgb")}
                    pesado
                    travado={travado("separacaoRgb")}
                  />
                </Gaveta>

                <Gaveta titulo="Texto animado" dica="Uma frase entrando e saindo.">
                  <Input
                    value={comp.texto}
                    maxLength={120}
                    aria-label="Texto da composição"
                    placeholder="Deixe vazio para não escrever nada"
                    onChange={(e) => mexer({ texto: e.target.value })}
                  />
                  <Escolha
                    rotulo="Entrada"
                    valor={comp.textoEntrada}
                    onChange={p("textoEntrada")}
                    opcoes={ENTRADAS}
                  />
                  <Escolha
                    rotulo="Saída"
                    valor={comp.textoSaida}
                    onChange={p("textoSaida")}
                    opcoes={ENTRADAS}
                  />
                </Gaveta>

                <Gaveta titulo="Transições" dica="Tempo, repetição e entrada da cena.">
                  <Faixa rotulo="Opacidade" valor={comp.opacidade} onChange={p("opacidade")} />
                  <Faixa rotulo="Intensidade" valor={comp.intensidade} onChange={p("intensidade")} />
                  <Faixa
                    rotulo="Duração"
                    valor={comp.duracao}
                    onChange={p("duracao")}
                    min={MIN_SEGUNDOS}
                    max={MAX_SEGUNDOS}
                    sufixo="s"
                  />
                  <Faixa
                    rotulo="Entrada"
                    valor={comp.entrada}
                    onChange={p("entrada")}
                    min={0}
                    max={5}
                    passo={0.1}
                    sufixo="s"
                  />
                  <Faixa
                    rotulo="Saída"
                    valor={comp.saida}
                    onChange={p("saida")}
                    min={0}
                    max={5}
                    passo={0.1}
                    sufixo="s"
                  />
                  <Liga rotulo="Repetir" valor={comp.repetir} onChange={p("repetir")} />
                </Gaveta>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SalvarVideoDialog
        projeto={projeto}
        open={salvando}
        onOpenChange={setSalvando}
        aoSalvar={aoSalvarVideo}
      />
    </>
  );
}
