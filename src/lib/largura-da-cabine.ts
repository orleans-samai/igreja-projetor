import { useEffect, useState } from "react";

/**
 * Se a cabine cabe no desenho de colunas.
 *
 * Existia só em CSS — `hidden xl:block` de um lado, `xl:hidden` do outro.
 * O problema é que CSS esconde, não desmonta: os dois desenhos ficavam
 * montados o tempo todo, e o de colunas rodava com largura zero enquanto
 * estava invisível. Componente que mede a si mesmo para se organizar não
 * lida bem com zero, e numa tela que cai exatamente em cima do corte a
 * coisa fica oscilando entre existir e não existir.
 *
 * Aqui a pergunta é feita uma vez, em JavaScript, e só um dos dois
 * desenhos é montado. O outro não existe — não mede nada, não erra nada.
 *
 * O corte é o mesmo `xl` do Tailwind, de propósito: se fossem dois
 * números, um dia eles discordariam.
 */
export const CORTE_COLUNAS = 1280;

const CONSULTA = `(min-width: ${CORTE_COLUNAS}px)`;

/** O que vale agora, ou `true` fora do navegador — a cabine é de PC. */
function medirAgora(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(CONSULTA).matches;
}

export function useColunasCabem(): boolean {
  const [cabem, setCabem] = useState(medirAgora);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const consulta = window.matchMedia(CONSULTA);
    const responder = () => setCabem(consulta.matches);
    // Mede de novo ao montar: entre o primeiro desenho e agora a janela
    // pode ter sido redimensionada, o que acontece toda vez que o Windows
    // aplica a escala da tela depois de abrir.
    responder();
    consulta.addEventListener("change", responder);
    return () => consulta.removeEventListener("change", responder);
  }, []);

  return cabem;
}
