import Stripe from "stripe";

// Client HTTP fetch + WebCrypto : requis sur Cloudflare Workers
export function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();

// Crée une Checkout Session (ui_mode "elements" — Payment Element monté dans
// notre propre UI, pas la page hébergée par Stripe) en appliquant, si fournie,
// une « payment method configuration » du dashboard (pmc_…) qui pilote les
// moyens de paiement proposés. Si Stripe refuse cette configuration (id
// invalide, config d'un autre mode live/test, config gérée par un tiers…),
// on retombe silencieusement sur la configuration par défaut du compte : un
// mauvais réglage ne doit JAMAIS casser le checkout.
export async function createCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  paymentMethodConfiguration?: string,
  idempotencyKey?: string,
): Promise<Stripe.Checkout.Session> {
  if (paymentMethodConfiguration) {
    try {
      return await stripe.checkout.sessions.create(
        {
          ...params,
          payment_method_configuration: paymentMethodConfiguration,
        },
        { idempotencyKey },
      );
    } catch (err) {
      if (
        !(err instanceof Stripe.errors.StripeInvalidRequestError) ||
        err.param !== "payment_method_configuration"
      )
        throw err;
      console.error("[Stripe] configuration des moyens de paiement rejetée");
    }
  }
  return stripe.checkout.sessions.create(params, {
    idempotencyKey: idempotencyKey ? idempotencyKey + ":default" : undefined,
  });
}
