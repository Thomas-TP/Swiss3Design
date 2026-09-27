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
  ucpAddress,
  ucpBuyer,
  ucpCheckoutView,
  ucpComplete,
  ucpCreate,
  ucpError,
  ucpLineRequests,
  ucpToken,
  ucpUpdate,
} from "./ucp-protocol";

// Service HTTP de la liaison REST UCP (/api/ucp/checkout-sessions…). L'agent
// s'annonce par l'en-tête UCP-Agent (profil de la plateforme) ; Idempotency-
// Key est honorée quand elle est fournie (réponse rejouée 24 h).

const CORS = {
  ...PUBLIC_CORS,
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": `${PUBLIC_CORS["Access-Control-Allow-Headers"]}, UCP-Agent, Idempotency-Key, Request-Id, Signature, Signature-Input, Content-Digest`,
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

export const ucpPreflight = () =>
  new Response(null, { status: 204, headers: CORS });

// « UCP-Agent: profile="https://…" » → hôte de la plateforme.
function agentOf(request: Request): string | null {
  const header = request.headers.get("UCP-Agent") ?? "";
  const profile = header.match(/profile="([^"]+)"/)?.[1];
  try {
    if (profile) return `ucp:${new URL(profile).host}`.slice(0, 80);
  } catch {
    // profil illisible : repli sur le User-Agent
  }
  return (request.headers.get("User-Agent") ?? "").slice(0, 80) || null;
}

async function readJson(request: Request) {
  const raw = await request.text();
  try {
    return { raw, data: raw ? JSON.parse(raw) : {} };
  } catch {
    return { raw, data: null };
  }
}

async function idempotent(
  request: Request,
  scope: string,
  raw: string,
  run: () => Promise<{ status: number; body: unknown }>,
) {
  const key = request.headers.get("Idempotency-Key");
  if (!key) {
    const result = await run();
    return reply(result.body, result.status);
  }
  const { env } = await getCloudflareContext({ async: true });
  const storeKey = `ucp:idem:${scope}:${await sha256Hex(key.slice(0, 255))}`;
  const hash = await sha256Hex(raw);
  const previous = (await env.KV.get(storeKey, "json")) as {
    hash: string;
    status: number;
    body: unknown;
  } | null;
  if (previous)
    return previous.hash === hash
      ? reply(previous.body, previous.status)
      : reply(
          ucpError(
            "idempotency_conflict",
            "Idempotency-Key reused with a different body",
          ),
          409,
        );
  const result = await run();
  if (result.status < 500)
    await env.KV.put(storeKey, JSON.stringify({ hash, ...result }), {
      expirationTtl: 86400,
    });
  return reply(result.body, result.status);
}

async function view(
  session: SessionRow,
  db: Awaited<ReturnType<typeof getDb>>,
  extraMessages?: Record<string, unknown>[],
) {
  const { env } = await getCloudflareContext({ async: true });
  const ctx = await catalogContext(db);
  const state = session.state as SessionState;
  return ucpCheckoutView(session, state, evaluate(state, ctx), {
    origin: env.BETTER_AUTH_URL,
    networkId: env.STRIPE_PROFILE_ID,
    live: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY),
    expired: isExpired(session),
    order: await linkedOrder(db, session),
    extraMessages,
  });
}

const invalid = (issues: { path: PropertyKey[]; message: string }[]) => ({
  status: 400,
  body: ucpError(
    "invalid",
    issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  ),
});

const failure = (error: unknown) => {
  if (error instanceof CheckoutError)
    return {
      status:
        error.code === "out_of_stock" || error.code === "conflict" ? 409 : 400,
      body: ucpError(error.code, error.message, error.param),
    };
  throw error;
};

const missing = {
  status: 404,
  body: ucpError("not_found", "Checkout session not found"),
};

export async function createUcp(request: Request) {
  if (!(await rateLimit(request, "ucp-create", { limit: 30, windowS: 600 })))
    return reply(ucpError("rate_limited", "Too many requests"), 429);
  const { raw, data } = await readJson(request);
  return idempotent(request, "create", raw, async () => {
    const parsed = ucpCreate.safeParse(data);
    if (!parsed.success) return invalid(parsed.error.issues);
    const db = await getDb();
    try {
      const ctx = await catalogContext(db);
      const buyer = ucpBuyer({}, parsed.data.buyer);
      const lang = (request.headers.get("Accept-Language") ?? "")
        .slice(0, 2)
        .toLowerCase();
      const state: SessionState = {
        items: sessionItems(ucpLineRequests(parsed.data.line_items), ctx),
        buyer,
        address: withRecipient(ucpAddress(parsed.data.fulfillment), buyer),
        locale: lang === "de" || lang === "it" || lang === "en" ? lang : "fr",
      };
      const session = await insertSession(db, "ucp", state, agentOf(request));
      return { status: 201, body: await view(session, db) };
    } catch (error) {
      return failure(error);
    }
  });
}

export async function getUcp(request: Request, id: string) {
  void request;
  const db = await getDb();
  const session = await loadSession(db, "ucp", id);
  if (!session) return reply(missing.body, missing.status);
  return reply(await view(session, db));
}

export async function updateUcp(request: Request, id: string) {
  const { raw, data } = await readJson(request);
  return idempotent(request, `update:${id}`, raw, async () => {
    const parsed = ucpUpdate.safeParse(data);
    if (!parsed.success) return invalid(parsed.error.issues);
    const db = await getDb();
    const session = await loadSession(db, "ucp", id);
    if (!session) return missing;
    if (session.status !== "open" || isExpired(session))
      return {
        status: 409,
        body: ucpError("session_closed", "Checkout session is closed"),
      };
    try {
      const ctx = await catalogContext(db);
      const current = session.state as SessionState;
      const buyer = ucpBuyer(current.buyer, parsed.data.buyer);
      const address = ucpAddress(parsed.data.fulfillment);
      const saved = await saveState(db, id, {
        ...current,
        buyer,
        items: parsed.data.line_items
          ? sessionItems(
              ucpLineRequests(parsed.data.line_items),
              ctx,
              current.items,
            )
          : current.items,
        address: address ? withRecipient(address, buyer) : current.address,
      });
      if (!saved)
        return {
          status: 409,
          body: ucpError("session_closed", "Checkout session is closed"),
        };
      return { status: 200, body: await view(saved, db) };
    } catch (error) {
      return failure(error);
    }
  });
}

export async function completeUcp(request: Request, id: string) {
  const { raw, data } = await readJson(request);
  return idempotent(request, `complete:${id}`, raw, async () => {
    const parsed = ucpComplete.safeParse(data);
    if (!parsed.success) return invalid(parsed.error.issues);
    const db = await getDb();
    const session = await loadSession(db, "ucp", id);
    if (!session) return missing;
    if (session.status === "completed")
      return { status: 200, body: await view(session, db) };
    if (session.status !== "open" || isExpired(session))
      return {
        status: 409,
        body: ucpError("session_closed", "Checkout session is closed"),
      };
    const token = ucpToken(parsed.data);
    if (!token)
      return {
        status: 400,
        body: ucpError(
          "invalid",
          "The payment instrument must carry a Stripe Shared Payment Token (credential.token = spt_…)",
          "$.payment.instruments",
        ),
      };
    const ctx = await catalogContext(db);
    const evaluation = evaluate(session.state as SessionState, ctx);
    if (!evaluation.ready)
      return { status: 200, body: await view(session, db) };
    const { env } = await getCloudflareContext({ async: true });
    try {
      const result = await completeSession(
        db,
        getStripe(env.STRIPE_SECRET_KEY),
        session,
        evaluation,
        token,
      );
      const fresh = (await loadSession(db, "ucp", id)) ?? session;
      // 5xx : jamais mis en cache d'idempotence, l'agent peut rejouer tel quel.
      if (result.status === "retry")
        return {
          status: 503,
          body: ucpError(
            "payment_outcome_unknown",
            result.message,
            "$.payment.instruments",
            "recoverable",
          ),
        };
      if (result.status === "failed" && result.code === "unavailable")
        return {
          status: 503,
          body: ucpError("payments_unavailable", result.message),
        };
      if (result.status === "failed")
        return {
          status: 200,
          body: await view(fresh, db, [
            {
              type: "error",
              code:
                result.code === "requires_action"
                  ? "requires_authentication"
                  : "payment_declined",
              path: "$.payment.instruments",
              content: result.message,
              severity: "requires_buyer_input",
            },
          ]),
        };
      return { status: 200, body: await view(fresh, db) };
    } catch (error) {
      return failure(error);
    }
  });
}

export async function cancelUcp(request: Request, id: string) {
  const { raw } = await readJson(request);
  return idempotent(request, `cancel:${id}`, raw, async () => {
    const db = await getDb();
    const session = await loadSession(db, "ucp", id);
    if (!session) return missing;
    if (session.status === "completed")
      return {
        status: 409,
        body: ucpError(
          "session_completed",
          "A completed checkout cannot be canceled",
        ),
      };
    const canceled = (await cancelSession(db, id)) ?? session;
    return { status: 200, body: await view(canceled, db) };
  });
}
