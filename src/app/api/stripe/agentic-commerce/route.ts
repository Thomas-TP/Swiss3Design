import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { loadSellableSkus, skuIndex } from "@/lib/commerce/catalog";
import {
  customizeShipping,
  decideFinalize,
  priceAvailability,
  type CustomizeCheckoutData,
  type FinalizeCheckoutData,
} from "@/lib/commerce/acs";
import { getShippingSettings } from "@/lib/shipping-settings";
import { getStripe, stripeCryptoProvider } from "@/lib/stripe";

// Hooks Stripe Agentic Commerce (« endpoint d'intégration » du dashboard) :
// validation de commande avant paiement, options de livraison, prix et stock
// en temps réel. Signés comme un webhook, avec le secret de la destination
// « Agentic Commerce Extension » (STRIPE_ACS_HOOK_SECRET). Réponse sous 4 s,
// sinon Stripe refuse le paiement (validation) ou se rabat sur le flux.
// Sans effet de bord : une requête rejouée reçoit la même réponse.

interface HookRequest {
  type?: string;
  id?: string;
  livemode?: boolean;
  context?: string;
  data?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.STRIPE_ACS_HOOK_SECRET;
  if (!secret) return new Response("Hook not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signature) return new Response("Missing signature", { status: 400 });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  try {
    if (!stripe.webhooks.signature) throw new Error("signature_unavailable");
    await stripe.webhooks.signature.verifyHeaderAsync(
      payload,
      signature,
      secret,
      undefined,
      stripeCryptoProvider,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  let hook: HookRequest;
  try {
    hook = JSON.parse(payload) as HookRequest;
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  // Une clé live ne répond qu'aux requêtes live, une clé test qu'au test.
  const liveKey = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY);
  if (typeof hook.livemode === "boolean" && hook.livemode !== liveKey)
    return new Response("Mode mismatch", { status: 400 });

  const db = await getDb();
  const [skus, rule] = await Promise.all([
    loadSellableSkus(db).then(skuIndex),
    getShippingSettings(),
  ]);

  switch (hook.type) {
    case "v1.delegated_checkout.finalize_checkout": {
      const decision = decideFinalize(
        (hook.data ?? {}) as unknown as FinalizeCheckoutData,
        skus,
        rule,
      );
      if (!decision.approved)
        console.info("[agentic commerce] commande refusée", {
          id: hook.id,
          reason: decision.reason,
        });
      return Response.json({
        manual_approval_details: decision.approved
          ? { type: "approved" }
          : { type: "declined", declined: { reason: decision.reason } },
        // Propagé dans les métadonnées de la Checkout Session.
        metadata: { validated_by: "swiss3design" },
      });
    }
    case "v1.delegated_checkout.customize_checkout":
      return Response.json(
        customizeShipping(
          (hook.data ?? {}) as unknown as CustomizeCheckoutData,
          skus,
          rule,
        ),
      );
    case "delegated_commerce.product_price_availability": {
      const skuId = String(
        (hook.data as { sku_id?: unknown } | undefined)?.sku_id ?? "",
      );
      return Response.json(priceAvailability(skuId, hook.context ?? "", skus));
    }
    default:
      return Response.json({ error: "unsupported_hook" }, { status: 400 });
  }
}
