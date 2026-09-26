/** Um path em 0–1 levado para a caixa: x multiplica pela largura, y pela altura. */
export function escalarCaminho(d: string, w: number, h: number): string {
  let eixo = 0;
  return d.replace(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e-?\d+)?/g, (t) => {
    if (/[A-Za-z]/.test(t)) {
      if (/[Zz]/.test(t)) eixo = 0;
      return t;
    }
    const v = Number(t) * (eixo % 2 === 0 ? w : h);
    eixo += 1;
    return String(Math.round(v * 100) / 100);
  });
}
