import { describe, it, expect } from "vitest";
import { groupByDevice, type SessionLike } from "./session-groups";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

function session(overrides: Partial<SessionLike> & { token: string }): SessionLike {
  return {
    userAgent: CHROME_WINDOWS,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupByDevice", () => {
  it("regroupe plusieurs sessions du même navigateur+OS en un seul appareil", () => {
    const sessions = [
      session({ token: "a", createdAt: "2026-01-01T00:00:00Z" }),
      session({ token: "b", createdAt: "2026-01-03T00:00:00Z" }),
      session({ token: "c", createdAt: "2026-01-02T00:00:00Z" }),
    ];
    const groups = groupByDevice(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions).toHaveLength(3);
    // La session la plus récente (b, 01-03) est la représentante du groupe
    expect(groups[0].sessions[0].token).toBe("b");
    expect(groups[0].lastActive.toISOString()).toBe("2026-01-03T00:00:00.000Z");
  });

  it("sépare les appareils réellement différents", () => {
    const sessions = [
      session({ token: "a", userAgent: CHROME_WINDOWS }),
      session({ token: "b", userAgent: SAFARI_IOS }),
    ];
    const groups = groupByDevice(sessions);
    expect(groups).toHaveLength(2);
  });

  it("marque le groupe contenant le jeton courant comme isCurrent", () => {
    const sessions = [
      session({ token: "a", userAgent: CHROME_WINDOWS }),
      session({ token: "b", userAgent: SAFARI_IOS }),
    ];
    const groups = groupByDevice(sessions, "a");
    const current = groups.find((g) => g.sessions.some((s) => s.token === "a"));
    const other = groups.find((g) => g.sessions.some((s) => s.token === "b"));
    expect(current?.isCurrent).toBe(true);
    expect(other?.isCurrent).toBe(false);
  });

  it("trie les groupes par activité la plus récente", () => {
    const sessions = [
      session({ token: "old", userAgent: CHROME_WINDOWS, createdAt: "2026-01-01T00:00:00Z" }),
      session({ token: "new", userAgent: SAFARI_IOS, createdAt: "2026-01-05T00:00:00Z" }),
    ];
    const groups = groupByDevice(sessions);
    expect(groups[0].sessions[0].token).toBe("new");
    expect(groups[1].sessions[0].token).toBe("old");
  });

  it("utilise updatedAt plutôt que createdAt pour la dernière activité si présent", () => {
    const sessions = [
      session({
        token: "a",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      }),
    ];
    const groups = groupByDevice(sessions);
    expect(groups[0].lastActive.toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });

  it("regroupe aussi les appareils sans user-agent exploitable", () => {
    const sessions = [
      session({ token: "a", userAgent: null }),
      session({ token: "b", userAgent: undefined }),
    ];
    const groups = groupByDevice(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].browser).toBeNull();
    expect(groups[0].os).toBeNull();
  });
});
