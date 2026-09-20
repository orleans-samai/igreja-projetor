import { Film, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { hasMediaFolders, listMedia, type MediaFile } from "@/lib/media-library";
import type { Theme } from "@/lib/types";

/**
 * Vídeo de fundo no telão, escolhido da pasta de mídia.
 *
 * Da pasta, e não de um seletor de arquivo qualquer, por um motivo prático:
 * a imagem de fundo é guardada como endereço `data:` dentro do tema, e o tema
 * viaja no quadro publicado a cada troca de slide. Uma foto aguenta isso; um
 * vídeo de vinte megabytes viraria vinte e sete em base64, copiados a cada
 * avanço de verso, e a projeção engasgaria no meio do louvor.
 *
 * O arquivo na pasta já é servido pelo protocolo do app. O tema guarda só o
 * endereço dele — alguns bytes — e o telão lê o vídeo do disco.
 */
export function FundoDeVideo({
  theme,
  aoEscolher,
}: {
  theme: Theme;
  aoEscolher: (patch: Partial<Theme>) => void;
}) {
  const [videos, setVideos] = useState<MediaFile[]>([]);
  const [carregando, setCarregando] = useState(false);
  const naPasta = hasMediaFolders();

  useEffect(() => {
    if (!naPasta) return;
    let vivo = true;
    setCarregando(true);
    void listMedia("video").then((r) => {
      if (!vivo) return;
      setVideos(r.items ?? []);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [naPasta]);

  if (!naPasta) return null;

  const atual = theme.backgroundType === "video" ? theme.backgroundValue : "";

  return (
    <div>
      <Label>Fundo em vídeo</Label>
      {videos.length === 0 ? (
        <p className="mt-1 text-secondary text-muted">
          {carregando
            ? "Lendo a pasta de vídeo…"
            : "Nenhum vídeo na pasta. Largue um arquivo na pasta de vídeo e atualize a biblioteca."}
        </p>
      ) : (
        <div className="mt-1 flex items-center gap-1.5">
          <select
            className="field min-w-0 flex-1"
            aria-label="Fundo em vídeo"
            value={atual}
            onChange={(e) => {
              const url = e.target.value;
              if (!url) return;
              aoEscolher({ backgroundType: "video", backgroundValue: url });
            }}
          >
            <option value="">Escolher um vídeo…</option>
            {videos.map((v) => (
              <option key={v.id} value={v.url}>
                {v.title}
              </option>
            ))}
          </select>
          {atual && (
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Tirar o vídeo de fundo"
              onClick={() => aoEscolher({ backgroundType: "color", backgroundValue: "#0f1115" })}
            >
              <X />
            </Button>
          )}
        </div>
      )}
      <p className="mt-1 flex items-start gap-1.5 text-caption text-subtle">
        <Film className="mt-0.5 size-3 shrink-0" aria-hidden />
        Roda em laço e sem som. Em PC modesto, o modo leve desliga o fundo — inclusive este.
      </p>
    </div>
  );
}
