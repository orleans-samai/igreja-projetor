import { cn } from "@/lib/cn";
import {
  alturaDaLogo,
  corDoNomeValida,
  corpoDoNome,
  sombraDaLogo,
  sombraDoNome,
  type TamanhoDaLogo,
  type UnidadeDaLogo,
} from "@/lib/logo-no-telao";

export function LumenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <rect x="8" y="7" width="16" height="10" rx="2" className="fill-bg" />
      <rect x="10" y="9" width="12" height="2.2" rx="1" className="fill-muted" />
      <path d="M16 17 L12 25 H20 Z" className="fill-bg" />
    </svg>
  );
}

/**
 * A logo da igreja, do jeito que vai para o telão.
 *
 * Sem `tamanho`, se comporta como antes e ocupa o espaço que recebe — é
 * assim que a prévia do diálogo de logo a usa, dentro de uma caixinha. Com
 * `tamanho`, ela se prende a uma fração da tela: era `max-h-full` puro, e
 * uma logo de 900px de altura virava um brasão de parede a parede no
 * minuto em que o app abria.
 */
export function ChurchLogo({
  url,
  name,
  className,
  tamanho,
  comNome = false,
  unidade = "vmin",
  corDoNome,
  sombraLogo,
  sombraNome,
}: {
  url?: string;
  name: string;
  className?: string;
  /** No telão: pequena, média ou grande. Ausente = ocupa o que receber. */
  tamanho?: TamanhoDaLogo;
  /** Nome da igreja debaixo da imagem. Só vale quando há imagem. */
  comNome?: boolean;
  /** `cqmin` na prévia, que mede pela caixinha; `vmin` no telão. */
  unidade?: UnidadeDaLogo;
  /** Cor do nome (#rrggbb). Ausente = a do palco. */
  corDoNome?: string;
  /** Sombras de 0 a 100 (ver logo-no-telao.ts). */
  sombraLogo?: number;
  sombraNome?: number;
}) {
  const cor = corDoNomeValida(corDoNome);
  const estiloDoNome = { color: cor, textShadow: sombraDoNome(sombraNome) };
  if (url) {
    const noTelao = tamanho !== undefined;
    const nome = comNome && name.trim();
    return (
      <div className={cn("flex flex-col items-center text-center", className)}>
        <img
          src={url}
          alt={name}
          className="max-w-full object-contain"
          style={{
            ...(noTelao ? { maxHeight: alturaDaLogo(tamanho, unidade), maxWidth: "70%" } : { maxHeight: "100%" }),
            filter: sombraDaLogo(sombraLogo, unidade),
          }}
        />
        {/* O Enter do nome vira linha nova aqui também: a igreja quebra o
            nome onde quer, e o telão mostra do mesmo jeito. */}
        {nome && (
          <p
            className="mt-[0.6em] whitespace-pre-line font-display font-semibold leading-tight tracking-tight text-stage-fg"
            style={{ ...(noTelao ? { fontSize: corpoDoNome(tamanho, unidade) } : undefined), ...estiloDoNome }}
          >
            {nome}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <LumenMark className="size-16" />
      <div>
        <p
          className="whitespace-pre-line font-display text-4xl font-semibold leading-tight tracking-tight text-stage-fg"
          style={estiloDoNome}
        >
          {name}
        </p>
        <p className="mt-1 text-body uppercase tracking-[0.22em] text-stage-fg/55">Lúmen</p>
      </div>
    </div>
  );
}
