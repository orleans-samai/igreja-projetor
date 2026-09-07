# Lúmen — igreja-projetor

Cabine de projeção para o culto: letras, Bíblia (Almeida 1819), temas, segundo monitor e modo operador.

No PC da igreja, o caminho certo é o instalador Windows (`Lúmen-Setup.exe`). Este repositório é o código-fonte.

## No culto

1. Abra o **Lúmen** pelo Menu Iniciar.
2. **Windows + P → Estender** (não use Duplicar).
3. **Tela → Abrir projetor** — o telão vai para a segunda tela em tela cheia.
4. **F5** apresenta. **Esc** encerra.

Atalhos da cabine: `Espaço` / setas avançam o slide, `B` apaga o telão, `Ctrl+K` abre o copiloto.

## Rodar o código

Requer [Node.js 22](https://nodejs.org/).

```bash
git clone https://github.com/orleanss777-sys/igreja-projetor.git
cd igreja-projetor
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (em geral `http://localhost:8080`).

## Gerar o app Windows

```bash
npm run win:exe
```

Sai em duas formas, as duas já com o ícone do Lúmen:

| Arquivo | Para quê |
|---|---|
| `dist-win/win-unpacked/Lúmen.exe` | Abre com dois cliques, sem instalar. Cabe num pendrive. |
| `dist-win/Lúmen-Setup-1.0.0.exe` | Instala no PC da igreja com atalho na área de trabalho e no Menu Iniciar, sem senha de administrador. |

O Windows pode avisar “editor desconhecido” — o app não é assinado. Use **Mais informações → Executar assim mesmo**.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Cabine no navegador |
| `npm test` | Testes |
| `npm run typecheck` | TypeScript |
| `npm run desktop:build` | Empacota a interface do app Windows |
| `npm run win:exe` | Gera o app e o instalador Windows |

## Pastas

- `src/` — cabine, telão, palco, Bíblia, operador
- `public/` — Bíblia Almeida 1819 e temas
- `desktop/` — app Windows (Electron)
- `desktop/installer/` — script do instalador NSIS
