import type { Locale } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { getShippingSettings } from "@/lib/shipping-settings";
import { FREE_SHIPPING_OVER_CENTS, SHIPPING_CENTS } from "@/lib/shipping";
import { price } from "./catalog";
import { STORE } from "./config";

// Faits vérifiables de la boutique, pour un agent : livraison, retours,
// paiement, contact, sur-mesure. Mêmes chiffres que /llms.txt et que le
// checkout (frais de port lus en base, jamais recopiés à la main).

export async function getStoreInfo(locale: Locale) {
  const shipping = await getShippingSettings().catch(() => ({
    shippingCents: SHIPPING_CENTS,
    freeOverCents: FREE_SHIPPING_OVER_CENTS,
  }));
  const page = (path: string) => `${SITE_URL}/${locale}${path}`;
  return {
    name: STORE.name,
    url: `${SITE_URL}/${locale}`,
    description: STORE.description,
    contact: {
      email: STORE.email,
      form: page("/contact"),
      responseTime: "within 48 hours",
    },
    location: "Gland (VD), Switzerland — workshops in Gland and Pully",
    currency: STORE.currency,
    shipping: {
      countries: ["CH"],
      carrier: "Swiss Post",
      flatRate: price(shipping.shippingCents),
      freeFrom: price(shipping.freeOverCents),
      inStockDispatch: "1–3 working days",
      madeToOrderDispatch:
        "after the production time shown on each product (productionDays)",
      tracking: "tracking number sent by email",
      policy: page("/legal/shipping"),
    },
    returns: {
      catalogueItems:
        "within 14 days of receipt if unused and in original condition; return shipping paid by the customer",
      customPrints: "excluded, except for manufacturing defects",
      warranty: "2-year Swiss statutory warranty",
      policy: page("/legal/shipping"),
    },
    payment: {
      methods: ["TWINT", "Visa", "Mastercard", "Google Pay"],
      processor: "Stripe",
      checkout: page("/checkout"),
    },
    customPrinting: {
      description:
        "Custom 3D printing from your own file or idea, with a personalised quote within 48 hours.",
      acceptedFiles: ["STL", "3MF", "OBJ", "STEP"],
      request: page("/custom"),
    },
    materials:
      "mainly PLA (softens around 50–60 °C); PETG and other materials on request; up to 4 filament colours in one piece",
    legal: {
      terms: page("/legal/terms"),
      privacy: page("/legal/privacy"),
      prevailingLanguage: "French",
    },
  };
}

export type StoreInfo = Awaited<ReturnType<typeof getStoreInfo>>;
