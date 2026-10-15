import { describe, expect, it } from "vitest";
import { freshQueryArgs, freshQueryText } from "./fresh";

describe("freshQueryText", () => {
  it("rend un SELECT incachable par Hyperdrive (CTE inutilisée avec now())", () => {
    expect(freshQueryText('select "id" from "user" where "email" = $1')).toBe(
      'WITH __fresh AS (SELECT now()) select "id" from "user" where "email" = $1',
    );
    expect(freshQueryText("\n  SELECT 1")).toContain("now()");
  });

  it("laisse les écritures et les requêtes déjà en WITH telles quelles", () => {
    for (const text of [
      'insert into "user" ("id") values ($1)',
      'update "session" set "expires_at" = $1',
      "delete from verification where id = $1",
      "with x as (select 1) select * from x",
    ])
      expect(freshQueryText(text)).toBe(text);
  });
});

describe("freshQueryArgs", () => {
  it("réécrit le texte d'une requête passée en chaîne ou en objet", () => {
    expect(freshQueryArgs(["select 1", [1]])[0]).toContain("now()");
    const [config, values] = freshQueryArgs([
      { text: "select 1", rowMode: "array" },
      [1],
    ]) as [{ text: string; rowMode: string }, number[]];
    expect(config.text).toContain("now()");
    expect(config.rowMode).toBe("array");
    expect(values).toEqual([1]);
  });

  it("ne touche pas aux objets soumis (curseurs, flux)", () => {
    const submittable = { text: "select 1", submit: () => {} };
    expect(freshQueryArgs([submittable])[0]).toBe(submittable);
  });
});
