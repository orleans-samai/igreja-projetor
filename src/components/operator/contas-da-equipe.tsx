import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  AJUDA_PERMISSAO,
  NOME_DA_EQUIPE,
  ROTULO_PERMISSAO,
  type ContaParaSalvar,
  type ContaRemota,
  type PermissaoRemota,
  type RemoteStatus,
} from "@/lib/remote-control";

type EquipeDaConta = ContaRemota["equipe"];

const PERMISSOES: PermissaoRemota[] = ["chat", "editor", "controle"];
const EQUIPES: EquipeDaConta[] = ["", "som", "louvor", "pastor"];

function nomeDaEquipe(e: EquipeDaConta): string {
  return e ? NOME_DA_EQUIPE[e] : "Sem equipe";
}

function Permissoes({
  valor,
  aoEscolher,
}: {
  valor: PermissaoRemota;
  aoEscolher: (p: PermissaoRemota) => void;
}) {
  return (
    <>
      {PERMISSOES.map((p) => (
        <button
          key={p}
          type="button"
          title={AJUDA_PERMISSAO[p]}
          aria-pressed={valor === p}
          onClick={() => aoEscolher(p)}
          className={cn(
            "rounded-md px-2 py-0.5 text-caption font-medium",
            "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            valor === p ? "bg-primary text-primary-fg" : "bg-raised text-muted hover:text-fg",
          )}
        >
          {ROTULO_PERMISSAO[p]}
        </button>
      ))}
    </>
  );
}

function Equipe({
  valor,
  rotulo,
  aoEscolher,
}: {
  valor: EquipeDaConta;
  rotulo: string;
  aoEscolher: (e: EquipeDaConta) => void;
}) {
  return (
    <select
      className="field ml-auto h-6 py-0 text-caption"
      aria-label={rotulo}
      value={valor}
      onChange={(e) => aoEscolher(e.target.value as EquipeDaConta)}
    >
      {EQUIPES.map((e) => (
        <option key={e} value={e}>
          {nomeDaEquipe(e)}
        </option>
      ))}
    </select>
  );
}

function LinhaDaConta({
  conta,
  salvar,
  apagar,
}: {
  conta: ContaRemota;
  salvar: (dados: ContaParaSalvar) => Promise<boolean>;
  apagar: (id: string) => void;
}) {
  const [trocando, setTrocando] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const atual = { id: conta.id, usuario: conta.usuario, permissao: conta.permissao, equipe: conta.equipe };

  // Apagar pede um segundo clique, que vale por alguns segundos: é a conta de
  // uma pessoa, e os aparelhos dela saem junto.
  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(t);
  }, [confirmando]);

  return (
    <li className="rounded-md bg-elevated p-2">
      <div className="flex items-center gap-1.5">
        <KeyRound className="size-3 shrink-0 text-subtle" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-body font-medium text-fg">{conta.usuario}</p>
        <span className="shrink-0 text-caption text-subtle">
          {conta.aparelhos === 0
            ? "nenhum aparelho"
            : conta.aparelhos === 1
              ? "1 aparelho"
              : `${conta.aparelhos} aparelhos`}
        </span>
        <Button size="sm" variant="ghost" aria-expanded={trocando} onClick={() => setTrocando((v) => !v)}>
          Trocar senha
        </Button>
        <Button
          size="iconSm"
          variant="ghost"
          aria-label={confirmando ? `Confirmar: apagar a conta ${conta.usuario}` : `Apagar a conta ${conta.usuario}`}
          className={cn("hover:text-danger", confirmando && "text-danger")}
          onClick={() => {
            if (!confirmando) {
              setConfirmando(true);
              return;
            }
            setConfirmando(false);
            apagar(conta.id);
          }}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Permissoes valor={conta.permissao} aoEscolher={(p) => void salvar({ ...atual, permissao: p })} />
        <Equipe
          valor={conta.equipe}
          rotulo={`Equipe de ${conta.usuario}`}
          aoEscolher={(e) => void salvar({ ...atual, equipe: e })}
        />
      </div>
      {confirmando && (
        <p className="mt-1 text-caption text-danger">
          Clique de novo para apagar. Os aparelhos que entraram com esta conta saem junto.
        </p>
      )}
      {trocando && (
        <form
          className="mt-1.5"
          onSubmit={async (ev: FormEvent) => {
            ev.preventDefault();
            if (senha.trim().length < 4) return;
            if (await salvar({ ...atual, senha: senha.trim() })) {
              setSenha("");
              setTrocando(false);
            }
          }}
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Nova senha"
              aria-label={`Nova senha de ${conta.usuario}`}
              autoComplete="new-password"
              maxLength={64}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={senha.trim().length < 4}>
              Guardar
            </Button>
          </div>
          <p className="mt-1 text-caption text-subtle">
            Quem entrou com a senha antiga sai e entra de novo com a nova.
          </p>
        </form>
      )}
    </li>
  );
}

function NovaConta({ salvar }: { salvar: (dados: ContaParaSalvar) => Promise<boolean> }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  // Começa no mínimo: dar mais é escolha do operador, com a pessoa na frente.
  const [permissao, setPermissao] = useState<PermissaoRemota>("chat");
  const [equipe, setEquipe] = useState<EquipeDaConta>("");
  const pronto = usuario.trim().length >= 2 && senha.trim().length >= 4;

  return (
    <form
      className="space-y-1.5 rounded-md border border-border p-2"
      onSubmit={async (ev: FormEvent) => {
        ev.preventDefault();
        if (!pronto) return;
        if (await salvar({ usuario: usuario.trim(), senha: senha.trim(), permissao, equipe })) {
          setUsuario("");
          setSenha("");
          setPermissao("chat");
          setEquipe("");
        }
      }}
    >
      <p className="text-caption font-medium text-muted">Nova conta</p>
      <div className="flex gap-1.5">
        <Input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuário (ex.: Caio)"
          aria-label="Usuário da nova conta"
          autoComplete="off"
          maxLength={32}
        />
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          aria-label="Senha da nova conta"
          autoComplete="new-password"
          maxLength={64}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-caption text-subtle">Entra como</span>
        <Permissoes valor={permissao} aoEscolher={setPermissao} />
        <Equipe valor={equipe} rotulo="Equipe da nova conta" aoEscolher={setEquipe} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={!pronto}>
          Criar conta
        </Button>
        <span className="text-caption text-subtle">Usuário de duas letras ou mais; senha de quatro.</span>
      </div>
    </form>
  );
}

/**
 * Contas com senha da equipe.
 *
 * Pelo acesso rápido (só o nome) todo aparelho entra no chat e espera a
 * cabine liberar o resto — e o operador promovia os mesmos aparelhos toda
 * semana. Com uma conta, a pessoa entra com usuário e senha e já chega com o
 * que pode fazer. A senha vai do campo direto para o processo principal, que
 * guarda só o scrypt dela.
 */
export function ContasDaEquipe({
  status,
  aoMudar,
}: {
  status: RemoteStatus;
  aoMudar: (s: RemoteStatus) => void;
}) {
  const contas = status.contas ?? [];
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (dados: ContaParaSalvar): Promise<boolean> => {
    const d = window.lumenDesktop;
    if (!d) return false;
    const r = await d.remoteControlSalvarConta(dados);
    aoMudar(r.status);
    setErro(r.ok ? null : (r.erro ?? "Não deu para guardar a conta."));
    return r.ok;
  };

  const apagar = async (id: string) => {
    const d = window.lumenDesktop;
    if (!d) return;
    aoMudar(await d.remoteControlApagarConta(id));
    setErro(null);
  };

  return (
    <div>
      <p className="text-caption font-medium uppercase tracking-wide text-subtle">Contas com senha</p>
      <p className="mt-1 text-secondary text-muted">
        Quem tem conta entra pelo celular em “Usuário e senha” e já chega com o que pode fazer. O
        acesso rápido, só com o nome, continua entrando só no chat.
      </p>
      {contas.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {contas.map((c) => (
            <LinhaDaConta key={c.id} conta={c} salvar={salvar} apagar={(id) => void apagar(id)} />
          ))}
        </ul>
      )}
      <div className="mt-1.5">
        <NovaConta salvar={salvar} />
      </div>
      {erro && (
        <p role="alert" className="mt-1 text-caption text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
