import { getProducts } from "@/db/queries";
import { formatChf } from "@/lib/format";
import { SITE_URL } from "@/lib/seo";
import { getShippingSettings } from "@/lib/shipping-settings";
import { FREE_SHIPPING_OVER_CENTS, SHIPPING_CENTS } from "@/lib/shipping";

// /llms.txt (convention llmstxt.org) : résumé Markdown du site destiné aux
// assistants IA et agents — qui nous sommes, les faits vérifiables (livraison,
// retours, paiement, matières) et les liens utiles, catalogue compris. Généré
// depuis la base pour que prix et frais de port ne soient jamais périmés.
// En anglais : langue pivot des modèles ; les versions fr/de/it sont listées.
export const dynamic = "force-dynamic";

const PAGES = {
  shop: "/shop",
  studio: "/studio",
  custom: "/custom",
  about: "/a-propos",
  contact: "/contact",
  shipping: "/legal/shipping",
  terms: "/legal/terms",
  privacy: "/legal/privacy",
} as const;

const url = (path: string, locale = "en") => `${SITE_URL}/${locale}${path}`;

export async function GET() {
  // Base indisponible → le fichier reste servi (200), sans la liste produits
  // et avec les frais de port par défaut : un 5xx ici fait échouer l'audit
  // « agentic browsing » de Lighthouse, alors qu'un résumé partiel reste utile.
  const [products, shipping] = await Promise.all([
    getProducts("en").catch(() => []),
    getShippingSettings().catch(() => ({
      shippingCents: SHIPPING_CENTS,
      freeOverCents: FREE_SHIPPING_OVER_CENTS,
    })),
  ]);
  const chf = (cents: number) => formatChf(cents, "en");

  const productLines = products.map((p) => {
    const sale =
      p.stock != null && p.stock <= 0
        ? "currently out of stock"
        : p.saleType === "on_demand"
          ? `printed to order${p.productionDays ? ` in ${p.productionDays} days` : ""}`
          : "in stock";
    return `- [${p.name}](${url(`/products/${p.slug}`)}): ${chf(p.priceCents)}, ${p.material}${p.multicolor ? ", multicolour" : ""}, ${sale}`;
  });

  const body = `# Swiss3Design

> Swiss online store for 3D-printed design objects in up to 4 colours in a single piece, made in two workshops in the Lake Geneva region (Gland and Pully, canton of Vaud) and shipped only within Switzerland. Prices in CHF. Also offers custom 3D printing on quote from your own file or idea.

## Key facts

- Website: ${SITE_URL} — French (default), German, Italian and English versions under /fr, /de, /it and /en.
- Company: Swiss3Design, Gland (VD), Switzerland. Contact: contact@swiss3design.ch (reply within 48 hours).
- Machines: Bambu Lab P1S with AMS 2 Pro (Gland) and Creality K2 with CFS (Pully) — up to 4 filament colours combined in one print, no painting or assembly.
- Materials: mainly PLA (softens around 50–60 °C); PETG and other materials on request.
- Shipping: Switzerland only, with Swiss Post. Flat rate ${chf(shipping.shippingCents)}, free from ${chf(shipping.freeOverCents)}. In-stock items leave within 1–3 working days; printed-to-order items after the production time shown on the product page. Tracking number by email.
- Returns: catalogue items within 14 days of receipt if unused and in original condition; return shipping paid by the customer. Custom prints are excluded except for manufacturing defects. 2-year Swiss statutory warranty.
- Payment: TWINT, Visa, Mastercard and Google Pay, processed by Stripe.
- Custom printing: upload an STL, 3MF, OBJ or STEP file (or describe the idea) and receive a personalised quote within 48 hours.

## Catalogue

- [Full catalogue](${url(PAGES.shop)}): every product, printed to order or ready to ship
${productLines.join("\n")}

## Studio

- [Studio](${url(PAGES.studio)}): four original objects designed by the workshop, adjustable in 3D and sent for a quote. Pick the shape, the pattern, up to four colors (filament changes at set heights) and, for cards, coasters and name tags, your own text. Every figure on the page (dimensions, grams, print time, printability) is computed; the workshop reviews every request and answers within 48 hours with a firm price. Nothing is paid in the Studio.
- [Lavaux vase](${url("/studio/lavaux")}): a vase with five profiles, five patterns and up to four colors
- [Cartouche business card](${url("/studio/cartouche")}): 85 × 55 mm, embossed or engraved text, two colors
- [Relief coaster](${url("/studio/relief")}): a 100 mm coaster shaped like a layered mountain range, with your name on the summit
- [Borne name tag](${url("/studio/borne")}): a two-color name tag with your text
- Configuration links carry only the settings (`#c=v1.…` fragment), never personal text. Agents can build one with the WebMCP tool `studio_configure`.

## Services

- [Custom 3D printing quote](${url(PAGES.custom)}): file upload (STL, 3MF, OBJ, STEP), material and colour choice, quote within 48 hours

## For AI agents

- [Agent guide](${SITE_URL}/agents.md): MCP, A2A and REST endpoints, customer-account access with consent, and how to buy
- Buying as an agent: machine payment (MPP) at ${SITE_URL}/api/v1/purchases, ACP checkout (${SITE_URL}/.well-known/acp.json) and UCP checkout (${SITE_URL}/.well-known/ucp), paid with a Stripe Shared Payment Token

## About

- [About us and FAQ](${url(PAGES.about)}): workshops, machines, process, materials, frequently asked questions
- [Contact](${url(PAGES.contact)}): contact form and email

## Policies

- [Shipping and returns](${url(PAGES.shipping)})
- [Terms and conditions of sale](${url(PAGES.terms)}): the French version prevails
- [Privacy policy](${url(PAGES.privacy)}): Swiss Federal Act on Data Protection (FADP)

## Other languages

- Français : ${url("", "fr")} — [catalogue](${url(PAGES.shop, "fr")}), [sur mesure](${url(PAGES.custom, "fr")}), [à propos](${url(PAGES.about, "fr")})
- Deutsch: ${url("", "de")} — [Katalog](${url(PAGES.shop, "de")}), [Massanfertigung](${url(PAGES.custom, "de")}), [Über uns](${url(PAGES.about, "de")})
- Italiano: ${url("", "it")} — [catalogo](${url(PAGES.shop, "it")}), [su misura](${url(PAGES.custom, "it")}), [chi siamo](${url(PAGES.about, "it")})
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      // Fichier pour agents, pas une page de résultats : hors index Google.
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
