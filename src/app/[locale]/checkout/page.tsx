import { getTranslations } from "next-intl/server";
import { CheckoutFlow } from "./checkout-flow";

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <div className="mt-8">
        <CheckoutFlow />
      </div>
    </div>
  );
}
