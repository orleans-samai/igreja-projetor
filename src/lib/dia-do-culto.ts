/**
 * O dia de cada culto, ao lado do nome: "Culto Domingo, dia 27".
 *
 * A lista de cultos tinha vários "Culto Domingo" iguais, e não dava para
 * saber qual era o de hoje. Cada culto guarda o seu dia (AAAA-MM-DD): o
 * novo, pelo dia da semana do nome; o antigo, pelo dia da última mudança,
 * gravado uma vez e fixo daí em diante.
 */

const DIAS_DA_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function aaaammdd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O dia de um culto novo: o próximo dia da semana que o nome diz ("Culto
 * Domingo" criado na quarta é o do domingo que vem; criado no domingo, é o
 * de hoje). Nome sem dia da semana fica com o dia de hoje.
 */
export function diaDoCultoNovo(nome: string, hoje: Date): string {
  const n = semAcento(nome);
  const alvo = DIAS_DA_SEMANA.findIndex((d) => new RegExp(`\\b${d}\\b`).test(n));
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (alvo >= 0) dia.setDate(dia.getDate() + ((alvo - dia.getDay() + 7) % 7));
  return aaaammdd(dia);
}

/** O dia de um instante, para o culto antigo que não guardava o seu. */
export function diaDoInstante(ms: number): string {
  return aaaammdd(new Date(ms));
}

interface CultoComDia {
  id: string;
  name: string;
  data?: string;
  serviceId?: string;
  updatedAt?: number;
}

/**
 * O culto do mês ("Setembro/2026"), o Temporário e o modelo semanal
 * ("Domingo 19h") não são de um dia só: não ganham dia.
 */
export function cultoTemDia(p: Pick<CultoComDia, "id" | "serviceId">): boolean {
  return !/^pl-\d{4}-\d{2}$/.test(p.id) && p.id !== "pl-temp" && !p.serviceId;
}

/**
 * "Culto Domingo, dia 27". De outro mês, com o mês ("dia 30/08"); de outro
 * ano, com o ano também — senão o dia sozinho enganaria.
 */
export function nomeComDia(p: CultoComDia, hoje: Date): string {
  if (!cultoTemDia(p)) return p.name;
  const data = p.data ?? (p.updatedAt ? diaDoInstante(p.updatedAt) : undefined);
  const m = data ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(data) : null;
  if (!m) return p.name;
  const [, ano, mes, dia] = m;
  const outroAno = Number(ano) !== hoje.getFullYear();
  const outroMes = outroAno || Number(mes) !== hoje.getMonth() + 1;
  const complemento = outroAno ? `/${mes}/${ano}` : outroMes ? `/${mes}` : "";
  return `${p.name}, dia ${Number(dia)}${complemento}`;
}
