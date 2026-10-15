import { describe, expect, it } from "vitest";
import { allowedRecipients, previewEmailGate } from "./preview-email";

const preview = {
  APP_ENV: "preview",
  PREVIEW_EMAIL_ALLOWLIST: " Ami@Example.ch , autre@example.ch",
  ADMIN_EMAILS: "admin@example.ch",
};

describe("previewEmailGate", () => {
  it("ne filtre rien hors preview (production, dev local)", () => {
    expect(previewEmailGate({})).toBeNull();
    expect(previewEmailGate({ ADMIN_EMAILS: "admin@example.ch" })).toBeNull();
    expect(allowedRecipients({}, ["x@y.ch", "z@y.ch"])).toEqual([
      "x@y.ch",
      "z@y.ch",
    ]);
  });

  it("autorise la liste et les admins, sans tenir compte de la casse", () => {
    const gate = previewEmailGate(preview)!;
    expect(gate("ami@example.ch")).toBe(true);
    expect(gate(" AUTRE@example.ch ")).toBe(true);
    expect(gate("admin@example.ch")).toBe(true);
    expect(gate("inconnu@example.ch")).toBe(false);
  });

  it("ferme tout en preview sans liste", () => {
    const gate = previewEmailGate({ APP_ENV: "preview" })!;
    expect(gate("ami@example.ch")).toBe(false);
  });

  it("garde seulement les destinataires autorisés", () => {
    expect(
      allowedRecipients(preview, ["ami@example.ch", "inconnu@example.ch"]),
    ).toEqual(["ami@example.ch"]);
    expect(allowedRecipients(preview, "inconnu@example.ch")).toEqual([]);
  });
});
