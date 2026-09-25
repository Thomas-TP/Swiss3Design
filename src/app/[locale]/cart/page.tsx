import { CartRecovery } from "@/components/cart-recovery";
import CartContent from "./cart-content";
import { getShippingSettings } from "@/lib/shipping-settings";
export const dynamic = "force-dynamic";
export default async function CartPage() {
  return (
    <>
      <CartRecovery />
      <CartContent shippingSettings={await getShippingSettings()} />
    </>
  );
}
