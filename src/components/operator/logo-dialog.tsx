import { ImageUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ChurchLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import {
  LADO_MAX_LOGO,
  PESO_MAX_BYTES,
  caberEm,
  ehImagemAceita,
  ehVetor,
  pesoDoDataUrl,
  pesoLegivel,
} from "@/lib/logo-imagem";
import { useLumenStore } from "@/store/lumen-store";

function lerComo(file: File, modo: "dataUrl"): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    if (modo === "dataUrl") leitor.readAsDataURL(file);
  });
}

/**
 * Reduz a imagem antes de guardá-la.
 *
 * A logo viaja dentro do quadro publicado a cada troca de slide. Guardar a
 * foto original de uma câmera seria copiar megabytes a cada avanço de verso,
 * e num PC de igreja isso aparece como engasgo na projeção.
 *
 * SVG passa direto: é desenho, e rasterizá-lo jogaria fora o que ele tem de
 * melhor. Se o navegador não conseguir desenhar a imagem, o original é
 * guardado assim mesmo — logo pesada é melhor que igreja sem logo.
 */
async function prepararLogo(file: File): Promise<string> {
  const original = await lerComo(file, "dataUrl");
  if (ehVetor(file.type)) return original;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagem ilegível"));
      el.src = original;
    });
    const alvo = caberEm(img.naturalWidth, img.naturalHeight, LADO_MAX_LOGO);
    if (alvo.largura === 0) return original;
    if (alvo.largura === img.naturalWidth && alvo.altura === img.naturalHeight) return original;
    const tela = document.createElement("canvas");
    tela.width = alvo.largura;
    tela.height = alvo.altura;
    const pincel = tela.getContext("2d");
    if (!pincel) return original;
    pincel.drawImage(img, 0, 0, alvo.largura, alvo.altura);
    // PNG, sempre: a logo da igreja quase sempre tem fundo transparente, e
    // JPEG o trocaria por um retângulo branco no meio do telão escuro.
    const reduzida = tela.toDataURL("image/png");
    return reduzida.length < original.length ? reduzida : original;
  } catch {
    return original;
  }
}

/**
 * A identidade visual da igreja num lugar só: a logo e o nome.
 *
 * Mora aqui, e não solto dentro das Configurações, porque é a primeira coisa
 * que alguém faz ao instalar o Lúmen — e era a mais escondida, no meio de
 * margens, transições e linhas por slide.
 */
export function IdentidadeDaIgreja() {
  const settings = useLumenStore((s) => s.settings);
  const update = useLumenStore((s) => s.updateSettings);
  const entrada = useRef<HTMLInputElement>(null);
  // Rótulo preso ao campo: sem isto, quem usa leitor de tela ouve uma caixa
  // de texto sem nome.
  const idNome = useId();
  const [ocupado, setOcupado] = useState(false);

  const escolher = async (file: File | undefined) => {
    if (!file) return;
    if (!ehImagemAceita(file.type)) {
      toast("Escolha uma imagem: PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > PESO_MAX_BYTES) {
      toast(`Essa imagem tem ${pesoLegivel(file.size)}. Use uma de até ${pesoLegivel(PESO_MAX_BYTES)}.`);
      return;
    }
    setOcupado(true);
    try {
      update({ logoUrl: await prepararLogo(file) });
      toast("Logo atualizada.");
    } catch {
      toast("Não consegui ler esse arquivo.");
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const peso = pesoDoDataUrl(settings.logoUrl);

  return (
    <div className="space-y-3">
      {/* O quadro mostra a logo como o telão vai mostrar: sobre fundo escuro,
          do tamanho que ela terá lá. Escolher às cegas e só descobrir no
          culto é o que este quadro evita. */}
      <div className="flex min-h-36 items-center justify-center rounded-lg bg-stage p-6 shadow-[var(--shadow-border)]">
        <div className="flex h-24 items-center justify-center">
          <ChurchLogo url={settings.logoUrl || undefined} name={settings.churchName || "Sua igreja"} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" loading={ocupado} onClick={() => entrada.current?.click()}>
          <ImageUp /> {settings.logoUrl ? "Trocar a imagem" : "Escolher a imagem"}
        </Button>
        {settings.logoUrl && (
          <Button variant="ghost" onClick={() => update({ logoUrl: "" })}>
            <Trash2 /> Tirar a logo
          </Button>
        )}
        {peso > 0 && <span className="text-caption text-subtle">{pesoLegivel(peso)}</span>}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(e) => void escolher(e.target.files?.[0])}
      />

      <div className="space-y-1.5">
        <Label htmlFor={idNome}>Nome da igreja</Label>
        <Input
          id={idNome}
          value={settings.churchName}
          onChange={(e) => update({ churchName: e.target.value })}
          placeholder="Igreja Local"
        />
        <p className="text-secondary text-muted">
          Aparece na barra de cima da cabine e no telão quando não há imagem. Com a logo
          escolhida, é ela que o telão mostra.
        </p>
      </div>
    </div>
  );
}

export function LogoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Logo e nome da igreja">
        <IdentidadeDaIgreja />
      </DialogContent>
    </Dialog>
  );
}
