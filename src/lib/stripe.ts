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
): Promise<Stripe.Checkout.Session> {
  if (paymentMethodConfiguration) {
    try {
      return await stripe.checkout.sessions.create({
        ...params,
        payment_method_configuration: paymentMethodConfiguration,
      });
    } catch (err) {
      console.error("payment_method_configuration rejetée, repli défaut", err);
    }
  }
  return stripe.checkout.sessions.create(params);
}
