import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cultoTemDia, diaDoCultoNovo, diaDoInstante, nomeComDia } from "./dia-do-culto.ts";

// 27/09/2026 é domingo.
const domingo27 = new Date(2026, 8, 27, 10, 0);
const quarta23 = new Date(2026, 8, 23, 20, 0);
const segunda28 = new Date(2026, 8, 28, 9, 0);

describe("o dia de cada culto", () => {
  it("culto novo com dia da semana no nome fica no próximo desse dia (hoje, se for hoje)", () => {
    assert.equal(diaDoCultoNovo("Culto Domingo", domingo27), "2026-09-27");
    assert.equal(diaDoCultoNovo("Culto Domingo", quarta23), "2026-09-27");
    assert.equal(diaDoCultoNovo("Quarta 20h", segunda28), "2026-09-30");
    assert.equal(diaDoCultoNovo("Culto de Sábado", segunda28), "2026-10-03");
    assert.equal(diaDoCultoNovo("Terça de oração", segunda28), "2026-09-29");
  });

  it("sem dia da semana no nome, fica o dia de hoje", () => {
    assert.equal(diaDoCultoNovo("Culto Jovem", segunda28), "2026-09-28");
    // "Domingos" no meio de outra palavra não conta como dia.
    assert.equal(diaDoCultoNovo("Escola Dominical", segunda28), "2026-09-28");
  });

  it("aparece depois do nome: Culto Domingo, dia 27", () => {
    assert.equal(nomeComDia({ id: "a", name: "Culto Domingo", data: "2026-09-27" }, segunda28), "Culto Domingo, dia 27");
  });

  it("de outro mês leva o mês; de outro ano, o ano também", () => {
    assert.equal(nomeComDia({ id: "a", name: "Culto Domingo", data: "2026-08-30" }, segunda28), "Culto Domingo, dia 30/08");
    assert.equal(nomeComDia({ id: "a", name: "Culto Domingo", data: "2025-12-28" }, segunda28), "Culto Domingo, dia 28/12/2025");
  });

  it("culto antigo sem dia guardado usa o dia da última mudança", () => {
    const ms = new Date(2026, 8, 20, 19, 30).getTime();
    assert.equal(diaDoInstante(ms), "2026-09-20");
    assert.equal(nomeComDia({ id: "a", name: "Culto Jovem", updatedAt: ms }, segunda28), "Culto Jovem, dia 20");
  });

  it("culto do mês, o Temporário e o modelo semanal não ganham dia", () => {
    const hoje = segunda28;
    assert.equal(nomeComDia({ id: "pl-2026-09", name: "Setembro/2026", updatedAt: hoje.getTime() }, hoje), "Setembro/2026");
    assert.equal(nomeComDia({ id: "pl-temp", name: "Temporário", updatedAt: hoje.getTime() }, hoje), "Temporário");
    assert.equal(
      nomeComDia({ id: "pl-dom", name: "Domingo 19h", serviceId: "svc-dom", updatedAt: hoje.getTime() }, hoje),
      "Domingo 19h",
    );
    assert.equal(cultoTemDia({ id: "x" }), true);
  });
});
