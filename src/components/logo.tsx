import { cn } from "@/lib/cn";

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

export function ChurchLogo({
  url,
  name,
  className,
}: {
  url?: string;
  name: string;
  className?: string;
}) {
  if (url) {
    return (
      <img src={url} alt={name} className={cn("max-h-full max-w-full object-contain", className)} />
    );
  }
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <LumenMark className="size-16" />
      <div>
        <p className="font-display text-4xl font-semibold tracking-tight text-stage-fg">{name}</p>
        <p className="mt-1 text-body uppercase tracking-[0.22em] text-stage-fg/55">Lúmen</p>
      </div>
    </div>
  );
}
