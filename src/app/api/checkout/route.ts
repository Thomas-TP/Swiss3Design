import { alias } from "drizzle-orm/pg-core";
import { reserveStock } from "@/lib/stock";
import { resumeOrderCheckout } from "@/lib/checkout-session";
import { aggregateStock } from "@/lib/payment-state";
import { z } from "zod";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import {
  orders,
  orderItems,
  products,
  productTranslations,
  productVariants,
  productColors,
  filamentColors,
  customerAddresses,
  discountCodes,
} from "@/db/schema";
import { getTranslations } from "next-intl/server";
import type { Translate } from "@/components/studio/summary";
import {
  studioDigest,
  studioLineInputSchema,
  type StudioLineInput,
} from "@/lib/studio/purchase";
import { resolveStudioLines } from "@/lib/studio/order-lines";
import { STUDIO_MAX_LINES } from "@/lib/studio/price";
import { getShippingSettings } from "@/lib/shipping-settings";
import { getAuth } from "@/lib/auth";
import { verifyEmailProof } from "@/lib/email-proof";
import { validateDiscount } from "@/lib/discounts";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { shippingForOrder } from "@/lib/shipping";
import { recordStatusTransition } from "@/lib/status-history";
import { makeOrderNumber } from "@/lib/order-number";

// Ligne PRODUIT (sans `kind`, comme avant le Studio) ou objet du Studio
// (`kind: "studio"` : configuration et textes saisis, revalidés plus bas).
const productLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  color: z.string().min(1).max(60).optional(),
  quantity: z.number().int().min(1).max(99),
});

const bodySchema = z.object({
  attemptId: z.uuid().optional(),
  items: z
    .array(z.union([studioLineInputSchema, productLineSchema]))
    .min(1)
    .max(50 + STUDIO_MAX_LINES),
  email: z.email(),
  // Preuve de vérification d'e-mail (invités) émise par /api/checkout/verify-email
  emailProof: z.string().optional(),
  discountCode: z.string().max(40).optional(),
  address: z.object({
    name: z.string().min(2).max(120),
    street: z.string().min(3).max(200),
    npa: z.string().regex(/^\d{4}$/),
    city: z.string().min(2).max(120),
    canton: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .or(z.literal(""))
      .default(""),
  }),
  saveAddress: z.boolean().optional(),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
});

export async function POST(request: Request) {
  // Anti-abus : plafonne la création de PaymentIntents/commandes par IP
  if (!(await rateLimit(request, "checkout", { limit: 20, windowS: 600 }))) {
    return tooManyRequests();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { address, saveAddress, locale } = parsed.data;
  // Deux familles de lignes : les produits de la boutique (stock, prix en base)
  // et les objets du Studio (configuration revalidée, prix refait ici).
  const isStudioInput = (
    line: (typeof parsed.data.items)[number],
  ): line is StudioLineInput => "kind" in line && line.kind === "studio";
  const items = parsed.data.items.filter(
    (line): line is z.infer<typeof productLineSchema> => !isStudioInput(line),
  );
  const studioInputs = parsed.data.items.filter(isStudioInput);
  if (items.length > 50 || studioInputs.length > STUDIO_MAX_LINES)
    return Response.json({ error: "invalid_request" }, { status: 400 });

  // Toute commande exige une identité e-mail fiable : un compte connecté
  // (e-mail déjà vérifié) ou une preuve de vérification par code (invités).
  const auth = await getAuth();
  const authSession = await auth.api.getSession({ headers: request.headers });
  let email: string;
  if (authSession) {
    if (!authSession.user.emailVerified)
      return Response.json({ error: "email_not_verified" }, { status: 403 });
    email = authSession.user.email.toLowerCase();
  } else {
    const claimed = parsed.data.email.trim().toLowerCase();
    const { env } = await getCloudflareContext({ async: true });
    const proofValid =
      parsed.data.emailProof &&
      (await verifyEmailProof(
        claimed,
        parsed.data.emailProof,
        env.BETTER_AUTH_SECRET,
      ));
    if (!proofValid) {
      return Response.json({ error: "email_not_verified" }, { status: 403 });
    }
    email = claimed;
  }

  const db = await getDb();
  const attemptKey =
    email.toLowerCase() + ":" + (parsed.data.attemptId ?? crypto.randomUUID());
  // Les textes saisis n'entrent dans cette colonne en clair que par un condensé
  // SHA-256. Sans objet du Studio, l'empreinte est exactement celle d'avant : une
  // tentative ouverte avant le déploiement se reprend.
  const studioDigests = await Promise.all(
    studioInputs.map(async (line) => ({
      d: await studioDigest(line),
      e: line.expectedUnitCents ?? null,
    })),
  );
  const fingerprint = JSON.stringify({
    email,
    items,
    address,
    locale,
    discountCode: parsed.data.discountCode ?? "",
    ...(studioDigests.length > 0 ? { studio: studioDigests } : {}),
  });
  const [existingAttempt] = await db
    .select()
    .from(orders)
    .where(eq(orders.checkoutAttemptKey, attemptKey));
  if (existingAttempt) {
    if (existingAttempt.checkoutFingerprint !== fingerprint)
      return Response.json({ error: "checkout_changed" }, { status: 409 });
    return resumeOrderCheckout(db, existingAttempt);
  }
  // Objets du Studio : validation stricte, prix recalculé, aucun stock. Avant la
  // moindre écriture : un refus (400, 409 prix, 422 non imprimable) ne laisse rien.
  let studioLines: Awaited<ReturnType<typeof resolveStudioLines>> = {
    ok: true,
    lines: [],
  };
  if (studioInputs.length > 0) {
    const core = (await getTranslations({
      locale,
      namespace: "studioCore",
    })) as unknown as Translate;
    studioLines = resolveStudioLines(studioInputs, core, locale);
    if (!studioLines.ok)
      return Response.json(studioLines.body, { status: studioLines.status });
  }
  const studioOrderLines = studioLines.ok ? studioLines.lines : [];

  const fallbackTranslation = alias(
    productTranslations,
    "fallback_translation",
  );
  const productIds = [...new Set(items.map((i) => i.productId))];
  // Prix et noms relus en base : on ne fait jamais confiance au client.
  // Produits, variantes et couleurs sont des lectures indépendantes → en parallèle.
  const [dbProducts, dbVariants, dbColors] = productIds.length
    ? await Promise.all([
        db
          .select({
            id: products.id,
            priceCents: products.priceCents,
            stock: products.stock,
            name: sql<string>`coalesce(${productTranslations.name},${fallbackTranslation.name},${products.slug})`,
          })
          .from(products)
          .leftJoin(
            productTranslations,
            and(
              eq(productTranslations.productId, products.id),
              eq(productTranslations.locale, locale),
            ),
          )
          .leftJoin(
            fallbackTranslation,
            and(
              eq(fallbackTranslation.productId, products.id),
              eq(fallbackTranslation.locale, "fr"),
            ),
          )
          .where(
            and(inArray(products.id, productIds), eq(products.active, true)),
          ),
        db
          .select()
          .from(productVariants)
          .where(inArray(productVariants.productId, productIds)),
        db
          .select({
            productId: productColors.productId,
            name: filamentColors.name,
            hex: filamentColors.hex,
          })
          .from(productColors)
          .innerJoin(
            filamentColors,
            eq(filamentColors.id, productColors.colorId),
          )
          .where(inArray(productColors.productId, productIds)),
      ])
    : [[], [], []];
  const byId = new Map(dbProducts.map((p) => [p.id, p]));
  const variantById = new Map(dbVariants.map((v) => [v.id, v]));
  // Couleurs autorisées par produit : nom → hex (le hex vient de la base, jamais
  // du client). Permet de figer la couleur choisie dans la commande.
  const colorsByProduct = new Map<string, Map<string, string>>();
  for (const c of dbColors) {
    const m = colorsByProduct.get(c.productId) ?? new Map<string, string>();
    m.set(c.name, c.hex);
    colorsByProduct.set(c.productId, m);
  }

  // Couleur choisie : validée contre la palette du produit, hex relu en base.
  const resolveColor = (productId: string, requested?: string) => {
    if (!requested) return { colorName: null, colorHex: null };
    const hex = colorsByProduct.get(productId)?.get(requested);
    return hex
      ? { colorName: requested, colorHex: hex }
      : { colorName: null, colorHex: null };
  };

  // Ligne effective (prix/stock/nom selon produit ou variante choisie)
  const lines = items.map((i) => {
    const product = byId.get(i.productId);
    if (!product) return null;
    if (!i.variantId && dbVariants.some((v) => v.productId === i.productId))
      return null;
    if (
      colorsByProduct.has(i.productId) &&
      (!i.color || !colorsByProduct.get(i.productId)?.has(i.color))
    )
      return null;
    const { colorName, colorHex } = resolveColor(i.productId, i.color);
    if (i.variantId) {
      const v = variantById.get(i.variantId);
      if (!v || v.productId !== i.productId) return null;
      return {
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        priceCents: v.priceCents ?? product.priceCents,
        stock: v.stock,
        name: v.name ? `${product.name} — ${v.name}` : product.name,
        colorName,
        colorHex,
      };
    }
    return {
      productId: i.productId,
      variantId: null as string | null,
      quantity: i.quantity,
      priceCents: product.priceCents,
      stock: product.stock,
      name: product.name,
      colorName,
      colorHex,
    };
  });
  if (lines.some((l) => l === null)) {
    return Response.json({ error: "unknown_product" }, { status: 400 });
  }
  const validLines = lines as NonNullable<(typeof lines)[number]>[];

  const outOfStock = aggregateStock(validLines).find(
    (l) => l.stock !== null && l.stock < l.quantity,
  );
  if (outOfStock) {
    return Response.json(
      { error: "insufficient_stock", productName: outOfStock.name },
      { status: 409 },
    );
  }

  const shopSubtotalCents = validLines.reduce(
    (sum, l) => sum + l.priceCents * l.quantity,
    0,
  );
  const studioSubtotalCents = studioOrderLines.reduce(
    (sum, l) => sum + l.lineCents,
    0,
  );
  const subtotalCents = shopSubtotalCents + studioSubtotalCents;

  // Port : seule la part boutique y est soumise ; le prix d'un objet du Studio
  // est ferme, livraison comprise (jamais de port sur une ligne du Studio, quels
  // que soient les réglages en base).
  const shippingCents = shippingForOrder(
    { shopCents: shopSubtotalCents, studioCents: studioSubtotalCents },
    await getShippingSettings(),
  );

  // Remise (code promo) revalidée côté serveur sur le sous-total réel
  let discountCents = 0;
  let appliedCode: string | null = null;
  if (parsed.data.discountCode) {
    const d = await validateDiscount(
      db,
      parsed.data.discountCode,
      subtotalCents,
    );
    if (d) {
      discountCents = d.discountCents;
      appliedCode = d.code;
    }
  }

  const totalCents = subtotalCents - discountCents + shippingCents;

  // Mémorise l'adresse par défaut pour les prochaines commandes si demandé.
  // Plusieurs adresses sont possibles (carnet d'adresses, espace compte) :
  // ici on met à jour l'adresse par défaut existante, ou on en crée une.
  if (authSession && saveAddress) {
    const [existingDefault] = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.userId, authSession.user.id),
          eq(customerAddresses.isDefault, true),
        ),
      )
      .limit(1);
    if (existingDefault) {
      await db
        .update(customerAddresses)
        .set({ ...address, updatedAt: new Date() })
        .where(eq(customerAddresses.id, existingDefault.id));
    } else {
      await db.insert(customerAddresses).values({
        userId: authSession.user.id,
        isDefault: true,
        ...address,
      });
    }
  }

  const orderNumber = makeOrderNumber();
  let order;
  try {
    order = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          checkoutAttemptKey: attemptKey,
          checkoutFingerprint: fingerprint,
          stockReservedAt: new Date(),
          reservationExpiresAt: new Date(Date.now() + 3600000),
          customerId: authSession?.user.id ?? null,
          email,
          status: "pending",
          subtotalCents,
          shippingCents,
          discountCents,
          discountCode: appliedCode,
          totalCents,
          shippingAddress: JSON.stringify({ ...address, country: "CH" }),
          locale,
        })
        .returning();
      await recordStatusTransition(tx, {
        entityType: "order",
        entityId: order.id,
        fromStatus: null,
        toStatus: "pending",
        source: "checkout",
        actorId: authSession?.user.id ?? null,
      });

      await tx.insert(orderItems).values([
        ...validLines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          variantId: l.variantId,
          nameSnapshot: l.name,
          colorName: l.colorName,
          colorHex: l.colorHex,
          priceCentsSnapshot: l.priceCents,
          quantity: l.quantity,
        })),
        // Objets du Studio : ni produit, ni variante, ni stock. Le prix unitaire
        // est celui du serveur ; la configuration et les textes saisis sont dans
        // `studio` (jamais dans Stripe, ni dans une mesure).
        ...studioOrderLines.map((l) => ({
          orderId: order.id,
          productId: null,
          variantId: null,
          nameSnapshot: l.name,
          colorName: null,
          colorHex: null,
          priceCentsSnapshot: l.unitCents,
          quantity: l.quantity,
          studio: l.snapshot,
        })),
      ]);

      await reserveStock(tx, validLines, order.id);
      if (appliedCode) {
        const [coupon] = await tx
          .update(discountCodes)
          .set({ usedCount: sql`${discountCodes.usedCount}+1` })
          .where(
            and(
              eq(discountCodes.code, appliedCode),
              eq(discountCodes.active, true),
              or(
                isNull(discountCodes.maxUses),
                lt(discountCodes.usedCount, discountCodes.maxUses),
              ),
              or(
                isNull(discountCodes.expiresAt),
                sql`${discountCodes.expiresAt} > now()`,
              ),
            ),
          )
          .returning();
        if (!coupon) throw new Error("discount_unavailable");
      }
      return order;
    });
  } catch (error) {
    // Une tentative concurrente avec la même clé reprend sa propre session.
    const [retry] = await db
      .select()
      .from(orders)
      .where(eq(orders.checkoutAttemptKey, attemptKey));
    if (retry && retry.checkoutFingerprint === fingerprint)
      return resumeOrderCheckout(db, retry);
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error:
          message === "insufficient_stock" ? message : "checkout_unavailable",
      },
      { status: 409 },
    );
  }
  return resumeOrderCheckout(db, order);
}
