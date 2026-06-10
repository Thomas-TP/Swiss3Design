import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { orders, orderItems, products, productTranslations } from "@/db/schema";
import { getSetting } from "@/db/queries";
import { getStripe } from "@/lib/stripe";
import { getAuth } from "@/lib/auth";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  email: z.email(),
  address: z.object({
    name: z.string().min(2).max(120),
    street: z.string().min(3).max(200),
    npa: z.string().regex(/^\d{4}$/),
    city: z.string().min(2).max(120),
  }),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
});

function makeOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `S3D-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { items, email, address, locale } = parsed.data;

  const db = await getDb();
  const ids = items.map((i) => i.productId);

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
    .where(and(inArray(products.id, ids), eq(products.active, true)));

  const byId = new Map(dbProducts.map((p) => [p.id, p]));
  if (items.some((i) => !byId.has(i.productId))) {
    return Response.json({ error: "unknown_product" }, { status: 400 });
  }
  const outOfStock = items.find((i) => {
    const stock = byId.get(i.productId)!.stock;
    return stock !== null && stock < i.quantity;
  });
  if (outOfStock) {
    return Response.json(
      {
        error: "insufficient_stock",
        productName: byId.get(outOfStock.productId)!.name,
      },
      { status: 409 },
    );
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + byId.get(i.productId)!.priceCents * i.quantity,
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

  // Rattache la commande au compte connecté, le cas échéant
  const auth = await getAuth();
  const authSession = await auth.api.getSession({ headers: request.headers });

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
    items.map((i) => ({
      orderId: order.id,
      productId: i.productId,
      nameSnapshot: byId.get(i.productId)!.name,
      priceCentsSnapshot: byId.get(i.productId)!.priceCents,
      quantity: i.quantity,
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
