import Stripe from "stripe";

// Client HTTP fetch + WebCrypto : requis sur Cloudflare Workers
export function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
