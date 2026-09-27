import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { PUBLIC_CORS } from "@/lib/agent/config";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import {
  cancelSession,
  catalogContext,
  completeSession,
  evaluate,
  insertSession,
  isExpired,
  linkedOrder,
  loadSession,
  saveState,
  sessionItems,
  withRecipient,
  type SessionRow,
  type SessionState,
} from "./agent-checkout";
import { CheckoutError, sha256Hex } from "./checkout-core";
import {
  ACP_SUPPORTED_VERSIONS,
  ACP_VERSION,
  acpAddress,
  acpBuyer,
  acpComplete,
  acpCreate,
  acpError,
  acpLineRequests,
  acpSessionView,
  acpToken,
  acpUpdate,
} from "./acp-protocol";
import type { OrderLocale } from "./agent-orders";

// Service HTTP de l'API ACP (/api/acp/checkout_sessions…) : en-têtes du
// protocole (API-Version, Idempotency-Key obligatoire sur les POST, réponses
// rejouées à l'identique pendant 24 h), puis le moteur agent-checkout.ts.
// Pas de clé API : la boutique est ouverte à tout agent, c'est le paiement
// par jeton (et la validation de la commande) qui fait foi.

const CORS = {
  ...PUBLIC_CORS,
  "Access-Control-Allow-Headers": `${PUBLIC_CORS["Access-Control-Allow-Headers"]}, API-Version, Idempotency-Key, Request-Id, Signature, Timestamp`,
  "Access-Control-Expose-Headers": "API-Version, Idempotency-Key, Request-Id",
};

function reply(request: Request, body: unknown, status = 200) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "API-Version": ACP_VERSION,
    ...CORS,
  };
  const key = request.headers.get("Idempotency-Key");
  if (key) headers["Idempotency-Key"] = key.slice(0, 255);
  const requestId = request.headers.get("Request-Id");
  if (requestId) headers["Request-Id"] = requestId.slice(0, 255);
  return new Response(JSON.stringify(body), { status, headers });
}

export const acpPreflight = () =>
  new Response(null, { status: 204, headers: CORS });

const STATUS: Record<CheckoutError["code"], number> = {
  invalid: 400,
  missing: 400,
  not_found: 400,
  out_of_stock: 409,
  region_restricted: 422,
  quantity_exceeded: 400,
  conflict: 409,
  payment_declined: 402,
  requires_action: 402,
};

function versionError(request: Request): Response | null {
  const version = request.headers.get("API-Version");
  if (version && !ACP_SUPPORTED_VERSIONS.includes(version))
    return reply(
      request,
      acpError(
        "invalid_request",
        "unsupported_version",
        `Unsupported API-Version ${version}`,
      ),
      400,
    );
  return null;
}

interface Stored {
  hash: string;
  status: number;
  body: unknown;
}

// Idempotence : même clé + même corps → même réponse (sans rien refaire) ;
// même clé + autre corps → 422. Les erreurs serveur ne sont pas mémorisées.
async function idempotent(
  request: Request,
  scope: string,
  raw: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key");
  if (!key || key.length > 255)
    return reply(
      request,
      acpError(
        "invalid_request",
        "idempotency_key_required",
        "Idempotency-Key header is required",
      ),
      400,
    );
  const { env } = await getCloudflareContext({ async: true });
  const storeKey = `acp:idem:${scope}:${await sha256Hex(key)}`;
  const hash = await sha256Hex(raw);
  const previous = (await env.KV.get(storeKey, "json")) as Stored | null;
  if (previous) {
    if (previous.hash !== hash)
      return reply(
        request,
        acpError(
          "invalid_request",
          "idempotency_conflict",
          "Idempotency-Key has already been used with a different request body",
        ),
        422,
      );
    return reply(request, previous.body, previous.status);
  }
  const result = await run();
  if (result.status < 500)
    await env.KV.put(
      storeKey,
      JSON.stringify({
        hash,
        status: result.status,
        body: result.body,
      } satisfies Stored),
      { expirationTtl: 86400 },
    );
  return reply(request, result.body, result.status);
}

function locale(value?: string): OrderLocale {
  const lang = value?.slice(0, 2).toLowerCase();
  return lang === "de" || lang === "it" || lang === "en" ? lang : "fr";
}

async function view(
  session: SessionRow,
  db: Awaited<ReturnType<typeof getDb>>,
) {
  const { env } = await getCloudflareContext({ async: true });
  const ctx = await catalogContext(db);
  const state = session.state as SessionState;
  const order = await linkedOrder(db, session);
  return acpSessionView(session, state, evaluate(state, ctx), {
    networkId: env.STRIPE_PROFILE_ID,
    live: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY),
    expired: isExpired(session),
    order,
  });
}

const checkoutFailure = (error: unknown) => {
  if (error instanceof CheckoutError)
    return {
      status: STATUS[error.code],
      body: acpError(
        "invalid_request",
        error.code === "not_found" ? "invalid_item" : error.code,
        error.message,
        error.param,
      ),
    };
  throw error;
};

const notFound = (request: Request) =>
  reply(
    request,
    acpError("invalid_request", "not_found", "Checkout session not found"),
    404,
  );

async function readJson(request: Request) {
  const raw = await request.text();
  try {
    return { raw, data: raw ? JSON.parse(raw) : {} };
  } catch {
    return { raw, data: null };
  }
}

export async function createAcp(request: Request) {
  const version = versionError(request);
  if (version) return version;
  if (!(await rateLimit(request, "acp-create", { limit: 30, windowS: 600 })))
    return reply(
      request,
      acpError("invalid_request", "rate_limited", "Too many requests"),
      429,
    );
  const { raw, data } = await readJson(request);
  return idempotent(request, "create", raw, async () => {
    const parsed = acpCreate.safeParse(data);
    if (!parsed.success)
      return {
        status: 400,
        body: acpError(
          "invalid_request",
          "invalid_body",
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        ),
      };
    if (parsed.data.currency.toLowerCase() !== "chf")
      return {
        status: 400,
        body: acpError(
          "invalid_request",
          "unsupported_currency",
          "Prices are in CHF only",
          "$.currency",
        ),
      };
    const db = await getDb();
    try {
      const ctx = await catalogContext(db);
      const buyer = acpBuyer(
        {},
        parsed.data.buyer,
        parsed.data.fulfillment_details?.email,
      );
      const state: SessionState = {
        items: sessionItems(acpLineRequests(parsed.data.line_items), ctx),
        buyer,
        address: withRecipient(
          acpAddress(parsed.data.fulfillment_details),
          buyer,
        ),
        locale: locale(
          parsed.data.locale ??
            request.headers.get("Accept-Language") ??
            undefined,
        ),
      };
      const session = await insertSession(
        db,
        "acp",
        state,
        (request.headers.get("User-Agent") ?? "").slice(0, 80) || null,
      );
      return { status: 201, body: await view(session, db) };
    } catch (error) {
      return checkoutFailure(error);
    }
  });
}

export async function getAcp(request: Request, id: string) {
  const version = versionError(request);
  if (version) return version;
  const db = await getDb();
  const session = await loadSession(db, "acp", id);
  if (!session) return notFound(request);
  return reply(request, await view(session, db));
}

export async function updateAcp(request: Request, id: string) {
  const version = versionError(request);
  if (version) return version;
  const { raw, data } = await readJson(request);
  return idempotent(request, `update:${id}`, raw, async () => {
    const parsed = acpUpdate.safeParse(data);
    if (!parsed.success)
      return {
        status: 400,
        body: acpError(
          "invalid_request",
          "invalid_body",
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        ),
      };
    const db = await getDb();
    const session = await loadSession(db, "acp", id);
    if (!session)
      return {
        status: 404,
        body: acpError(
          "invalid_request",
          "not_found",
          "Checkout session not found",
        ),
      };
    if (session.status !== "open" || isExpired(session))
      return {
        status: 409,
        body: acpError(
          "invalid_request",
          "session_closed",
          `Checkout session is ${isExpired(session) ? "expired" : session.status}`,
        ),
      };
    try {
      const ctx = await catalogContext(db);
      const current = session.state as SessionState;
      const buyer = acpBuyer(
        current.buyer,
        parsed.data.buyer,
        parsed.data.fulfillment_details?.email,
      );
      const next: SessionState = {
        ...current,
        buyer,
        items: parsed.data.line_items
          ? sessionItems(
              acpLineRequests(parsed.data.line_items),
              ctx,
              current.items,
            )
          : current.items,
        address: parsed.data.fulfillment_details?.address
          ? withRecipient(acpAddress(parsed.data.fulfillment_details), buyer)
          : current.address,
      };
      const saved = await saveState(db, id, next);
      if (!saved)
        return {
          status: 409,
          body: acpError(
            "invalid_request",
            "session_closed",
            "Checkout session is closed",
          ),
        };
      return { status: 200, body: await view(saved, db) };
    } catch (error) {
      return checkoutFailure(error);
    }
  });
}

export async function completeAcp(request: Request, id: string) {
  const version = versionError(request);
  if (version) return version;
  const { raw, data } = await readJson(request);
  return idempotent(request, `complete:${id}`, raw, async () => {
    const parsed = acpComplete.safeParse(data);
    if (!parsed.success)
      return {
        status: 400,
        body: acpError(
          "invalid_request",
          "invalid_body",
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        ),
      };
    const db = await getDb();
    let session = await loadSession(db, "acp", id);
    if (!session)
      return {
        status: 404,
        body: acpError(
          "invalid_request",
          "not_found",
          "Checkout session not found",
        ),
      };
    if (session.status === "completed")
      return { status: 200, body: await view(session, db) };
    if (session.status !== "open" || isExpired(session))
      return {
        status: 409,
        body: acpError(
          "invalid_request",
          "session_closed",
          `Checkout session is ${isExpired(session) ? "expired" : session.status}`,
        ),
      };
    const token = acpToken(parsed.data);
    if (!token)
      return {
        status: 400,
        body: acpError(
          "invalid_request",
          "invalid_payment_data",
          "payment_data must carry a Stripe Shared Payment Token (spt_…)",
          "$.payment_data",
        ),
      };
    if (parsed.data.buyer) {
      const current = session.state as SessionState;
      session =
        (await saveState(db, id, {
          ...current,
          buyer: acpBuyer(current.buyer, parsed.data.buyer),
        })) ?? session;
    }
    const ctx = await catalogContext(db);
    const evaluation = evaluate(session.state as SessionState, ctx);
    if (!evaluation.ready)
      return {
        status: 422,
        body: { ...(await view(session, db)), status: "not_ready_for_payment" },
      };
    const { env } = await getCloudflareContext({ async: true });
    try {
      const result = await completeSession(
        db,
        getStripe(env.STRIPE_SECRET_KEY),
        session,
        evaluation,
        token,
      );
      const fresh = (await loadSession(db, "acp", id)) ?? session;
      // 5xx : jamais mis en cache d'idempotence, l'agent peut rejouer tel quel.
      if (result.status === "retry")
        return {
          status: 503,
          body: acpError(
            "service_unavailable",
            "payment_outcome_unknown",
            result.message,
          ),
        };
      if (result.status === "failed" && result.code === "unavailable")
        return {
          status: 503,
          body: acpError(
            "service_unavailable",
            "payments_unavailable",
            result.message,
          ),
        };
      if (result.status === "failed") {
        const body = await view(fresh, db);
        return {
          status: 402,
          body: {
            ...body,
            messages: [
              ...body.messages,
              {
                type: "error",
                code:
                  result.code === "requires_action"
                    ? "requires_3ds"
                    : "payment_declined",
                severity: "high",
                resolution: "requires_buyer_input",
                param: "$.payment_data",
                content_type: "plain",
                content: result.message,
              },
            ],
          },
        };
      }
      return { status: 200, body: await view(fresh, db) };
    } catch (error) {
      return checkoutFailure(error);
    }
  });
}

export async function cancelAcp(request: Request, id: string) {
  const version = versionError(request);
  if (version) return version;
  const { raw } = await readJson(request);
  return idempotent(request, `cancel:${id}`, raw, async () => {
    const db = await getDb();
    const session = await loadSession(db, "acp", id);
    if (!session)
      return {
        status: 404,
        body: acpError(
          "invalid_request",
          "not_found",
          "Checkout session not found",
        ),
      };
    if (session.status === "completed")
      return {
        status: 405,
        body: acpError(
          "invalid_request",
          "session_completed",
          "A completed checkout cannot be canceled; contact the store for a refund",
        ),
      };
    const canceled = (await cancelSession(db, id)) ?? session;
    return { status: 200, body: await view(canceled, db) };
  });
}
