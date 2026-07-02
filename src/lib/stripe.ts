import Stripe from "stripe";

// Client HTTP fetch + WebCrypto : requis sur Cloudflare Workers
export function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();

// Crée un PaymentIntent en appliquant, si fournie, une « payment method
// configuration » du dashboard (pmc_…) qui pilote les moyens de paiement
// proposés par le Payment Element. Si Stripe refuse cette configuration
// (id invalide, config d'un autre mode live/test, config gérée par un
// tiers…), on retombe silencieusement sur la configuration par défaut du
// compte : un mauvais réglage ne doit JAMAIS casser le checkout.
export async function createPaymentIntent(
  stripe: Stripe,
  params: Stripe.PaymentIntentCreateParams,
  paymentMethodConfiguration?: string,
): Promise<Stripe.PaymentIntent> {
  if (paymentMethodConfiguration) {
    try {
      return await stripe.paymentIntents.create({
        ...params,
        payment_method_configuration: paymentMethodConfiguration,
      });
    } catch (err) {
      console.error("payment_method_configuration rejetée, repli défaut", err);
    }
  }
  return stripe.paymentIntents.create(params);
}
