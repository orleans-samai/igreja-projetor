import { ImageUp } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Slider } from "@/components/operator/dialogs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useVfxStore } from "@/features/vfx/store";
import { nid } from "@/lib/fold";
import { hasMediaFolders, listMedia, type MediaFile } from "@/lib/media-library";
import type { Theme } from "@/lib/types";
import { useLumenStore } from "@/store/lumen-store";

/**
 * Criar um tema da casa do zero: o fundo, a letra e onde ele vale.
 *
 * Antes só se editava o tema em uso — criar um novo era copiar um e
 * desfigurá-lo. O fundo vem de onde a igreja já guarda as coisas: uma cor,
 * uma imagem do computador, a pasta de mídia ou um vídeo dinâmico que já
 * virou arquivo. O resto (contorno, sombra, margens) vem do tema em uso,
 * que já foi acertado para o telão desta igreja.
 */

type Fundo = "cor" | "imagem" | "video" | "dinamico";

/**
 * Fontes que o telão desenha em qualquer Windows: as duas que vêm dentro
 * do Lúmen e as que o próprio Windows traz. Fonte que só existe no PC de
 * quem criou o tema cairia numa genérica no domingo.
 */
const FONTES = [
  { valor: "Fraunces", nome: "Fraunces (serifa, a do Lúmen)" },
  { valor: "Instrument Sans", nome: "Instrument Sans (sem serifa, a do Lúmen)" },
  { valor: "Georgia", nome: "Georgia" },
  { valor: "Segoe UI", nome: "Segoe UI" },
  { valor: "Arial", nome: "Arial" },
  { valor: "Bahnschrift", nome: "Bahnschrift" },
  { valor: "Impact", nome: "Impact" },
  { valor: "Times New Roman", nome: "Times New Roman" },
];

const FAMILIA_NA_TELA: Record<string, string> = {
  Fraunces: "Fraunces Variable, Fraunces, Georgia, serif",
  "Instrument Sans": "Instrument Sans Variable, Instrument Sans, Segoe UI, sans-serif",
};

/**
 * A imagem do computador, reduzida ao tamanho do telão.
 *
 * Ela fica dentro do tema, e o tema viaja no quadro publicado a cada troca
 * de slide: a foto de 6 MB da câmera seriam 8 MB copiados a cada verso.
 * Reduzida a Full HD em JPEG, fica perto de meio megabyte e igual na parede.
 */
async function imagemParaFundo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const escala = Math.min(1, 1920 / bitmap.width, 1080 / bitmap.height);
    const tela = document.createElement("canvas");
    tela.width = Math.max(1, Math.round(bitmap.width * escala));
    tela.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("sem tela de desenho");
    ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
    return tela.toDataURL("image/jpeg", 0.86);
  } finally {
    bitmap.close();
  }
}

export function CriarTemaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const themes = useLumenStore((s) => s.themes);
  const songThemeId = useLumenStore((s) => s.songThemeId);
  const addTheme = useLumenStore((s) => s.addTheme);
  const setThemeForKind = useLumenStore((s) => s.setThemeForKind);
  const applyThemeLive = useLumenStore((s) => s.applyThemeLive);
  const updateSettings = useLumenStore((s) => s.updateSettings);
  const projetos = useVfxStore((s) => s.projetos);
  const base = themes.find((t) => t.id === songThemeId) ?? themes[0];

  const [nome, setNome] = useState("");
  const [fundo, setFundo] = useState<Fundo>("cor");
  const [cor, setCor] = useState("#10131a");
  const [imagem, setImagem] = useState("");
  const [video, setVideo] = useState("");
  const [fonte, setFonte] = useState(base?.fontFamily ?? "Fraunces");
  const [corDoTexto, setCorDoTexto] = useState(base?.textColor ?? "#f4f1ea");
  const [tamanho, setTamanho] = useState(base?.fontSize ?? 64);
  const [veu, setVeu] = useState(30);
  const [caixaAlta, setCaixaAlta] = useState(false);
  const [vale, setVale] = useState<Theme["applyTo"]>("songs");
  const [imagens, setImagens] = useState<MediaFile[] | null>(null);
  const [videos, setVideos] = useState<MediaFile[] | null>(null);
  const [lendo, setLendo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const naPasta = hasMediaFolders();

  // Um tema novo a cada abertura: o que ficou pela metade da última vez não
  // aparece no próximo.
  useEffect(() => {
    if (!open) return;
    setNome("");
    setFundo("cor");
    setImagem("");
    setVideo("");
    setFonte(base?.fontFamily ?? "Fraunces");
    setCorDoTexto(base?.textColor ?? "#f4f1ea");
    setTamanho(base?.fontSize ?? 64);
    setVeu(30);
    setCaixaAlta(false);
    setVale("songs");
    // O tema em uso só serve de ponto de partida ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !naPasta) return;
    let vivo = true;
    void Promise.all([listMedia("image"), listMedia("video")]).then(([i, v]) => {
      if (!vivo) return;
      setImagens(i.items ?? []);
      setVideos(v.items ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [open, naPasta]);

  // Um dinâmico entra pelo vídeo que ele gerou — e só se o arquivo ainda
  // está na pasta.
  const dinamicos = projetos.map((p) => {
    const arquivoGerado = p.gerados
      .map((g) => videos?.find((v) => v.id === g.id))
      .find((v): v is MediaFile => Boolean(v));
    return { id: p.id, nome: p.nome, url: arquivoGerado?.url ?? "" };
  });

  const escolherImagem = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Escolha uma imagem: JPG, PNG ou WEBP.");
      return;
    }
    setLendo(true);
    try {
      setImagem(await imagemParaFundo(file));
    } catch {
      toast("Não consegui ler essa imagem.");
    } finally {
      setLendo(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  };

  const fundoPronto =
    fundo === "cor" ? { backgroundType: "color" as const, backgroundValue: cor }
    : fundo === "imagem" ? (imagem ? { backgroundType: "image" as const, backgroundValue: imagem } : null)
    : video ? { backgroundType: "video" as const, backgroundValue: video } : null;

  const criar = () => {
    if (!base || !fundoPronto) return;
    const tema: Theme = {
      ...base,
      ...fundoPronto,
      id: `theme-${nid()}`,
      name: nome.trim().slice(0, 60) || "Tema novo",
      overlayOpacity: fundo === "cor" ? 0 : veu / 100,
      fontFamily: fonte,
      fontSize: tamanho,
      textColor: corDoTexto,
      uppercase: caixaAlta,
      applyTo: vale,
    };
    addTheme(tema);
    if (fundoPronto.backgroundType !== "color") updateSettings({ showWallpaper: true });
    if (vale === "bible") setThemeForKind("bible", tema.id);
    else if (vale === "songs") setThemeForKind("songs", tema.id);
    else applyThemeLive(tema.id);
    toast(`Tema “${tema.name}” criado e já no telão.`);
    onOpenChange(false);
  };

  const estiloDaPrevia: CSSProperties =
    fundo === "cor"
      ? { background: cor }
      : fundo === "imagem" && imagem
        ? { backgroundImage: `url("${imagem}")`, backgroundSize: "cover", backgroundPosition: "center" }
        : { background: "var(--color-stage)" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Criar tema"
        description="O fundo, a letra e onde ele vale. Ao criar, ele já vai para o telão."
        className="w-[min(560px,calc(100%-1.5rem))]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {/* Botão simples, não o <Button>: a variante pintaria o fundo por
                cima do dourado. */}
            <button
              type="button"
              className="ouro inline-flex h-8 items-center rounded-md px-3 text-body font-semibold disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={criar}
              disabled={!fundoPronto}
            >
              Criar tema
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          {/* O telão em miniatura: o que se escolhe aqui é o que a igreja vê. */}
          <div
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg shadow-[var(--shadow-border)]"
            style={estiloDaPrevia}
            data-previa-do-tema
          >
            {(fundo === "video" || fundo === "dinamico") && video && (
              <video
                key={video}
                className="absolute inset-0 size-full object-cover"
                src={video}
                autoPlay
                loop
                muted
                playsInline
              />
            )}
            {fundo !== "cor" && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${veu / 100})` }} />}
            <p
              className="relative px-6 text-center leading-tight"
              style={{
                fontFamily: FAMILIA_NA_TELA[fonte] ?? `${fonte}, sans-serif`,
                // O telão tem 1920 de largura; a prévia, uns 520.
                fontSize: `${(tamanho * 0.27).toFixed(1)}px`,
                color: corDoTexto,
                textTransform: caixaAlta ? "uppercase" : "none",
                textShadow: "0 1px 3px rgba(0,0,0,.6)",
              }}
            >
              Santo, santo, santo
              <br />é o Senhor
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nome-do-tema">Nome do tema</Label>
            <Input
              id="nome-do-tema"
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Culto de domingo"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Fundo</Label>
            <Segmented
              label="Fundo do tema"
              full
              value={fundo}
              onChange={(f) => {
                setFundo(f);
                setVideo("");
              }}
              items={[
                { value: "cor", label: "Cor" },
                { value: "imagem", label: "Imagem" },
                { value: "video", label: "Vídeo" },
                { value: "dinamico", label: "Dinâmico" },
              ]}
            />
            {fundo === "cor" && (
              <label className="flex items-center gap-2 text-secondary text-fg">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  aria-label="Cor do fundo"
                  className="h-8 w-14 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                />
                Cor do fundo
              </label>
            )}
            {fundo === "imagem" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" loading={lendo} onClick={() => arquivo.current?.click()}>
                  <ImageUp /> Do computador
                </Button>
                {naPasta && (imagens?.length ?? 0) > 0 && (
                  <select
                    className="field min-w-0 flex-1"
                    aria-label="Imagem da pasta de mídia"
                    value={imagens?.some((i) => i.url === imagem) ? imagem : ""}
                    onChange={(e) => e.target.value && setImagem(e.target.value)}
                  >
                    <option value="">Ou da pasta de imagens…</option>
                    {imagens?.map((i) => (
                      <option key={i.id} value={i.url}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  ref={arquivo}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void escolherImagem(e.target.files?.[0])}
                />
              </div>
            )}
            {fundo === "video" &&
              (!naPasta ? (
                <p className="text-secondary text-muted">Vídeo de fundo vem da pasta de mídia, no app do Windows.</p>
              ) : videos && videos.length === 0 ? (
                <p className="text-secondary text-muted">Nenhum vídeo na pasta de vídeo ainda.</p>
              ) : (
                <select
                  className="field w-full"
                  aria-label="Vídeo do fundo"
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                >
                  <option value="">Escolher um vídeo…</option>
                  {videos?.map((v) => (
                    <option key={v.id} value={v.url}>
                      {v.title}
                    </option>
                  ))}
                </select>
              ))}
            {fundo === "dinamico" &&
              (dinamicos.length === 0 ? (
                <p className="text-secondary text-muted">
                  Nenhum vídeo dinâmico ainda. Monte um na aba Dinâmicos e salve como vídeo.
                </p>
              ) : (
                <select
                  className="field w-full"
                  aria-label="Vídeo dinâmico do fundo"
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                >
                  <option value="">Escolher um dinâmico…</option>
                  {dinamicos.map((d) => (
                    <option key={d.id} value={d.url} disabled={!d.url}>
                      {d.url ? d.nome : `${d.nome} (ainda não virou vídeo)`}
                    </option>
                  ))}
                </select>
              ))}
          </div>

          {fundo !== "cor" && (
            <Slider label="Véu escuro sobre o fundo" value={veu} min={0} max={80} suffix="%" onChange={setVeu} />
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="fonte-do-tema">Letra</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="fonte-do-tema"
                className="field min-w-0 flex-1"
                value={fonte}
                onChange={(e) => setFonte(e.target.value)}
              >
                {FONTES.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-secondary text-fg">
                <input
                  type="color"
                  value={corDoTexto}
                  onChange={(e) => setCorDoTexto(e.target.value)}
                  aria-label="Cor da letra"
                  className="h-7 w-10 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                />
                Cor
              </label>
              <label className="flex items-center gap-1.5 text-secondary text-fg">
                <input type="checkbox" checked={caixaAlta} onChange={(e) => setCaixaAlta(e.target.checked)} />
                Caixa-alta
              </label>
            </div>
            <Slider label="Tamanho da letra no telão" value={tamanho} min={40} max={96} suffix="px" onChange={setTamanho} />
          </div>

          <div className="grid gap-1.5">
            <Label>Vale para</Label>
            <Segmented
              label="Onde o tema vale"
              full
              value={vale}
              onChange={setVale}
              items={[
                { value: "songs", label: "Letras" },
                { value: "bible", label: "Bíblia" },
                { value: "both", label: "Os dois" },
              ]}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
