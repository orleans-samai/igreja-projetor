import { FolderOpen, Gauge, Import, Power } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { AVISO_PRIVACIDADE, instrucao } from "@/lib/ia/conversa";
import { avaliar, recomendaSobDemanda, ROTULO, type Medidas } from "@/lib/ia/desempenho";
import { lerResposta } from "@/lib/ia/protocolo";
import { planejar } from "@/lib/ia/ferramentas";
import { MODOS_IA, type EstadoIA, type ModeloIA, type ModoIA } from "@/lib/ia/tipos";

/**
 * O painel do assistente local.
 *
 * Mostra o que custa antes de o operador escolher: quanto o modelo pesa,
 * quanta memória ele vai querer, e quanta sobra nesta máquina. Um PC de
 * igreja também está projetando, e a conta que importa é a que sobra.
 */

const ROTULO_VEREDITO: Record<string, string> = {
  otimo: "Ótimo nesta máquina",
  adequado: "Adequado",
  "pode-travar": "Pode causar lentidão",
  "nao-recomendado": "Não recomendado",
  desconhecido: "Não deu para medir",
};

/** Comandos do dia a dia; se o modelo erra estes, erra no culto. */
const PROVAS = [
  "avance um slide",
  "apague o telão",
  "mostre a logo",
  "coloque João 3:16 na projeção",
  "procure a música castelo forte",
];

function tamanho(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function IaConfiguracoes() {
  const [estado, setEstado] = useState<EstadoIA | null>(null);
  const [modelos, setModelos] = useState<ModeloIA[]>([]);
  const [medindo, setMedindo] = useState(false);
  const [resultado, setResultado] = useState<{ veredito: string; porque: string; medidas: Medidas } | null>(
    null,
  );
  const suportado = typeof window !== "undefined" && window.lumenDesktop?.isDesktop;

  const recarregar = useCallback(async () => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    setEstado(await d.iaEstado());
    setModelos(await d.iaModelos());
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!suportado) {
    return (
      <p className="text-secondary text-muted">
        O assistente local só existe no aplicativo do Windows.
      </p>
    );
  }

  const trocarModo = async (modo: ModoIA) => {
    const d = window.lumenDesktop!;
    setEstado(await d.iaConfigurar({ modo }));
    void recarregar();
  };

  /**
   * Mede o que importa: quanto demora e quantos comandos ele entende.
   *
   * Roda os comandos de verdade pelo mesmo caminho do assistente, mas não
   * executa nada — só confere se o pedido sairia válido. Medir sem mexer no
   * telão é o único jeito de testar com o culto montado.
   */
  const medir = async () => {
    const d = window.lumenDesktop!;
    setMedindo(true);
    setResultado(null);
    try {
      const t0 = performance.now();
      const subiu = await d.iaLigar();
      const carregarMs = performance.now() - t0;
      if (!subiu.ok) {
        toast(subiu.erro ?? "Não consegui ligar o assistente.");
        return;
      }
      let soma = 0;
      let acertos = 0;
      for (const prova of PROVAS) {
        const t = performance.now();
        const r = await d.iaPerguntar([
          { role: "system", content: instrucao() },
          { role: "user", content: prova },
        ]);
        soma += performance.now() - t;
        if (!r.ok) continue;
        const leitura = lerResposta(r.texto ?? "");
        if (leitura.tipo === "pedido" && planejar(leitura.pedido).ok) acertos += 1;
      }
      const agora = await d.iaEstado();
      const medidas: Medidas = {
        carregarMs,
        respostaMs: soma / PROVAS.length,
        acertos,
        tentativas: PROVAS.length,
        livreGB: agora.memoriaLivreGB,
        modeloGB: agora.modelo?.ramEstimadaGB ?? 0,
      };
      const r = avaliar(medidas);
      setResultado({ ...r, medidas });
      setEstado(agora);
    } finally {
      setMedindo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Assistente local</Label>
        <div className="mt-1">
          <Segmented
            label="Modo do assistente"
            full
            value={estado?.modo ?? "desativado"}
            onChange={(v) => void trocarModo(v)}
            items={MODOS_IA.map((m) => ({ value: m.value, label: m.label }))}
          />
        </div>
        <p className="mt-1 text-secondary text-muted">
          {MODOS_IA.find((m) => m.value === (estado?.modo ?? "desativado"))?.ajuda}
        </p>
      </div>

      {/* O que a máquina tem, antes de o operador escolher o que pôr nela. */}
      {estado && (
        <p className="text-caption text-subtle">
          {estado.memoriaLivreGB} GB de memória livre agora
          {estado.modelo ? ` · o modelo escolhido quer ~${estado.modelo.ramEstimadaGB} GB` : ""}
        </p>
      )}

      {estado && !estado.runtime.achado && (
        <div className="rounded-md bg-elevated p-3">
          <p className="text-secondary text-fg">Falta o programa que roda o modelo.</p>
          <p className="mt-1 text-secondary text-muted">
            Baixe o <span className="text-fg">llama-server</span> do llama.cpp e ponha o executável
            na pasta do assistente. O Lúmen não baixa nada sozinho.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => void window.lumenDesktop!.iaAbrirPasta()}
          >
            <FolderOpen /> Abrir a pasta do assistente
          </Button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label>Modelos</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const r = await window.lumenDesktop!.iaImportarModelo();
              if (r.cancelado) return;
              toast(r.ok ? "Modelo importado." : (r.erro ?? "Não consegui importar."));
              void recarregar();
            }}
          >
            <Import /> Importar .gguf
          </Button>
        </div>
        {modelos.length === 0 ? (
          <p className="mt-1 text-secondary text-muted">
            Nenhum modelo ainda. Importe um arquivo .gguf — Qwen3 0.6B Q4 para máquina fraca, Gemma
            3 1B Q4 se houver 8 GB de RAM.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {modelos.map((m) => {
              const escolhido = estado?.modelo?.caminho === m.caminho;
              return (
                <li key={m.caminho} className="rounded-md bg-elevated p-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-body text-fg">{m.nome}</p>
                    <Button
                      size="sm"
                      variant={escolhido ? "secondary" : "ghost"}
                      aria-pressed={escolhido}
                      onClick={async () => {
                        const r = await window.lumenDesktop!.iaEscolherModelo(m.caminho);
                        if (!r.ok) toast(r.erro ?? "Não consegui usar esse modelo.");
                        void recarregar();
                      }}
                    >
                      {escolhido ? "Em uso" : "Usar"}
                    </Button>
                  </div>
                  <p className="text-caption text-subtle">
                    {tamanho(m.bytes)} · {m.quantizacao} · pede ~{m.ramEstimadaGB} GB ·{" "}
                    <span
                      className={cn(
                        m.veredito === "nao-recomendado" && "text-danger",
                        m.veredito === "otimo" && "text-ok",
                      )}
                    >
                      {ROTULO_VEREDITO[m.veredito ?? "desconhecido"]}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={medindo}
            disabled={!estado?.modelo || !estado.runtime.achado}
            onClick={() => void medir()}
          >
            <Gauge /> Testar desempenho
          </Button>
          {estado?.situacao === "pronta" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await window.lumenDesktop!.iaDesligar();
                void recarregar();
              }}
            >
              <Power /> Descarregar agora
            </Button>
          )}
        </div>
        {resultado && (
          <div className="mt-2 rounded-md bg-elevated p-3">
            <p className="text-body font-medium text-fg">
              {ROTULO[resultado.veredito as keyof typeof ROTULO]}
            </p>
            <p className="mt-0.5 text-secondary text-muted">{resultado.porque}</p>
            <p className="mt-1 text-caption text-subtle">
              Subiu em {(resultado.medidas.carregarMs / 1000).toFixed(1)}s · resposta em{" "}
              {(resultado.medidas.respostaMs / 1000).toFixed(1)}s · entendeu{" "}
              {resultado.medidas.acertos} de {resultado.medidas.tentativas} comandos
            </p>
            {recomendaSobDemanda(resultado.veredito as "adequado") && estado?.modo === "sempre" && (
              <p className="mt-1 text-secondary text-fg">
                Com este resultado, prefira o modo sob demanda.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-caption text-subtle">{AVISO_PRIVACIDADE}.</p>
    </div>
  );
}
