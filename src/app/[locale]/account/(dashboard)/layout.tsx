import type { Locale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { getServerSession } from "@/lib/session";
import { AccountNav } from "./account-nav";
import { AvatarPicker } from "./avatar-picker";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

// Layout commun à tout l'espace compte authentifié (groupe (dashboard)) : garde
// de session + en-tête (avatar/nom) + navigation par onglets. Les pages pré-auth
// (login/register/forgot/reset) sont hors de ce groupe → pas de sidebar.
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect({ href: "/account/login", locale: locale as Locale });
  }
  const { user } = session!;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarPicker current={user.image ?? null} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.name}</p>
            <p className="truncate text-sm text-soft">{user.email}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <div className="mt-8 flex flex-col gap-6 md:flex-row md:gap-10">
        <AccountNav isAdmin={user.role === "admin"} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
