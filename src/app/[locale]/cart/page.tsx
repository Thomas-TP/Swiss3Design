import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CartRecovery } from "@/components/cart-recovery";
import CartContent from "./cart-content";
import { getShippingSettings } from "@/lib/shipping-settings";
import { NOINDEX } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title"), robots: NOINDEX };
}
export default async function CartPage() {
  return (
    <>
      <CartRecovery />
      <CartContent shippingSettings={await getShippingSettings()} />
    </>
  );
}
