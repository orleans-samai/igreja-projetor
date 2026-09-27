import { Camera, History, MessageSquare, MicOff, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ChatHistoricoDialog } from "@/components/operator/chat-historico-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Hint } from "@/components/ui/tooltip";
import {
  completarMencao,
  iniciais,
  posicaoNoGrupo,
  sugestoesDeMencao,
  trechosDoRecado,
} from "@/lib/chat-grupos";
import { chatVisivel } from "@/lib/chat-visivel";
import { cn } from "@/lib/cn";
import { chaveDaPessoa, corDaPessoa } from "@/lib/cor-do-chat";
import {
  NOME_DA_EQUIPE,
  type EquipeDoChat,
  type MensagemChat,
  type ParaChat,
  type PessoaNoChat,
} from "@/lib/remote-control";
import { chegouRecado, recadoApagado } from "@/store/chat-historico-store";
import { useChatStore } from "@/store/chat-store";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O chat da cabine.
 *
 * Fica ao lado, nunca por cima: quem está projetando não pode ter um balão
 * tapando o botão de Próximo. Por isso o painel ocupa uma coluna própria e o
 * aviso de mensagem nova é um número no botão, não uma janela.
 */

function hora(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * O aviso discreto de mensagem nova.
 *
 * Uma linha que aparece e sai sozinha — nunca um popup no meio da tela, que
 * é exatamente o que não se pode fazer com quem está projetando um culto.
 */
export function ChatAviso() {
  const aviso = useChatStore((s) => s.aviso);
  const limpar = useChatStore((s) => s.limparAviso);
  const abrir = useChatStore((s) => s.abrir);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(limpar, 6000);
    return () => window.clearTimeout(t);
  }, [aviso, limpar]);

  if (!aviso) return null;
  return (
    <button
      type="button"
      onClick={() => abrir(true)}
      className={cn(
        "animate-swap-in flex w-full items-baseline gap-2 border-b border-border bg-elevated px-3 py-1 text-left",
        "hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <MessageSquare className="size-3.5 shrink-0 translate-y-0.5 text-accent" aria-hidden />
      <span className="shrink-0 text-secondary font-medium text-fg">{aviso.de}</span>
      <span className="min-w-0 flex-1 truncate text-secondary text-muted">{aviso.texto}</span>
    </button>
  );
}

/** O seletor "Para" guarda o destino como texto: "todos", "e:som", "p:<id>". */
function valorDoPara(para: ParaChat): string {
  if (para.tipo === "equipe") return `e:${para.equipe}`;
  if (para.tipo === "pessoa") return `p:${para.id}`;
  return "todos";
}

function paraDoValor(valor: string, pessoas: PessoaNoChat[]): ParaChat {
  if (valor.startsWith("e:")) return { tipo: "equipe", equipe: valor.slice(2) as EquipeDoChat };
  if (valor.startsWith("p:")) {
    const id = valor.slice(2);
    return { tipo: "pessoa", id, nome: pessoas.find((p) => p.id === id)?.nome ?? "" };
  }
  return { tipo: "todos" };
}

/** O selo do balão: "→ Som", "→ Bia". Recado para todos não leva selo. */
function destinoCurto(para?: ParaChat): string | null {
  if (!para || para.tipo === "todos") return null;
  if (para.tipo === "equipe") return NOME_DA_EQUIPE[para.equipe] ?? para.equipe;
  return para.id === "cabine" ? "você" : para.nome || "uma pessoa";
}

const LADO_DA_FOTO = 1600;

/**
 * A foto sai da cabine do mesmo tamanho que sai do celular: 1600 px, JPEG.
 * Uma foto de 12 MP inteira atravessaria a Wi-Fi da igreja para cada
 * aparelho aberto, no meio do culto.
 */
async function fotoParaMandar(arquivo: File): Promise<Uint8Array> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_DA_FOTO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(imagem.width * escala));
  canvas.height = Math.max(1, Math.round(imagem.height * escala));
  canvas.getContext("2d")?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("Não deu para preparar a foto.");
  return new Uint8Array(await blob.arrayBuffer());
}

const SILENCIOS = [
  { minutos: 10, rotulo: "Por 10 minutos" },
  { minutos: 30, rotulo: "Por 30 minutos" },
  { minutos: 120, rotulo: "Até o fim do culto (2 h)" },
];

/**
 * Um recado em balão. Os da cabine ficam à direita, sem nome; os dos outros,
 * à esquerda, com as iniciais na cor da pessoa — o nome e as iniciais uma vez
 * por grupo, a hora uma vez, no fim.
 *
 * A cabine modera: apaga qualquer recado (para todos, em dois cliques) e
 * silencia quem escreveu, por um tempo.
 */
function Recado({
  m,
  primeiro,
  ultimo,
  cor,
  corDoNome,
  silenciado,
  aoAbrirFoto,
}: {
  m: MensagemChat;
  primeiro: boolean;
  ultimo: boolean;
  cor: string;
  corDoNome: (nome: string, id: string) => string;
  silenciado: boolean;
  aoAbrirFoto: (src: string) => void;
}) {
  const minha = m.daCabine;
  const [confirmando, setConfirmando] = useState(false);
  const destino = destinoCurto(m.para);
  const deAparelho = !!m.deId && m.deId !== "cabine";

  useEffect(() => {
    if (!confirmando) return;
    const t = window.setTimeout(() => setConfirmando(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmando]);

  const apagar = async () => {
    const d = window.lumenDesktop;
    if (!d) return;
    const r = await d.remoteControlChatApagar(m.id);
    if (r.ok) recadoApagado(m.id);
  };

  const silenciar = (minutos: number) => {
    if (m.deId) void window.lumenDesktop?.remoteControlSilenciar(m.deId, minutos);
  };

  return (
    <li className={cn("group flex items-end gap-1.5", minha && "justify-end", !primeiro && "-mt-1")}>
      {!minha && (
        <span
          aria-hidden
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full text-[10.5px] font-bold",
            !ultimo && "invisible",
          )}
          style={{ background: cor, color: "#0a0b0d" }}
        >
          {iniciais(m.de)}
        </span>
      )}
      <div
        className={cn(
          "relative min-w-0 max-w-[85%] rounded-lg px-2 py-1.5",
          minha ? "bg-accent/15 ring-1 ring-accent/40" : "bg-elevated",
        )}
      >
        {!minha && primeiro && (
          <p className="truncate text-caption font-semibold" style={{ color: cor }}>
            {m.de}
          </p>
        )}
        {destino && <p className="text-caption text-subtle">→ {destino}</p>}
        {m.apagada ? (
          <p className="text-secondary italic text-subtle">Recado apagado pela cabine</p>
        ) : (
          <>
            {m.foto && (
              <button
                type="button"
                className="mt-0.5 block rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => aoAbrirFoto(`/__chat/${m.foto?.arquivo}`)}
                aria-label={`Ver a foto de ${minha ? "você" : m.de} maior`}
              >
                <img src={`/__chat/${m.foto.arquivo}`} alt="" className="max-h-40 rounded-md" />
              </button>
            )}
            {/* Recado falado: o player nativo basta, e é o que todo mundo já
                sabe operar. `preload="none"` para o culto não carregar áudio
                nenhum até alguém decidir ouvir. */}
            {m.audio && (
              <audio
                controls
                preload="none"
                src={m.audio}
                className="mt-1 w-full"
                aria-label={`Recado falado de ${m.de}${m.segundos ? `, ${m.segundos} segundos` : ""}`}
              />
            )}
            {m.texto && (
              <p className="whitespace-pre-wrap break-words text-secondary text-fg">
                {trechosDoRecado(m.texto, m.mencoes).map((t, i) =>
                  t.pessoa ? (
                    <b
                      key={i}
                      className={cn("font-semibold", t.pessoa.id === "cabine" && "rounded-sm bg-accent/25 px-0.5")}
                      style={{ color: corDoNome(t.pessoa.nome, t.pessoa.id) }}
                    >
                      {t.texto}
                    </b>
                  ) : (
                    <span key={i}>{t.texto}</span>
                  ),
                )}
              </p>
            )}
          </>
        )}
        {ultimo && <p className="tnum text-right text-caption text-subtle">{hora(m.em)}</p>}

        {!m.apagada && (
          <div
            className={cn(
              "absolute -top-3 right-1 flex items-center gap-0.5 rounded-md bg-raised p-0.5",
              "shadow-[var(--shadow-pop),var(--shadow-border)]",
              "opacity-0 transition-opacity duration-[var(--motion-fast)] focus-within:opacity-100 group-hover:opacity-100",
              confirmando && "opacity-100",
            )}
          >
            <button
              type="button"
              onClick={() => (confirmando ? void apagar() : setConfirmando(true))}
              aria-label={confirmando ? "Confirmar: apagar o recado para todos" : "Apagar o recado"}
              className={cn(
                "flex h-6 items-center gap-1 rounded px-1 text-caption",
                "focus-visible:outline-2 focus-visible:outline-ring",
                confirmando ? "bg-danger text-danger-fg" : "text-muted hover:text-danger",
              )}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {confirmando && "Apagar?"}
            </button>
            {deAparelho && (
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Silenciar ${m.de} no chat`}
                    className={cn(
                      "grid size-6 place-items-center rounded",
                      "focus-visible:outline-2 focus-visible:outline-ring",
                      silenciado ? "text-danger" : "text-muted hover:text-fg",
                    )}
                  >
                    <MicOff className="size-3.5" aria-hidden />
                  </button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuLabel>{silenciado ? `${m.de} está silenciado` : `Silenciar ${m.de}`}</MenuLabel>
                  {SILENCIOS.map((s) => (
                    <MenuItem key={s.minutos} onSelect={() => silenciar(s.minutos)}>
                      {s.rotulo}
                    </MenuItem>
                  ))}
                  {silenciado && (
                    <>
                      <MenuSeparator />
                      <MenuItem onSelect={() => silenciar(0)}>Devolver a voz</MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function ChatPanel() {
  const mensagens = useChatStore((s) => s.mensagens);
  const aberto = useChatStore((s) => s.aberto);
  const posicao = useChatStore((s) => s.posicao);
  const pessoas = useChatStore((s) => s.pessoas);
  const digitando = useChatStore((s) => s.digitando);
  const para = useChatStore((s) => s.para);
  const setPara = useChatStore((s) => s.setPara);
  const operador = useLumenStore((s) => s.settings.operatorName);
  const [texto, setTexto] = useState("");
  const [cursor, setCursor] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lupa, setLupa] = useState<string | null>(null);
  const [historico, setHistorico] = useState(false);
  const [, setRelogio] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const arquivoDeFoto = useRef<HTMLInputElement>(null);
  const ultimoDigitando = useRef(0);

  // Cor de cada pessoa, na ordem em que apareceram na conversa — e a das
  // citadas e a de quem está no chat, pelo mesmo mapa, para a Bia ser da
  // mesma cor no balão, na menção e na lista de presença.
  const { cores, corDoNome } = useMemo(() => {
    const usadas = new Map<string, number>();
    const chaveDoNome = (nome: string, id: string) => (id === "cabine" ? "cabine" : `p:${nome.trim().toLowerCase()}`);
    const cores = mensagens.map((m) => {
      const cor = corDaPessoa(chaveDaPessoa(m), usadas);
      for (const p of m.mencoes ?? []) corDaPessoa(chaveDoNome(p.nome, p.id), usadas);
      return cor;
    });
    for (const p of pessoas) corDaPessoa(chaveDoNome(p.nome, p.id), usadas);
    return {
      cores,
      corDoNome: (nome: string, id: string) => corDaPessoa(chaveDoNome(nome, id), usadas),
    };
  }, [mensagens, pessoas]);

  const outros = pessoas.filter((p) => p.id !== "cabine");
  const agora = Date.now();
  const digitandoAgora = digitando.filter((d) => d.ate > agora);

  // "Digitando…" some sozinho: sem isto a linha ficaria até o próximo recado.
  useEffect(() => {
    if (digitandoAgora.length === 0) return;
    const t = window.setInterval(() => setRelogio((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [digitandoAgora.length]);

  // Recado novo desce a lista — a não ser que o operador esteja lendo lá em
  // cima, e aí não se arranca a leitura dele.
  const ultimo = mensagens[mensagens.length - 1];
  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (perto || ultimo?.daCabine) el.scrollTop = el.scrollHeight;
  }, [ultimo?.id, ultimo?.daCabine, aberto]);

  const sugestao = useMemo(
    () => sugestoesDeMencao(texto.slice(0, cursor), pessoas, "cabine"),
    [texto, cursor, pessoas],
  );

  if (!chatVisivel(posicao, aberto)) return null;

  const autor = operador || "Cabine";

  const enviar = async () => {
    const limpo = texto.trim();
    const d = window.lumenDesktop;
    if (!limpo || !d?.isDesktop) return;
    setEnviando(true);
    setErro(null);
    try {
      const msg = await d.remoteControlChat(limpo, autor, para);
      // Quem manda também vê — e o recado vai para o histórico do culto.
      if (msg) chegouRecado(msg);
      setTexto("");
      setCursor(0);
    } finally {
      setEnviando(false);
    }
  };

  const mandarFoto = async (arquivo: File) => {
    const d = window.lumenDesktop;
    if (!d?.isDesktop) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await d.remoteControlChatFoto(await fotoParaMandar(arquivo), texto.trim(), autor, para);
      if (!r.ok) {
        setErro(r.erro ?? "A foto não foi.");
        return;
      }
      if (r.mensagem) chegouRecado(r.mensagem);
      setTexto("");
      setCursor(0);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A foto não foi.");
    } finally {
      setEnviando(false);
    }
  };

  const escolherMencao = (nome: string) => {
    if (!sugestao) return;
    const r = completarMencao(texto, cursor, sugestao.fragmento, nome);
    setTexto(r.texto);
    setCursor(r.cursor);
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(r.cursor, r.cursor);
    });
  };

  const avisarDigitando = () => {
    const t = Date.now();
    if (t - ultimoDigitando.current < 1500) return;
    ultimoDigitando.current = t;
    window.lumenDesktop?.remoteControlDigitando(para);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    // Tab completa o @ com a primeira sugestão, como nos mensageiros.
    if (e.key === "Tab" && sugestao) {
      e.preventDefault();
      escolherMencao(sugestao.pessoas[0].nome);
    }
  };

  // Colar um print (Ctrl+V) manda a foto, com o que estiver escrito de legenda.
  const aoColar = (e: ClipboardEvent<HTMLInputElement>) => {
    const imagem = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (!imagem) return;
    e.preventDefault();
    void mandarFoto(imagem);
  };

  const quemDigita = digitandoAgora.map((d) => d.nome);

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-surface",
        // Flutuante encosta no canto inferior e some da árvore de colunas;
        // lateral vira uma coluna de verdade, que nunca cobre nada.
        posicao === "flutuante"
          ? "pop-layer absolute bottom-3 right-3 z-30 h-[26rem] w-80 rounded-lg shadow-[var(--shadow-pop),var(--shadow-border)]"
          : "h-full w-full border-border",
        posicao === "coluna" && "border-l border-border",
      )}
      aria-label="Chat com os celulares"
    >
      <div className="panel-head justify-between">
        <h2 className="flex items-center gap-1.5">
          <MessageSquare className="size-3.5 text-subtle" aria-hidden /> Chat
        </h2>
        {/* Sem botão de fechar: o chat é móvel da cabine, e some só onde
            se escolhe onde ele fica — nas Configurações. Recado de culto que
            chega num painel fechado é recado perdido. */}
        <Hint label="Histórico do chat, culto a culto" side="bottom">
          <Button size="iconSm" variant="ghost" aria-label="Histórico do chat" onClick={() => setHistorico(true)}>
            <History />
          </Button>
        </Hint>
      </div>

      {/* Quem está no chat agora. Tocar num nome escreve só para ele. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border px-2 py-1 text-caption text-muted">
        {outros.length === 0 ? (
          <span className="text-subtle">Ninguém no chat pelo celular agora</span>
        ) : (
          outros.map((p) => (
            <button
              key={p.id}
              type="button"
              title={`Escrever só para ${p.nome}`}
              onClick={() => setPara({ tipo: "pessoa", id: p.id, nome: p.nome })}
              className="inline-flex items-center gap-1 rounded-sm hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: corDoNome(p.nome, p.id) }} />
              {p.nome}
              {p.equipe && p.equipe !== "cabine" ? ` · ${NOME_DA_EQUIPE[p.equipe]}` : ""}
              {p.silenciado && (
                <>
                  <MicOff className="size-3 text-danger" aria-hidden />
                  <span className="sr-only">(silenciado)</span>
                </>
              )}
            </button>
          ))
        )}
      </div>

      <ul ref={lista} className="lumen-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 pt-3">
        {mensagens.length === 0 && (
          <li className="px-1 py-6 text-center text-secondary text-subtle">
            Nada ainda. Quem estiver com o celular conectado pode escrever aqui.
          </li>
        )}
        {mensagens.map((m, i) => {
          const pos = posicaoNoGrupo(mensagens, i);
          return (
            <Recado
              key={m.id}
              m={m}
              primeiro={pos.primeiro}
              ultimo={pos.ultimo}
              cor={cores[i]}
              corDoNome={corDoNome}
              silenciado={pessoas.some((p) => p.id === m.deId && p.silenciado)}
              aoAbrirFoto={setLupa}
            />
          );
        })}
      </ul>

      {quemDigita.length > 0 && (
        <p className="px-2 pb-1 text-caption italic text-subtle" aria-live="polite">
          {quemDigita.join(" e ")} {quemDigita.length === 1 ? "está" : "estão"} digitando…
        </p>
      )}

      <div className="space-y-1.5 border-t border-border p-2">
        {sugestao && (
          <div className="flex flex-wrap gap-1" aria-label="Quem citar">
            {sugestao.pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => escolherMencao(p.nome)}
                className="rounded-full bg-elevated px-2 py-0.5 text-caption text-fg hover:bg-raised focus-visible:outline-2 focus-visible:outline-ring"
              >
                @{p.nome}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1.5 text-caption text-subtle">
          Para
          <select
            className="field h-7 min-w-0 flex-1 py-0 text-caption"
            aria-label="Para quem vai o recado"
            value={valorDoPara(para)}
            onChange={(e) => setPara(paraDoValor(e.target.value, pessoas))}
          >
            <option value="todos">Todos</option>
            <optgroup label="Equipes">
              {(["som", "louvor", "pastor"] as const).map((e) => (
                <option key={e} value={`e:${e}`}>
                  {NOME_DA_EQUIPE[e]}
                </option>
              ))}
            </optgroup>
            {outros.length > 0 && (
              <optgroup label="Pessoas">
                {outros.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <Hint label="Enviar foto (ou cole um print com Ctrl+V)">
            <Button
              size="iconSm"
              variant="ghost"
              type="button"
              aria-label="Enviar foto"
              disabled={enviando}
              onClick={() => arquivoDeFoto.current?.click()}
            >
              <Camera />
            </Button>
          </Hint>
          <input
            ref={arquivoDeFoto}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void mandarFoto(f);
            }}
          />
          <Input
            ref={campo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setCursor(e.target.selectionStart ?? e.target.value.length);
              if (e.target.value.trim()) avisarDigitando();
            }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={aoTeclar}
            onPaste={aoColar}
            placeholder="Responder (@ cita alguém)"
            aria-label="Mensagem para os celulares"
            maxLength={500}
          />
          <Button size="iconSm" type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar">
            <Send />
          </Button>
        </form>
        {erro && (
          <p role="alert" className="text-caption text-danger">
            {erro}
          </p>
        )}
      </div>

      <Dialog open={lupa !== null} onOpenChange={(v) => !v && setLupa(null)}>
        <DialogContent title="Foto do chat" className="w-[min(960px,calc(100%-1.5rem))]">
          {lupa && <img src={lupa} alt="Foto do chat" className="max-h-[75dvh] w-full object-contain px-4 pb-4" />}
        </DialogContent>
      </Dialog>
      <ChatHistoricoDialog open={historico} onOpenChange={setHistorico} />
    </aside>
  );
}
