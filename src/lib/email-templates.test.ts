import { describe, expect, it } from "vitest";
import { withUtm } from "./email-templates";

describe("withUtm", () => {
  it("marque les liens du site pour le canal Email", () => {
    expect(
      withUtm("https://swiss3design.ch/fr/cart?restore=abc", "cart_reminder"),
    ).toBe(
      "https://swiss3design.ch/fr/cart?restore=abc&utm_source=swiss3design&utm_medium=email&utm_campaign=cart_reminder",
    );
  });

  it("laisse intacts les liens vers d'autres sites", () => {
    const post = "https://service.post.ch/ekp-web/ui/entry/search/99.00";
    expect(withUtm(post, "shipping")).toBe(post);
    expect(withUtm("https://swiss3design.ch.evil.test/x", "x")).toBe(
      "https://swiss3design.ch.evil.test/x",
    );
  });
});
