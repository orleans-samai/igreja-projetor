/**
 * O XML de um PowerPoint, lido sem DOMParser.
 *
 * O leitor precisa rodar na janela e nos testes do Node, e o Node não tem
 * DOMParser. O que o PowerPoint escreve é XML simples — elementos,
 * atributos, texto —, e este leitor faz só isso. De propósito, não entende
 * DOCTYPE nem entidade declarada: o arquivo vem da rede, da página do
 * dirigente, e a "bomba de entidades" (um XML de 1 KB que se expande em
 * gigabytes) é exatamente o que um leitor completo deixaria passar.
 *
 * Os nomes perdem o prefixo: `p:sp` vira `sp`, `r:embed` vira `embed`. O
 * PowerPoint usa o mesmo nome local em partes diferentes (`p:sp` no slide,
 * `dsp:sp` no desenho do SmartArt), e é justamente isso que deixa o mesmo
 * código desenhar os dois.
 */

export interface No {
  nome: string;
  attrs: Record<string, string>;
  filhos: No[];
  /** O texto direto do elemento — o que importa em `a:t`. */
  texto: string;
}

/** Um slide de verdade tem alguns milhares de elementos; um milhão é ataque. */
const MAX_NOS = 1_000_000;
/** Profundidade que nenhum PowerPoint alcança; passar disso é arquivo malfeito. */
const MAX_PROFUNDIDADE = 256;

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function desescapar(texto: string): string {
  if (!texto.includes("&")) return texto;
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

function local(nome: string): string {
  const i = nome.indexOf(":");
  return i >= 0 ? nome.slice(i + 1) : nome;
}

const ATRIBUTO = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** O elemento raiz, ou null se não houver nenhum. */
export function lerXml(fonte: string): No | null {
  const documento: No = { nome: "#documento", attrs: {}, filhos: [], texto: "" };
  const pilha: No[] = [documento];
  const n = fonte.length;
  let nos = 0;
  let i = 0;
  while (i < n) {
    const lt = fonte.indexOf("<", i);
    if (lt < 0) {
      pilha[pilha.length - 1].texto += desescapar(fonte.slice(i));
      break;
    }
    if (lt > i) pilha[pilha.length - 1].texto += desescapar(fonte.slice(i, lt));
    if (fonte.startsWith("<!--", lt)) {
      const f = fonte.indexOf("-->", lt + 4);
      i = f < 0 ? n : f + 3;
      continue;
    }
    if (fonte.startsWith("<![CDATA[", lt)) {
      const f = fonte.indexOf("]]>", lt + 9);
      pilha[pilha.length - 1].texto += fonte.slice(lt + 9, f < 0 ? n : f);
      i = f < 0 ? n : f + 3;
      continue;
    }
    if (fonte.startsWith("<?", lt)) {
      const f = fonte.indexOf("?>", lt + 2);
      i = f < 0 ? n : f + 2;
      continue;
    }
    if (fonte.startsWith("<!", lt)) {
      // DOCTYPE, com ou sem subconjunto interno: pulado inteiro, sem ler
      // uma entidade sequer.
      let j = lt + 2;
      let colchetes = 0;
      while (j < n) {
        const c = fonte[j];
        if (c === "[") colchetes += 1;
        else if (c === "]") colchetes -= 1;
        else if (c === ">" && colchetes <= 0) break;
        j += 1;
      }
      i = j + 1;
      continue;
    }
    if (fonte[lt + 1] === "/") {
      const f = fonte.indexOf(">", lt);
      const nome = local(fonte.slice(lt + 2, f < 0 ? n : f).trim());
      // Fecha até o elemento com esse nome; um fechamento sem par é ignorado.
      for (let k = pilha.length - 1; k > 0; k -= 1) {
        if (pilha[k].nome === nome) {
          pilha.length = k;
          break;
        }
      }
      i = f < 0 ? n : f + 1;
      continue;
    }
    let j = lt + 1;
    let aspas = "";
    while (j < n) {
      const c = fonte[j];
      if (aspas) {
        if (c === aspas) aspas = "";
      } else if (c === '"' || c === "'") aspas = c;
      else if (c === ">") break;
      j += 1;
    }
    let corpo = fonte.slice(lt + 1, j);
    const vazio = corpo.endsWith("/");
    if (vazio) corpo = corpo.slice(0, -1);
    const fimDoNome = corpo.search(/[\s/]/);
    const nome = local(fimDoNome < 0 ? corpo : corpo.slice(0, fimDoNome));
    const attrs: Record<string, string> = {};
    if (fimDoNome >= 0) {
      for (const m of corpo.slice(fimDoNome).matchAll(ATRIBUTO)) {
        if (m[1] === "xmlns" || m[1].startsWith("xmlns:")) continue;
        attrs[local(m[1])] = desescapar(m[2] ?? m[3] ?? "");
      }
    }
    nos += 1;
    if (nos > MAX_NOS) throw new Error("XML grande demais.");
    const no: No = { nome, attrs, filhos: [], texto: "" };
    pilha[pilha.length - 1].filhos.push(no);
    if (!vazio) {
      if (pilha.length > MAX_PROFUNDIDADE) throw new Error("XML fundo demais.");
      pilha.push(no);
    }
    i = j + 1;
  }
  return documento.filhos[0] ?? null;
}

/** O primeiro filho com esse nome. */
export function filho(no: No | null | undefined, nome: string): No | null {
  if (!no) return null;
  for (const f of no.filhos) if (f.nome === nome) return f;
  return null;
}

/** Todos os filhos com esse nome. */
export function filhos(no: No | null | undefined, nome: string): No[] {
  return no ? no.filhos.filter((f) => f.nome === nome) : [];
}

/** Desce pelo caminho de nomes, sempre pelo primeiro filho de cada um. */
export function descer(no: No | null | undefined, ...nomes: string[]): No | null {
  let atual = no ?? null;
  for (const nome of nomes) {
    atual = filho(atual, nome);
    if (!atual) return null;
  }
  return atual;
}

/** O primeiro filho cujo nome está na lista. */
export function umDe(no: No | null | undefined, nomes: readonly string[]): No | null {
  if (!no) return null;
  for (const f of no.filhos) if (nomes.includes(f.nome)) return f;
  return null;
}

/** Um atributo numérico, ou `padrao` quando falta ou não é número. */
export function numero(no: No | null | undefined, attr: string, padrao: number): number;
export function numero(no: No | null | undefined, attr: string): number | undefined;
export function numero(no: No | null | undefined, attr: string, padrao?: number): number | undefined {
  const v = no?.attrs[attr];
  if (v === undefined || v === "") return padrao;
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

/** "1", "true" e "on" são verdade, como o PowerPoint escreve. */
export function booleano(no: No | null | undefined, attr: string): boolean | undefined {
  const v = no?.attrs[attr];
  if (v === undefined) return undefined;
  return v === "1" || v === "true" || v === "on";
}
