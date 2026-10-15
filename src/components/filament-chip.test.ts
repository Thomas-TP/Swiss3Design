import { describe, expect, it } from "vitest";
import { chipBackground, wheelOrder } from "./filament-chip";

describe("wheelOrder : la roue des couleurs d'une carte", () => {
  it("neutres d'abord (clair → foncé), puis les couleurs par teinte", () => {
    expect(
      wheelOrder(["#1A0CE4", "#1C1917", "#E5231C", "#F5F5F4", "#2E8B57"]),
    ).toEqual(["#F5F5F4", "#1C1917", "#E5231C", "#2E8B57", "#1A0CE4"]);
  });
  it("ne perd ni n'ajoute aucune teinte", () => {
    const hexes = ["#A3D8E1", "#757575", "#F0D6D9", "#0047BB", "#7D1B49"];
    expect(wheelOrder(hexes).sort()).toEqual([...hexes].sort());
  });
  it("une roue de N teintes = N secteurs égaux", () => {
    const style = chipBackground(wheelOrder(["#ff0000", "#00ff00", "#0000ff"]));
    expect(style.backgroundImage).toContain("conic-gradient");
    expect(String(style.backgroundImage).match(/#/g)).toHaveLength(3);
  });
});
