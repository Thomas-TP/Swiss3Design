import { desc, eq } from "drizzle-orm";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { customerAddresses } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { AccountTitle } from "../account-title";
import { AddressBook } from "./address-book";

export const dynamic = "force-dynamic";

export default async function AddressesTab() {
  const t = await getTranslations("account");
  const session = await getServerSession();
  const { user } = session!;

  const db = await getDb();
  const addresses = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, user.id))
    .orderBy(
      desc(customerAddresses.isDefault),
      desc(customerAddresses.updatedAt),
    );

  return (
    <div>
      <AccountTitle
        title={t("addresses.title")}
        subtitle={t("addresses.subtitle")}
        icon={MapPin}
      />
      <AddressBook
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          name: a.name,
          street: a.street,
          npa: a.npa,
          city: a.city,
          canton: a.canton,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
