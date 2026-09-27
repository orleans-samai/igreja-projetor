# Lúmen — instruções para agentes

App de projeção para igrejas (Windows). Electron 44 + TanStack Start + React 19
+ Zustand + Tailwind v4. Interface, comentários e mensagens de commit em
**português**. Comentários explicam o **porquê** (o defeito que evitam, o
pedido da igreja), não o que o código faz.

## Antes de dizer que está pronto

Rode tudo, nesta ordem, e só dê como pronto se passar:

```
npx tsc --noEmit
npx eslint .
npm run test:app
npm run desktop:build
npm run test:desktop:smoke
```

- O smoke (`scripts/desktop-smoke.mjs`) abre o Electron de verdade com um
  perfil isolado e leva uns 5 minutos. Ele usa o **build**: rode
  `desktop:build` antes, senão testa o código velho. Evidências em
  `artifacts/desktop-smoke/`.
- Mudou comportamento visível? Acrescente a prova no smoke e na linha `PASS`
  do fim dele.
- Teste novo em `src/**/*.test.ts` precisa entrar **nas três listas** do
  `package.json` (`test`, `test:app`, `test:core`). Testes rodam no Node
  (`--experimental-strip-types`): importe com caminho relativo e extensão
  `.ts`, nunca `@/…`.
- Servidor de desenvolvimento: `npm run dev` (porta 8080). O erro
  "window is not defined" do `AutoSlideDialog` no modo web é antigo e não é
  seu.

## Publicação

- **Nunca faça push para `main` sem autorização explícita.** Todo push para
  `main` roda `.github/workflows/release.yml`, publica uma versão e **todos os
  Lúmen instalados se atualizam sozinhos**. Commit local pode.
- Instalador local: `npm run win:exe:x64` → `dist-win/release/` (sem
  assinatura; o Windows mostra o aviso do SmartScreen).

## Regras do produto

- **Bíblias:** só versões de domínio público ou licença aberta vêm no app
  (`BUILTIN_BIBLES` em `src/lib/bible.ts`, licenças em
  `public/bible/LICENCAS.txt`). NVI, NAA, ARA e outras com direitos autorais
  **não** entram; a igreja importa as que tem licença.
- **Apresentações:** .pptx, .ppsx, .ppt, .pps e .odp são desenhados pelo
  PowerPoint (se houver) ou pelo LibreOffice (`desktop/conversor-office.cjs`)
  em PDF, e dali seguem o caminho do PDF (pdf.js, 1920 px) — sai como no
  PowerPoint, sem animações. Sem nenhum dos dois, .pptx/.ppsx caem no leitor
  simplificado (`desktop/pptx.cjs`, texto e imagem) e a cabine avisa.
- **Telão:** a letra fica sempre centralizada na vertical
  (`SlideBody` em `src/components/slide/slide-renderer.tsx`,
  `margensCentradas`). Não reintroduza alinhamento em cima/embaixo.
- **Artes** (`src/features/artes/`, ver `LEIA-ME.md`): gerador procedural,
  **sem IA** em nenhuma etapa. O formulário pede só título e referência.
- **Sem IA, sem YouTube e sem Auto-Slide:** o assistente de IA, o copiloto
  da busca (Ctrl+K), o refino online do Otimizar, o player do YouTube e o
  Auto-Slide (reconhecimento de canto) saíram a pedido da igreja. Não
  reintroduza. Os comandos por regras (`src/lib/copilot.ts`) e os comandos
  por voz do Modo operador continuam. As gavetas antigas do YouTube e do
  Auto-Slide são aceitas e descartadas na leitura (`APOSENTADAS` em
  `desktop/storage.cjs`) — recurso que sai deixa a chave lá, nunca a recusa.

## Arquitetura e segurança

- **Processo principal** (`desktop/*.cjs`) é quem toca o disco e a rede. A
  janela fala com ele só pelo `preload.cjs` (contextBridge + IPC). A janela
  nunca inicia executável nem monta caminho de arquivo: o caminho é montado no
  processo principal e preso dentro da pasta autorizada
  (ver `dentroDaPasta` em `desktop/media.cjs`).
- Chave nova de armazenamento precisa entrar em `KEYS` (`desktop/storage.cjs`).
- **Páginas do celular** (`public/remote-control.html`, `public/dirigente.html`):
  HTML solto, sem build, JavaScript em estilo ES5 (`var`, `function`).
  Não fazem requisição para fora da rede da igreja. O chat das duas é um
  arquivo só, `public/chat-equipe.js` (servido em `/chat-equipe.js`); a
  paleta, a conta da cor e a janela de grupo dele são as de
  `src/lib/cor-do-chat.ts` e `src/lib/chat-grupos.ts` — os testes conferem.
  Nada de `\p{…}` nem sintaxe nova ali: celular velho não abriria a página.
- **Entrar pelo celular:** acesso rápido (só o nome, entra no chat) ou
  usuário e senha (conta criada em Permissões, já com permissão e equipe).
  A senha da conta só existe cozida (scrypt) em `remote.json`; o `status`
  que vai para a janela nunca leva nem a cozida.
- O servidor do celular (`desktop/remote-control.cjs`) confere permissão em
  toda rota (`chat` < `editor` < `controle`) e avisa mudanças pelo fluxo SSE
  sem carregar dados que exijam permissão.

## Armadilhas do Windows

- `fs.watch` numa pasta com caminho curto (`ORLEAN~1`) derruba o processo numa
  asserção da libuv: use `fs.realpathSync.native` antes.
- JSON salvo pelo Bloco de Notas vem com BOM: tire antes do `JSON.parse`.
- Avisos de LF → CRLF do git são esperados.

## Pastas

| Onde | O quê |
|---|---|
| `src/components/operator/` | Cabine (Repertório, Programação, Bíblia, chat, menus) |
| `src/components/slide/` | Desenho do telão, prévia e retorno de palco |
| `src/features/artes/`, `src/features/vfx/` | Estúdio de artes e vídeos |
| `src/lib/` | Regras puras e testáveis (Bíblia, mídia, chat, telão) |
| `src/store/` | Zustand: `lumen-store` (conteúdo), `ops-store` (cabine), `chat-store` |
| `desktop/` | Electron: janelas, disco, servidor do celular, atualizador |
| `public/` | Páginas do celular e do dirigente, Bíblias embutidas, temas |
| `scripts/` | Testes do processo principal, smoke, build do instalador |
