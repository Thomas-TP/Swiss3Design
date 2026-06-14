import { requireAdmin } from "@/lib/session";
import { DiscountForm } from "../discount-form";

export default async function NewDiscountPage() {
  await requireAdmin();
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Nouveau code promo</h2>
      <DiscountForm />
    </div>
  );
}
