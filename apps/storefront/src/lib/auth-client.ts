// Client Better Auth cross-origine : l'app Next.js (localhost:3000 en dev,
// swiss3design.ch en prod) reste l'unique fournisseur d'identité (2FA,
// passkeys, OAuth...) — voir AGENTS.md côté racine. Le storefront SolidStart
// n'a pas accès au cookie de session (autre origine) : le plugin `bearer()`
// activé côté serveur expose le token de session via l'en-tête
// `set-auth-token`, qu'on capture ici et rejoue en `Authorization: Bearer`.
import { createAuthClient } from "better-auth/solid";
import type { SuccessContext } from "@better-fetch/fetch";

const TOKEN_KEY = "s3d_auth_token";

function readToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
}

export function storeAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000",
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => readToken(),
    },
  },
});

export const { useSession, signIn, signOut } = authClient;

// Le plugin bearer() (côté serveur) expose le jeton de session via l'en-tête
// `set-auth-token` sur les réponses de login — on le capture ici et le
// persiste pour que `authClient` le rejoue ensuite en Authorization: Bearer.
export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email(
    { email, password },
    {
      onSuccess: (ctx) => {
        const token = ctx.response.headers.get("set-auth-token");
        if (token) storeAuthToken(token);
      },
    },
  );
}

export async function signOutAndClear() {
  await signOut();
  storeAuthToken(null);
}
