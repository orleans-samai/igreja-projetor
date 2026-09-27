/**
 * Regras do chat da equipe: quem lê cada recado, as equipes e as menções.
 *
 * O chat era um mural só — tudo ia para todo mundo. Com recado para uma
 * pessoa ou para uma equipe, a pergunta "quem pode ler isto?" passa a ter
 * resposta, e ela é dada aqui, no servidor, recado a recado: esconder na
 * tela do celular não bastaria, porque o recado já teria chegado nele.
 *
 * Quem lê:
 *   - a cabine lê tudo — ela modera o chat (apaga recado, silencia aparelho)
 *     e isso a página diz para quem escreve;
 *   - quem escreveu lê o que escreveu;
 *   - quem foi mencionado com @nome lê o recado em que foi citado;
 *   - "todos" chega a todo mundo; "equipe" a quem está naquela equipe;
 *     "pessoa" só àquela pessoa.
 */

/** As equipes do culto. A cabine é uma delas, mas só a cabine está nela. */
const EQUIPES = {
  cabine: "Cabine",
  som: "Som",
  louvor: "Louvor",
  pastor: "Pastor",
};

/** Equipes que um aparelho pode escolher para si. */
const EQUIPES_DE_APARELHO = ["som", "louvor", "pastor"];

/**
 * @typedef {{ tipo: "todos" } | { tipo: "equipe", equipe: string } | { tipo: "pessoa", id: string, nome: string }} Para
 * @typedef {{ id: string, nome: string, equipe: string, cabine?: boolean }} Leitor
 */

/**
 * O destino que chegou de fora, conferido. Equipe desconhecida ou pessoa sem
 * id viram "todos" — nunca um destino que ninguém lê.
 * @param {unknown} bruto
 * @returns {Para}
 */
function paraValido(bruto) {
  const p = /** @type {Record<string, unknown>} */ (bruto && typeof bruto === "object" ? bruto : {});
  if (p.tipo === "equipe" && typeof p.equipe === "string" && Object.hasOwn(EQUIPES, p.equipe)) {
    return { tipo: "equipe", equipe: p.equipe };
  }
  if (p.tipo === "pessoa" && typeof p.id === "string" && p.id) {
    return {
      tipo: "pessoa",
      id: p.id.slice(0, 80),
      nome: typeof p.nome === "string" ? p.nome.slice(0, 32) : "",
    };
  }
  return { tipo: "todos" };
}

/**
 * As pessoas citadas com @nome, entre as que estão no chat.
 *
 * Nome pode ter espaço ("@Pastor João"), então a procura é pelo nome
 * inteiro depois do @, do mais comprido para o mais curto — "@Ana Paula"
 * não pode virar menção à "Ana". Maiúscula e acento não importam.
 * @param {string} texto
 * @param {{ id: string, nome: string }[]} pessoas
 * @returns {{ id: string, nome: string }[]}
 */
function mencoesNoTexto(texto, pessoas) {
  const alvo = dobrar(texto);
  const achadas = [];
  const vistos = new Set();
  // Cada @ do texto cita uma pessoa só: o nome mais comprido que couber ali
  // fica com ele, e "@Ana Paula" não cita também a "Ana".
  const arrobasUsadas = new Set();
  const ordenadas = [...pessoas].sort((a, b) => b.nome.length - a.nome.length);
  for (const p of ordenadas) {
    if (!p.nome || vistos.has(p.id)) continue;
    const nome = dobrar(p.nome);
    let i = alvo.indexOf(`@${nome}`);
    while (i >= 0) {
      const depois = alvo[i + 1 + nome.length];
      // O nome termina ali (espaço, pontuação ou fim) — "@Ana" não cita "Anabela".
      if (!arrobasUsadas.has(i) && (depois === undefined || !/[\p{L}\p{N}]/u.test(depois))) {
        arrobasUsadas.add(i);
        vistos.add(p.id);
        achadas.push({ id: p.id, nome: p.nome });
        break;
      }
      i = alvo.indexOf(`@${nome}`, i + 1);
    }
  }
  return achadas;
}

/** @param {string} s */
function dobrar(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Se este leitor pode ver este recado.
 * @param {Leitor | null} leitor
 * @param {{ deId?: string, para?: Para, mencoes?: { id: string }[] }} msg
 */
function podeVer(leitor, msg) {
  if (!leitor) return false;
  if (leitor.cabine) return true;
  if (msg.deId && msg.deId === leitor.id) return true;
  if ((msg.mencoes || []).some((m) => m.id === leitor.id)) return true;
  const para = msg.para || { tipo: "todos" };
  if (para.tipo === "todos") return true;
  if (para.tipo === "equipe") return leitor.equipe === para.equipe;
  if (para.tipo === "pessoa") return leitor.id === para.id;
  return false;
}

module.exports = { EQUIPES, EQUIPES_DE_APARELHO, paraValido, mencoesNoTexto, podeVer };
