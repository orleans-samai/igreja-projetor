import { useCallback, useEffect, useRef } from "react";
import { capturar, type Captura } from "@/lib/auto-slide/audio";
import { AutoSlideEngine } from "@/lib/auto-slide/engine";
import { criarReconhecedorLocal, disponibilidade, type Reconhecedor } from "@/lib/auto-slide/recognizer";
import { useAutoSlideStore } from "@/store/auto-slide-store";
import { useLumenStore } from "@/store/lumen-store";

export function useAutoSlide() {
  const ligado = useAutoSlideStore((s) => s.ligado);
  const deviceId = useAutoSlideStore((s) => s.deviceId);
  const config = useAutoSlideStore((s) => s.config);
  const setEstado = useAutoSlideStore((s) => s.setEstado);
  const setNivel = useAutoSlideStore((s) => s.setNivel);
  const relatar = useAutoSlideStore((s) => s.relatar);
  const contarTroca = useAutoSlideStore((s) => s.contarTroca);

  const live = useLumenStore((s) => s.live);
  const liveIndex = useLumenStore((s) => s.liveIndex);
  const status = useLumenStore((s) => s.status);

  const motor = useRef<AutoSlideEngine | null>(null);
  if (!motor.current) motor.current = new AutoSlideEngine({ ...config });
  const pedidoDoMotor = useRef<number | null>(null);
  const contexto = useRef(0);

  // Invalida o áudio em processamento inclusive se o operador sair e voltar
  // ao mesmo slide antes de a transcrição terminar.
  useEffect(() => useLumenStore.subscribe((next, previous) => {
    if (next.live !== previous.live || next.liveIndex !== previous.liveIndex || next.status !== previous.status) {
      contexto.current += 1;
    }
  }), []);

  useEffect(() => motor.current?.ajustar(config), [config]);

  // Letra nova, contexto novo.
  const assinatura = live ? `${live.refId}:${live.slides.length}` : "";
  useEffect(() => {
    motor.current?.carregar(live?.slides.map((s) => s.text) ?? []);
    pedidoDoMotor.current = null;
    useAutoSlideStore.getState().zerar();
  }, [assinatura, live]);

  // O operador tem prioridade absoluta: qualquer troca que não tenha saído do
  // motor reposiciona o contexto e segura o motor por um cooldown.
  useEffect(() => {
    if (pedidoDoMotor.current === liveIndex) {
      pedidoDoMotor.current = null;
      return;
    }
    motor.current?.marcarManual(Date.now());
  }, [liveIndex]);

  const decidir = useCallback(
    (texto: string) => {
      const st = useLumenStore.getState();
      if (!texto.trim() || !st.live || st.live.kind !== "song" || st.status !== "presenting") return;
      const d = motor.current!.decidir(texto, st.liveIndex, Date.now());
      relatar({ ouvido: texto, candidato: d.index, score: d.score, motivo: d.motivo });
      setEstado(d.trocar || d.motivo === "ja-esta-nele" ? "casou" : "confianca-baixa");
      if (import.meta.env.DEV) {
        console.info(
          `[AutoSlide] "${texto}" → slide ${d.index + 1} (${(d.score * 100).toFixed(0)}%) ${d.motivo}`,
        );
      }
      if (!d.trocar || useAutoSlideStore.getState().modo === "sugerir") return;
      pedidoDoMotor.current = d.index;
      st.goLiveIndex(d.index);
      contarTroca();
    },
    [relatar, setEstado, contarTroca],
  );

  useEffect(() => {
    if (!ligado || status !== "presenting" || live?.kind !== "song") {
      if (!ligado) setEstado("desligado");
      else setEstado("pausado");
      return;
    }
    let captura: Captura | null = null;
    let reconhecedor: Reconhecedor | null = null;
    let cancelado = false;
    let processando = false;
    motor.current?.interromper();

    void (async () => {
      const disp = await disponibilidade();
      if (cancelado) return;
      if (!disp.ok) {
        setEstado("sem-modelo", disp.motivo);
        return;
      }
      reconhecedor = criarReconhecedorLocal();
      try {
        captura = await capturar({
          deviceId: deviceId || undefined,
          onNivel: (n) => { if (!cancelado) setNivel(n); },
          onErro: (e) => { if (!cancelado) setEstado("erro-audio", e); },
          onJanela: async ({ amostras, nivel }) => {
            if (cancelado || !reconhecedor || processando) return;
            // Silêncio não é frase: poupa a CPU e evita alucinação do modelo.
            if (nivel < 0.01) {
              motor.current?.interromper();
              setEstado("sem-audio");
              return;
            }
            setEstado("processando");
            processando = true;
            const versao = contexto.current;
            try {
              const texto = await reconhecedor.transcrever(amostras);
              if (cancelado || versao !== contexto.current) return;
              if (!texto.trim()) {
                motor.current?.interromper();
                setEstado("escutando");
                return;
              }
              decidir(texto);
            } catch (error) {
              if (!cancelado) setEstado("erro-audio", error instanceof Error ? error.message : "Falha no reconhecimento local.");
            } finally {
              processando = false;
            }
          },
        });
        if (cancelado) captura.parar();
        else setEstado("escutando");
      } catch {
        if (!cancelado) {
          setEstado("erro-audio", "Não foi possível abrir a entrada de áudio escolhida.");
        }
      }
    })();

    return () => {
      cancelado = true;
      captura?.parar();
      reconhecedor?.encerrar();
      setNivel(0);
    };
  }, [ligado, deviceId, status, live, decidir, setEstado, setNivel]);
}
