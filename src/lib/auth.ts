import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";
import { sendEmail } from "./email";
import {
  verificationEmail,
  resetPasswordEmail,
  deleteAccountEmail,
} from "./email-templates";

function adminEmails(env: CloudflareEnv): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// N'active un provider social que si ses identifiants sont configurés
function socialProviders(env: CloudflareEnv) {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
    };
  }
  if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET) {
    providers.facebook = {
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
    };
  }
  return providers;
}

export function enabledSocialProviders(env: CloudflareEnv): string[] {
  return Object.keys(socialProviders(env));
}

// Instance par requête : les bindings Cloudflare ne sont disponibles
// que dans le contexte d'une requête.
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = drizzle(env.DB, { schema });

  // La vérification d'e-mail exige un envoyeur opérationnel : elle
  // s'active automatiquement dès que RESEND_API_KEY est configurée.
  const canSendEmails = Boolean(env.RESEND_API_KEY);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins:
      env.APP_ENV === "preview"
        ? [env.BETTER_AUTH_URL]
        : ["https://swiss3design.ch", "https://www.swiss3design.ch"],
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: canSendEmails,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(resetPasswordEmail(user.email, url));
      },
    },
    emailVerification: {
      sendOnSignUp: canSendEmails,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(verificationEmail(user.email, url));
      },
    },
    socialProviders: socialProviders(env),
    // Session valable 7 j (défaut Better Auth) ; freshAge alignée dessus —
    // sinon le défaut (24 h) bloque listSessions/unlinkAccount (« session pas
    // assez fraîche ») pour un client connecté depuis plus d'un jour, alors
    // que sa session est toujours valide.
    session: {
      freshAge: 60 * 60 * 24 * 7,
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    user: {
      // Changement d'e-mail : réutilise emailVerification.sendVerificationEmail
      // ci-dessus (Better Auth route dessus automatiquement) — la nouvelle
      // adresse n'est appliquée qu'après clic sur le lien envoyé.
      changeEmail: { enabled: true },
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "customer",
          input: false, // jamais modifiable par le client
        },
      },
      // Suppression de compte (droit à l'effacement nLPD), confirmée par e-mail.
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          await sendEmail(deleteAccountEmail(user.email, url));
        },
        // Purge des données personnelles avant suppression. Les sessions,
        // comptes OAuth et la 2FA sont supprimés par Better Auth ; on nettoie
        // ici nos propres tables.
        beforeDelete: async (u) => {
          // Devis + fichiers 3D (R2) : données personnelles non requises légalement
          const quotes = await db
            .select({ fileUrl: schema.quoteRequests.fileUrl })
            .from(schema.quoteRequests)
            .where(eq(schema.quoteRequests.customerId, u.id));
          for (const q of quotes) {
            if (q.fileUrl) {
              try {
                await env.R2.delete(q.fileUrl);
              } catch {
                // fichier déjà absent — sans gravité
              }
            }
          }
          await db
            .delete(schema.quoteRequests)
            .where(eq(schema.quoteRequests.customerId, u.id));
          await db
            .delete(schema.customerAddresses)
            .where(eq(schema.customerAddresses.userId, u.id));
          // Commandes : conservées 10 ans (compta, art. 958f CO) → on coupe
          // seulement le lien vers le compte supprimé.
          await db
            .update(schema.orders)
            .set({ customerId: null })
            .where(eq(schema.orders.customerId, u.id));
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({
            data: {
              ...u,
              role: adminEmails(env).includes(u.email.toLowerCase())
                ? "admin"
                : "customer",
            },
          }),
          // Rattache au nouveau compte les commandes et devis passés en invité
          // avec la même adresse. Sûr avant vérification d'e-mail : un compte
          // non vérifié ne peut pas se connecter, donc personne ne consulte ces
          // données tant que la possession de l'adresse n'est pas prouvée.
          after: async (u) => {
            const emailLc = u.email.toLowerCase();
            try {
              await db
                .update(schema.orders)
                .set({ customerId: u.id })
                .where(
                  and(
                    eq(schema.orders.email, emailLc),
                    isNull(schema.orders.customerId),
                  ),
                );
              await db
                .update(schema.quoteRequests)
                .set({ customerId: u.id })
                .where(
                  and(
                    eq(schema.quoteRequests.email, emailLc),
                    isNull(schema.quoteRequests.customerId),
                  ),
                );
            } catch (e) {
              // Le rattachement ne doit jamais faire échouer l'inscription :
              // l'affichage du compte retombe de toute façon sur le filet par
              // e-mail (orders.email === user.email).
              console.error("[rattachement commandes invité]", e);
            }
          },
        },
      },
    },
    plugins: [twoFactor({ issuer: "Swiss3Design" }), nextCookies()],
  });
}
