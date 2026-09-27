import { Film, ImageUp, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
import { Segmented } from "@/components/ui/segmented";
import {
  NOME_DO_TAMANHO,
  TAMANHOS_DA_LOGO,
  fundoDaLogoValido,
  tamanhoValido,
  type FundoDaLogo,
} from "@/lib/logo-no-telao";
import { hasMediaFolders, listMedia, type MediaFile } from "@/lib/media-library";
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

type ModoDoFundo = "tema" | FundoDaLogo["tipo"];

/**
 * O que fica atrás da logo no telão: o fundo do tema, ou um vídeo ou uma
 * imagem da pasta de mídia.
 *
 * Da pasta, e não de um seletor de arquivo qualquer, pelo mesmo motivo do
 * vídeo de fundo do tema: o telão lê o arquivo do disco pelo endereço, e o
 * quadro publicado a cada troca de slide leva só esse endereço.
 */
function FundoAtrasDaLogo() {
  // O objeto é montado fora do seletor: um seletor que devolve objeto novo a
  // cada leitura faz o React redesenhar sem parar — e o app inteiro caía
  // no instante em que alguém escolhia o vídeo.
  const fundoGuardado = useLumenStore((s) => s.settings.logoFundo);
  const fundo = fundoDaLogoValido(fundoGuardado);
  const logoAoAbrir = useLumenStore((s) => s.settings.showIdleLogo !== false);
  const update = useLumenStore((s) => s.updateSettings);
  const [modo, setModo] = useState<ModoDoFundo>(fundo?.tipo ?? "tema");
  const [arquivos, setArquivos] = useState<Record<FundoDaLogo["tipo"], MediaFile[] | null>>({
    video: null,
    imagem: null,
  });
  const naPasta = hasMediaFolders();

  useEffect(() => {
    if (!naPasta || modo === "tema" || arquivos[modo]) return;
    let vivo = true;
    void listMedia(modo === "video" ? "video" : "image").then((r) => {
      if (vivo) setArquivos((a) => ({ ...a, [modo]: r.items ?? [] }));
    });
    return () => {
      vivo = false;
    };
  }, [naPasta, modo, arquivos]);

  const trocarModo = (m: ModoDoFundo) => {
    setModo(m);
    // Voltar ao tema vale na hora; vídeo e imagem esperam o arquivo escolhido.
    if (m === "tema") update({ logoFundo: null });
  };
  const lista = modo === "tema" ? null : arquivos[modo];
  const atual = fundo && fundo.tipo === modo ? fundo.url : "";

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body font-medium text-fg">Fundo atrás da logo</span>
        <Segmented
          label="Fundo atrás da logo"
          value={modo}
          onChange={trocarModo}
          items={[
            { value: "tema", label: "Do tema" },
            { value: "video", label: "Vídeo" },
            { value: "imagem", label: "Imagem" },
          ]}
        />
      </div>
      {modo !== "tema" &&
        (!naPasta ? (
          <p className="text-secondary text-muted">
            Fundo da pasta de mídia só existe no app do Windows.
          </p>
        ) : lista === null ? (
          <p className="text-secondary text-muted">Lendo a pasta de mídia…</p>
        ) : lista.length === 0 ? (
          <p className="text-secondary text-muted">
            {modo === "video"
              ? "Nenhum vídeo na pasta de vídeo. Coloque o arquivo lá e ele aparece aqui."
              : "Nenhuma imagem na pasta de imagens. Coloque o arquivo lá e ela aparece aqui."}
          </p>
        ) : (
          <select
            className="field w-full"
            aria-label={modo === "video" ? "Vídeo atrás da logo" : "Imagem atrás da logo"}
            value={atual}
            onChange={(e) => {
              const escolhido = lista.find((f) => f.url === e.target.value);
              if (escolhido) update({ logoFundo: { tipo: modo, url: escolhido.url, titulo: escolhido.title } });
            }}
          >
            <option value="">{modo === "video" ? "Escolher um vídeo…" : "Escolher uma imagem…"}</option>
            {lista.map((f) => (
              <option key={f.id} value={f.url}>
                {f.title}
              </option>
            ))}
          </select>
        ))}
      {modo === "video" && (
        <p className="flex items-start gap-1.5 text-caption text-subtle">
          <Film className="mt-0.5 size-3 shrink-0" aria-hidden />
          Roda em laço e sem som, na tela inteira. Em modo leve, o vídeo não roda.
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-secondary text-fg">
        <input
          type="checkbox"
          checked={logoAoAbrir}
          onChange={(e) => update({ showIdleLogo: e.target.checked })}
          className="size-4 accent-[var(--color-accent)]"
        />
        Começar com a logo no telão sempre que o Lúmen abrir
      </label>
    </div>
  );
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
  const fundo = fundoDaLogoValido(settings.logoFundo);

  return (
    <div className="space-y-3">
      {/* O quadro mostra a logo como o telão vai mostrar: sobre fundo escuro,
          do tamanho que ela terá lá. Escolher às cegas e só descobrir no
          culto é o que este quadro evita. */}
      {/* Um telão em miniatura, 16:9, medindo a logo pela própria caixa: o
          que se vê aqui é a proporção que a igreja vai ver na parede. */}
      <div
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-stage shadow-[var(--shadow-border)]"
        style={{ containerType: "size" }}
      >
        {fundo?.tipo === "video" && (
          <video
            key={fundo.url}
            className="absolute inset-0 size-full object-cover"
            src={fundo.url}
            autoPlay
            loop
            muted
            playsInline
          />
        )}
        {fundo?.tipo === "imagem" && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${fundo.url}")` }}
          />
        )}
        <ChurchLogo
          className="relative"
          url={settings.logoUrl || undefined}
          name={settings.churchName || "Sua igreja"}
          tamanho={tamanhoValido(settings.logoTamanho)}
          comNome={!!settings.logoComNome}
          unidade="cqmin"
        />
      </div>

      {settings.logoUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Tamanho da logo no telão"
            value={tamanhoValido(settings.logoTamanho)}
            onChange={(v) => update({ logoTamanho: v })}
            items={TAMANHOS_DA_LOGO.map((t) => ({ value: t, label: NOME_DO_TAMANHO[t] }))}
          />
          <label className="flex cursor-pointer items-center gap-2 text-secondary text-fg">
            <input
              type="checkbox"
              checked={!!settings.logoComNome}
              onChange={(e) => update({ logoComNome: e.target.checked })}
              className="size-4 accent-[var(--color-accent)]"
            />
            Nome da igreja embaixo
          </label>
        </div>
      )}

      <FundoAtrasDaLogo />

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
