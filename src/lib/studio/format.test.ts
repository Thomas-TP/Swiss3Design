// Formats d'affichage du Studio (brief « Strates », §2.2 et §6.3.2) : règles
// suisses par locale (`fr-CH`, `de-CH`, `it-CH`, `en-CH`).
import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatChfRange,
  formatClock,
  formatDuration,
  formatGrams,
  formatInteger,
  formatLayerIndex,
  formatLayers,
  formatMm,
  formatNumber,
  simulatedSeconds,
} from "./format";

const NBSP = " ";

describe("nombres et unités", () => {
  it("millimètres : virgule en français, point ailleurs, espace insécable", () => {
    expect(formatMm(0.2, "fr")).toBe(`0,2${NBSP}mm`);
    expect(formatMm(150, "fr")).toBe(`150,0${NBSP}mm`);
    for (const locale of ["de", "it", "en"]) {
      expect(formatMm(0.2, locale)).toBe(`0.2${NBSP}mm`);
      expect(formatMm(42, locale, 2)).toBe(`42.00${NBSP}mm`);
    }
  });

  it("grammes : une décimale sous 10 g, entier au-dessus", () => {
    expect(formatGrams(92.4, "fr")).toBe(`92${NBSP}g`);
    expect(formatGrams(4.83, "fr")).toBe(`4,8${NBSP}g`);
    expect(formatGrams(4.83, "de")).toBe(`4.8${NBSP}g`);
  });

  it("entiers : séparateur de milliers ICU (jamais d'espace simple)", () => {
    for (const locale of ["fr", "de", "it", "en"]) {
      expect(formatInteger(58420, locale)).toMatch(/^58\D420$/);
      expect(formatInteger(58420, locale)).not.toContain(" ");
    }
    expect(formatLayers(750, "fr")).toBe("750");
    expect(formatNumber(1234.5, "fr", 1)).toMatch(/^1\D234,5$/);
  });

  it("numéro de couche à largeur fixe", () => {
    expect(formatLayerIndex(284)).toBe("0284");
    expect(formatLayerIndex(7, 4)).toBe("0007");
    expect(formatLayerIndex(750)).toBe("0750");
    expect(formatLayerIndex(-3)).toBe("0000");
  });
});

describe("durées", () => {
  it("« 2 h 45 », « 45 min », « 2 Std. 45 » en allemand", () => {
    expect(formatDuration(165, "fr")).toBe(`2${NBSP}h${NBSP}45`);
    expect(formatDuration(45, "fr")).toBe(`45${NBSP}min`);
    expect(formatDuration(60, "fr")).toBe(`1${NBSP}h${NBSP}00`);
    expect(formatDuration(165, "de")).toBe(`2${NBSP}Std.${NBSP}45`);
    expect(formatDuration(165, "en")).toBe(`2${NBSP}h${NBSP}45`);
    expect(formatDuration(-5, "fr")).toBe(`0${NBSP}min`);
  });

  it("horloge : « 1 min 39 », « 42 s »", () => {
    expect(formatClock(99, "fr")).toBe(`1${NBSP}min${NBSP}39`);
    expect(formatClock(42, "fr")).toBe(`42${NBSP}s`);
    expect(formatClock(9900, "fr")).toBe(`2${NBSP}h${NBSP}45`);
  });

  it("simulation : 2 h 45 à ×100 donne 1 min 39", () => {
    const seconds = simulatedSeconds(165, 100);
    expect(seconds).toBe(99);
    expect(formatClock(seconds, "fr")).toBe(`1${NBSP}min${NBSP}39`);
    expect(simulatedSeconds(165, 1)).toBe(9900);
  });
});

describe("prix et taille de fichier", () => {
  it("fourchette en francs entiers ou en demi-francs", () => {
    expect(formatChfRange(1700, 2300, "fr")).toBe(`CHF${NBSP}17–23`);
    expect(formatChfRange(900, 1050, "fr")).toBe(`CHF${NBSP}9,00–10,50`);
    expect(formatChfRange(900, 1050, "de")).toBe(`CHF${NBSP}9.00–10.50`);
  });

  it("taille : Ko/Mo en français, KB/MB ailleurs", () => {
    expect(formatBytes(2_900_000, "fr")).toBe(`2,9${NBSP}Mo`);
    expect(formatBytes(2_900_000, "en")).toBe(`2.9${NBSP}MB`);
    expect(formatBytes(4500, "fr")).toBe(`4,5${NBSP}Ko`);
    expect(formatBytes(84 + 50 * 58_420, "fr")).toBe(`2,9${NBSP}Mo`);
  });
});
