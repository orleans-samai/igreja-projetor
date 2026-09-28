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
- No smoke as janelas ficam escondidas (`show: false`): sem quadros, a
  rolagem suave, o `requestAnimationFrame` e o `ResizeObserver` não andam. É
  o mesmo que acontece com a cabine coberta pelo telão num monitor só — o
  que precisa acontecer de qualquer jeito não pode depender só deles (ver a
  garantia da rolagem em `slide-grid.tsx`).
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
- **Apresentações:** .pptx, .ppsx, .ppt, .pps e .odp são desenhados, nesta
  ordem, pelo PowerPoint (se houver; usa o que já está aberto e só o fecha
  se não sobrou apresentação do usuário) ou pelo LibreOffice
  (`desktop/conversor-office.cjs`) em PDF, e dali seguem o caminho do PDF
  (pdf.js, 1920 px) — sai como no PowerPoint, sem animações. Sem nenhum dos
  dois, .pptx/.ppsx são desenhados pelo próprio Lúmen (`src/lib/pptx/`:
  tema, herança do layout e do mestre, texto) e, se nem isso der, caem no
  leitor simplificado (`desktop/pptx.cjs`, texto e imagem). Essa é a ordem
  do automático: no menu **Slides** (entre Artes e Mais) a igreja escolhe
  quem vai na frente — Office, LibreOffice ou o próprio Lúmen
  (`src/lib/abrir-slides.ts`) —, e os outros ficam de reserva. A cabine
  sempre diz quem desenhou, e avisa quando foi a reserva no lugar do
  escolhido. Arquivo com senha é recusado na hora: o PowerPoint
  nunca pode ficar parado esperando senha no meio do culto.
- **Músicas do Holyrics** (`src/lib/holyrics.ts`): o lote com "Arquivo
  único" (.mufl) é serialização do Java, lida por
  `src/lib/serializacao-java.ts` — só leitura, nenhuma classe é criada, com
  teto de profundidade, objetos e tamanhos. O .json e o .txt do Holyrics
  também entram. O .muf de uma música vem cifrado pelo Holyrics e não é
  aberto: a mensagem ensina a exportar o .mufl. As amostras em
  `src/lib/amostras-holyrics/` foram gravadas pelo próprio Holyrics
  (`scripts/holyrics-amostras.jjs`); não troque por arquivo feito à mão.
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
- **Som:** só o telão toca. A prévia da cabine fica sempre muda — o som
  saía por duas fontes. "Tirar vídeo" tira a imagem e deixa o som seguindo
  por baixo da letra (`src/lib/trilha.ts`): é o mesmo `<video>` que continua
  tocando, por isso o áudio não corta. Outra mídia com som no ar encerra a
  trilha. Ao tirar o vídeo, a logo da igreja vai para o telão (não escuro).
- **Qualquer arquivo na cabine:** soltar ou importar na Mídia ou no Culto
  aceita tudo. Apresentação vira slides (`apresentacao-recebida.ts`, o mesmo
  caminho do menu Slides); o resto fica em Mídia › Arquivos
  (`midia/arquivos`), e o Lúmen nunca o abre nem executa — só mostra no
  Explorer ou manda para a Lixeira. O que chega pela rede (celular,
  dirigente) continua só mídia e apresentação (`receber` em
  `desktop/media.cjs`).
- **Dia do culto:** cada culto guarda `data` (AAAA-MM-DD) e aparece como
  "Culto Domingo, dia 27" (`src/lib/dia-do-culto.ts`); culto do mês,
  Temporário e modelo semanal não ganham dia.

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
  No CSS delas, não estilize por elemento solto (`li > button`): a regra
  pega também o botão de ação ao lado (o `+` do culto ganhou a linha
  inteira e espremeu o nome até uma palavra por linha). O smoke confere as
  abas em 360 e 430 px (`conferirLayoutDoCelular`): lista nova no celular
  entra nessa trava.
  O ícone do Lúmen nas duas páginas é o do aplicativo no PC
  (`public/favicon.svg`, de onde sai o .ico); `desktop-marca.test.mjs`
  confere.
- **Entrar pelo celular:** acesso rápido (só o nome, entra no chat) ou
  usuário e senha (conta criada em Permissões, já com permissão e equipe).
  A senha da conta só existe cozida (scrypt) em `remote.json`; o `status`
  que vai para a janela nunca leva nem a cozida.
- **Permissões por parte** (`desktop/permissoes.cjs`, espelhado em
  `src/lib/permissoes.ts` — os testes conferem os dois): só chat (lista
  vazia), `culto`, `midia`, `letras`, `controle`, uma ou mais, ou `completo`.
  O celular mostra só as abas que a pessoa pode usar; quem só tem o chat vê
  só o chat. Os degraus antigos (`chat`, `editor`, `controle`) do
  `remote.json` são convertidos na leitura, nunca recusados.
- O servidor do celular (`desktop/remote-control.cjs`) confere a permissão
  em toda rota e avisa mudanças pelo fluxo SSE sem carregar dados que
  exijam permissão (o que está no ar só vai para quem tem mais que o chat).
- **Barra de tempo do celular:** a cabine repassa o relato do telão
  (`media-tempo`) ao servidor, no máximo um por segundo e só com duração
  conhecida (evento `tempo`, só para quem mexe na mídia); o celular anda o
  relógio sozinho entre um relato e outro e manda `/posicao` para ir a um
  ponto.

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
