import { fold } from "./fold.ts";

export interface BookMeta {
  id: number;
  osis: string;
  name: string;
  abbrevs: string[];
}

/** Canonical Protestant 66-book order with PT-BR names and operator shortcuts. */
export const BOOKS: BookMeta[] = [
  { id: 1, osis: "Gen", name: "Gênesis", abbrevs: ["gn", "gen", "ge", "genesis"] },
  { id: 2, osis: "Exod", name: "Êxodo", abbrevs: ["ex", "exo", "exod", "exodo"] },
  { id: 3, osis: "Lev", name: "Levítico", abbrevs: ["lv", "lev", "levitico"] },
  { id: 4, osis: "Num", name: "Números", abbrevs: ["nm", "num", "nu", "numeros"] },
  { id: 5, osis: "Deut", name: "Deuteronômio", abbrevs: ["dt", "deu", "deut", "deuteronomio"] },
  { id: 6, osis: "Josh", name: "Josué", abbrevs: ["js", "jos", "josue"] },
  { id: 7, osis: "Judg", name: "Juízes", abbrevs: ["jz", "juiz", "juizes", "judg"] },
  { id: 8, osis: "Ruth", name: "Rute", abbrevs: ["rt", "rut", "rute", "ruth"] },
  { id: 9, osis: "1Sam", name: "1 Samuel", abbrevs: ["1sm", "1sam", "1 samuel", "1sa"] },
  { id: 10, osis: "2Sam", name: "2 Samuel", abbrevs: ["2sm", "2sam", "2 samuel", "2sa"] },
  { id: 11, osis: "1Kgs", name: "1 Reis", abbrevs: ["1rs", "1re", "1 reis", "1ki"] },
  { id: 12, osis: "2Kgs", name: "2 Reis", abbrevs: ["2rs", "2re", "2 reis", "2ki"] },
  { id: 13, osis: "1Chr", name: "1 Crônicas", abbrevs: ["1cr", "1cro", "1 cronicas"] },
  { id: 14, osis: "2Chr", name: "2 Crônicas", abbrevs: ["2cr", "2cro", "2 cronicas"] },
  { id: 15, osis: "Ezra", name: "Esdras", abbrevs: ["ed", "esd", "esdras", "ezr"] },
  { id: 16, osis: "Neh", name: "Neemias", abbrevs: ["ne", "nee", "neemias", "neh"] },
  { id: 17, osis: "Esth", name: "Ester", abbrevs: ["et", "est", "ester"] },
  { id: 18, osis: "Job", name: "Jó", abbrevs: ["job", "jo"] },
  { id: 19, osis: "Ps", name: "Salmos", abbrevs: ["sl", "sal", "salmo", "salmos", "ps"] },
  { id: 20, osis: "Prov", name: "Provérbios", abbrevs: ["pv", "prv", "pro", "proverbios"] },
  { id: 21, osis: "Eccl", name: "Eclesiastes", abbrevs: ["ec", "ecl", "eclesiastes"] },
  { id: 22, osis: "Song", name: "Cânticos", abbrevs: ["ct", "cant", "canticos", "cantares"] },
  { id: 23, osis: "Isa", name: "Isaías", abbrevs: ["is", "isa", "isaias"] },
  { id: 24, osis: "Jer", name: "Jeremias", abbrevs: ["jr", "jer", "jeremias"] },
  { id: 25, osis: "Lam", name: "Lamentações", abbrevs: ["lm", "lam", "lamentacoes"] },
  { id: 26, osis: "Ezek", name: "Ezequiel", abbrevs: ["ez", "eze", "ezequiel"] },
  { id: 27, osis: "Dan", name: "Daniel", abbrevs: ["dn", "dan", "daniel"] },
  { id: 28, osis: "Hos", name: "Oseias", abbrevs: ["os", "ose", "oseias"] },
  { id: 29, osis: "Joel", name: "Joel", abbrevs: ["jl", "joel"] },
  { id: 30, osis: "Amos", name: "Amós", abbrevs: ["am", "amos"] },
  { id: 31, osis: "Obad", name: "Obadias", abbrevs: ["ob", "obd", "obadias"] },
  { id: 32, osis: "Jonah", name: "Jonas", abbrevs: ["jn", "jonas", "jonah"] },
  { id: 33, osis: "Mic", name: "Miqueias", abbrevs: ["mq", "miq", "miqueias"] },
  { id: 34, osis: "Nah", name: "Naum", abbrevs: ["na", "nau", "naum"] },
  { id: 35, osis: "Hab", name: "Habacuque", abbrevs: ["hc", "hab", "habacuque"] },
  { id: 36, osis: "Zeph", name: "Sofonias", abbrevs: ["sf", "sof", "sofonias"] },
  { id: 37, osis: "Hag", name: "Ageu", abbrevs: ["ag", "age", "ageu"] },
  { id: 38, osis: "Zech", name: "Zacarias", abbrevs: ["zc", "zac", "zacarias"] },
  { id: 39, osis: "Mal", name: "Malaquias", abbrevs: ["ml", "mal", "malaquias"] },
  { id: 40, osis: "Matt", name: "Mateus", abbrevs: ["mt", "mat", "mateus"] },
  { id: 41, osis: "Mark", name: "Marcos", abbrevs: ["mc", "mr", "mar", "marcos"] },
  { id: 42, osis: "Luke", name: "Lucas", abbrevs: ["lc", "luc", "lucas"] },
  { id: 43, osis: "John", name: "João", abbrevs: ["jo", "joao", "joh", "john"] },
  { id: 44, osis: "Acts", name: "Atos", abbrevs: ["at", "atos", "act"] },
  { id: 45, osis: "Rom", name: "Romanos", abbrevs: ["rm", "rom", "romanos"] },
  { id: 46, osis: "1Cor", name: "1 Coríntios", abbrevs: ["1co", "1cor", "1 corintios", "1 cor"] },
  { id: 47, osis: "2Cor", name: "2 Coríntios", abbrevs: ["2co", "2cor", "2 corintios", "2 cor"] },
  { id: 48, osis: "Gal", name: "Gálatas", abbrevs: ["gl", "gal", "galatas"] },
  { id: 49, osis: "Eph", name: "Efésios", abbrevs: ["ef", "efesios", "eph"] },
  { id: 50, osis: "Phil", name: "Filipenses", abbrevs: ["fp", "fil", "filipenses", "php"] },
  { id: 51, osis: "Col", name: "Colossenses", abbrevs: ["cl", "col", "colossenses"] },
  { id: 52, osis: "1Thess", name: "1 Tessalonicenses", abbrevs: ["1ts", "1tes", "1 tessalonicenses"] },
  { id: 53, osis: "2Thess", name: "2 Tessalonicenses", abbrevs: ["2ts", "2tes", "2 tessalonicenses"] },
  { id: 54, osis: "1Tim", name: "1 Timóteo", abbrevs: ["1tm", "1tim", "1 timoteo"] },
  { id: 55, osis: "2Tim", name: "2 Timóteo", abbrevs: ["2tm", "2tim", "2 timoteo"] },
  { id: 56, osis: "Titus", name: "Tito", abbrevs: ["tt", "tito", "tit"] },
  { id: 57, osis: "Phlm", name: "Filemom", abbrevs: ["fm", "flm", "filemom"] },
  { id: 58, osis: "Heb", name: "Hebreus", abbrevs: ["hb", "heb", "hebreus"] },
  { id: 59, osis: "Jas", name: "Tiago", abbrevs: ["tg", "tia", "tiago", "jas"] },
  { id: 60, osis: "1Pet", name: "1 Pedro", abbrevs: ["1pe", "1ped", "1 pedro"] },
  { id: 61, osis: "2Pet", name: "2 Pedro", abbrevs: ["2pe", "2ped", "2 pedro"] },
  { id: 62, osis: "1John", name: "1 João", abbrevs: ["1jo", "1joao", "1 joao", "1 jn"] },
  { id: 63, osis: "2John", name: "2 João", abbrevs: ["2jo", "2joao", "2 joao"] },
  { id: 64, osis: "3John", name: "3 João", abbrevs: ["3jo", "3joao", "3 joao"] },
  { id: 65, osis: "Jude", name: "Judas", abbrevs: ["jd", "jud", "judas"] },
  { id: 66, osis: "Rev", name: "Apocalipse", abbrevs: ["ap", "apoc", "apocalipse", "rev"] },
];

export type BibleSection =
  | "law"
  | "hist"
  | "wisdom"
  | "prophet"
  | "gospel"
  | "acts"
  | "paul"
  | "general"
  | "rev";

export function bookById(id: number): BookMeta | undefined {
  return BOOKS.find((b) => b.id === id);
}

export function bookByOsis(osis: string): BookMeta | undefined {
  return BOOKS.find((b) => b.osis === osis);
}

export function bookShort(book: BookMeta): string {
  if (book.id === 18) return "Jó";
  const a = book.abbrevs[0] ?? book.osis;
  if (/^\d/.test(a)) return a[0] + a.charAt(1).toUpperCase() + a.slice(2);
  return a.charAt(0).toUpperCase() + a.slice(1);
}

export function bookTinyName(book: BookMeta): string {
  if (book.id === 52) return "1 Tess.";
  if (book.id === 53) return "2 Tess.";
  return book.name;
}

export function findBookByTyped(raw: string): BookMeta | undefined {
  const q = fold(raw);
  if (!q) return undefined;
  if (q === "jo") return bookById(43);
  if (q === "job") return bookById(18);
  const exactAbbrev = BOOKS.find((b) => b.abbrevs.some((a) => fold(a) === q));
  if (exactAbbrev) return exactAbbrev;
  const exactName = BOOKS.find((b) => fold(b.name) === q);
  if (exactName) return exactName;
  return BOOKS.find(
    (b) => b.abbrevs.some((a) => fold(a).startsWith(q)) || fold(b.name).startsWith(q),
  );
}

export function bookSection(id: number): BibleSection {
  if (id <= 5) return "law";
  if (id <= 17) return "hist";
  if (id <= 22) return "wisdom";
  if (id <= 39) return "prophet";
  if (id <= 43) return "gospel";
  if (id === 44) return "acts";
  if (id <= 57) return "paul";
  if (id <= 65) return "general";
  return "rev";
}
