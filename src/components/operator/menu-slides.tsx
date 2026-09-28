import { Presentation } from "lucide-react";
import { toast } from "sonner";
import {
  Menu,
  MenuContent,
  MenuEscolha,
  MenuEscolhas,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { OPCOES_DE_ABERTURA, quemAbreValido, type QuemAbreSlides } from "@/lib/abrir-slides";
import { cn } from "@/lib/cn";
import { type Programas, useProgramasInstalados } from "@/components/operator/use-programas-instalados";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O que se diz embaixo de cada escolha: para que serve — ou, quando o
 * programa não está no computador, isso, antes de alguém escolher e
 * estranhar a apresentação saindo por outro.
 */
function detalheDa(valor: QuemAbreSlides, ajuda: string, programas: Programas | null) {
  if (programas && valor === "office" && !programas.powerPoint) return "Não encontrado neste computador";
  if (programas && valor === "libreoffice" && !programas.libreOffice) return "Não encontrado neste computador";
  return ajuda;
}

/**
 * As escolhas de quem abre as apresentações, para o menu Slides da barra e
 * para o menu único do celular.
 */
export function EscolhasDeQuemAbre({ programas }: { programas: Programas | null }) {
  const escolha = useLumenStore((s) => quemAbreValido(s.settings.abrirSlidesCom));
  const updateSettings = useLumenStore((s) => s.updateSettings);
  return (
    <MenuEscolhas
      valor={escolha}
      onEscolher={(valor) => {
        const nova = quemAbreValido(valor);
        updateSettings({ abrirSlidesCom: nova });
        const rotulo = OPCOES_DE_ABERTURA.find((o) => o.valor === nova)?.rotulo ?? nova;
        toast.success(`As próximas apresentações abrem com: ${rotulo}.`);
      }}
    >
      {OPCOES_DE_ABERTURA.map((o) => (
        <MenuEscolha key={o.valor} valor={o.valor} detalhe={detalheDa(o.valor, o.ajuda, programas)}>
          {o.rotulo}
        </MenuEscolha>
      ))}
    </MenuEscolhas>
  );
}

/**
 * O menu Slides: importar uma apresentação e escolher quem a abre.
 *
 * A igreja pediu para escolher entre o Office, o LibreOffice e o próprio
 * Lúmen, entre as Artes e o Mais. O escolhido vai na frente e os outros
 * ficam de reserva (ver abrir-slides.ts). Abaixo de 1024px fica só o ícone,
 * como o Controle pelo celular: a barra não pode empurrar o Mais para fora.
 */
export function MenuSlides({ onImportar }: { onImportar: () => void }) {
  const { programas, perguntar } = useProgramasInstalados();
  return (
    <Menu onOpenChange={perguntar}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Slides"
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-secondary text-muted",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "hover:bg-elevated hover:text-fg",
            "data-[state=open]:bg-elevated data-[state=open]:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          )}
        >
          <Presentation className="size-3.5" aria-hidden />
          <span className="hidden lg:inline">Slides</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-72">
        <MenuItem onSelect={onImportar}>Importar apresentação (PowerPoint ou PDF)…</MenuItem>
        <MenuSeparator />
        <MenuLabel>Abrir apresentações com</MenuLabel>
        <EscolhasDeQuemAbre programas={programas} />
        <p className="px-2 pb-1.5 pt-1 text-caption text-subtle">
          Vale para as próximas. As que já entraram continuam como estão.
        </p>
      </MenuContent>
    </Menu>
  );
}
