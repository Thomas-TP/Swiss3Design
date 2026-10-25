import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl/middleware importe « next/server » sans extension (ESM) : le
// routage des langues n'est pas l'objet de ces tests, on le remplace.
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));
import middleware from "./middleware";
import { senderAddress } from "./lib/email";

// Les redirections répondent tout de suite ; les autres chemins peuvent être
// asynchrones (relais, i18n) : les tests qui les visent font un await.
const call = (url: string, method = "GET") =>
  middleware(
    new NextRequest(url, { method, headers: { host: new URL(url).host } }),
  ) as Response;

describe("passage de Swiss3Design à Kreya (domaines)", () => {
  it("les pages de l'ancien domaine partent en 301 vers la même adresse sur kreya.ch", () => {
    for (const host of ["swiss3design.ch", "www.swiss3design.ch"]) {
      const res = call(`https://${host}/fr/shop?tri=prix#haut`);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(
        "https://kreya.ch/fr/shop?tri=prix",
      );
      expect(res.headers.get("strict-transport-security")).toBeTruthy();
    }
    expect(call("https://swiss3design.ch/").headers.get("location")).toBe(
      "https://kreya.ch/",
    );
  });

  it("l'ancien domaine sert encore webhooks, Server Actions et MCP sans redirection", async () => {
    for (const [url, method] of [
      ["https://swiss3design.ch/api/stripe/webhook", "POST"],
      ["https://swiss3design.ch/api/cron/maintenance", "POST"],
      ["https://swiss3design.ch/api/newsletter/unsubscribe?u=1&t=2", "GET"],
      ["https://swiss3design.ch/fr/custom", "POST"],
      ["https://swiss3design.ch/mcp", "POST"],
    ] as const) {
      const res = await call(url, method);
      expect([301, 308], `${method} ${url}`).not.toContain(res.status);
    }
  });

  it("http → https, et www.kreya.ch → kreya.ch", () => {
    const http = call("http://kreya.ch/fr");
    expect(http.status).toBe(308);
    expect(http.headers.get("location")).toBe("https://kreya.ch/fr");
    const www = call("https://www.kreya.ch/fr/studio");
    expect(www.status).toBe(301);
    expect(www.headers.get("location")).toBe("https://kreya.ch/fr/studio");
  });
});

describe("expéditeur des e-mails", () => {
  it("garde l'adresse en production, change seulement le domaine en preview", () => {
    expect(senderAddress("Kreya <shop@kreya.ch>", undefined)).toBe(
      "Kreya <shop@kreya.ch>",
    );
    expect(
      senderAddress("Kreya Preview <shop@kreya.ch>", "swiss3design.ch"),
    ).toBe("Kreya Preview <shop@swiss3design.ch>");
  });
});
