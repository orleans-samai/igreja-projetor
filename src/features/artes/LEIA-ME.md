# Artes — gerador procedural, sem IA

Nada neste módulo usa inteligência artificial: nem modelo de linguagem, nem
geração de imagem, nem serviço externo. Cada arte sai de tabelas
(`catalogo/`), regras (`gerador/`) e um sorteio com semente.

## Fluxo

```
briefing → análise → famílias compatíveis → plano do lote → recursos
  → composição (camadas) → ajuste tipográfico → validação → assinatura
  → comparação com o lote e o histórico → galeria
```

| Etapa | Onde |
|---|---|
| Briefing e análise determinística | `briefing.ts` (`normalizar`, `analisar`, `diaEMes`) |
| Tabela categoria → recursos (ajustável pela igreja) | `catalogo/categorias.ts` (`categoriaEfetiva`) |
| Paletas com contraste conferido, paletas da marca | `catalogo/paletas.ts` |
| Conjuntos tipográficos (≤ 2 famílias, fontes OFL embutidas) | `catalogo/tipografia.ts` |
| Ilustrações, ícones e cenas desenhados em SVG por código | `catalogo/ilustracoes.ts` |
| Formas orgânicas e texturas | `catalogo/formas.ts` |
| As 12 famílias × 3 variantes | `gerador/familias/*.ts` |
| Ferramentas de composição (texto que cabe, foto pelo ponto focal, logo sem esticar, cor pelo que está embaixo) | `gerador/compositor.ts` |
| Quebra equilibrada e ajuste de corpo | `gerador/texto.ts` |
| Conferência (área segura, colisão, contraste, corpo mínimo, logo) | `gerador/validar.ts` |
| Assinatura estrutural e comparação | `gerador/assinatura.ts` |
| Lote, regeneração, adaptação de formato | `gerador/lote.ts` |
| Documento em camadas | `documento.ts` |
| Desenho (prévia, miniatura, editor e exportação) | `konva/desenho.tsx`, `konva/exportar.tsx` |
| Fontes, imagens, medidor real | `konva/recursos.ts` |
| Interface | `componentes/` |
| Disco | `store.ts`, `persistencia.ts`, `migracao-v1.ts`; fotos em `desktop/artes-imagens.cjs` |

## Famílias e variantes

| Família | Variantes |
|---|---|
| Editorial | texto à esquerda / imagem à direita · imagem à esquerda, título no alto da coluna oposta · grade modular |
| Fotografia | foto inteira com texto na região mais calma · foto no alto e painel embaixo · foto deslocada com bloco sólido |
| Tipográfica | linhas escalonadas · palavra dominante · alinhada à esquerda com apoios gráficos |
| Colagem | recortes sobrepostos com fita · duas imagens e bloco central · painéis de papel rasgado |
| Geométrica | círculo como janela · blocos assimétricos · diagonais e faixas |
| Minimalista | título e pequeno elemento · imagem isolada · linhas divisórias |
| Ilustrada | cena na base · ilustração lateral · elemento central com apoios |
| Institucional | cabeçalho de identidade e grade · imagem horizontal e colunas · painel lateral de marca |
| Molduras e janelas | moldura com título externo · borda editorial · duas janelas em arco |
| Orgânica | imagem recortada em forma curva · ilustração sobre forma · camadas onduladas |
| Cartaz | título dominante e selo de data · número grande do dia · faixas informativas |
| Capa editorial | manchete no alto e imagem central · título lateral girado · capa de revista |

Cada variante tem geometria própria para quadrado, retrato (4:5), story (9:16)
e paisagem (16:9). Trocar de formato recompõe com as regras da família; não
estica nem recorta a arte pronta.

## Regras de diversidade (lote de 8)

- Pelo menos 6 famílias quando o conteúdo permite; nenhuma variante repetida.
- No máximo 2 composições centralizadas.
- Luz claro/intermediário/escuro distribuída pelo plano (`planoDeLuz`); público
  infantil pende para o claro.
- A mesma imagem domina no máximo 2 opções quando há alternativa do assunto.
- Duas opções com assinatura estrutural parecida (`parecidas`) — mesmo lugar
  de título, imagem e informação, mesmo peso de imagem — não entram juntas,
  mesmo com cores diferentes.
- O histórico por projeto (categoria + título, 40 assinaturas) empurra o lote
  seguinte para longe do anterior.
- Limite de tentativas (10 × quantidade). Se o catálogo não dá a variedade
  pedida, vêm menos opções com a explicação — nunca duplicata disfarçada.

## Como acrescentar

**Variante:** escreva o `compor` no arquivo da família e declare os
`requisitos` com honestidade (imagem, data com dia e mês, identidade, título
máximo). Ela precisa funcionar nas quatro proporções ou recusar (`return false`)
quando o conteúdo não cabe — nunca encolher letra além do mínimo. Suba
`VERSAO_CATALOGO` em `familias/index.ts`. O teste de catálogo confere ids e
requisitos; o de diversidade reclama de variante que é outra com cor diferente.

**Ilustração:** acrescente em `catalogo/ilustracoes.ts` com assuntos, público,
proporção, ponto focal, área livre para texto, densidade, origem e licença. Use
só as cinco cores recebidas (`a`, `b`, `p`, `e`, `t`). Símbolo religioso ganha
assunto próprio (ex.: `batismo`) para entrar só onde a categoria pede.

**Paleta:** acrescente em `catalogo/paletas.ts`; o teste confere o contraste de
todo par que carrega texto.

**Categoria:** acrescente em `catalogo/categorias.ts` com pesos de família,
assuntos, tags de paleta e tipografias. A igreja ajusta pelo próprio briefing
("Ajustar o estilo desta categoria").

## Origem e licença dos recursos

- Ilustrações, ícones, cenas, formas e texturas: desenhados por código neste
  repositório — licença do projeto.
- Fontes: Fraunces, Instrument Sans, IBM Plex Mono, Oswald, Anton, Playfair
  Display, DM Serif Display, Bricolage Grotesque, Fredoka, Caveat, Newsreader —
  todas SIL Open Font License 1.1, pacotes `@fontsource`, embutidas no app.
- Fotos e logo: da igreja, trazidas no briefing. As imagens de tema em
  `public/themes` não entram no catálogo: a origem delas não está documentada.
- Konva / react-konva: MIT.

## Amostras

`node scripts/artes-amostras.mjs` (com `npm run dev` rodando) gera os cinco
cenários de referência nos quatro formatos em `artifacts/artes-amostras/`.
Validação automática não substitui olhar as composições.
