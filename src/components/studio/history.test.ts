import { describe, expect, it } from "vitest";
import { CARTOUCHE_DEFAULT, LAVAUX_DEFAULT } from "@/lib/studio/presets";
import type { LavauxConfig } from "@/lib/studio/types";
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
  type HistoryAction,
  type StudioHistory,
} from "./history";

const start = () => createHistory({ config: LAVAUX_DEFAULT, texts: {} });
const withH = (h: number): LavauxConfig => ({ ...LAVAUX_DEFAULT, h });
const run = (history: StudioHistory, ...actions: HistoryAction[]) =>
  actions.reduce(historyReducer, history);
const heightOf = (history: StudioHistory) =>
  (history.present.config as LavauxConfig).h;

describe("historique du Studio (§6.7)", () => {
  it("un geste de curseur = un seul état d'historique, quel que soit le nombre d'événements", () => {
    let history = start();
    for (let h = 151; h <= 180; h++)
      history = run(history, {
        type: "set",
        patch: { config: withH(h) },
        commit: false,
      });
    expect(history.past).toHaveLength(0); // geste en cours : rien d'empilé
    expect(canUndo(history)).toBe(true);
    history = run(history, { type: "commit" });
    expect(history.past).toHaveLength(1);
    expect((history.past[0].config as LavauxConfig).h).toBe(150);
    expect(heightOf(history)).toBe(180);
  });

  it("annuler pendant un geste le termine d'abord, puis revient avant le geste", () => {
    let history = run(start(), {
      type: "set",
      patch: { config: withH(170) },
      commit: false,
    });
    history = run(history, { type: "undo" });
    expect(heightOf(history)).toBe(150);
    expect(canRedo(history)).toBe(true);
    history = run(history, { type: "redo" });
    expect(heightOf(history)).toBe(170);
  });

  it("un geste qui ne change rien n'empile rien", () => {
    let history = run(start(), {
      type: "set",
      patch: { config: withH(150) },
      commit: true,
    });
    expect(history.past).toHaveLength(0);
    expect(canUndo(history)).toBe(false);
  });

  it("un nouveau geste après un annuler efface le futur", () => {
    let history = run(
      start(),
      { type: "set", patch: { config: withH(160) }, commit: true },
      { type: "set", patch: { config: withH(170) }, commit: true },
      { type: "undo" },
    );
    expect(canRedo(history)).toBe(true);
    history = run(history, {
      type: "set",
      patch: { config: withH(190) },
      commit: true,
    });
    expect(canRedo(history)).toBe(false);
    expect(heightOf(history)).toBe(190);
  });

  it("la pile est de 50 états au plus", () => {
    let history = start();
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++)
      history = run(history, {
        type: "set",
        patch: { config: withH(80 + (i % 100)) },
        commit: true,
      });
    expect(history.past.length).toBe(HISTORY_LIMIT);
  });

  it("les textes frappés se fusionnent et s'annulent avec la configuration", () => {
    let history = createHistory({ config: CARTOUCHE_DEFAULT, texts: {} });
    history = run(
      history,
      { type: "texts", patch: { name: "Z" } },
      { type: "texts", patch: { name: "Zo" } },
      { type: "texts", patch: { role: "Chef" } },
      { type: "commit" },
    );
    expect(history.present.texts).toEqual({ name: "Zo", role: "Chef" });
    expect(history.past).toHaveLength(1);
    history = run(history, { type: "undo" });
    expect(history.present.texts).toEqual({});
  });

  it("charger un document vide l'historique", () => {
    const history = run(
      start(),
      { type: "set", patch: { config: withH(160) }, commit: true },
      { type: "load", doc: { config: withH(100), texts: { name: "A" } } },
    );
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(0);
    expect(heightOf(history)).toBe(100);
    expect(history.present.texts).toEqual({ name: "A" });
  });
});
