import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWindows,
  pickExternalScreen,
  recommendedBrowser,
  windowsInstallSteps,
  type OutputScreen,
} from "./windows-desktop.ts";

describe("windows-desktop", () => {
  it("reconhece Windows e o Edge", () => {
    assert.equal(
      isWindows("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
      true,
    );
    assert.equal(isWindows("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), false);
    assert.equal(
      recommendedBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
      ),
      "edge",
    );
  });

  it("escolhe o monitor que não é o principal", () => {
    const screens: OutputScreen[] = [
      { id: 0, label: "Notebook", left: 0, top: 0, width: 1920, height: 1080, primary: true },
      { id: 1, label: "Projetor", left: 1920, top: 0, width: 1920, height: 1080, primary: false },
    ];
    const ext = pickExternalScreen(screens);
    assert.equal(ext?.label, "Projetor");
    assert.equal(pickExternalScreen([screens[0]]), null);
  });

  it("explica a instalação no Windows em português", () => {
    const steps = windowsInstallSteps("edge");
    assert.equal(steps.length, 5);
    assert.match(steps[0].title, /Setup\.exe/i);
    assert.match(steps[1].detail, /Aplicativos/i);
    assert.match(steps[3].detail, /Estender/);
  });
});
