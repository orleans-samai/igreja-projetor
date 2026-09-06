import { useMemo, useState } from "react";
import { Monitor, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { importBibleVersion } from "@/lib/bible";
import { nid } from "@/lib/fold";
import { LyricsSearchPanel } from "@/components/operator/lyrics-search-dialog";
import { formatImportedLyrics, parseLyrics } from "@/lib/lyrics";
import { OptimizeHint } from "@/components/operator/optimize-bar";
import { cn } from "@/lib/cn";
import { isWall, optimizeRawText } from "@/lib/slide-optimize";
import { useLumenStore } from "@/store/lumen-store";
import type { ClockPosition, Song, Theme } from "@/lib/types";

export function SongEditorDialog({
  open,
  onOpenChange,
  songId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  songId: string | null;
}) {
  const songs = useLumenStore((s) => s.songs);
  const groups = useLumenStore((s) => s.groups);
  const saveSong = useLumenStore((s) => s.saveSong);
  const existing = songs.find((s) => s.id === songId);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [artist, setArtist] = useState(existing?.artist ?? "");
  const [groupId, setGroupId] = useState(existing?.groupId ?? groups[0]?.id ?? "");
  const [key, setKey] = useState(existing?.key ?? "");
  const [copyright, setCopyright] = useState(existing?.copyright ?? "");
  const [lyrics, setLyrics] = useState(existing?.lyricsRaw ?? "");
  const [webMode, setWebMode] = useState(false);

  const previewSlides = useMemo(() => parseLyrics(lyrics), [lyrics]);

  const reset = (song?: Song) => {
    setTitle(song?.title ?? "");
    setArtist(song?.artist ?? "");
    setGroupId(song?.groupId ?? groups[0]?.id ?? "");
    setKey(song?.key ?? "");
    setCopyright(song?.copyright ?? "");
    setLyrics(song?.lyricsRaw ?? "");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          reset(existing);
          setWebMode(false);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent title={existing ? "Editar música" : "Nova música"} className="max-h-[86vh] overflow-y-auto">
        {webMode ? (
          <LyricsSearchPanel
            prefillQuery={title}
            prefillArtist={artist}
            onCancel={() => setWebMode(false)}
            onPick={(hit) => {
              if (hit.title) setTitle(hit.title);
              if (hit.artist) setArtist(hit.artist);
              setLyrics(formatImportedLyrics(hit.lyrics));
              if (hit.copyright || hit.sourceName) {
                setCopyright(
                  [hit.copyright, hit.publicDomain ? "domínio público" : "", hit.sourceName]
                    .filter(Boolean)
                    .join(" · "),
                );
              }
              setWebMode(false);
            }}
          />
        ) : (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveSong({
              id: existing?.id ?? nid(),
              title: title.trim() || "Sem título",
              artist,
              groupId,
              key,
              copyright,
              lyricsRaw: lyrics,
              slides: parseLyrics(lyrics),
              createdAt: existing?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            });
            onOpenChange(false);
            toast("Música salva");
          }}
        >
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Label>Artista / autor</Label>
            <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Grupo</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md bg-elevated px-2 text-sm"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tom</Label>
                <Input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Label>Copyright</Label>
            <Input value={copyright} onChange={(e) => setCopyright(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Letra — linha em branco = novo slide. Use [Coro], [Verso 1]…</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setWebMode(true)}
            >
              Buscar letra na internet
            </Button>
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!pasted || !isWall(pasted)) return;
                if (lyrics.trim() && !isWall(lyrics)) return;
                e.preventDefault();
                setLyrics(optimizeRawText(pasted, "song").raw);
                toast("Otimizei o bloco para o telão");
              }}
              className="min-h-56 font-mono text-xs"
            />
            <OptimizeHint text={lyrics} onApply={setLyrics} />
            <p className="text-xs text-muted">{previewSlides.length} slides gerados</p>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const rows = [
    ["F5", "Apresentar (não recarrega a página)"],
    ["Esc", "Parar / voltar à cabine"],
    ["→ ←  Espaço  Enter", "Próximo / anterior"],
    ["PageUp / PageDown", "Próximo / anterior"],
    ["B", "Tela preta"],
    ["L", "Logo da igreja"],
    ["C", "Ocultar texto, manter fundo"],
    ["Ctrl+F", "Busca do repertório"],
    ["Ctrl+B", "Abrir a Bíblia"],
    ["Ctrl+P", "Foco na playlist"],
    ["Ctrl+T", "Próximo tema"],
    ["Ctrl+N", "Próximo item da playlist"],
    ["Ctrl+1…9", "Item N da playlist"],
    ["Ctrl+Shift+F", "Buscar letra na internet"],
    ["Ctrl+Shift+O", "Otimizar apresentação"],
    ["Ctrl+K", "Busca universal / copiloto"],
    ["Ctrl+Z", "Desfazer o culto"],
    ["Ctrl+Shift+H", "Check-up pré-culto"],
    ["F8", "Modo operador"],
    ["F9", "Emergência"],
    ["Ctrl+R", "Bloqueado enquanto o culto está no ar"],
    ["?", "Esta ajuda"],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Atalhos da cabine">
        <ul className="grid gap-2 text-sm">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <kbd className="rounded bg-elevated px-2 py-0.5 font-mono text-xs text-primary">{k}</kbd>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-subtle">
          Atalhos não disparam enquanto você digita em um campo, exceto F5, Esc e os de Ctrl.
          No Windows, instale o Lúmen pelo Edge ou Chrome (Ajuda → Instalar no Windows) para abrir pelo Menu Iniciar.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function CountdownDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const start = useLumenStore((s) => s.startCountdown);
  const [label, setLabel] = useState("Início do culto");
  const [minutes, setMinutes] = useState(5);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Contagem regressiva">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(label, minutes * 60);
            onOpenChange(false);
          }}
        >
          <Label>Texto</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          <Label>Minutos</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <div className="flex justify-end">
            <Button type="submit">Iniciar no telão</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const settings = useLumenStore((s) => s.settings);
  const update = useLumenStore((s) => s.updateSettings);
  const exportLibrary = useLumenStore((s) => s.exportLibrary);
  const importLibrary = useLumenStore((s) => s.importLibrary);
  const resetDemo = useLumenStore((s) => s.resetDemo);
  const addExtraVersion = useLumenStore((s) => s.addExtraVersion);
  const themes = useLumenStore((s) => s.themes);
  const updateTheme = useLumenStore((s) => s.updateTheme);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const setThemeForKind = useLumenStore((s) => s.setThemeForKind);
  const theme = themes.find((t) => t.id === songThemeId) ?? themes[0];

  const patchTheme = (patch: Partial<Theme>) => {
    if (theme) updateTheme({ ...theme, ...patch });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Configuração da cabine" className="max-h-[86vh] overflow-y-auto">
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Igreja</p>
            <Label>Nome no logo</Label>
            <Input
              value={settings.churchName}
              onChange={(e) => update({ churchName: e.target.value })}
            />
            <Label>Logo (imagem)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => update({ logoUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
            <Label>Linhas máximas por slide</Label>
            <Input
              type="number"
              min={3}
              max={8}
              value={settings.maxLines}
              onChange={(e) => update({ maxLines: Number(e.target.value) })}
            />
            <Label>Transição</Label>
            <select
              className="h-9 w-full rounded-md bg-elevated px-2 text-sm"
              value={settings.transition}
              onChange={(e) => update({ transition: e.target.value as "cut" | "fade" })}
            >
              <option value="fade">Fade curto</option>
              <option value="cut">Corte seco</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.chordsOnStage}
                onChange={(e) => update({ chordsOnStage: e.target.checked })}
              />
              Cifra no retorno de palco
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.chordsOnAudience}
                onChange={(e) => update({ chordsOnAudience: e.target.checked })}
              />
              Cifra no projetor público
            </label>
          </section>
          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Tema ativo</p>
            <Label>Opacidade do overlay</Label>
            <input
              type="range"
              min={0}
              max={80}
              value={Math.round(theme.overlayOpacity * 100)}
              onChange={(e) => patchTheme({ overlayOpacity: Number(e.target.value) / 100 })}
              className="w-full"
            />
            <Label>Tamanho da fonte</Label>
            <input
              type="range"
              min={40}
              max={96}
              value={theme.fontSize}
              onChange={(e) => patchTheme({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
            <Label>Cor do texto</Label>
            <input
              type="color"
              value={theme.textColor}
              onChange={(e) => patchTheme({ textColor: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={theme.uppercase}
                onChange={(e) => patchTheme({ uppercase: e.target.checked })}
              />
              Caixa-alta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={theme.shadow}
                onChange={(e) => patchTheme({ shadow: e.target.checked })}
              />
              Sombra
            </label>
            <Label>Alinhamento</Label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as const).map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant={theme.alignH === a ? "default" : "secondary"}
                  onClick={() => patchTheme({ alignH: a })}
                >
                  {a === "left" ? "Esq." : a === "right" ? "Dir." : "Centro"}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setThemeForKind("stage", theme.id)}
            >
              Usar também no palco
            </Button>
          </section>
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Dados</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const blob = new Blob([exportLibrary()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "lumen-biblioteca.json";
                a.click();
              }}
            >
              Exportar repertório
            </Button>
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md bg-elevated px-3 text-xs">
              Importar repertório
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  importLibrary(await file.text());
                  toast("Repertório importado");
                }}
              />
            </label>
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md bg-elevated px-3 text-xs">
              Importar Bíblia JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const bible = await importBibleVersion(JSON.parse(await file.text()));
                    addExtraVersion(bible.id, bible.name);
                    toast(`Versão ${bible.name} importada`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao importar");
                  }
                }}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={resetDemo}>
              Restaurar demo
            </Button>
          </div>
          <p className="text-xs text-subtle">
            A Bíblia embutida é Almeida 1819, domínio público. Não embutimos NVI, NAA nem outras
            versões com copyright — importe só o que a igreja tem direito de usar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DisplayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const settings = useLumenStore((s) => s.settings);
  const update = useLumenStore((s) => s.updateSettings);
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const updateTheme = useLumenStore((s) => s.updateTheme);
  const theme = themes.find((t) => t.id === songThemeId) ?? themes[0];
  const [clockPad, setClockPad] = useState(false);

  const bg =
    theme.backgroundType === "color"
      ? { background: theme.backgroundValue }
      : {
          backgroundImage: `url(${theme.backgroundValue})`,
          backgroundSize: settings.fitMode === "contain" ? "contain" : "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat" as const,
        };

  const fill = settings.baseFill === "light" ? "bg-paper text-paper-fg" : "bg-stage text-stage-fg";
  const clockCorner: Record<ClockPosition, string> = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2",
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Configurações de exibição" className="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showWallpaper}
                onChange={(e) => update({ showWallpaper: e.target.checked })}
              />
              Exibir papel de parede
            </label>
            <Settings2 className="size-4 text-subtle" />
          </div>

          <label className="block cursor-pointer">
            <div
              className={cn(
                "relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-lg shadow-[var(--shadow-border)]",
                fill,
              )}
              style={settings.showWallpaper ? bg : undefined}
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="max-h-16 object-contain" />
              ) : (
                <Monitor className="size-8 text-muted" />
              )}
              {settings.showClock && (
                <span
                  className={cn(
                    "absolute font-display text-lg tabular-nums opacity-90",
                    clockCorner[settings.clockPosition],
                  )}
                >
                  {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <p className="absolute inset-x-0 bottom-0 bg-stage/60 py-1.5 text-center text-xs">
                Clique para alterar
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !theme) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const url = String(reader.result);
                  updateTheme({
                    ...theme,
                    backgroundType: "image",
                    backgroundValue: url,
                  });
                  update({ showWallpaper: true });
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>

          <div>
            <Label>Ajuste</Label>
            <select
              className="field mt-1 w-full"
              value={settings.fitMode}
              onChange={(e) => update({ fitMode: e.target.value as "contain" | "cover" })}
            >
              <option value="contain">Ajustar</option>
              <option value="cover">Preencher</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showClock}
                onChange={(e) => {
                  update({ showClock: e.target.checked });
                  if (e.target.checked) setClockPad(true);
                }}
              />
              Exibir relógio
            </label>
            <button
              type="button"
              aria-label="Posição do relógio"
              className="rounded-md p-1 text-subtle hover:bg-elevated hover:text-fg"
              onClick={() => setClockPad((v) => !v)}
            >
              <Settings2 className="size-4" />
            </button>
          </div>

          {settings.showClock && clockPad && (
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-28 rounded-md bg-elevated shadow-[var(--shadow-border)]">
                {(
                  [
                    ["top-left", "left-1 top-1"],
                    ["top-right", "right-1 top-1"],
                    ["bottom-left", "bottom-1 left-1"],
                    ["bottom-right", "bottom-1 right-1"],
                  ] as const
                ).map(([id, pos]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={id}
                    onClick={() => update({ clockPosition: id })}
                    className={cn(
                      "absolute size-4 rounded-sm",
                      pos,
                      settings.clockPosition === id ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted">Canto do relógio no telão</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Preto"
                onClick={() => update({ baseFill: "dark", showWallpaper: false })}
                className={cn(
                  "size-9 rounded-md bg-stage shadow-[var(--shadow-border)]",
                  settings.baseFill === "dark" && !settings.showWallpaper && "ring-2 ring-primary",
                )}
              />
              <button
                type="button"
                aria-label="Claro"
                onClick={() => update({ baseFill: "light", showWallpaper: false })}
                className={cn(
                  "size-9 rounded-md bg-paper shadow-[var(--shadow-border)]",
                  settings.baseFill === "light" && !settings.showWallpaper && "ring-2 ring-primary",
                )}
              />
              <span className="text-sm">Cor base (preencher)</span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => {
              update({ showWallpaper: true });
              onOpenChange(false);
            }}
          >
            Papel de parede (culto / evento)
          </Button>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-subtle">PC Windows</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.secondMonitor !== false}
                onChange={(e) => update({ secondMonitor: e.target.checked })}
              />
              Projetor no segundo monitor
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.startFullscreen !== false}
                onChange={(e) => update({ startFullscreen: e.target.checked })}
              />
              Telão em tela cheia
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.wakeLock !== false}
                onChange={(e) => update({ wakeLock: e.target.checked })}
              />
              Impedir hibernação durante o culto
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
