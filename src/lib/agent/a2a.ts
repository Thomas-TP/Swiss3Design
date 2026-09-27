import type { Locale } from "@/i18n/routing";
import { searchProducts, toLocale, type AgentProductSummary } from "./catalog";
import { AGENT_SURFACE_VERSION, PATHS, STORE, abs } from "./config";
import { RpcError } from "./jsonrpc";
import {
  TOOL_NAMES,
  ToolError,
  isToolName,
  runTool,
  toolDefinitions,
  type ToolContext,
  type ToolName,
} from "./tools";

// Agent A2A (Agent2Agent) de la boutique : un autre agent lui écrit en texte
// libre (« un vase multicolore à moins de 50 CHF », « où en est la commande
// S3D-1042, jean@exemple.ch ») ou appelle directement une compétence via une
// partie `data` ({ "skill": "search_products", … }). Réponses déterministes,
// construites sur les mêmes outils que le serveur MCP — aucun LLM côté
// serveur, donc rien d'inventé.

const A2A_ERRORS = {
  taskNotFound: -32001,
  taskNotCancelable: -32002,
  unsupportedOperation: -32004,
} as const;

interface IncomingPart {
  kind?: string;
  text?: unknown;
  data?: unknown;
}

interface IncomingMessage {
  messageId?: string;
  contextId?: string;
  parts?: IncomingPart[];
  metadata?: Record<string, unknown>;
}

const SKILL_EXAMPLES: Record<ToolName, string[]> = {
  search_products: [
    "Find a multicolour vase under 50 CHF",
    "Show me desk organisers",
  ],
  get_product: ['{"skill":"get_product","slug":"vase-spirale"}'],
  list_categories: ["Which product categories do you have?"],
  get_store_info: [
    "How much is shipping to Zurich?",
    "What is your return policy?",
  ],
  track_order: ["Where is my order S3D-1042? My email is jean@example.ch"],
  build_cart_link: [
    '{"skill":"build_cart_link","items":[{"slug":"vase-spirale","quantity":1,"color":"Rouge"}]}',
  ],
};

export function agentCard() {
  const url = abs(PATHS.a2a);
  return {
    protocolVersion: "0.3.0",
    name: "Swiss3Design Shop Assistant",
    description:
      "Shopping assistant of Swiss3Design, a Swiss store of multicolour 3D-printed design objects (CHF, shipping within Switzerland). Searches the catalogue, answers shipping/returns/payment questions, tracks orders and prepares ready-to-pay cart links.",
    version: AGENT_SURFACE_VERSION,
    provider: { organization: STORE.name, url: STORE.url },
    url,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [{ url, transport: "JSONRPC" }],
    // Champ A2A 1.0 (remplace url/preferredTransport) : les deux versions
    // de la spec sont servies par le même point d'entrée.
    supportedInterfaces: [
      { url, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
      { url, protocolBinding: "JSONRPC", protocolVersion: "0.3" },
    ],
    iconUrl: STORE.logo,
    documentationUrl: abs(PATHS.agentsDoc),
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: toolDefinitions().map((tool) => ({
      id: tool.name,
      name: tool.title,
      description: tool.description,
      tags: ["shopping", "3d-printing", "switzerland"],
      examples: SKILL_EXAMPLES[tool.name],
      inputModes: ["text/plain", "application/json"],
      outputModes: ["text/plain", "application/json"],
    })),
    supportsAuthenticatedExtendedCard: false,
  };
}

// ── Compréhension du message ────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "the a an and or of for to in on with without under below over less than more me my i im looking find show want need some any do you have is are what which " +
    "le la les un une des du de et ou pour avec sans sous moins plus que je cherche trouve montre veux voudrais besoin vous avez est sont quel quelle quels quelles " +
    "der die das ein eine und oder für mit ohne unter weniger mehr ich suche zeige möchte brauche haben ist sind welche " +
    "il lo gli una uno e o per con senza sotto meno più cerco mostra vorrei avete sono quale quali chf fr franc francs"
  ).split(" "),
);

const LANGUAGE_HINTS: Record<Locale, RegExp> = {
  fr: /\b(je|cherche|vous|livraison|commande|avec|pour|une|des)\b/i,
  de: /\b(ich|suche|versand|bestellung|mit|für|eine|haben)\b/i,
  it: /\b(cerco|spedizione|ordine|vorrei|avete|una|per)\b/i,
  en: /\b(the|find|shipping|order|looking|with|for)\b/i,
};

export function detectLanguage(text: string, hint?: unknown): Locale {
  if (typeof hint === "string") return toLocale(hint);
  for (const locale of ["fr", "de", "it"] as const)
    if (LANGUAGE_HINTS[locale].test(text)) return locale;
  return "en";
}

export function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  );
}

const ORDER_NUMBER = /\b[A-Z0-9]{2,6}-\d{3,}\b/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const STORE_INFO =
  /\b(ship|shipping|deliver|delivery|livraison|livrer|versand|lieferung|spedizione|consegna|return|retour|rueckgabe|reso|payment|paiement|zahlung|pagamento|twint|contact|kontakt|contatto|warranty|garantie|custom|sur mesure|devis|quote|angebot|preventivo|stl|3mf)\b/i;
const CATEGORIES = /\b(categor|catégor|kategor)/i;

export function routeText(text: string): {
  skill: ToolName;
  args: Record<string, unknown>;
} {
  const order = text.match(ORDER_NUMBER);
  const email = text.match(EMAIL);
  if (order && email)
    return {
      skill: "track_order",
      args: { order_number: order[0], email: email[0] },
    };
  if (STORE_INFO.test(text)) return { skill: "get_store_info", args: {} };
  if (CATEGORIES.test(text)) return { skill: "list_categories", args: {} };
  const price = text.match(/(\d+(?:[.,]\d+)?)\s*(?:chf|fr\.?|francs?)/i);
  return {
    skill: "search_products",
    args: {
      query: text,
      ...(price && { max_price_chf: Number(price[1].replace(",", ".")) }),
    },
  };
}

// Recherche tolérante : le texte libre d'un agent (« un vase rouge pour mon
// bureau ») ne tient pas dans un ILIKE unique ; on classe localement le
// catalogue (petit) par nombre de mots-clés trouvés.
async function searchByKeywords(
  text: string,
  locale: Locale,
  maxPriceChf?: number,
): Promise<{ products: AgentProductSummary[]; exact: boolean }> {
  const words = keywords(text);
  const all = await searchProducts({ locale, maxPriceChf, limit: 50 });
  const scored = all
    .map((p) => {
      const hay =
        `${p.name} ${p.description} ${p.material} ${p.colors.join(" ")} ${p.multicolor ? "multicolore multicolour multicolor mehrfarbig multicolore" : ""}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "");
      return { p, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  // Quand un produit couvre plusieurs mots-clés (« lampe » ET « multicolore »),
  // seuls les mieux classés répondent vraiment à la demande.
  const top = scored[0]?.score ?? 0;
  const best = top >= 2 ? scored.filter((s) => s.score === top) : scored;
  return best.length > 0
    ? { products: best.slice(0, 5).map((s) => s.p), exact: true }
    : { products: all.slice(0, 5), exact: false };
}

function summarize(skill: ToolName, data: unknown, exact = true): string {
  const d = data as Record<string, unknown>;
  switch (skill) {
    case "search_products": {
      const products = (d.products ?? []) as AgentProductSummary[];
      if (products.length === 0) return "No product matches this request.";
      const head = exact
        ? `Found ${products.length} product(s):`
        : "No exact match; here are some of our products:";
      return [
        head,
        ...products.map(
          (p) =>
            `- ${p.name} — CHF ${p.price.amount} — ${p.availability.replace(/_/g, " ")} — ${p.url}`,
        ),
      ].join("\n");
    }
    case "get_product":
      return `${d.name} — CHF ${(d.price as { amount: string }).amount} — ${String(d.availability).replace(/_/g, " ")} — ${d.url}`;
    case "list_categories":
      return (d.categories as { name: string; url: string }[])
        .map((c) => `- ${c.name}: ${c.url}`)
        .join("\n");
    case "get_store_info": {
      const s = d.shipping as {
        flatRate: { amount: string };
        freeFrom: { amount: string };
      };
      return `Shipping within Switzerland only (Swiss Post): CHF ${s.flatRate.amount}, free from CHF ${s.freeFrom.amount}. Returns within 14 days for catalogue items. Payment: TWINT, Visa, Mastercard, Google Pay. Custom 3D printing on quote at ${(d.customPrinting as { request: string }).request}. Contact: ${(d.contact as { email: string }).email}.`;
    }
    case "track_order":
      return `Order ${d.orderNumber}: ${d.status}${d.trackingUrl ? ` — tracking: ${d.trackingUrl}` : ""}.`;
    case "build_cart_link":
      return `Cart ready (estimated total CHF ${(d.estimatedTotal as { amount: string }).amount}): ${d.cartUrl}`;
  }
}

// ── Méthodes JSON-RPC ───────────────────────────────────────────────────────

function extract(message: IncomingMessage) {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  const data = parts
    .map((p) => p.data)
    .find((d): d is Record<string, unknown> => !!d && typeof d === "object");
  return { text, data };
}

async function answer(message: IncomingMessage, ctx: ToolContext) {
  const { text, data } = extract(message);
  const requestedSkill = data?.skill ?? data?.tool;
  if (isToolName(requestedSkill)) {
    const args = (data?.arguments as Record<string, unknown>) ?? {
      ...data,
      skill: undefined,
      tool: undefined,
    };
    const result = await runTool(requestedSkill, args, ctx);
    return {
      skill: requestedSkill,
      result,
      text: summarize(requestedSkill, result),
    };
  }
  if (!text)
    throw new ToolError(
      "invalid_arguments",
      `Send a text part, or a data part with "skill" (${TOOL_NAMES.join(", ")}).`,
    );
  const locale = detectLanguage(text, message.metadata?.language);
  const routed = routeText(text);
  if (routed.skill === "search_products") {
    const { products, exact } = await searchByKeywords(
      text,
      locale,
      routed.args.max_price_chf as number | undefined,
    );
    const result = { count: products.length, products };
    return {
      skill: routed.skill,
      result,
      text: summarize(routed.skill, result, exact),
    };
  }
  const result = await runTool(
    routed.skill,
    {
      ...routed.args,
      ...(routed.skill !== "track_order" && { language: locale }),
    },
    ctx,
  );
  return { skill: routed.skill, result, text: summarize(routed.skill, result) };
}

export function a2aDispatcher(ctx: ToolContext) {
  return async (method: string, params: unknown): Promise<unknown> => {
    const p = (params ?? {}) as { message?: IncomingMessage };
    switch (method) {
      case "message/send":
      case "SendMessage": {
        if (!p.message || typeof p.message !== "object")
          throw new RpcError(-32602, "params.message is required");
        const contextId = p.message.contextId ?? crypto.randomUUID();
        const messageId = crypto.randomUUID();
        let reply: { text: string; data: unknown };
        try {
          const out = await answer(p.message, ctx);
          reply = {
            text: out.text,
            data: { skill: out.skill, result: out.result },
          };
        } catch (error) {
          if (!(error instanceof ToolError)) throw error;
          reply = {
            text: error.message,
            data: { error: { code: error.code, message: error.message } },
          };
        }
        // A2A 1.0 (SendMessage) : réponse enveloppée, rôles en capitales,
        // parties sans discriminant « kind ». A2A 0.3 : Message à plat.
        return method === "SendMessage"
          ? {
              message: {
                messageId,
                contextId,
                role: "ROLE_AGENT",
                parts: [{ text: reply.text }, { data: reply.data }],
              },
            }
          : {
              kind: "message",
              messageId,
              contextId,
              role: "agent",
              parts: [
                { kind: "text", text: reply.text },
                { kind: "data", data: reply.data },
              ],
            };
      }
      case "tasks/get":
      case "GetTask":
        throw new RpcError(
          A2A_ERRORS.taskNotFound,
          "This agent answers with messages and keeps no tasks.",
        );
      case "tasks/cancel":
      case "CancelTask":
        throw new RpcError(A2A_ERRORS.taskNotCancelable, "No task to cancel.");
      case "message/stream":
      case "SendStreamingMessage":
      case "tasks/resubscribe":
      case "tasks/pushNotificationConfig/set":
      case "tasks/pushNotificationConfig/get":
      case "agent/getAuthenticatedExtendedCard":
        throw new RpcError(
          A2A_ERRORS.unsupportedOperation,
          `${method} is not supported by this agent.`,
        );
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
  };
}
