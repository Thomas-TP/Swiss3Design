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
import { twoFactorClient, emailOTPClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
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
  // magicLinkClient volontairement absent : le lien magique est vérifié par
  // une redirection GET sur le serveur d'auth (localhost:3000), qui pose un
  // cookie de session SUR CETTE ORIGINE-LÀ puis redirige - ce storefront
  // (autre origine) ne peut pas lire ce cookie ni récupérer de jeton porteur
  // à l'issue du flux tel quel. passkey/emailOTP restent de simples appels
  // API directs (comme signIn.email), donc compatibles avec le pont bearer.
  plugins: [twoFactorClient(), emailOTPClient(), passkeyClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => readToken(),
    },
  },
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  twoFactor,
  emailOtp,
  passkey,
  updateUser,
  changeEmail,
  changePassword,
  sendVerificationEmail,
  listAccounts,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  deleteUser,
} = authClient;

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

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";
const OAUTH_POPUP_MESSAGE_TYPE = "better-auth:oauth-popup";
const OAUTH_POPUP_TIMEOUT_MS = 300_000;

// Connexion Google en popup (oauthPopup() côté serveur, src/lib/auth.ts) :
// n'utilise PAS le client officiel oauthPopupClient()/signIn.popup(), qui ne
// stocke le jeton reçu par postMessage que si isEmbedded() détecte une
// iframe cross-origine — notre cas (page top-level, mais cross-ORIGIN, pas
// forcément cross-SITE) ne l'est pas, et le plugin retombe alors sur un
// $fetch("/get-session") qui dépend du cookie de session pour fonctionner :
// ça marche par accident en dev (localhost:3000/4002 sont same-site malgré
// des ports différents - la portée de SameSite ignore le port) mais casserait
// silencieusement en prod si storefront-next finit sur un domaine vraiment
// distinct. On capture donc le jeton nous-mêmes, comme pour toutes les
// autres méthodes de connexion de ce fichier.
export function signInWithGooglePopup(next?: { callbackURL?: string }): Promise<{ error?: string }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ error: "unavailable" });
      return;
    }
    const authOrigin = new URL(BETTER_AUTH_URL).origin;
    const nonce = crypto.randomUUID();
    const startUrl = new URL(`${BETTER_AUTH_URL}/api/auth/oauth-popup/start`);
    startUrl.searchParams.set("provider", "google");
    startUrl.searchParams.set("popupOrigin", window.location.origin);
    startUrl.searchParams.set("popupNonce", nonce);
    if (next?.callbackURL) startUrl.searchParams.set("callbackURL", next.callbackURL);

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(startUrl.toString(), "s3d-oauth-popup", `width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      resolve({ error: "popup_blocked" });
      return;
    }

    let settled = false;
    const settle = (result: { error?: string }) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedPoll);
      window.clearTimeout(timeout);
      try {
        if (!popup.closed) popup.close();
      } catch {
        // popup déjà fermée
      }
      resolve(result);
    };

    function onMessage(event: MessageEvent) {
      if (event.origin !== authOrigin) return;
      const data = event.data as { type?: string; nonce?: string; token?: string; error?: { code: string } } | null;
      if (data?.type !== OAUTH_POPUP_MESSAGE_TYPE || data.nonce !== nonce) return;
      if (data.error) {
        settle({ error: data.error.code });
        return;
      }
      if (typeof data.token !== "string" || !data.token) return;
      storeAuthToken(data.token);
      // Force useSession() (hook réactif) à relire la session : ce chemin ne
      // passe pas par une action authClient normale (signIn.X), qui déclenche
      // ça automatiquement en interne.
      authClient.$store.notify("$sessionSignal");
      settle({});
    }

    const closedPoll = window.setInterval(() => {
      if (popup.closed) settle({ error: "popup_closed" });
    }, 500);
    const timeout = window.setTimeout(() => settle({ error: "timeout" }), OAUTH_POPUP_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
  });
}
