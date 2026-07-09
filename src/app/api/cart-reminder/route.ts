import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { abandonedCarts } from "@/db/schema";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const LOCALES = ["fr", "de", "it", "en"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface IncomingItem {
  name: string;
  quantity: number;
  priceCents: number;
}

// Enregistre une demande de relance de panier. Appelé UNIQUEMENT quand le
// client a coché le consentement (case décochée par défaut) — la présence de la
// requête vaut consentement explicite, horodaté (nLPD).
export async function POST(request: Request) {
  if (!(await rateLimit(request, "cart-reminder", { limit: 5, windowS: 60 }))) {
    return tooManyRequests();
  }

  const data = (await request.json().catch(() => null)) as {
    email?: string;
    items?: IncomingItem[];
    locale?: string;
  } | null;
  if (!data) return Response.json({ error: "invalid" }, { status: 400 });

  const email = String(data.email ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const items = (Array.isArray(data.items) ? data.items : [])
    .filter(
      (i) =>
        i &&
        typeof i.name === "string" &&
        Number.isFinite(i.quantity) &&
        Number.isFinite(i.priceCents),
    )
    .slice(0, 30)
    .map((i) => ({
      name: String(i.name).slice(0, 120),
      quantity: Math.max(1, Math.min(99, Math.floor(i.quantity))),
      priceCents: Math.max(0, Math.floor(i.priceCents)),
    }));
  if (items.length === 0) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  const subtotalCents = items.reduce(
    (s, i) => s + i.priceCents * i.quantity,
    0,
  );
  const locale = LOCALES.includes(String(data.locale))
    ? (String(data.locale) as "fr" | "de" | "it" | "en")
    : "fr";

  const db = await getDb();
  // Une seule relance en attente par e-mail : on remplace l'éventuelle
  // précédente non encore envoyée par l'état actuel du panier.
  await db
    .delete(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.email, email),
        isNull(abandonedCarts.reminderSentAt),
      ),
    );
  await db.insert(abandonedCarts).values({
    email,
    token: crypto.randomUUID(),
    itemsJson: JSON.stringify(items),
    subtotalCents,
    locale,
    consentAt: new Date(),
  });

  return Response.json({ ok: true });
}
