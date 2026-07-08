"use client";

// Contexte léger exposant l'utilisateur déjà résolu par le layout (garde de
// session + pont Medusa) aux onglets enfants, pour éviter que chacun ne
// rappelle useSession() et ne gère son propre état de chargement.
import { createContext, useContext } from "react";
import type { authClient } from "@/lib/auth-client";

type SessionUser = (typeof authClient.$Infer.Session)["user"];

const AccountUserContext = createContext<SessionUser | null>(null);

export function AccountUserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <AccountUserContext.Provider value={user}>{children}</AccountUserContext.Provider>;
}

export function useAccountUser(): SessionUser {
  const user = useContext(AccountUserContext);
  if (!user) throw new Error("useAccountUser doit être utilisé sous AccountUserProvider");
  return user;
}
