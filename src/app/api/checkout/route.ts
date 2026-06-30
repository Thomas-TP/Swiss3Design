import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
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
} from "@/db/schema";
import { getSetting } from "@/db/queries";
import { getStripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customer";
import { getAuth } from "@/lib/auth";
import { verifyEmailProof } from "@/lib/email-proof";
import { validateDiscount } from "@/lib/discounts";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).optional(),
        color: z.string().min(1).max(60).optional(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
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

function makeOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `S3D-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export async function POST(request: Request) {
  // Anti-abus : plafonne la création de PaymentIntents/commandes par IP
  if (!(await rateLimit(request, "checkout", { limit: 20, windowS: 600 }))) {
    return tooManyRequests();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { items, address, saveAddress, locale } = parsed.data;

  // Toute commande exige une identité e-mail fiable : un compte connecté
  // (e-mail déjà vérifié) ou une preuve de vérification par code (invités).
  const auth = await getAuth();
  const authSession = await auth.api.getSession({ headers: request.headers });
  let email: string;
  if (authSession) {
    email = authSession.user.email;
  } else {
    const claimed = parsed.data.email.trim().toLowerCase();
    const { env } = await getCloudflareContext({ async: true });
    const proofValid =
      parsed.data.emailProof &&
      (await verifyEmailProof(claimed, parsed.data.emailProof, env.BETTER_AUTH_SECRET));
    if (!proofValid) {
      return Response.json({ error: "email_not_verified" }, { status: 403 });
    }
    email = claimed;
  }

  const db = await getDb();
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [
    ...new Set(items.map((i) => i.variantId).filter((v): v is string => !!v)),
  ];

  // Prix et noms relus en base : on ne fait jamais confiance au client.
  // Produits, variantes et couleurs sont des lectures indépendantes → en parallèle.
  const [dbProducts, dbVariants, dbColors] = await Promise.all([
    db
      .select({
        id: products.id,
        priceCents: products.priceCents,
        stock: products.stock,
        name: productTranslations.name,
      })
      .from(products)
      .innerJoin(
        productTranslations,
        and(
          eq(productTranslations.productId, products.id),
          eq(productTranslations.locale, locale),
        ),
      )
      .where(and(inArray(products.id, productIds), eq(products.active, true))),
    variantIds.length
      ? db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            priceCents: productVariants.priceCents,
            stock: productVariants.stock,
            name: productVariants.name,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : Promise.resolve(
          [] as {
            id: string;
            productId: string;
            priceCents: number | null;
            stock: number | null;
            name: string;
          }[],
        ),
    db
      .select({
        productId: productColors.productId,
        name: filamentColors.name,
        hex: filamentColors.hex,
      })
      .from(productColors)
      .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
      .where(inArray(productColors.productId, productIds)),
  ]);
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

  const outOfStock = validLines.find(
    (l) => l.stock !== null && l.stock < l.quantity,
  );
  if (outOfStock) {
    return Response.json(
      { error: "insufficient_stock", productName: outOfStock.name },
      { status: 409 },
    );
  }

  const subtotalCents = validLines.reduce(
    (sum, l) => sum + l.priceCents * l.quantity,
    0,
  );

  // Les deux réglages de livraison sont indépendants → lus en parallèle.
  const [shippingSetting, freeOverSetting] = await Promise.all([
    getSetting("shipping_cents"),
    getSetting("free_shipping_over_cents"),
  ]);
  const shippingFlat = Number(shippingSetting ?? SHIPPING_CENTS);
  const freeOver = Number(freeOverSetting ?? FREE_SHIPPING_OVER_CENTS);
  const shippingCents = subtotalCents >= freeOver ? 0 : shippingFlat;

  // Remise (code promo) revalidée côté serveur sur le sous-total réel
  let discountCents = 0;
  let appliedCode: string | null = null;
  if (parsed.data.discountCode) {
    const d = await validateDiscount(db, parsed.data.discountCode, subtotalCents);
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
  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
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
    .returning({ id: orders.id });

  await db.insert(orderItems).values(
    validLines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      variantId: l.variantId,
      nameSnapshot: l.name,
      colorName: l.colorName,
      colorHex: l.colorHex,
      priceCentsSnapshot: l.priceCents,
      quantity: l.quantity,
    })),
  );

  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  // Client connecté : rattache le paiement à son identité Stripe (Customer).
  // Stripe Link peut alors proposer en 1 clic les cartes déjà enregistrées
  // par ce client — aucun coffre-fort de moyens de paiement côté serveur.
  const stripeCustomerId = authSession
    ? await getOrCreateStripeCustomer(stripe, db, {
        id: authSession.user.id,
        email: authSession.user.email,
        name: authSession.user.name,
        stripeCustomerId: authSession.user.stripeCustomerId ?? null,
      })
    : undefined;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "chf",
    automatic_payment_methods: { enabled: true },
    receipt_email: email,
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
    shipping: {
      name: address.name,
      address: {
        line1: address.street,
        postal_code: address.npa,
        city: address.city,
        country: "CH",
      },
    },
    metadata: { orderId: order.id, orderNumber },
  });

  await db
    .update(orders)
    .set({ stripePaymentIntentId: paymentIntent.id })
    .where(eq(orders.id, order.id));

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    orderNumber,
    totalCents,
    shippingCents,
    discountCents,
  });
}
