import { GraduationCap, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/lib/tour";
import { cn } from "@/lib/cn";
import { useLumenStore } from "@/store/lumen-store";
import { useOpsStore } from "@/store/ops-store";

/**
 * Convite de primeira vez.
 *
 * Uma faixa fina, no mesmo formato da faixa de instalação: quem já sabe operar
 * fecha no X e nunca mais vê; quem chegou agora tem onde começar sem precisar
 * caçar o botão. Some sozinha durante o culto.
 */
export function TourBanner() {
  const visto = useOpsStore((s) => s.tourSeen);
  const aberto = useOpsStore((s) => s.tourOpen);
  const setAberto = useOpsStore((s) => s.setTourOpen);
  const marcarVisto = useOpsStore((s) => s.markTourSeen);
  const liveMode = useOpsStore((s) => s.liveMode);
  const status = useLumenStore((s) => s.status);
  if (visto || aberto || liveMode || status !== "idle") return null;
  return (
    <div className="flex items-center gap-2 border-b border-border bg-elevated px-3 py-1">
      <GraduationCap className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-secondary text-muted">
        Primeira vez na cabine? Um tutorial de dois minutos mostra onde fica cada coisa.
      </p>
      <Button size="sm" variant="ghost" onClick={() => setAberto(true)}>
        Aprender a usar
      </Button>
      <Button size="iconSm" variant="ghost" aria-label="Dispensar" onClick={marcarVisto}>
        <X />
      </Button>
    </div>
  );
}

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

const FOLGA = 8;
const CARTAO = { largura: 360, altura: 210 };

/** Meio pixel de diferença não é movimento — não vale um render. */
function mesmaCaixa(a: Caixa | null, b: Caixa | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

/**
 * Onde o cartão cabe sem cobrir o que ele está explicando.
 *
 * Tenta os quatro lados do alvo — embaixo, em cima, à direita, à esquerda — e
 * fica no primeiro que couber inteiro na tela. Painel alto, como a biblioteca,
 * não deixa espaço em cima nem embaixo, e o cartão vai para o lado. Se nenhum
 * lado couber, ele fica no centro e por cima; é o menos pior.
 */
function posicionar(alvo: Caixa | null, altura: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centro = {
    top: Math.round((vh - altura) / 2),
    left: Math.round((vw - CARTAO.largura) / 2),
  };
  if (!alvo) return centro;

  const grudar = (v: number, max: number) => Math.round(Math.min(Math.max(12, v), max - 12));
  const meioX = grudar(alvo.left + alvo.width / 2 - CARTAO.largura / 2, vw - CARTAO.largura);
  const meioY = grudar(alvo.top + alvo.height / 2 - altura / 2, vh - altura);

  const lados = [
    { top: alvo.top + alvo.height + 12, left: meioX },
    { top: alvo.top - altura - 12, left: meioX },
    { top: meioY, left: alvo.left + alvo.width + 12 },
    { top: meioY, left: alvo.left - CARTAO.largura - 12 },
  ];
  const cabe = lados.find(
    (p) =>
      p.top >= 12 &&
      p.left >= 12 &&
      p.top + altura <= vh - 12 &&
      p.left + CARTAO.largura <= vw - 12,
  );
  return cabe ? { top: Math.round(cabe.top), left: Math.round(cabe.left) } : centro;
}

/**
 * Tutorial guiado.
 *
 * Escurece a tela e abre um buraco em cima do elemento que está sendo
 * explicado — o buraco é uma sombra gigante em volta do recorte, que custa
 * um elemento só e acompanha o alvo se a janela mudar de tamanho.
 *
 * Quando o alvo não existe (a cabine em telas estreitas usa outro layout), o
 * passo continua valendo: o cartão vai para o centro, sem destaque.
 */
export function Tour() {
  const aberto = useOpsStore((s) => s.tourOpen);
  const setAberto = useOpsStore((s) => s.setTourOpen);
  const marcarVisto = useOpsStore((s) => s.markTourSeen);
  const setTourTab = useOpsStore((s) => s.setTourTab);
  const [i, setI] = useState(0);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  // O cartão cresce com o texto do passo; a posição precisa da altura real.
  const cartaoRef = useRef<HTMLDivElement>(null);
  const [alturaCartao, setAlturaCartao] = useState(CARTAO.altura);

  const passo = TOUR_STEPS[i];
  const ultimo = i === TOUR_STEPS.length - 1;

  const medir = useCallback(() => {
    let proximo: Caixa | null = null;
    if (passo?.target) {
      // A cabine larga e a estreita marcam o mesmo alvo; a que não está em uso
      // fica com display:none e mede zero. Vale a primeira que estiver na tela.
      const todos = document.querySelectorAll<HTMLElement>(`[data-tour="${passo.target}"]`);
      for (const el of todos) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        // Encostado na borda o recorte sairia da tela; ele para na borda.
        const top = Math.max(0, r.top - FOLGA);
        const left = Math.max(0, r.left - FOLGA);
        const right = Math.min(window.innerWidth, r.right + FOLGA);
        const bottom = Math.min(window.innerHeight, r.bottom + FOLGA);
        proximo = { top, left, width: right - left, height: bottom - top };
        break;
      }
    }
    setAlvo((atual) => (mesmaCaixa(atual, proximo) ? atual : proximo));
  }, [passo]);

  useLayoutEffect(() => {
    if (aberto) medir();
  }, [aberto, medir]);

  useLayoutEffect(() => {
    const h = cartaoRef.current?.offsetHeight;
    if (h) setAlturaCartao((v) => (Math.abs(v - h) < 1 ? v : h));
  }, [aberto, i]);

  // A cabine se mexe embaixo do tutorial — aba que troca, painel que rola,
  // janela que muda de tamanho. Remedir de tempos em tempos é mais barato que
  // observar cada causa, e só vira render quando o alvo saiu do lugar.
  useEffect(() => {
    if (!aberto) return;
    const id = window.setInterval(medir, 150);
    window.addEventListener("resize", medir);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", medir);
    };
  }, [aberto, medir]);

  // Na cabine estreita os painéis viram abas: abre a aba do passo atual.
  useEffect(() => {
    if (!aberto) return;
    setTourTab(passo?.tab ?? null);
  }, [aberto, passo, setTourTab]);

  const fechar = useCallback(() => {
    setAberto(false);
    setTourTab(null);
    marcarVisto();
    setI(0);
  }, [setAberto, setTourTab, marcarVisto]);

  // O tutorial fica por cima de tudo, então ele é quem responde ao teclado
  // enquanto está aberto — inclusive engolindo as teclas do culto.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
        return;
      }
      if (["ArrowRight", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        setI((v) => (v >= TOUR_STEPS.length - 1 ? v : v + 1));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setI((v) => Math.max(0, v - 1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [aberto, fechar]);

  if (!aberto || !passo) return null;

  const { top, left } = posicionar(alvo, alturaCartao);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Aprender a usar">
      {/* O recorte: sombra enorme em volta deixa só o alvo iluminado. */}
      {alvo ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg transition-all duration-[var(--motion-slow)] ease-[var(--ease-out)]"
          style={{
            top: alvo.top,
            left: alvo.left,
            width: alvo.width,
            height: alvo.height,
            boxShadow: "0 0 0 9999px rgb(5 6 10 / 0.78)",
            outline: "2px solid var(--color-live)",
            outlineOffset: 0,
          }}
        />
      ) : (
        <div aria-hidden className="veil absolute inset-0 bg-stage/78" data-state="open" />
      )}

      {/* Clicar fora fecha, como em qualquer diálogo. */}
      <button
        type="button"
        aria-label="Fechar tutorial"
        className="absolute inset-0 cursor-default"
        onClick={fechar}
      />

      <div
        className={cn(
          "animate-pop-in absolute rounded-xl bg-surface p-4",
          "shadow-[var(--shadow-pop),var(--shadow-border)]",
        )}
        ref={cartaoRef}
        style={{ top, left, width: CARTAO.largura }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-title font-semibold tracking-tight text-fg">{passo.title}</h2>
          <span className="tnum shrink-0 text-caption text-subtle">
            {i + 1}/{TOUR_STEPS.length}
          </span>
        </div>

        <p className="mt-2 text-body text-muted">{passo.body}</p>

        {passo.keys && (
          <p className="mt-2.5 flex items-center gap-1.5 text-caption text-subtle">
            No teclado:
            <kbd className="rounded-sm bg-elevated px-1.5 py-0.5 text-caption text-fg shadow-[var(--shadow-border)]">
              {passo.keys}
            </kbd>
          </p>
        )}

        {/* Régua de progresso: quantos passos faltam, sem contar de cabeça. */}
        <div className="mt-3.5 flex gap-1" aria-hidden>
          {TOUR_STEPS.map((s, n) => (
            <span
              key={s.id}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors duration-[var(--motion-base)]",
                n <= i ? "bg-live" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={fechar}>
            {ultimo ? "Fechar" : "Sair do tutorial"}
          </Button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setI((v) => Math.max(0, v - 1))}>
                Voltar
              </Button>
            )}
            {!ultimo && (
              <Button size="sm" onClick={() => setI((v) => v + 1)}>
                Próximo
              </Button>
            )}
            {ultimo && (
              <Button
                size="sm"
                onClick={() => {
                  fechar();
                  useOpsStore.getState().setTrainingOpen(true);
                }}
              >
                Treinar no simulador
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
