"use client";

// Client Better Auth cross-origine : l'app Next.js racine (localhost:3000 en
// dev, swiss3design.ch en prod) reste l'unique fournisseur d'identité (2FA,
// passkeys, OAuth...) — voir AGENTS.md côté racine. Ce storefront n'a pas
// accès au cookie de session (autre origine) : le plugin `bearer()` activé
// côté serveur expose le token de session via l'en-tête `set-auth-token`,
// qu'on capture ici et rejoue en `Authorization: Bearer`. Même architecture
// que apps/storefront/src/lib/auth-client.ts (storefront SolidStart), avec
// le client React officiel au lieu du client Solid.
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import type { SuccessContext } from "@better-fetch/fetch";

const TOKEN_KEY = "s3d_auth_token";

export function readToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
}

export function storeAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [twoFactorClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => readToken(),
    },
  },
});

export const { useSession, signIn, signUp, signOut, twoFactor } = authClient;

// Le plugin bearer() (côté serveur) expose le jeton de session via l'en-tête
// `set-auth-token` sur toute réponse qui complète une connexion (signIn.email,
// signUp.email si vérification désactivée, twoFactor.verifyTotp/BackupCode) -
// on le capture ici et le persiste pour que `authClient` le rejoue ensuite en
// Authorization: Bearer. À passer en `onSuccess` sur CHAQUE appel qui peut
// terminer une connexion, pas seulement signIn.email.
export function captureToken(ctx: SuccessContext) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) storeAuthToken(token);
}

export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password }, { onSuccess: captureToken });
}

export async function signOutAndClear() {
  await signOut();
  storeAuthToken(null);
}
