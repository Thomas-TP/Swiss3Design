import { eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { AccountTitle } from "../account-title";
import { card } from "../_ui";
import { PrefsForm } from "./prefs-form";

export const dynamic = "force-dynamic";

export default async function NotificationsTab() {
  const t = await getTranslations("account");
  const session = await getServerSession();
  const { user } = session!;

  const db = await getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  return (
    <div>
      <AccountTitle
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        icon={Bell}
      />

      <div className="space-y-4">
        <div className={card}>
          <PrefsForm
            initial={{
              newsletter: prefs?.newsletter ?? false,
              productNews: prefs?.productNews ?? false,
            }}
          />
        </div>
        <p className={`${card} text-xs text-soft`}>
          {t("notifications.transactionalNote")}
        </p>
      </div>
    </div>
  );
}
