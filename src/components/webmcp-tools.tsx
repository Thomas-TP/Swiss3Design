"use client";
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { sameLine, useCart } from "@/lib/cart";
import { fetchCartLine } from "@/lib/agent/cart-line";

// WebMCP : expose aux agents du navigateur (navigator.modelContext) les
// actions clés de la boutique — chercher, lire une fiche, gérer le panier,
// aller au paiement, suivre une commande. Les outils passent par l'API
// publique /api/v1 et par le vrai panier (même état que l'interface) ; le
// paiement lui-même reste une action humaine sur la page de checkout.
// Sans navigator.modelContext (quasi tous les navigateurs aujourd'hui), rien
// n'est enregistré et le composant ne coûte rien.

interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): unknown;
}

const text = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      data?.error?.message ?? `Request failed (${response.status})`,
    );
  return data;
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function WebMcpTools() {
  const cart = useCart();
  const locale = useLocale();
  const router = useRouter();
  const state = useRef({ cart, locale, router });
  useEffect(() => {
    state.current = { cart, locale, router };
  });

  useEffect(() => {
    const context =
      (navigator as Navigator & { modelContext?: ModelContext }).modelContext ??
      (document as Document & { modelContext?: ModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") return;
    const controller = new AbortController();

    const cartSummary = () => {
      const { items, subtotalCents } = state.current.cart;
      return {
        items: items.map((i) => ({
          slug: i.slug,
          name: i.name,
          variant: i.variantName ?? null,
          color: i.colorName ?? null,
          quantity: i.quantity,
          unitPriceChf: (i.priceCents / 100).toFixed(2),
        })),
        subtotalChf: (subtotalCents / 100).toFixed(2),
        note: "Shipping is added at checkout (Switzerland only).",
      };
    };

    const tools: WebMcpTool[] = [
      {
        name: "search_products",
        title: "Search products",
        description:
          "Search the Swiss3Design catalogue of 3D-printed design objects. Returns names, CHF prices, availability, colours and product URLs.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Free-text search" },
            category: { type: "string", description: "Category slug" },
            max_price_chf: {
              type: "number",
              description: "Maximum price in CHF",
            },
            multicolor: {
              type: "boolean",
              description: "Only multicolour prints",
            },
          },
        },
        annotations: { readOnlyHint: true },
        async execute(input) {
          const params = new URLSearchParams({
            language: state.current.locale,
          });
          for (const key of [
            "query",
            "category",
            "max_price_chf",
            "multicolor",
          ])
            if (input[key] !== undefined && input[key] !== "")
              params.set(key, String(input[key]));
          return text(await api(`/api/v1/products?${params}`));
        },
      },
      {
        name: "get_product",
        title: "Get product details",
        description:
          "Full details of a product: price, availability, colour options, variants, dimensions.",
        inputSchema: {
          type: "object",
          properties: { slug: { type: "string", description: "Product slug" } },
          required: ["slug"],
        },
        annotations: { readOnlyHint: true },
        async execute(input) {
          const slug = str(input.slug);
          if (!slug) throw new Error("slug is required");
          return text(
            await api(
              `/api/v1/products/${encodeURIComponent(slug)}?language=${state.current.locale}`,
            ),
          );
        },
      },
      {
        name: "get_store_info",
        title: "Store information",
        description:
          "Shipping (Switzerland only), returns, payment methods, contact and custom 3D printing.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        async execute() {
          return text(
            await api(`/api/v1/store?language=${state.current.locale}`),
          );
        },
      },
      {
        name: "view_cart",
        title: "View cart",
        description:
          "Items currently in the shopping cart, with the subtotal in CHF.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        async execute() {
          return text(cartSummary());
        },
      },
      {
        name: "add_to_cart",
        title: "Add to cart",
        description:
          "Add a product to the shopping cart. A colour is required when the product offers colours, a variant when it has variants (see get_product).",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Product slug" },
            quantity: { type: "integer", minimum: 1, maximum: 99 },
            color: {
              type: "string",
              description: "Colour name from colorOptions",
            },
            variant: { type: "string", description: "Variant id or name" },
          },
          required: ["slug"],
        },
        async execute(input) {
          const slug = str(input.slug);
          if (!slug) throw new Error("slug is required");
          const line = await fetchCartLine(
            {
              slug,
              quantity: Number(input.quantity) || 1,
              color: str(input.color),
              variant: str(input.variant),
            },
            state.current.locale,
          );
          const { cart: current } = state.current;
          const existing = current.items.find((i) => sameLine(i, line));
          const quantity = Math.min(
            99,
            (existing?.quantity ?? 0) + line.quantity,
          );
          const { quantity: _q, ...item } = line;
          current.add(item);
          current.setQuantity(
            line.productId,
            line.variantId ?? null,
            line.colorName ?? null,
            quantity,
          );
          return text({ added: line.name, color: line.colorName, quantity });
        },
      },
      {
        name: "remove_from_cart",
        title: "Remove from cart",
        description:
          "Remove a product (optionally a given colour or variant) from the cart.",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string" },
            color: { type: "string" },
            variant: { type: "string" },
          },
          required: ["slug"],
        },
        async execute(input) {
          const slug = str(input.slug);
          const color = str(input.color)?.toLowerCase();
          const variant = str(input.variant)?.toLowerCase();
          const lines = state.current.cart.items.filter(
            (i) =>
              i.slug === slug &&
              (!color || i.colorName?.toLowerCase() === color) &&
              (!variant ||
                i.variantId === variant ||
                i.variantName?.toLowerCase() === variant),
          );
          for (const l of lines)
            state.current.cart.remove(
              l.productId,
              l.variantId ?? null,
              l.colorName ?? null,
            );
          return text({ removed: lines.length });
        },
      },
      {
        name: "go_to_checkout",
        title: "Go to checkout",
        description:
          "Open the checkout page, where the customer enters the delivery address and pays (TWINT, cards, Google Pay).",
        inputSchema: { type: "object", properties: {} },
        annotations: { consequentialHint: true },
        async execute() {
          if (state.current.cart.items.length === 0)
            throw new Error("The cart is empty");
          state.current.router.push("/checkout");
          return text({
            url: `${location.origin}/${state.current.locale}/checkout`,
            cart: cartSummary(),
          });
        },
      },
      {
        name: "track_order",
        title: "Track an order",
        description:
          "Order status and Swiss Post tracking link, from the order number and email.",
        inputSchema: {
          type: "object",
          properties: {
            order_number: { type: "string" },
            email: { type: "string", format: "email" },
          },
          required: ["order_number", "email"],
        },
        annotations: { readOnlyHint: true },
        async execute(input) {
          return text(
            await api("/api/v1/orders/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_number: str(input.order_number),
                email: str(input.email),
              }),
            }),
          );
        },
      },
    ];

    for (const tool of tools) {
      try {
        const registered = context.registerTool(tool, {
          signal: controller.signal,
        });
        if (registered instanceof Promise) registered.catch(() => {});
      } catch {
        // Implémentation expérimentale incompatible : on n'insiste pas.
      }
    }
    return () => controller.abort();
  }, []);

  return null;
}
