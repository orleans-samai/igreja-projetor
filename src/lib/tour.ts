/**
 * Tutorial da cabine, para quem nunca operou.
 *
 * Aponta para a tela de verdade em vez de mostrar desenho: o que trava um
 * voluntário na primeira vez não é o conceito, é não saber onde as coisas
 * estão. Por isso cada passo tem um alvo real, marcado com `data-tour`.
 *
 * O Simulador (Culto → Simulador) é outra coisa e vem depois: lá se treina
 * fazendo, e ele já pressupõe que a pessoa sabe onde clicar.
 */

export interface TourStep {
  id: string;
  /** Valor do atributo data-tour do elemento a destacar. Sem alvo, o cartão
   *  fica no centro — serve para abrir e fechar o tutorial. */
  target?: string;
  /** Em telas estreitas a cabine vira abas; o passo diz em qual delas o alvo
   *  mora, para o tutorial abrir a aba antes de apontar. */
  tab?: "lib" | "preview" | "culto";
  title: string;
  body: string;
  /** Tecla que faz a mesma coisa, quando existe. */
  keys?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "inicio",
    title: "Esta é a cabine",
    body:
      "Nada do que você fizer aqui aparece no telão até você mandar. Pode clicar à " +
      "vontade, explorar e errar — a igreja continua vendo o que já estava no ar.",
  },
  {
    id: "biblioteca",
    target: "biblioteca",
    tab: "lib",
    title: "1. A biblioteca",
    body:
      "Tudo que dá para projetar mora aqui: letras de música, avisos, mídia e a " +
      "Bíblia inteira, que funciona sem internet. Clique num item para vê-lo no preview.",
    keys: "Ctrl+F",
  },
  {
    id: "culto",
    target: "culto",
    tab: "culto",
    title: "2. A ordem do culto",
    body:
      "Esta é a programação de domingo, na ordem. Dê dois cliques num item da " +
      "biblioteca para trazê-lo para cá, e arraste para mudar a ordem.",
  },
  {
    id: "preview",
    target: "preview",
    tab: "preview",
    title: "3. O preview",
    body:
      "É o que você está preparando. Só você vê. Serve para conferir a letra e o " +
      "tema antes que a igreja veja qualquer coisa.",
  },
  {
    id: "apresentar",
    target: "apresentar",
    tab: "preview",
    title: "4. Mandar para o telão",
    body:
      "Este é o momento em que a igreja passa a ver. Daqui em diante o que está no " +
      "preview vai para o telão.",
    keys: "F5",
  },
  {
    id: "transporte",
    target: "transporte",
    title: "5. Passar os slides",
    body:
      "Setas do teclado, Espaço ou estes botões. As três miniaturas mostram o slide " +
      "anterior, o atual e o próximo — dá para clicar direto em qualquer um.",
    keys: "→ ←",
  },
  {
    id: "grade",
    target: "grade",
    tab: "preview",
    title: "6. A grade de letras",
    body:
      "Todos os slides da música, lado a lado, com a letra inteira à vista. Um " +
      "clique num cartão manda aquele slide para o telão na hora — é assim que " +
      "se pula um verso ou se repete o coro. Os botões - e + mudam o tamanho.",
  },
  {
    id: "preto",
    target: "preto",
    title: "7. O botão de emergência",
    body:
      "Apaga o telão na hora. É o que se aperta quando aparece algo errado na tela. " +
      "Fica sempre neste mesmo canto, para você acertar sem olhar. Aperte de novo e volta.",
    keys: "B",
  },
  {
    id: "tally",
    target: "tally",
    title: "8. Como saber o que está no ar",
    body:
      "Este ponto responde isso de relance: cinza quando está parado, âmbar pulsando " +
      "quando a igreja está vendo. A cor âmbar, no app inteiro, significa no ar.",
  },
  {
    id: "fim",
    title: "É isso. O resto se acha sozinho",
    body:
      "Ctrl+K procura qualquer coisa — música, versículo ou comando. F9 põe um " +
      "versículo de socorro no ar. E em Culto → Simulador dá para treinar com " +
      "situações de culto de verdade, antes do domingo.",
    keys: "?",
  },
];
