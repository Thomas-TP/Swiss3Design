import { getSetting } from "@/db/queries";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "./shipping";
export async function getShippingSettings() {
  const [flat, free] = await Promise.all([
    getSetting("shipping_cents"),
    getSetting("free_shipping_over_cents"),
  ]);
  const cents = (value: string | null, fallback: number) =>
    value !== null && Number.isSafeInteger(Number(value)) && Number(value) >= 0
      ? Number(value)
      : fallback;
  return {
    shippingCents: cents(flat, SHIPPING_CENTS),
    freeOverCents: cents(free, FREE_SHIPPING_OVER_CENTS),
  };
}
