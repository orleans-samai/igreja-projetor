import { Component, type ReactNode } from "react";

/**
 * A cabine não pode morrer por causa das colunas.
 *
 * As colunas redimensionáveis são conveniência: o operador arrasta a
 * divisória e escolhe quanta tela cada coisa ocupa. A biblioteca que faz
 * isso valida o próprio estado com asserções, e uma asserção que falha
 * durante o desenho sobe até a rota e apaga a cabine inteira — foi o que
 * aconteceu com "Panel constraints not found for index 4", no domingo de
 * alguém.
 *
 * Perder o arrasto é um aborrecimento. Perder a projeção no meio do culto
 * não é. Então aqui a falha é contida e a cabine continua de pé com as
 * mesmas colunas, só sem as divisórias móveis.
 *
 * Não engole o problema em silêncio: escreve no console e oferece o
 * caminho de volta, que é restaurar a ordem padrão.
 */
export class ColunasSeguras extends Component<
  { children: ReactNode; alternativa: ReactNode },
  { caiu: boolean }
> {
  state = { caiu: false };

  static getDerivedStateFromError() {
    return { caiu: true };
  }

  componentDidCatch(erro: unknown) {
    // Console e não toast: isto acontece durante o desenho, e o que ajuda
    // depois é o texto do erro no log, não um aviso que some em quatro
    // segundos enquanto o culto começa.
    console.error("As colunas redimensionáveis falharam; a cabine seguiu sem elas.", erro);
  }

  render() {
    return this.state.caiu ? this.props.alternativa : this.props.children;
  }
}
