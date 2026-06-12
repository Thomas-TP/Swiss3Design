import { getCloudflareContext } from "@opennextjs/cloudflare";

// Limiteur de débit à fenêtre fixe sur KV, par IP et par route.
// KV est éventuellement cohérent : la limite est approximative, ce qui
// suffit largement contre l'abus (spam d'e-mails, remplissage du bucket R2).

export async function rateLimit(
  request: Request,
  route: string,
  { limit, windowS }: { limit: number; windowS: number },
): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const ip = request.headers.get("cf-connecting-ip");
  // En local (pas derrière Cloudflare), pas d'IP fiable : on ne limite pas
  if (!ip) return true;

  const window = Math.floor(Date.now() / (windowS * 1000));
  const key = `rl:${route}:${ip}:${window}`;

  const count = Number((await env.KV.get(key)) ?? 0);
  if (count >= limit) return false;

  // expirationTtl minimal accepté par KV : 60 s
  await env.KV.put(key, String(count + 1), {
    expirationTtl: Math.max(windowS, 60),
  });
  return true;
}

export const tooManyRequests = () =>
  Response.json({ error: "too_many_requests" }, { status: 429 });
