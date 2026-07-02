import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/*
 * Encaissement Samsung Pay (Web Checkout) : le service partenaire Samsung est
 * configuré avec Stripe comme passerelle — le credential retourné par
 * loadPaymentSheet() porte alors une référence de paiement Stripe (token) que
 * l'on attache au PaymentIntent DÉJÀ créé par /api/checkout pour cette
 * commande. Montant, devise et commande restent donc 100 % côté serveur ; ce
 * endpoint n'accepte du client qu'un numéro de commande et le credential.
 *
 * La finalisation (stock, e-mails, statut) reste portée par le webhook Stripe
 * et la page de succès — même chemin idempotent que le Payment Element.
 */

const bodySchema = z.object({
  orderNumber: z.string().min(6).max(40),
  credential: z.unknown(),
});

// Extrait la référence Stripe du credential Samsung, quelle que soit la forme
// exacte retenue par la passerelle (documentée uniquement côté portail
// partenaire) : token à la racine, ou dans 3DS.data quand le PG déchiffre.
function extractStripeReference(credential: unknown): string | null {
  if (!credential || typeof credential !== "object") return null;
  const c = credential as Record<string, unknown>;
  const candidates: unknown[] = [
    c["token"],
    c["reference"],
    (c["3DS"] as Record<string, unknown> | undefined)?.["data"],
  ];
  for (const v of candidates) {
    if (typeof v === "string" && /^(tok|pm|src)_[A-Za-z0-9]+$/.test(v)) {
      return v;
    }
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await rateLimit(request, "samsung-pay", { limit: 20, windowS: 600 }))) {
    return tooManyRequests();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { orderNumber, credential } = parsed.data;

  const db = await getDb();
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      stripePaymentIntentId: orders.stripePaymentIntentId,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order?.stripePaymentIntentId) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return Response.json({ error: "not_payable" }, { status: 409 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
  // Déjà payé (double clic, relance) : idempotent, on renvoie l'état
  if (pi.status === "succeeded" || pi.status === "processing") {
    return Response.json({ status: pi.status, paymentIntentId: pi.id });
  }

  const reference = extractStripeReference(credential);
  if (!reference) {
    // Credential dans un format non géré (ex. JWE 3DS brut nécessitant les
    // clés CSR) : loggé pour calibrer l'intégration lors des tests réels.
    console.error(
      "samsung-pay: credential sans référence Stripe reconnue",
      JSON.stringify(credential).slice(0, 400),
    );
    return Response.json({ error: "unsupported_credential" }, { status: 422 });
  }

  try {
    const confirmed = await stripe.paymentIntents.confirm(
      pi.id,
      reference.startsWith("pm_")
        ? { payment_method: reference }
        : {
            payment_method_data: {
              type: "card",
              // Référence émise par la passerelle pour le compte du marchand
              card: { token: reference },
            } as never,
          },
    );
    return Response.json({
      status: confirmed.status,
      paymentIntentId: confirmed.id,
      // Nécessaire au client uniquement si la banque exige une étape 3DS
      ...(confirmed.status === "requires_action"
        ? { clientSecret: confirmed.client_secret }
        : {}),
    });
  } catch (err) {
    console.error("samsung-pay: confirmation Stripe refusée", err);
    return Response.json({ error: "charge_failed" }, { status: 402 });
  }
}
