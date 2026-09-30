"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { getReorderItems } from "../actions";
import { btnGhost } from "../../_ui";

export function ReorderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const { add } = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReorder() {
    setPending(true);
    setError(null);
    const res = await getReorderItems(orderId);
    setPending(false);
    if ("error" in res) {
      setError(t("orderDetail.reorderError"));
      return;
    }
    if (res.items.length === 0) {
      setError(t("orderDetail.reorderUnavailable"));
      return;
    }
    for (const item of res.items) {
      for (let i = 0; i < item.quantity; i++) {
        add({
          productId: item.productId,
          variantId: item.variantId,
          variantName: item.variantName,
          colorName: item.colorName,
          colorHex: item.colorHex,
          slug: item.slug,
          name: item.name,
          priceCents: item.priceCents,
          imageUrl: item.imageUrl,
          saleType: item.saleType,
        });
      }
    }
    router.push("/cart");
  }

  return (
    <div>
      <button
        type="button"
        onClick={onReorder}
        disabled={pending}
        className={btnGhost}
      >
        <RotateCcw size={15} strokeWidth={1.5} />
        {pending ? t("security.processing") : t("orderDetail.reorder")}
      </button>
      {error && (
        <p className="mt-2 text-sm font-medium text-accent-text">{error}</p>
      )}
    </div>
  );
}
