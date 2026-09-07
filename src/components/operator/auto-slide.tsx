import { Ear, Loader2, Mic, Pause, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Hint } from "@/components/ui/tooltip";
import { capturar, listarFontes, type Captura, type FonteDeAudio } from "@/lib/auto-slide/audio";
import { AutoSlideEngine, type Perfil } from "@/lib/auto-slide/engine";
import { disponibilidade, type Disponibilidade } from "@/lib/auto-slide/recognizer";
import { cn } from "@/lib/cn";
import { useAutoSlideStore, type EstadoAuto } from "@/store/auto-slide-store";
import { useLumenStore } from "@/store/lumen-store";

const ROTULO: Record<EstadoAuto, string> = {
  desligado: "Desligado",
  "sem-modelo": "Sem modelo de reconhecimento",
  escutando: "Escutando",
  processando: "Processando",
  casou: "Correspondência encontrada",
  "confianca-baixa": "Confiança baixa",
  "sem-audio": "Sem áudio",
  pausado: "Reconhecimento pausado",
  "erro-audio": "Erro no dispositivo de áudio",
};

/** Cor do ponto: âmbar é do telão, então aqui ele só marca o que está no ar. */
function corDoEstado(e: EstadoAuto) {
  if (e === "casou") return "bg-live";
  if (e === "escutando" || e === "processando") return "bg-accent";
  if (e === "erro-audio" || e === "sem-modelo") return "bg-danger";
  return "bg-subtle";
}

/**
 * Painel do operador.
 *
 * Uma linha quando tudo vai bem. Só cresce quando há o que dizer, porque a
 * cabine não pode virar um mostrador de telemetria no meio do culto.
 */
export function AutoSlidePanel({ onConfig }: { onConfig: () => void }) {
  const ligado = useAutoSlideStore((s) => s.ligado);
  const setLigado = useAutoSlideStore((s) => s.setLigado);
  const estado = useAutoSlideStore((s) => s.estado);
  const ouvido = useAutoSlideStore((s) => s.ouvido);
  const candidato = useAutoSlideStore((s) => s.candidato);
  const score = useAutoSlideStore((s) => s.score);
  const erro = useAutoSlideStore((s) => s.erro);
  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);

  if (!ligado) return null;

  return (
    <div className="animate-swap-in flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-elevated px-3 py-1">
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", corDoEstado(estado), estado === "casou" && "tally")}
        />
        <span className="text-caption font-medium text-fg">Auto-Slide</span>
      </span>

      <span className="text-caption text-muted">{ROTULO[estado]}</span>

      {live && (
        <span className="tnum text-caption text-subtle">
          slide {liveIndex + 1}
          {candidato !== null && candidato !== liveIndex ? ` → ${candidato + 1}` : ""}
        </span>
      )}

      {ouvido && (
        <span className="min-w-0 flex-1 truncate text-caption text-subtle">
          “{ouvido}” · {Math.round(score * 100)}%
        </span>
      )}

      {erro && <span className="min-w-0 flex-1 truncate text-caption text-danger">{erro}</span>}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Hint label="Ajustes do reconhecimento">
          <Button size="iconSm" variant="ghost" aria-label="Ajustes do Auto-Slide" onClick={onConfig}>
            <Mic />
          </Button>
        </Hint>
        <Button size="sm" variant="ghost" onClick={() => setLigado(false)}>
          <Pause /> Pausar Auto-Slide
        </Button>
      </div>
    </div>
  );
}

/**
 * Configuração e modo de teste.
 *
 * O modo de teste não simula nada: o texto digitado entra pelo mesmo caminho
 * que o texto transcrito, com o mesmo motor e o mesmo estado. Era a única
 * forma de ajustar o casamento de letra sem depender de estar num culto.
 */
export function AutoSlideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const s = useAutoSlideStore();
  const live = useLumenStore((st) => st.live);
  const preview = useLumenStore((st) => st.preview);
  const [fontes, setFontes] = useState<FonteDeAudio[]>([]);
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [teste, setTeste] = useState("");
  const [testeSaida, setTesteSaida] = useState<string | null>(null);
  const [ouvindoTeste, setOuvindoTeste] = useState<Captura | null>(null);

  const procurar = useCallback(async () => {
    setBuscando(true);
    try {
      setFontes(await listarFontes());
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void procurar();
    void disponibilidade().then(setDisp);
  }, [open, procurar]);

  useEffect(() => {
    if (open) return;
    ouvindoTeste?.parar();
    setOuvindoTeste(null);
  }, [open, ouvindoTeste]);

  const deck = live ?? preview;
  const rodarTeste = () => {
    if (!deck) {
      setTesteSaida("Selecione uma música primeiro.");
      return;
    }
    const motor = new AutoSlideEngine({ ...s.config });
    motor.carregar(deck.slides.map((x) => x.text));
    const d = motor.decidir(teste, 0, Date.now());
    const top = [...d.notas].sort((a, b) => b.score - a.score).slice(0, 3);
    setTesteSaida(
      top.length === 0
        ? "Trecho curto demais para valer palpite."
        : top
            .map((n) => `Slide ${n.index + 1}: ${Math.round(n.score * 100)}%`)
            .join(" · ") + ` — decisão: ${d.motivo}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Reconhecimento de canto"
        className="w-[min(38rem,calc(100%-1.5rem))]"
      >
        <div className="space-y-4">
          {disp && !disp.ok && (
            <p className="rounded-md bg-elevated p-2 text-secondary text-muted">
              <span className="text-fg">{disp.motivo}</span> {disp.comoResolver} O modo de teste
              abaixo funciona mesmo assim.
            </p>
          )}

          <div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="auto-fonte">Fonte de áudio</Label>
                <select
                  id="auto-fonte"
                  className="field mt-1 w-full"
                  value={s.deviceId}
                  onChange={(e) => s.setDevice(e.target.value)}
                >
                  <option value="">Entrada padrão do sistema</option>
                  {fontes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
              <Hint label="Procurar dispositivos de novo">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Procurar dispositivos"
                  loading={buscando}
                  onClick={() => void procurar()}
                >
                  <RefreshCw />
                </Button>
              </Hint>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-raised"
                role="meter"
                aria-label="Nível de entrada"
                aria-valuenow={Math.round(s.nivel * 100)}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-75"
                  style={{ width: `${Math.min(100, Math.round(s.nivel * 140))}%` }}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (ouvindoTeste) {
                    ouvindoTeste.parar();
                    setOuvindoTeste(null);
                    s.setNivel(0);
                    return;
                  }
                  try {
                    setOuvindoTeste(
                      await capturar({
                        deviceId: s.deviceId || undefined,
                        onNivel: (n) => s.setNivel(n),
                        onJanela: () => undefined,
                      }),
                    );
                  } catch {
                    s.setEstado("erro-audio", "Não foi possível abrir esta entrada.");
                  }
                }}
              >
                {ouvindoTeste ? <Pause /> : <Play />} Testar áudio
              </Button>
            </div>
          </div>

          <div>
            <Label>Modo</Label>
            <Segmented
              full
              label="Perfil do Auto-Slide"
              className="mt-1"
              value={s.perfil}
              onChange={(v) => s.setPerfil(v as Perfil)}
              items={[
                { value: "conservador", label: "Conservador" },
                { value: "equilibrado", label: "Equilibrado" },
                { value: "rapido", label: "Rápido" },
              ]}
            />
            <p className="mt-1 text-caption text-subtle">
              Conservador só troca com certeza. Rápido antecipa o verso seguinte.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="auto-conf">
                Confiança mínima · {Math.round(s.config.confianca * 100)}%
              </Label>
              <input
                id="auto-conf"
                type="range"
                min={60}
                max={99}
                value={Math.round(s.config.confianca * 100)}
                onChange={(e) => s.ajustar({ confianca: Number(e.target.value) / 100 })}
                className="mt-2 h-1 w-full accent-accent"
              />
            </div>
            <div>
              <Label htmlFor="auto-cool">
                Tempo mínimo entre slides · {(s.config.cooldownMs / 1000).toFixed(1)} s
              </Label>
              <input
                id="auto-cool"
                type="range"
                min={500}
                max={5000}
                step={100}
                value={s.config.cooldownMs}
                onChange={(e) => s.ajustar({ cooldownMs: Number(e.target.value) })}
                className="mt-2 h-1 w-full accent-accent"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex select-none items-center gap-2 text-secondary text-muted">
              <button
                type="button"
                role="switch"
                aria-checked={s.config.permitirVoltar}
                data-on={s.config.permitirVoltar}
                className="lumen-switch"
                onClick={() => s.ajustar({ permitirVoltar: !s.config.permitirVoltar })}
              />
              Permitir voltar slides
            </label>
            <label className="flex select-none items-center gap-2 text-secondary text-muted">
              <button
                type="button"
                role="switch"
                aria-checked={s.config.antecipar}
                data-on={s.config.antecipar}
                className="lumen-switch"
                onClick={() => s.ajustar({ antecipar: !s.config.antecipar })}
              />
              Antecipar próximo verso
            </label>
          </div>

          <div className="border-t border-border pt-3">
            <Label htmlFor="auto-teste">Modo de teste — digite o que seria reconhecido</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="auto-teste"
                value={teste}
                onChange={(e) => setTeste(e.target.value)}
                placeholder="um trecho da letra, como o microfone ouviria"
                onKeyDown={(e) => {
                  if (e.key === "Enter") rodarTeste();
                }}
              />
              <Button variant="secondary" onClick={rodarTeste} disabled={!teste.trim()}>
                Testar
              </Button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-8 text-secondary text-muted">
              {testeSaida ??
                (deck
                  ? `Comparando com “${deck.title}” · ${deck.slides.length} slides.`
                  : "Selecione uma música para comparar.")}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              variant={s.ligado ? "secondary" : "default"}
              onClick={() => s.setLigado(!s.ligado)}
            >
              {s.ligado ? <Pause /> : <Ear />}
              {s.ligado ? "Desativar Auto-Slide" : "Ativar Auto-Slide por voz"}
            </Button>
            <span className="flex items-center gap-1.5 text-caption text-subtle">
              {s.estado === "processando" && <Loader2 className="size-3 animate-spin" aria-hidden />}
              {ROTULO[s.estado]}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
