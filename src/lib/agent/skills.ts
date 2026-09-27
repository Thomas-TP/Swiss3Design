import { PATHS, STORE, abs } from "./config";

// Skills pour agents (Agent Skills Discovery RFC v0.2.0) : un SKILL.md par
// tâche courante, avec frontmatter name/description. Le contenu est ici (et
// non dans public/) pour que l'index calcule l'empreinte SHA-256 exacte du
// fichier servi — un digest recopié à la main finirait par mentir.

export interface Skill {
  name: string;
  description: string;
  body: string;
}

const MCP = abs(PATHS.mcp);
const API = abs(PATHS.api);

export const SKILLS: Skill[] = [
  {
    name: "shop-swiss3design",
    description:
      "Find and buy 3D-printed design objects on swiss3design.ch: search the catalogue, compare prices in CHF, check availability and hand the customer a ready-to-pay cart link.",
    body: `# Shop on Swiss3Design

Swiss3Design (${STORE.url}) sells multicolour 3D-printed design objects made in Switzerland. Prices are in CHF; shipping is within Switzerland only.

## Tools

Use the MCP server at \`${MCP}\` (Streamable HTTP, no authentication) or the REST API at \`${API}\` (OpenAPI: ${abs(PATHS.openapi)}).

1. \`search_products\` (\`GET ${API}/products?query=vase&max_price_chf=50&language=en\`) — find products. Check \`availability\`: \`in_stock\`, \`made_to_order\` (see \`productionDays\`) or \`out_of_stock\`.
2. \`get_product\` (\`GET ${API}/products/{slug}\`) — details, \`colorOptions\` and \`variants\`.
3. \`build_cart_link\` (\`POST ${API}/cart-links\`) — send \`{"items":[{"slug":"…","quantity":1,"color":"…"}]}\`. A colour is required when the product has \`colorOptions\`, a variant when it has \`variants\`. Give the returned \`cartUrl\` to the customer: it fills their cart on swiss3design.ch, where they pay with TWINT, Visa, Mastercard or Google Pay.

## Rules

- Never invent prices or stock: always read them from the tools.
- Shipping: flat rate, free above a threshold — call \`get_store_info\` for the current amounts.
- Only addresses in Switzerland can be delivered.
`,
  },
  {
    name: "track-swiss3design-order",
    description:
      "Check the status and Swiss Post tracking link of a Swiss3Design order from its order number and the email address used to place it.",
    body: `# Track a Swiss3Design order

Ask the customer for their **order number** (in the confirmation email, e.g. \`S3D-1042\`) and the **email address** used for the order.

- MCP: call \`track_order\` on \`${MCP}\` with \`{"order_number":"…","email":"…"}\`.
- REST: \`POST ${API}/orders/track\` with the same JSON body.

The response gives the status (\`paid\`, \`in_production\`, \`shipped\`, \`delivered\`…), the items, the totals in CHF and, once shipped, a Swiss Post \`trackingUrl\`. A 404 means the number and email do not match — ask the customer to check both. Lookups are rate-limited.

Customers can also follow their order on ${STORE.url}/en/track.
`,
  },
  {
    name: "custom-3d-print-quote",
    description:
      "Help a customer request a custom 3D print from Swiss3Design: accepted file formats, materials, colours and how to get a quote within 48 hours.",
    body: `# Request a custom 3D print

Swiss3Design prints custom parts and objects from the customer's own file or idea, in up to 4 colours in one piece.

- Accepted files: STL, 3MF, OBJ, STEP (or a description of the idea).
- Materials: mainly PLA; PETG and others on request.
- The customer submits the request on ${STORE.url}/en/custom (file upload, material, colour, quantity) and receives a personalised quote within 48 hours by email, then pays online.
- Questions: ${STORE.email}.

Call \`get_store_info\` (MCP \`${MCP}\` or \`GET ${API}/store\`) for up-to-date details.
`,
  },
];

export function skillFile(skill: Skill): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}`;
}

export const skillPath = (name: string) =>
  `/.well-known/agent-skills/${name}/SKILL.md`;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function skillsIndex() {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: await Promise.all(
      SKILLS.map(async (skill) => ({
        name: skill.name,
        type: "skill-md",
        description: skill.description,
        url: skillPath(skill.name),
        digest: `sha256:${await sha256Hex(skillFile(skill))}`,
      })),
    ),
  };
}
