import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";
import { sendEmail } from "./email";
import { verificationEmail, resetPasswordEmail } from "./email-templates";

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
    trustedOrigins: [
      "https://swiss3design.ch",
      "https://www.swiss3design.ch",
    ],
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
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "customer",
          input: false, // jamais modifiable par le client
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
        },
      },
    },
    plugins: [nextCookies()],
  });
}
