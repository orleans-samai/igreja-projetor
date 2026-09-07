import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { serviceMedia } from "@/lib/service-package";
import type { PreflightReport } from "@/lib/windows-desktop";
import type { HealthItem } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

async function decodeMedia(url: string, type: string): Promise<void> {
  if (type === "image") {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { img.src = ""; reject(new Error("Tempo esgotado")); }, 12000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); reject(new Error("Imagem indisponível")); };
      img.src = url;
    });
    return;
  }
  const element = document.createElement(type === "video" ? "video" : "audio");
  element.muted = true; element.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Tempo esgotado")), 12000);
      element.onplaying = () => { clearTimeout(timer); resolve(); };
      element.onerror = () => { clearTimeout(timer); reject(new Error("Formato não reproduzido")); };
      element.src = url;
      void element.play().catch((e) => { clearTimeout(timer); reject(e); });
    });
  } finally { element.pause(); element.removeAttribute("src"); element.load(); }
}

export function PreflightControls({ open, onItems }: { open: boolean; onItems: (items: HealthItem[]) => void }) {
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [error, setError] = useState("");
  const [imageOk, setImageOk] = useState(false);
  const [soundOk, setSoundOk] = useState(false);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const [playback, setPlayback] = useState<{ url: string; type: string; title: string }[]>([]);
  const playlistId = useLumenStore((s) => s.activePlaylistId);
  const playlists = useLumenStore((s) => s.playlists);
  const media = useLumenStore((s) => s.media);
  const songs = useLumenStore((s) => s.songs);
  const themes = useLumenStore((s) => s.themes);
  const settings = useLumenStore((s) => s.settings);
  const live = useLumenStore((s) => s.status);
  const desktop = window.lumenDesktop;
  const refresh = useCallback(async () => {
    try {
      const files = serviceMedia();
      setPlayback(files.filter((f) => ["video", "audio"].includes(f.type)));
      if (desktop) {
        const result = await desktop.preflight([...new Set(files.map((f) => f.url).filter((u) => !u.startsWith("data:")))]);
        setReport((previous) => {
          if (previous?.selectedId !== result.selectedId || previous?.projectorReady !== result.projectorReady) setImageOk(false);
          return result;
        });
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na verificação."); }
  }, [desktop]);

  useEffect(() => {
    if (!open) return;
    setTested(false); setImageOk(false); setSoundOk(false); setFailures([]);
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => { clearInterval(interval); void desktop?.testDisplay(false); };
  }, [open, refresh, desktop, playlistId, playlists, media, songs, themes, settings]);

  useEffect(() => {
    if (!open) return;
    const items: HealthItem[] = [
      { id: "actual-output", label: "Monitor de saída", level: desktop ? report?.projectorReady ? "ok" : "fail" : "warn", detail: desktop ? report?.projectorReady ? "Projetor visível no monitor externo escolhido." : "Conecte o monitor, escolha Estender e abra o projetor." : "Confira manualmente o monitor externo no navegador." },
      { id: "media-files", label: "Arquivos deste culto", level: error || report?.missing.length || failures.length ? "fail" : tested ? "ok" : "warn", detail: error || (report?.missing.length ? `${report.missing.length} arquivo(s) ausente(s).` : failures.length ? failures.join(" · ") : tested ? "Arquivos encontrados e reprodução verificada." : "Execute Verificar reprodução para conferir imagens, áudio e vídeo.") },
      { id: "external-media", label: "Mídias sem internet", level: report?.external.length ? "warn" : "ok", detail: report?.external.length ? `${report.external.length} mídia(s) online ou temporária(s). Exporte e importe um pacote para torná-las locais.` : "Nenhuma dependência externa detectada nas mídias deste culto." },
      { id: "image-test", label: "Imagem no telão", level: imageOk ? "ok" : "warn", detail: imageOk ? "Imagem e margens conferidas pelo operador." : "Mostre o padrão de teste e confira do fundo da igreja." },
      { id: "sound-test", label: "Som nas caixas", level: soundOk ? "ok" : "warn", detail: soundOk ? "Som confirmado pelo operador." : "Teste o som e confirme que saiu nas caixas corretas." },
    ];
    onItems(items);
  }, [open, onItems, desktop, report, error, tested, failures, imageOk, soundOk]);

  if (!open) return null;
  return <div className="mb-3 space-y-3 rounded-md border border-border p-3">
    <p className="text-body font-medium">Preparar o telão e o som</p>
    {desktop && <label className="block text-secondary">Monitor do projetor
      <select aria-label="Monitor do projetor" className="field mt-1 w-full" value={report?.selectedId ?? ""} onChange={async (e) => {
        try { await desktop.selectDisplay(Number(e.target.value)); setImageOk(false); await refresh(); } catch (e) { setError(String(e)); }
      }}>
        <option value="" disabled>Conecte um monitor externo</option>
        {report?.displays.filter((d) => !d.primary).map((d) => <option key={d.id} value={d.id}>{d.label} · {d.width}×{d.height} · {Math.round(d.scaleFactor * 100)}%</option>)}
      </select>
    </label>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={!desktop || !report?.selectedId || live !== "idle"} onClick={() => void desktop?.testDisplay(true).catch((e) => setError(String(e)))}>Testar imagem · 15 s</Button>
      <Button size="sm" variant="secondary" disabled={live !== "idle"} onClick={async () => {
        const ctx = new AudioContext();
        try {
          await ctx.resume();
          for (const [index, pan] of [-1, 1].entries()) {
            const tone = ctx.createOscillator(), volume = ctx.createGain(), stereo = ctx.createStereoPanner();
            tone.frequency.value = index ? 660 : 440; stereo.pan.value = pan; volume.gain.value = 0.08;
            tone.connect(volume).connect(stereo).connect(ctx.destination); tone.start(ctx.currentTime + index * 0.7); tone.stop(ctx.currentTime + index * 0.7 + 0.4);
          }
          setTimeout(() => void ctx.close(), 1600);
        } catch (e) { await ctx.close(); setError(String(e)); }
      }}>Testar som L / R</Button>
      <Button size="sm" loading={busy} disabled={busy || live !== "idle"} onClick={async () => {
        setBusy(true); setTested(false);
        try {
          const failed: string[] = [];
          for (const file of serviceMedia()) { try { await decodeMedia(file.url, file.type); } catch { failed.push(file.title); } }
          setFailures(failed); setTested(true); await refresh();
        } catch (e) { setError(String(e)); }
        finally { setBusy(false); }
      }}>Verificar reprodução</Button>
    </div>
    {live !== "idle" && <p className="text-caption text-muted">Encerre a apresentação para executar os testes de imagem e som.</p>}
    <div className="flex flex-wrap gap-3 text-secondary">
      <label><input type="checkbox" checked={imageOk} onChange={(e) => setImageOk(e.target.checked)} /> Imagem e bordas corretas</label>
      <label><input type="checkbox" checked={soundOk} onChange={(e) => setSoundOk(e.target.checked)} /> Ouvi nas caixas corretas</label>
    </div>
    {playback.length > 0 && live === "idle" && <details><summary className="cursor-pointer text-secondary">Ouvir / assistir às mídias do culto</summary><div className="mt-2 space-y-3">{playback.map((f) => <div key={f.url}><p className="text-caption">{f.title}</p>{f.type === "video" ? <video className="max-h-40 w-full" src={f.url} preload="none" controls /> : <audio className="w-full" src={f.url} preload="none" controls />}</div>)}</div></details>}
  </div>;
}
