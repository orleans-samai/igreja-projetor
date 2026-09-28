import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avisoDaEscolha,
  OPCOES_DE_ABERTURA,
  primeiroConversor,
  QUEM_ABRE_PADRAO,
  quemAbreValido,
} from "./abrir-slides.ts";

describe("quem abre as apresentações", () => {
  it("o menu tem o automático e os três que a igreja pediu, nessa ordem", () => {
    assert.deepEqual(
      OPCOES_DE_ABERTURA.map((o) => o.valor),
      ["automatico", "office", "libreoffice", "lumen"],
    );
    assert.equal(QUEM_ABRE_PADRAO, "automatico");
  });

  it("valor desconhecido ou ausente vira o automático", () => {
    assert.equal(quemAbreValido(undefined), "automatico");
    assert.equal(quemAbreValido("powerpoint"), "automatico");
    assert.equal(quemAbreValido(3), "automatico");
    for (const valor of ["office", "libreoffice", "lumen"] as const) assert.equal(quemAbreValido(valor), valor);
  });

  it("só o LibreOffice muda quem vai na frente no processo principal", () => {
    assert.equal(primeiroConversor("libreoffice"), "libreoffice");
    assert.equal(primeiroConversor("office"), "powerpoint");
    assert.equal(primeiroConversor("automatico"), "powerpoint");
    assert.equal(primeiroConversor("lumen"), "powerpoint");
  });

  it("desenhou quem foi escolhido, ou está no automático: nada a avisar", () => {
    assert.equal(avisoDaEscolha("office", "PowerPoint"), undefined);
    assert.equal(avisoDaEscolha("libreoffice", "LibreOffice"), undefined);
    assert.equal(avisoDaEscolha("lumen", "Lúmen"), undefined);
    assert.equal(avisoDaEscolha("automatico", "LibreOffice", "O PowerPoint não conseguiu abrir."), undefined);
  });

  it("a reserva desenhou: o aviso diz quem, no lugar de quem e por quê", () => {
    const aviso = avisoDaEscolha("libreoffice", "PowerPoint", "O LibreOffice não está instalado neste computador.");
    assert.equal(
      aviso,
      "O LibreOffice não está instalado neste computador. Desenhada pelo PowerPoint no lugar do LibreOffice, que está escolhido no menu Slides.",
    );
    assert.match(avisoDaEscolha("lumen", "PowerPoint") ?? "", /^Desenhada pelo PowerPoint no lugar do Lúmen/);
  });
});
