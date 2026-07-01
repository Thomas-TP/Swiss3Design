// Un même appareil physique peut avoir plusieurs sessions Better Auth valides
// (reconnexions successives sans déconnexion explicite) — il n'existe aucun
// identifiant d'appareil, seulement user-agent + IP par session. On regroupe
// donc par signature navigateur+OS pour l'écran « Sessions & appareils »,
// plutôt que d'afficher N lignes identiques (cf. Google Account : « il est
// normal d'avoir plusieurs sessions sur un même appareil »).

import { describeUserAgent } from "./user-agent";

export interface SessionLike {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface DeviceGroup<T extends SessionLike> {
  key: string;
  browser: string | null;
  os: string | null;
  ipAddress?: string | null;
  lastActive: Date;
  sessions: T[];
  isCurrent: boolean;
}

function lastActivity(s: SessionLike): number {
  return new Date(s.updatedAt ?? s.createdAt).getTime();
}

export function groupByDevice<T extends SessionLike>(
  sessions: T[],
  currentToken?: string,
): DeviceGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const s of sessions) {
    const { browser, os } = describeUserAgent(s.userAgent);
    const key = `${browser ?? "?"}|${os ?? "?"}`;
    buckets.set(key, [...(buckets.get(key) ?? []), s]);
  }

  const groups = Array.from(buckets.entries()).map(([key, list]) => {
    const sorted = [...list].sort((a, b) => lastActivity(b) - lastActivity(a));
    const rep = sorted[0];
    const { browser, os } = describeUserAgent(rep.userAgent);
    return {
      key,
      browser,
      os,
      ipAddress: rep.ipAddress,
      lastActive: new Date(rep.updatedAt ?? rep.createdAt),
      sessions: sorted,
      isCurrent: list.some((s) => s.token === currentToken),
    };
  });

  return groups.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
}
