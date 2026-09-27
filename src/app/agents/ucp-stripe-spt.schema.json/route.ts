import { UCP_HANDLER_SCHEMA_PATH } from "@/lib/commerce/ucp-protocol";
import { SITE_URL } from "@/lib/seo";

// Schéma JSON de l'instrument (et de la config) du handler UCP maison
// `ch.swiss3design.stripe_spt`.
export const dynamic = "force-static";

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${SITE_URL}${UCP_HANDLER_SCHEMA_PATH}`,
  title: "Swiss3Design Stripe Shared Payment Token instrument",
  type: "object",
  required: ["id", "handler_id", "type", "credential"],
  properties: {
    id: { type: "string" },
    handler_id: { type: "string", const: "stripe_spt" },
    type: { type: "string", const: "card" },
    credential: {
      type: "object",
      required: ["type", "token"],
      properties: {
        type: { type: "string", const: "stripe_shared_payment_token" },
        token: { type: "string", pattern: "^spt_[A-Za-z0-9_]+$" },
      },
    },
  },
  $defs: {
    config: {
      type: "object",
      required: ["psp", "merchant_id", "network_id", "environment"],
      properties: {
        psp: { const: "stripe" },
        merchant_id: { type: "string", pattern: "^acct_" },
        network_id: { type: "string", pattern: "^profile_" },
        environment: { enum: ["production", "sandbox"] },
        credential_type: { const: "stripe_shared_payment_token" },
      },
    },
  },
};

export function GET() {
  return new Response(JSON.stringify(schema, null, 2), {
    headers: {
      "Content-Type": "application/schema+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
