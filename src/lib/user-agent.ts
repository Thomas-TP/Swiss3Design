// Lecture indicative du user-agent d'une session (écran « Sessions & appareils »).
// Pas une détection robuste : juste assez pour afficher « Chrome sur Windows »
// plutôt qu'une chaîne user-agent brute illisible.

const OS_PATTERNS: [RegExp, string][] = [
  [/windows/i, "Windows"],
  [/iphone|ipad|ipod/i, "iOS"],
  [/mac os x/i, "macOS"],
  [/android/i, "Android"],
  [/linux/i, "Linux"],
];

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/edg\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/chrome\//i, "Chrome"],
  [/firefox\//i, "Firefox"],
  [/safari\//i, "Safari"],
];

export function describeUserAgent(ua: string | null | undefined): {
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { browser: null, os: null };
  const os = OS_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? null;
  const browser = BROWSER_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? null;
  return { browser, os };
}
