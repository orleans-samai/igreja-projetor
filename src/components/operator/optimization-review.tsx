import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SlideStage } from "@/components/slide/slide-renderer";
import { applyOptimization, cancelOptimization, canRefine, refineOptimization, useOptimizationReview } from "@/lib/run-optimize";
import { projectionReadability } from "@/lib/projection-readability";
import type { FitMode } from "@/lib/types";

export function OptimizationReview() {
  const proposal = useOptimizationReview((s) => s.proposal);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState("1920x1080");
  const [outputLabel, setOutputLabel] = useState("Simulação");
  const [busy, setBusy] = useState(false);
  const [clipped, setClipped] = useState<string[]>([]);
  const beforeRef = useRef<HTMLDivElement>(null), afterRef = useRef<HTMLDivElement>(null);
  const proposalKey = proposal?.signature;
  useEffect(() => {
    setIndex(0);
    if (!proposalKey) return;
    let cancelled = false;
    setOutputLabel("Simulação");
    void window.lumenDesktop?.preflight([]).then((report) => {
      if (cancelled) return;
      const display = report.displays.find((d) => d.id === report.selectedId);
      if (display) { setSize(`${display.width}x${display.height}`); setOutputLabel(display.label); }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [proposalKey]);

  useEffect(() => {
    if (!proposal) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const errors: string[] = [];
        for (const [name, ref] of [["Antes", beforeRef], ["Depois", afterRef]] as const) {
          const text = ref.current?.querySelector<HTMLElement>(".slide-text");
          const body = text?.parentElement;
          if (!text || !body) continue;
          const area = body.getBoundingClientRect();
          for (const child of body.children) {
            const bounds = child.getBoundingClientRect();
            if (bounds.top < area.top - 1 || bounds.bottom > area.bottom + 1 || bounds.left < area.left - 1 || bounds.right > area.right + 1 || child.scrollWidth > child.clientWidth + 1) {
              errors.push(`${name}: o conteúdo ultrapassa a área segura neste slide.`); break;
            }
          }
        }
        setClipped(errors);
      });
    });
    return () => { cancelled = true; };
  }, [proposal, index, size]);

  if (!proposal) return null;
  const { frame, result } = proposal;
  const [width, height] = size.split("x").map(Number);
  const theme = { ...proposal.input.theme, ...result.themePatch };
  const settings = { ...frame.settings, ...result.settingsPatch };
  const before = { ...frame, index: Math.min(index, Math.max(0, (frame.deck?.slides.length ?? 1) - 1)), settings: { ...frame.settings, transition: "cut" as const, showClock: false } };
  const after = { ...before, theme, settings: { ...settings, transition: "cut" as const, showClock: false }, deck: frame.deck ? { ...frame.deck, slides: result.slides } : null, index: Math.min(index, Math.max(0, result.slides.length - 1)) };
  const diagnostics = projectionReadability(theme, { ...proposal.input.settings, ...result.settingsPatch }, width, height, settings.fitMode);
  const count = Math.max(frame.deck?.slides.length ?? 0, result.slides.length);
  const setFit = (fitMode: FitMode) => useOptimizationReview.setState({ proposal: { ...proposal, result: { ...result, settingsPatch: { ...result.settingsPatch, fitMode } } } });
  return <Dialog open onOpenChange={(open) => { if (!open) cancelOptimization(); }}>
    <DialogContent title="Revisar leitura no telão" className="w-[min(64rem,calc(100%-1.5rem))]" description="Confira a sugestão e aplique quando estiver pronta. A leitura à distância também depende do tamanho e do foco do telão."
      footer={<><Button variant="secondary" onClick={cancelOptimization}>Cancelar</Button><Button onClick={applyOptimization}>Aplicar correções</Button></>}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-secondary">Saída · {outputLabel}<select className="field mt-1 block" aria-label="Resolução para revisar" value={size} onChange={(e) => { setSize(e.target.value); setOutputLabel("Simulação"); }}>
          {[...new Set([size, "1920x1080", "1280x720", "1024x768", "1280x800", "3840x2160"])].map((s) => <option key={s} value={s}>{s.replace("x", " × ")}</option>)}
        </select></label>
        <label className="text-secondary">Enquadramento<select className="field mt-1 block" aria-label="Enquadramento da sugestão" value={settings.fitMode} onChange={(e) => setFit(e.target.value as FitMode)}><option value="contain">Ajustar · preservar bordas</option><option value="cover">Preencher a tela</option></select></label>
        <label className="text-secondary">Tamanho da letra<input className="field mt-1 block w-24" aria-label="Tamanho da letra na sugestão" type="number" min={36} max={160} value={theme.fontSize} onChange={(e) => {
          const fontSize = Number(e.target.value); if (fontSize < 36 || fontSize > 160) return;
          useOptimizationReview.setState({ proposal: { ...proposal, result: { ...result, themePatch: { ...result.themePatch, fontSize } } } });
        }} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><p className="mb-1 text-secondary">Antes · {before.index + 1}/{frame.deck?.slides.length ?? 0}</p><div ref={beforeRef} style={{ aspectRatio: `${width}/${height}` }} className="overflow-hidden rounded-md bg-black"><SlideStage className="size-full" frame={before} variant="preview" simulateOutput /></div></div>
        <div><p className="mb-1 text-secondary">Depois · {after.index + 1}/{result.slides.length}</p><div ref={afterRef} style={{ aspectRatio: `${width}/${height}` }} className="overflow-hidden rounded-md bg-black"><SlideStage className="size-full" frame={after} variant="preview" simulateOutput /></div></div>
      </div>
      <div className="my-3 flex items-center justify-between gap-2"><Button size="sm" variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Slide anterior</Button><span className="text-caption">{index + 1} de {count} · letra na saída: ≈{diagnostics.fontPixels}px</span><Button size="sm" variant="secondary" disabled={index >= count - 1} onClick={() => setIndex(index + 1)}>Próximo slide</Button></div>
      <ul className="space-y-1 text-secondary text-muted">{[...result.summary, ...diagnostics.issues, ...clipped].map((label, i) => <li key={`${i}-${label}`}>{label}</li>)}</ul>
      {frame.status !== "idle" && <p className="mt-2 text-caption text-muted">Se esta apresentação estiver no ar, aplicar também atualizará o telão.</p>}
      {canRefine(proposal) && <Button className="mt-3" size="sm" variant="secondary" loading={busy} disabled={busy} onClick={async () => { setBusy(true); try { await refineOptimization(); } finally { setBusy(false); } }}>Refinar quebras com IA · online</Button>}
    </DialogContent>
  </Dialog>;
}
