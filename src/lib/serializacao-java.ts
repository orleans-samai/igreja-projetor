/**
 * Leitor do formato de serialização do Java (o que o ObjectOutputStream grava).
 *
 * O Holyrics é feito em Java, e a exportação em lote dele com "Arquivo
 * único" (.mufl) é a lista de músicas gravada pelo ObjectOutputStream, sem
 * nada em volta. Aqui só se LÊ: nenhuma classe é criada e nenhum código
 * roda — o que o arquivo diz vira objetos simples (classe, campos e o que a
 * classe escreveu por conta própria). O perigo conhecido da serialização
 * Java está em reconstruir objetos de verdade dentro de uma JVM, e isso
 * aqui não existe.
 *
 * Arquivo de fora é tratado como hostil: profundidade, quantidade de
 * objetos e tamanhos têm teto, referência só aponta para o que já foi lido,
 * e o que foge da gramática é recusado em vez de adivinhado.
 *
 * Gramática: Java Object Serialization Specification, capítulo 6.
 */

const TC_NULL = 0x70;
const TC_REFERENCE = 0x71;
const TC_CLASSDESC = 0x72;
const TC_OBJECT = 0x73;
const TC_STRING = 0x74;
const TC_ARRAY = 0x75;
const TC_CLASS = 0x76;
const TC_BLOCKDATA = 0x77;
const TC_ENDBLOCKDATA = 0x78;
const TC_RESET = 0x79;
const TC_BLOCKDATALONG = 0x7a;
const TC_EXCEPTION = 0x7b;
const TC_LONGSTRING = 0x7c;
const TC_PROXYCLASSDESC = 0x7d;
const TC_ENUM = 0x7e;

const SC_WRITE_METHOD = 0x01;
const SC_SERIALIZABLE = 0x02;
const SC_EXTERNALIZABLE = 0x04;
const SC_BLOCK_DATA = 0x08;

/** Um hinário inteiro tem dezenas de milhares de objetos; milhões é arquivo feito para travar. */
const MAX_OBJETOS = 2_000_000;
/** As músicas do Holyrics ficam a três níveis da raiz; centenas é arquivo feito para estourar a pilha. */
const MAX_PROFUNDIDADE = 200;

export class FormatoJavaInvalido extends Error {}

export interface ClasseJava {
  nome: string;
  flags: number;
  campos: { tipo: string; nome: string }[];
  superClasse: ClasseJava | null;
}

export interface ObjetoJava {
  classe: string;
  campos: Record<string, ValorJava>;
  /** O que a própria classe escreveu (writeObject): os itens de uma ArrayList moram aqui. */
  extras: ValorJava[];
}

export interface EnumJava {
  enumDe: string;
  constante: string;
}

export interface BlocoJava {
  bloco: Uint8Array;
}

export type ValorJava =
  | null
  | boolean
  | number
  | string
  | ObjetoJava
  | EnumJava
  | BlocoJava
  | ClasseJava
  | ValorJava[];

/** O fim de uma anotação: marca interna, nunca sai daqui. */
const FIM = Symbol("fim");

/**
 * Texto em UTF-8 "modificado" do Java: o NUL vira dois bytes, e o que está
 * fora do plano básico (emoji) vem como duas metades de 3 bytes cada. Um
 * decodificador de UTF-8 comum trocaria o emoji por "�"; montar direto as
 * unidades de UTF-16 acerta os dois casos.
 */
function utfModificado(b: Uint8Array, inicio: number, fim: number): string {
  const partes: string[] = [];
  let unidades: number[] = [];
  const continuacao = (i: number) => {
    if (i >= fim || (b[i] & 0xc0) !== 0x80) throw new FormatoJavaInvalido("Texto com byte inválido.");
    return b[i] & 0x3f;
  };
  for (let i = inicio; i < fim; ) {
    const a = b[i];
    if (a < 0x80) {
      unidades.push(a);
      i += 1;
    } else if ((a & 0xe0) === 0xc0) {
      unidades.push(((a & 0x1f) << 6) | continuacao(i + 1));
      i += 2;
    } else if ((a & 0xf0) === 0xe0) {
      unidades.push(((a & 0x0f) << 12) | (continuacao(i + 1) << 6) | continuacao(i + 2));
      i += 3;
    } else {
      throw new FormatoJavaInvalido("Texto com byte inválido.");
    }
    if (unidades.length >= 8192) {
      partes.push(String.fromCharCode(...unidades));
      unidades = [];
    }
  }
  partes.push(String.fromCharCode(...unidades));
  return partes.join("");
}

class Leitor {
  private readonly bytes: Uint8Array;
  private readonly vista: DataView;
  private pos = 0;
  private alcas: unknown[] = [];
  private profundidade = 0;
  private objetos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  ler(): ValorJava[] {
    if (this.u16() !== 0xaced) throw new FormatoJavaInvalido("Não é serialização do Java.");
    if (this.u16() !== 5) throw new FormatoJavaInvalido("Versão da serialização do Java que o Lúmen não conhece.");
    const conteudo: ValorJava[] = [];
    while (this.pos < this.bytes.length) {
      const item = this.conteudo();
      if (item === FIM) throw new FormatoJavaInvalido("Fim de bloco fora do lugar.");
      conteudo.push(item);
    }
    return conteudo;
  }

  private passo(n: number): number {
    if (n < 0 || this.pos + n > this.bytes.length) throw new FormatoJavaInvalido("O arquivo acabou no meio.");
    const aqui = this.pos;
    this.pos += n;
    return aqui;
  }

  private u8() {
    return this.vista.getUint8(this.passo(1));
  }
  private i8() {
    return this.vista.getInt8(this.passo(1));
  }
  private u16() {
    return this.vista.getUint16(this.passo(2));
  }
  private i16() {
    return this.vista.getInt16(this.passo(2));
  }
  private i32() {
    return this.vista.getInt32(this.passo(4));
  }
  private i64() {
    return Number(this.vista.getBigInt64(this.passo(8)));
  }

  private utf(): string {
    const n = this.u16();
    const inicio = this.passo(n);
    return utfModificado(this.bytes, inicio, inicio + n);
  }

  private utfLongo(): string {
    const n = this.i64();
    if (!Number.isSafeInteger(n) || n < 0) throw new FormatoJavaInvalido("Texto com tamanho inválido.");
    const inicio = this.passo(n);
    return utfModificado(this.bytes, inicio, inicio + n);
  }

  private novaAlca<T>(valor: T): T {
    this.objetos += 1;
    if (this.objetos > MAX_OBJETOS) throw new FormatoJavaInvalido("Objetos demais no arquivo.");
    this.alcas.push(valor);
    return valor;
  }

  private referencia(): unknown {
    const indice = this.i32() - 0x7e0000;
    if (indice < 0 || indice >= this.alcas.length) throw new FormatoJavaInvalido("Referência para algo que não existe.");
    return this.alcas[indice];
  }

  private conteudo(): ValorJava | typeof FIM {
    this.profundidade += 1;
    if (this.profundidade > MAX_PROFUNDIDADE) throw new FormatoJavaInvalido("Objetos aninhados demais.");
    try {
      const tc = this.u8();
      switch (tc) {
        case TC_NULL:
          return null;
        case TC_REFERENCE:
          return this.referencia() as ValorJava;
        case TC_CLASSDESC:
        case TC_PROXYCLASSDESC:
          this.pos -= 1;
          return this.descricaoDeClasse();
        case TC_OBJECT:
          return this.objeto();
        case TC_STRING:
          return this.novaAlca(this.utf());
        case TC_LONGSTRING:
          return this.novaAlca(this.utfLongo());
        case TC_ARRAY:
          return this.lista();
        case TC_CLASS: {
          const classe = this.descricaoDeClasse();
          return this.novaAlca(classe);
        }
        case TC_ENUM:
          return this.enumeracao();
        case TC_BLOCKDATA: {
          const n = this.u8();
          const inicio = this.passo(n);
          return { bloco: this.bytes.slice(inicio, inicio + n) };
        }
        case TC_BLOCKDATALONG: {
          const n = this.i32();
          const inicio = this.passo(n);
          return { bloco: this.bytes.slice(inicio, inicio + n) };
        }
        case TC_ENDBLOCKDATA:
          return FIM;
        case TC_RESET:
          this.alcas = [];
          return this.conteudo();
        case TC_EXCEPTION:
          throw new FormatoJavaInvalido("O arquivo foi gravado no meio de um erro.");
        default:
          throw new FormatoJavaInvalido(`Marca desconhecida 0x${tc.toString(16)}.`);
      }
    } finally {
      this.profundidade -= 1;
    }
  }

  private descricaoDeClasse(): ClasseJava | null {
    // A superclasse vem dentro da descrição: uma cadeia comprida de
    // superclasses também é aninhamento, e também tem teto.
    this.profundidade += 1;
    if (this.profundidade > MAX_PROFUNDIDADE) throw new FormatoJavaInvalido("Objetos aninhados demais.");
    try {
      return this.lerDescricaoDeClasse();
    } finally {
      this.profundidade -= 1;
    }
  }

  private lerDescricaoDeClasse(): ClasseJava | null {
    const tc = this.u8();
    if (tc === TC_NULL) return null;
    if (tc === TC_REFERENCE) {
      const ref = this.referencia();
      if (!ref || typeof ref !== "object" || !("flags" in ref)) {
        throw new FormatoJavaInvalido("Referência de classe apontando para outra coisa.");
      }
      return ref as ClasseJava;
    }
    if (tc === TC_PROXYCLASSDESC) {
      const classe: ClasseJava = { nome: "(proxy)", flags: SC_SERIALIZABLE, campos: [], superClasse: null };
      this.novaAlca(classe);
      const interfaces = this.i32();
      if (interfaces < 0 || interfaces > 65535) throw new FormatoJavaInvalido("Proxy com interfaces demais.");
      for (let i = 0; i < interfaces; i += 1) this.utf();
      this.anotacoes();
      classe.superClasse = this.descricaoDeClasse();
      return classe;
    }
    if (tc !== TC_CLASSDESC) throw new FormatoJavaInvalido("Esperava a descrição de uma classe.");
    const nome = this.utf();
    this.passo(8); // serialVersionUID: não importa para quem só lê.
    const classe: ClasseJava = { nome, flags: 0, campos: [], superClasse: null };
    this.novaAlca(classe);
    classe.flags = this.u8();
    const quantos = this.i16();
    if (quantos < 0) throw new FormatoJavaInvalido("Classe com número de campos inválido.");
    for (let i = 0; i < quantos; i += 1) {
      const tipo = String.fromCharCode(this.u8());
      const nomeDoCampo = this.utf();
      if (tipo === "L" || tipo === "[") {
        const tipoDoObjeto = this.conteudo();
        if (typeof tipoDoObjeto !== "string") throw new FormatoJavaInvalido("Campo sem o nome do tipo.");
      } else if (!"BCDFIJSZ".includes(tipo)) {
        throw new FormatoJavaInvalido(`Tipo de campo desconhecido "${tipo}".`);
      }
      classe.campos.push({ tipo, nome: nomeDoCampo });
    }
    this.anotacoes();
    classe.superClasse = this.descricaoDeClasse();
    return classe;
  }

  /** Conteúdo até o fim do bloco: anotação de classe ou o que o writeObject escreveu. */
  private anotacoes(): ValorJava[] {
    const lista: ValorJava[] = [];
    for (;;) {
      const item = this.conteudo();
      if (item === FIM) return lista;
      lista.push(item);
    }
  }

  private valor(tipo: string): ValorJava {
    switch (tipo) {
      case "B":
        return this.i8();
      case "C":
        return String.fromCharCode(this.u16());
      case "D":
        return this.vista.getFloat64(this.passo(8));
      case "F":
        return this.vista.getFloat32(this.passo(4));
      case "I":
        return this.i32();
      case "J":
        return this.i64();
      case "S":
        return this.i16();
      case "Z":
        return this.u8() !== 0;
      case "L":
      case "[": {
        const v = this.conteudo();
        if (v === FIM) throw new FormatoJavaInvalido("Fim de bloco no lugar de um valor.");
        return v;
      }
      default:
        throw new FormatoJavaInvalido(`Tipo de valor desconhecido "${tipo}".`);
    }
  }

  private objeto(): ObjetoJava {
    const classe = this.descricaoDeClasse();
    if (!classe) throw new FormatoJavaInvalido("Objeto sem classe.");
    const obj: ObjetoJava = { classe: classe.nome, campos: {}, extras: [] };
    this.novaAlca(obj);
    // Os dados vêm da classe mais alta para a mais baixa.
    const hierarquia: ClasseJava[] = [];
    for (let c: ClasseJava | null = classe; c; c = c.superClasse) {
      hierarquia.unshift(c);
      if (hierarquia.length > MAX_PROFUNDIDADE) throw new FormatoJavaInvalido("Herança longa demais.");
    }
    for (const c of hierarquia) {
      if (c.flags & SC_SERIALIZABLE) {
        for (const campo of c.campos) obj.campos[campo.nome] = this.valor(campo.tipo);
        if (c.flags & SC_WRITE_METHOD) obj.extras.push(...this.anotacoes());
      } else if (c.flags & SC_EXTERNALIZABLE) {
        if (!(c.flags & SC_BLOCK_DATA)) {
          throw new FormatoJavaInvalido("Objeto externalizável antigo, que só a própria classe sabe ler.");
        }
        obj.extras.push(...this.anotacoes());
      }
    }
    return obj;
  }

  private lista(): ValorJava[] {
    const classe = this.descricaoDeClasse();
    if (!classe) throw new FormatoJavaInvalido("Vetor sem classe.");
    const itens: ValorJava[] = [];
    this.novaAlca(itens);
    const n = this.i32();
    const tipo = classe.nome.charAt(1);
    // Cada item ocupa ao menos um byte: um tamanho maior que o que resta é mentira.
    if (n < 0 || n > this.bytes.length - this.pos) throw new FormatoJavaInvalido("Vetor com tamanho inválido.");
    for (let i = 0; i < n; i += 1) itens.push(this.valor(tipo));
    return itens;
  }

  private enumeracao(): EnumJava {
    const classe = this.descricaoDeClasse();
    const e: EnumJava = { enumDe: classe?.nome ?? "", constante: "" };
    this.novaAlca(e);
    const nome = this.conteudo();
    if (typeof nome !== "string") throw new FormatoJavaInvalido("Enum sem o nome da constante.");
    e.constante = nome;
    return e;
  }
}

/** Os objetos gravados no arquivo, na ordem em que foram escritos. */
export function lerSerializacaoJava(bytes: Uint8Array): ValorJava[] {
  return new Leitor(bytes).ler();
}

export function ehSerializacaoJava(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xac && bytes[1] === 0xed && bytes[2] === 0x00 && bytes[3] === 0x05;
}
