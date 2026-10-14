import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEGACY_STUDIO_REDIRECTS } from "./legacy-redirects";

// /studio/relief → /studio/montagne : permanent, avec ou sans langue. Les chemins
// sont ceux de `next.config.ts` (path-to-regexp) ; la requête passe d'elle-même
// (documenté par Next) et le fragment reste côté navigateur.

/** Applique la règle comme Next : `:locale(fr|de|it|en)` capture la langue. */
function redirectOf(path: string): string | null {
  for (const rule of LEGACY_STUDIO_REDIRECTS) {
    const pattern = rule.source.replace(
      ":locale(fr|de|it|en)",
      "(?<locale>fr|de|it|en)",
    );
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (match)
      return rule.destination.replace(":locale", match.groups?.locale ?? "");
  }
  return null;
}

describe("anciennes adresses du Studio", () => {
  it("/<langue>/studio/relief devient /<langue>/studio/montagne, dans les quatre langues", () => {
    for (const locale of ["fr", "de", "it", "en"]) {
      expect(redirectOf(`/${locale}/studio/relief`)).toBe(
        `/${locale}/studio/montagne`,
      );
    }
    expect(redirectOf("/studio/relief")).toBe("/studio/montagne");
  });

  it("les autres objets et la montagne elle-même ne bougent pas", () => {
    for (const path of [
      "/fr/studio/lavaux",
      "/fr/studio/montagne",
      "/fr/studio",
      "/es/studio/relief",
      "/fr/studio/relief/x",
    ]) {
      expect(redirectOf(path), `${path}`).toBeNull();
    }
  });

  it("toutes les règles sont permanentes (308), et next.config.ts les sert", () => {
    for (const rule of LEGACY_STUDIO_REDIRECTS)
      expect(rule.permanent).toBe(true);
    const config = readFileSync(
      fileURLToPath(new URL("../../../next.config.ts", import.meta.url)),
      "utf8",
    );
    expect(config).toContain("LEGACY_STUDIO_REDIRECTS");
    expect(config).toContain("async redirects()");
  });
});
