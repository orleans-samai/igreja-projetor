import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CULTOS,
  apagarRecado,
  buscarNoHistorico,
  diaDe,
  exportarCulto,
  guardarRecado,
  type HistoricoDoChat,
} from "./chat-historico.ts";
import type { MensagemChat } from "./remote-control.ts";

const domingo = new Date(2026, 8, 27, 19, 5).getTime();
const culto = { id: "pl-1", nome: "Culto Jovem" };
const recado = (id: string, texto: string, extra: Partial<MensagemChat> = {}): MensagemChat => ({
  id,
  de: "Caio",
  texto,
  em: domingo,
  daCabine: false,
  ...extra,
});

test("recados do mesmo culto e dia ficam juntos; outro dia é outro culto", () => {
  let h: HistoricoDoChat = { cultos: [] };
  h = guardarRecado(h, culto, recado("1", "Sobe o retorno"));
  h = guardarRecado(h, culto, recado("2", "Pronto"));
  h = guardarRecado(h, culto, recado("3", "Semana que vem", { em: domingo + 7 * 86400000 }));
  assert.equal(h.cultos.length, 2);
  assert.equal(h.cultos[0].dia, diaDe(domingo));
  assert.deepEqual(h.cultos[0].recados.map((r) => r.id), ["1", "2"]);
});

test("o mesmo recado chegando de novo não duplica", () => {
  let h: HistoricoDoChat = { cultos: [] };
  h = guardarRecado(h, culto, recado("1", "oi"));
  h = guardarRecado(h, culto, recado("1", "oi"));
  assert.equal(h.cultos[0].recados.length, 1);
});

test("o áudio não vai para o histórico, só a marca de que houve voz", () => {
  const h = guardarRecado({ cultos: [] }, culto, recado("1", "", { audio: "data:audio/webm;base64,AAAA", segundos: 4 }));
  const r = h.cultos[0].recados[0];
  assert.equal("audio" in r, false);
  assert.equal(r.voz, true);
  assert.equal(r.segundos, 4);
});

test("apagado pela cabine some do histórico também", () => {
  let h = guardarRecado({ cultos: [] }, culto, recado("1", "recado errado", { foto: { arquivo: "x.jpg" } }));
  h = apagarRecado(h, "1");
  const r = h.cultos[0].recados[0];
  assert.equal(r.apagada, true);
  assert.equal(r.texto, "");
  assert.equal(r.foto, undefined);
  assert.deepEqual(buscarNoHistorico(h, "errado"), []);
});

test("a busca acha pelo texto ou por quem escreveu, sem acento importar", () => {
  let h: HistoricoDoChat = { cultos: [] };
  h = guardarRecado(h, culto, recado("1", "O microfone do púlpito falhou"));
  h = guardarRecado(h, culto, recado("2", "Tudo certo", { de: "Bia" }));
  assert.deepEqual(buscarNoHistorico(h, "PULPITO").map((a) => a.recado.id), ["1"]);
  assert.deepEqual(buscarNoHistorico(h, "bia").map((a) => a.recado.id), ["2"]);
  assert.deepEqual(buscarNoHistorico(h, "  "), []);
});

test("guarda os cultos mais novos quando passa do limite", () => {
  let h: HistoricoDoChat = { cultos: [] };
  for (let i = 0; i < MAX_CULTOS + 5; i += 1) {
    h = guardarRecado(h, culto, recado(String(i), "x", { em: domingo + i * 86400000 }));
  }
  assert.equal(h.cultos.length, MAX_CULTOS);
  assert.equal(h.cultos.at(-1)?.recados[0].id, String(MAX_CULTOS + 4));
});

test("a exportação diz a hora, quem, para quem e o que foi dito", () => {
  let h: HistoricoDoChat = { cultos: [] };
  h = guardarRecado(h, culto, recado("1", "Sobe o retorno", { para: { tipo: "equipe", equipe: "louvor" } }));
  h = guardarRecado(h, culto, recado("2", "", { de: "Cabine", daCabine: true, foto: { arquivo: "a.jpg" } }));
  h = apagarRecado(guardarRecado(h, culto, recado("3", "ops")), "3");
  const texto = exportarCulto(h.cultos[0]);
  assert.match(texto, /^Chat — Culto Jovem — 27\/09\/2026/);
  assert.match(texto, /\[19:05\] Caio → Louvor: Sobe o retorno/);
  assert.match(texto, /\[19:05\] Cabine → Todos: \(foto\)/);
  assert.match(texto, /\(recado apagado pela cabine\)/);
});
