import {
  UCP_HANDLER_KEY,
  UCP_HANDLER_SCHEMA_PATH,
  UCP_HANDLER_VERSION,
  UCP_VERSION,
} from "@/lib/commerce/ucp-protocol";
import { SITE_URL } from "@/lib/seo";

// Spécification publique du handler de paiement UCP maison (référencée par
// le profil /.well-known/ucp) : comment une plateforme paie un checkout
// Swiss3Design avec un Shared Payment Token Stripe.
export const dynamic = "force-static";

const doc = `# Payment handler \`${UCP_HANDLER_KEY}\` — Stripe Shared Payment Token

Version ${UCP_HANDLER_VERSION} · Business: Swiss3Design (${SITE_URL}) · UCP ${UCP_VERSION}

## Purpose

Lets a UCP platform pay a Swiss3Design checkout with a Stripe **Shared Payment
Token** (SPT): a single-use, amount-limited credential scoped to the business's
Stripe profile. Card data never reaches the business.

## Configuration (business profile, \`payment_handlers\`)

| Field | Meaning |
| --- | --- |
| \`psp\` | Always \`stripe\` |
| \`merchant_id\` | Stripe account of the business |
| \`network_id\` | Stripe profile (network business profile) the SPT must be issued to |
| \`environment\` | \`production\` or \`sandbox\` |
| \`credential_type\` | Always \`stripe_shared_payment_token\` |

## Acquiring the credential

Issue an SPT for \`network_id\`, in \`chf\`, with \`usage_limits.max_amount\`
at least the checkout \`total\` (minor units), for example:

- **Link agent wallet**: a spend request with \`credential_type: shared_payment_token\` and the \`network_id\`.
- **Your own Stripe account** (agent platforms, Issuing): \`POST /v1/shared_payment/issued_tokens\` with \`seller_details[network_business_profile]\` set to \`network_id\`.

## Submitting

\`POST /checkout-sessions/{id}/complete\`:

\`\`\`json
{
  "payment": {
    "instruments": [
      {
        "id": "inst_1",
        "handler_id": "stripe_spt",
        "type": "card",
        "credential": { "type": "stripe_shared_payment_token", "token": "spt_…" }
      }
    ]
  }
}
\`\`\`

Instrument schema: ${SITE_URL}${UCP_HANDLER_SCHEMA_PATH}

## Processing

The business confirms a Stripe PaymentIntent with the SPT for exactly the
checkout total in CHF. On success the checkout becomes \`completed\` with an
\`order\`; a declined token returns \`messages[]\` with \`payment_declined\`
(issue a new SPT and complete again). Shipping within Switzerland only; terms:
${SITE_URL}/legal/terms.
`;

export function GET() {
  return new Response(doc, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
