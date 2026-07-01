import { describe, it, expect } from "vitest";
import { describeUserAgent } from "./user-agent";

describe("describeUserAgent", () => {
  it("détecte Chrome sur Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(describeUserAgent(ua)).toEqual({ browser: "Chrome", os: "Windows" });
  });

  it("détecte Safari sur iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
    expect(describeUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS" });
  });

  it("priorise Edge avant Chrome (UA Edge contient aussi Chrome/)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(describeUserAgent(ua).browser).toBe("Edge");
  });

  it("renvoie null pour une valeur absente", () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
    expect(describeUserAgent(undefined)).toEqual({ browser: null, os: null });
  });
});
