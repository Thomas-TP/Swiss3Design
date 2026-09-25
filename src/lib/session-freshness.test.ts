import { describe, expect, it } from "vitest";
import {
  isSessionFresh,
  SENSITIVE_SESSION_MAX_AGE_MS,
} from "./session-freshness";

describe("isSessionFresh", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");

  it("accepte une session dans la fenêtre sensible, borne comprise", () => {
    expect(isSessionFresh(now - 29 * 60_000, now)).toBe(true);
    expect(isSessionFresh(now - SENSITIVE_SESSION_MAX_AGE_MS, now)).toBe(true);
  });

  it("refuse une session plus ancienne que trente minutes", () => {
    expect(isSessionFresh(now - SENSITIVE_SESSION_MAX_AGE_MS - 1, now)).toBe(
      false,
    );
  });

  it("refuse une date de création illisible", () => {
    expect(isSessionFresh("date-invalide", now)).toBe(false);
  });

  it("refuse une date de création dans le futur", () => {
    expect(isSessionFresh(now + 1, now)).toBe(false);
  });
});
