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
  customerAddresses,
} from "@/db/schema";
import { getSetting } from "@/db/queries";
import { getStripe } from "@/lib/stripe";
import { getAuth } from "@/lib/auth";
import { verifyEmailProof } from "@/lib/email-proof";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).optional(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  email: z.email(),
  // Preuve de vérification d'e-mail (invités) émise par /api/checkout/verify-email
  emailProof: z.string().optional(),
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

  // Prix et noms relus en base : on ne fait jamais confiance au client
  const dbProducts = await db
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
    .where(and(inArray(products.id, productIds), eq(products.active, true)));
  const byId = new Map(dbProducts.map((p) => [p.id, p]));

  const dbVariants = variantIds.length
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          priceCents: productVariants.priceCents,
          stock: productVariants.stock,
          name: productVariants.name,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
    : [];
  const variantById = new Map(dbVariants.map((v) => [v.id, v]));

  // Ligne effective (prix/stock/nom selon produit ou variante choisie)
  const lines = items.map((i) => {
    const product = byId.get(i.productId);
    if (!product) return null;
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
      };
    }
    return {
      productId: i.productId,
      variantId: null as string | null,
      quantity: i.quantity,
      priceCents: product.priceCents,
      stock: product.stock,
      name: product.name,
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

  const shippingFlat = Number(
    (await getSetting("shipping_cents")) ?? SHIPPING_CENTS,
  );
  const freeOver = Number(
    (await getSetting("free_shipping_over_cents")) ?? FREE_SHIPPING_OVER_CENTS,
  );
  const shippingCents = subtotalCents >= freeOver ? 0 : shippingFlat;
  const totalCents = subtotalCents + shippingCents;

  // Mémorise l'adresse pour les prochaines commandes si demandé
  if (authSession && saveAddress) {
    await db
      .insert(customerAddresses)
      .values({ userId: authSession.user.id, ...address })
      .onConflictDoUpdate({
        target: customerAddresses.userId,
        set: { ...address, updatedAt: new Date() },
      });
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
      priceCentsSnapshot: l.priceCents,
      quantity: l.quantity,
    })),
  );

  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "chf",
    automatic_payment_methods: { enabled: true },
    receipt_email: email,
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
  });
}
