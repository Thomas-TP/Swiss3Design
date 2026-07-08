"use client";

// Layout commun à tout l'espace compte authentifié (groupe (dashboard)) :
// garde de session + en-tête (avatar/nom) + navigation par onglets. Les pages
// pré-auth (login/register/forgot/reset) sont hors de ce groupe → pas de
// sidebar. Contrairement à l'app racine (session lue côté serveur via
// cookie), storefront-next est cross-origine avec le serveur d'auth : le
// jeton porteur ne vit qu'en localStorage, donc la garde tourne côté client.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/auth-client";
import { medusa, loginToMedusa } from "@/lib/medusa";
import { AccountUserProvider } from "./account-context";
import { AccountNav } from "./account-nav";
import { AvatarPicker } from "./avatar-picker";
import { SignOutButton } from "./sign-out-button";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [medusaReady, setMedusaReady] = useState(false);
  const bridging = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.push(`/account/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPending, session, pathname, router]);

  // Assure qu'une session client Medusa (Customer) existe en plus de la
  // session better-auth, nécessaire pour les commandes/adresses (Store API
  // scopée au client connecté) — voir src/lib/medusa.ts::loginToMedusa.
  // S'auto-corrige à chaque montage du dashboard (session Medusa expirée,
  // absente, ou jamais établie), pas seulement juste après la connexion.
  useEffect(() => {
    if (!session || bridging.current) return;
    bridging.current = true;
    (async () => {
      try {
        await medusa.store.customer.retrieve();
        setMedusaReady(true);
      } catch {
        try {
          await loginToMedusa(session.user.email);
          setMedusaReady(true);
        } catch {
          setMedusaReady(true);
        }
      }
    })();
  }, [session]);

  if (isPending || !session || !medusaReady) {
    return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14" />;
  }

  const { user } = session;

  return (
    <AccountUserProvider user={user}>
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
          <AccountNav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </AccountUserProvider>
  );
}
