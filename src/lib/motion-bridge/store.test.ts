import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTION_CHANGE_EVENT, MOTION_STORAGE_KEY } from "./motion-pref";
import { motionBridge, resetMotionBridgeForTests } from "./store";
import type { StageViewDescriptor } from "./types";

// Navigateur minimal (environnement Vitest « node ») : window événementiel,
// localStorage en mémoire, <html> et son dataset, matchMedia réglable.
function installBrowser({
  motion,
  osReduced = false,
}: { motion?: string; osReduced?: boolean } = {}) {
  const store = new Map<string, string>();
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = osReduced;
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => media,
  });
  const dataset: Record<string, string> = motion ? { motion } : {};
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return { win, media, dataset, store };
}

const view = (
  id: string,
  extra: Partial<StageViewDescriptor> = {},
): StageViewDescriptor => ({
  id,
  scene: "print-hero",
  element: {} as HTMLElement,
  props: { n: 0 },
  clear: "transparent",
  ...extra,
});

beforeEach(() => resetMotionBridgeForTests());
afterEach(() => {
  resetMotionBridgeForTests();
  vi.unstubAllGlobals();
});

describe("état du pont", () => {
  it("côté serveur : C0, figé, set sans effet", () => {
    const state = motionBridge.get();
    expect(state).toMatchObject({
      capability: 0,
      runtimeReady: false,
      stageReady: false,
      scroll: null,
      stage: null,
      studio: null,
    });
    motionBridge.set({ capability: 2 });
    expect(motionBridge.get().capability).toBe(0);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("côté client : reduced lu sur data-motion avant tout abonnement", () => {
    installBrowser({ motion: "reduce" });
    expect(motionBridge.get().reduced).toBe(true);
  });

  it("n'émet que si une valeur change, et remplace l'objet d'état", () => {
    installBrowser({ motion: "full" });
    const listener = vi.fn<() => void>();
    const off = motionBridge.subscribe(listener);
    const before = motionBridge.get();
    motionBridge.set({ capability: 0, velocity: 0 });
    expect(listener).not.toHaveBeenCalled();
    motionBridge.set({ capability: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(motionBridge.get()).not.toBe(before);
    expect(motionBridge.get().capability).toBe(2);
    off();
    motionBridge.set({ capability: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("suit l'interrupteur de mouvement tant que quelqu'un écoute", () => {
    const { win, dataset } = installBrowser({ motion: "full" });
    const listener = vi.fn<() => void>();
    const off = motionBridge.subscribe(listener);
    dataset.motion = "reduce";
    win.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    expect(motionBridge.get().reduced).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    dataset.motion = "full";
    win.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    expect(motionBridge.get().reduced).toBe(true);
  });

  it("réglage du système sans choix explicite : data-motion est réappliqué", () => {
    const { media, dataset, store } = installBrowser({ motion: "full" });
    const off = motionBridge.subscribe(() => {});
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    expect(dataset.motion).toBe("reduce");
    expect(motionBridge.get().reduced).toBe(true);
    // Un choix explicite « full » l'emporte sur le système.
    store.set(MOTION_STORAGE_KEY, "full");
    media.dispatchEvent(new Event("change"));
    expect(dataset.motion).toBe("full");
    expect(motionBridge.get().reduced).toBe(false);
    off();
  });

  it("data-motion retiré par React (hydratation rattrapée) : reposé à l'abonnement", () => {
    const { dataset } = installBrowser({ osReduced: true });
    expect(dataset.motion).toBeUndefined();
    const off = motionBridge.subscribe(() => {});
    expect(dataset.motion).toBe("reduce");
    expect(motionBridge.get().reduced).toBe(true);
    off();
  });

  it("à l'abonnement, le choix mémorisé l'emporte sur le système", () => {
    const { dataset, store } = installBrowser({ osReduced: true });
    store.set(MOTION_STORAGE_KEY, "full");
    const off = motionBridge.subscribe(() => {});
    expect(dataset.motion).toBe("full");
    expect(motionBridge.get().reduced).toBe(false);
    off();
  });
});

describe("registre des vues", () => {
  beforeEach(() => void installBrowser());

  it("enregistre, met à jour, retire ; liste triée par priorité", () => {
    motionBridge.views.register(view("b", { priority: 2 }));
    motionBridge.views.register(view("a", { priority: 1 }));
    motionBridge.views.register(view("c"));
    expect(motionBridge.views.list().map((v) => v.id)).toEqual(["c", "a", "b"]);
    motionBridge.views.unregister("a");
    expect(motionBridge.views.list().map((v) => v.id)).toEqual(["c", "b"]);
  });

  it("list() garde la même référence tant que rien ne change", () => {
    motionBridge.views.register(view("a"));
    const first = motionBridge.views.list();
    expect(motionBridge.views.list()).toBe(first);
    motionBridge.views.update("a", { n: 1 });
    expect(motionBridge.views.list()).not.toBe(first);
  });

  it("n'émet que sur ajout, retrait ou nouvel objet de props", () => {
    const listener = vi.fn<() => void>();
    motionBridge.views.subscribe(listener);
    const props = { n: 1 };
    motionBridge.views.register(view("a", { props }));
    motionBridge.views.update("a", props); // même instantané
    motionBridge.views.update("inconnue", { n: 2 });
    motionBridge.views.setReady("a", true); // canal séparé
    expect(listener).toHaveBeenCalledTimes(1);
    motionBridge.views.update("a", { n: 1 }); // nouvel objet
    motionBridge.views.unregister("a");
    motionBridge.views.unregister("a");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("les props ne sont jamais mutées : update crée un nouveau descripteur", () => {
    const original = view("a");
    motionBridge.views.register(original);
    motionBridge.views.update("a", { n: 5 });
    expect(original.props).toEqual({ n: 0 });
    expect(motionBridge.views.get("a")?.props).toEqual({ n: 5 });
  });

  it("état « prête » : canal à part, effacé au retrait de la vue", () => {
    const ready = vi.fn<() => void>();
    motionBridge.views.subscribeReady(ready);
    motionBridge.views.register(view("a"));
    motionBridge.views.setReady("a", true);
    motionBridge.views.setReady("a", true);
    expect(motionBridge.views.isReady("a")).toBe(true);
    expect(ready).toHaveBeenCalledTimes(1);
    motionBridge.views.unregister("a");
    expect(motionBridge.views.isReady("a")).toBe(false);
    expect(ready).toHaveBeenCalledTimes(2);
  });
});
