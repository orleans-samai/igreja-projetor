import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS, migrateLumenState } from "./lumen-domain.ts";

describe("migração do estado do Lúmen", () => {
  it("preserva preferências antigas e completa campos novos", () => {
    const migrated = migrateLumenState({
      settings: { churchName: "Comunidade", margins: { t: 3 } },
      songs: [],
    });
    const settings = migrated.settings as typeof DEFAULT_SETTINGS;
    assert.equal(settings.churchName, "Comunidade");
    assert.equal(settings.margins.t, 3);
    assert.equal(settings.margins.r, DEFAULT_SETTINGS.margins.r);
    assert.deepEqual(migrated.favoriteMedia, []);
  });

  it("recusa formatos persistidos inválidos", () => {
    assert.deepEqual(migrateLumenState(null), {});
    assert.deepEqual(migrateLumenState([]), {});
  });
});
