"use client";
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { sameLine, useCart } from "@/lib/cart";
import { fetchCartLine } from "@/lib/agent/cart-line";
import { FILAMENT_IDS } from "@/lib/studio/filaments";

// WebMCP : expose aux agents du navigateur (document.modelContext) les
// actions clés de la boutique — chercher, lire une fiche, gérer le panier,
// aller au paiement, suivre une commande. Les outils passent par l'API
// publique /api/v1 et par le vrai panier (même état que l'interface) ; le
// paiement lui-même reste une action humaine sur la page de checkout.
// Sans document.modelContext (quasi tous les navigateurs aujourd'hui), rien
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
    // document.modelContext d'abord : lire navigator.modelContext (déprécié)
    // affiche un avertissement dans la console de chaque page ; il ne reste que
    // le repli pour les navigateurs qui n'ont pas encore déplacé l'objet.
    const context =
      (document as Document & { modelContext?: ModelContext }).modelContext ??
      (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
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
        name: "studio_configure",
        title: "Configure a Studio object",
        description:
          "Builds a shareable Studio link for one of Swiss3Design's own configurable objects " +
          "(lavaux vase, cartouche business card, relief coaster, borne name tag) and returns its stats. " +
          "Personal texts (names, contacts) are never accepted here: the human types them on the page.",
        inputSchema: {
          type: "object",
          properties: {
            object: {
              enum: ["lavaux", "cartouche", "relief", "borne"],
              description: "Which Studio object to configure",
            },
            params: {
              type: "object",
              description:
                "Numeric or enum parameters using the link keys (lavaux: h, d, p, b, n, l, m, gs, gd, wl, wa, wk, vc, va, vs, rn, ra, rt, w; cartouche: t, r, mo, e, ly, fp, ft; relief: sh, s, ba, re, lv, sd, lk, lb; borne: sh, c, t, rg, rd, mo, fb, ft); clamped to valid ranges.",
            },
            palette: {
              type: "array",
              items: { enum: [...FILAMENT_IDS] },
              maxItems: 4,
              description:
                "Filament ids, bottom to top for vases and coasters; plate then text for cards and name tags.",
            },
            open: {
              type: "boolean",
              description: "Navigate the tab to the link.",
            },
          },
          required: ["object"],
        },
        annotations: { readOnlyHint: true },
        async execute(input) {
          // Chargé à la demande : l'outil est rare, ses modules ne pèsent pas sur les pages.
          const { configureFromTool, describeConfiguration } =
            await import("@/components/studio/configure-tool");
          const result = configureFromTool(input);
          if (!result.ok) throw new Error(result.error);
          const answer = describeConfiguration(
            result.config,
            location.origin,
            state.current.locale,
          );
          if (input.open === true) location.assign(answer.link);
          return text(answer);
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
            quantity: {
              type: "integer",
              minimum: 1,
              maximum: 99,
              description:
                "Quantity to add (default 1); added to any quantity already in the cart, up to 99",
            },
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
          "Remove a product from the cart: every line of it, or only the line with the given colour or variant. Returns how many lines were removed (0 when nothing matched).",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Product slug" },
            color: {
              type: "string",
              description: "Only the line with this colour name",
            },
            variant: {
              type: "string",
              description: "Only the line with this variant (id or name)",
            },
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
          "Order status, items, totals and Swiss Post tracking link, from the order number and the email address used for the order. A wrong number or email returns not found; lookups are rate-limited.",
        inputSchema: {
          type: "object",
          properties: {
            order_number: {
              type: "string",
              description: "Order number from the confirmation email (S3D-…)",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email address used for the order",
            },
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
