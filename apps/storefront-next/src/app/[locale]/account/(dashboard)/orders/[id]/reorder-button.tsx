"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { btnGhost } from "../../_ui";

interface ReorderItem {
  variant_id: string | null;
  quantity: number;
  metadata: Record<string, unknown> | null;
}

export function ReorderButton({ items }: { items: ReorderItem[] }) {
  const t = useTranslations("account");
  const router = useRouter();
  const { addItem } = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReorder() {
    setPending(true);
    setError(null);
    try {
      const reorderable = items.filter((i) => i.variant_id);
      if (reorderable.length === 0) {
        setError(t("orderDetail.reorderUnavailable"));
        return;
      }
      for (const item of reorderable) {
        // Le panier Medusa ne supporte qu'une mutation à la fois (pas d'ajout en lot)
        await addItem(item.variant_id!, item.quantity, item.metadata ?? undefined);
      }
      router.push("/cart");
    } catch {
      setError(t("orderDetail.reorderError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onReorder} disabled={pending} className={btnGhost}>
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
        {t("orderDetail.reorder")}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-accent">{error}</p>}
    </div>
  );
}
