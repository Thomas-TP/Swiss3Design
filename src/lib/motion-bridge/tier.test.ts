import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WEBGL_LOST_KEY,
  classifyCapability,
  createFrameMonitor,
  detectCapability,
  downgrade,
  lowerDetectedCapability,
  markWebglLost,
  median,
  resetCapabilityForTests,
  type CapabilityEnv,
} from "./tier";

// Poste de bureau ordinaire : C2.
const desktop: CapabilityEnv = {
  webgl2: true,
  saveData: false,
  deviceMemory: 8,
  contextLostInSession: false,
  coarsePointer: false,
  width: 1440,
  hardwareConcurrency: 8,
};

describe("classifyCapability (§3.6)", () => {
  it("C2 : WebGL2, écran large, pointeur fin, 8 cœurs", () => {
    expect(classifyCapability(desktop)).toBe(2);
  });

  it.each([
    ["sans WebGL2", { webgl2: false }],
    ["économie de données", { saveData: true }],
    ["2 Go de mémoire", { deviceMemory: 2 }],
    ["0,5 Go de mémoire", { deviceMemory: 0.5 }],
    ["contexte déjà perdu dans la session", { contextLostInSession: true }],
    // C0 l'emporte sur les raisons de C1.
    ["mobile sans WebGL2", { webgl2: false, coarsePointer: true, width: 375 }],
  ])("C0 : %s", (_label, patch) => {
    expect(classifyCapability({ ...desktop, ...patch })).toBe(0);
  });

  it.each([
    ["pointeur grossier", { coarsePointer: true }],
    ["largeur < 1024 px", { width: 1023 }],
    ["4 cœurs", { hardwareConcurrency: 4 }],
    ["tablette", { coarsePointer: true, width: 1024 }],
  ])("C1 : %s", (_label, patch) => {
    expect(classifyCapability({ ...desktop, ...patch })).toBe(1);
  });

  it("indices absents (Safari, Firefox) : aucune pénalité", () => {
    expect(
      classifyCapability({
        ...desktop,
        deviceMemory: undefined,
        hardwareConcurrency: undefined,
      }),
    ).toBe(2);
    expect(classifyCapability({ ...desktop, width: 1024 })).toBe(2);
  });
});

describe("déclassement", () => {
  it("C2 → C1 → C0, et C0 reste C0", () => {
    expect(downgrade(2)).toBe(1);
    expect(downgrade(1)).toBe(0);
    expect(downgrade(0)).toBe(0);
  });

  it("médiane", () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("médiane des 60 premières frames > 22 ms : déclasser, une seule fois", () => {
    const monitor = createFrameMonitor();
    for (let i = 0; i < 59; i++) expect(monitor.push(30)).toBe(false);
    expect(monitor.push(30)).toBe(true);
    expect(monitor.push(30)).toBe(false);
  });

  it("frames rapides, ou quelques pics seulement : on garde le palier", () => {
    const monitor = createFrameMonitor();
    let result = false;
    // 25 frames lentes sur 60 : la médiane reste à 16,7 ms.
    for (let i = 0; i < 60; i++) result = monitor.push(i < 25 ? 40 : 16.7);
    expect(result).toBe(false);
  });

  it("écarts aberrants (onglet masqué, débogueur) : ignorés", () => {
    const monitor = createFrameMonitor({ samples: 3 });
    expect(monitor.push(5000)).toBe(false);
    expect(monitor.push(Number.NaN)).toBe(false);
    expect(monitor.push(-1)).toBe(false);
    monitor.push(30);
    monitor.push(30);
    expect(monitor.push(30)).toBe(true);
    monitor.reset();
    monitor.push(10);
    monitor.push(10);
    expect(monitor.push(10)).toBe(false);
  });
});

describe("détection mémorisée", () => {
  afterEach(() => {
    resetCapabilityForTests();
    vi.unstubAllGlobals();
  });

  function installBrowser({ lost = false } = {}) {
    const session = new Map<string, string>(
      lost ? [[WEBGL_LOST_KEY, "1"]] : [],
    );
    const getContext = vi.fn<
      (kind: string, options?: object) => { getExtension(): object }
    >(() => ({ getExtension: () => ({ loseContext: () => {} }) }));
    vi.stubGlobal("window", {
      innerWidth: 1440,
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal("navigator", { hardwareConcurrency: 8, deviceMemory: 8 });
    vi.stubGlobal("document", {
      createElement: () => ({ getContext }),
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
    });
    return { getContext, session };
  }

  it("serveur : C0", () => {
    expect(detectCapability()).toBe(0);
  });

  it("une seule sonde WebGL par chargement, déclassement conservé", () => {
    const { getContext } = installBrowser();
    expect(detectCapability()).toBe(2);
    expect(detectCapability()).toBe(2);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    expect(lowerDetectedCapability()).toBe(1);
    expect(detectCapability()).toBe(1);
    expect(lowerDetectedCapability(0)).toBe(0);
    // Jamais de remontée par cette voie.
    expect(lowerDetectedCapability(2)).toBe(0);
  });

  it("perte de contexte dans la session : C0 sans créer de contexte", () => {
    const { getContext } = installBrowser({ lost: true });
    expect(detectCapability()).toBe(0);
    expect(getContext).not.toHaveBeenCalled();
  });

  it("markWebglLost écrit le drapeau de session", () => {
    const { session } = installBrowser();
    markWebglLost();
    expect(session.get(WEBGL_LOST_KEY)).toBe("1");
  });
});
