import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { getDb } from "@/db";
import { oauthClient } from "@/db/schema";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getServerSession } from "@/lib/session";
import { ScopeList } from "@/components/agent-scope-list";
import { AuthShell } from "../../account/auth-shell";
import { alertWarn } from "../../account/(dashboard)/_ui";
import { ConsentForm } from "./consent-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agentAccess" });
  return { title: t("consent.title"), robots: { index: false } };
}

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

// Page de consentement OAuth : better-auth y redirige avec la requête
// d'autorisation signée (?client_id=…&scope=…&sig=…). Le client voit qui
// demande l'accès, à quoi, et vers quel site il sera renvoyé ; la réponse part
// par POST /oauth2/consent (ConsentForm), jamais par un simple lien. Cadre
// commun des écrans d'authentification (AuthShell) : hors du groupe (site), donc
// ni Lenis ni canvas ; le <main> est celui du layout racine.
export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Query>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("agentAccess");

  const session = await getServerSession();
  if (!session) {
    // Session perdue entre connexion et consentement : on repasse par la
    // connexion avec la même requête signée, l'autorisation reprend ensuite.
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      for (const v of Array.isArray(value) ? value : [value])
        if (v !== undefined) qs.append(key, v);
    redirect({ href: `/account/login?${qs.toString()}`, locale });
  }

  const clientId = first(query.client_id);
  const scopes = (first(query.scope) ?? "").split(" ").filter(Boolean);
  const db = await getDb();
  const [client] = clientId
    ? await db
        .select({
          name: oauthClient.name,
          uri: oauthClient.uri,
          disabled: oauthClient.disabled,
        })
        .from(oauthClient)
        .where(eq(oauthClient.clientId, clientId))
        .limit(1)
    : [];
  const valid = Boolean(client && !client.disabled && first(query.sig));
  const redirectHost = hostOf(first(query.redirect_uri));
  const appName = client?.name?.trim() || redirectHost || t("consent.unnamed");

  if (!valid) {
    return (
      <AuthShell title={t("consent.invalidTitle")}>
        <p className="text-center text-sm text-soft">
          {t("consent.invalidBody")}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("consent.heading", { app: appName })}
      intro={t("consent.signedInAs", { email: session!.user.email })}
      below={
        <p className="mt-5 text-center text-sm text-soft">
          {t("consent.revokeHint")}{" "}
          <Link
            href="/account/agents"
            className="font-medium text-ink underline decoration-line decoration-1 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
          >
            {t("consent.revokeLink")}
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">{t("consent.willAccess")}</h2>
          <ScopeList scopes={scopes} className="mt-3" />
        </div>
        {redirectHost && (
          <p className="text-sm text-soft">
            {t("consent.redirectTo", { host: redirectHost })}
          </p>
        )}
        <p className={`${alertWarn} flex gap-2`}>
          <ShieldAlert
            size={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
          />
          {t("consent.unverified")}
        </p>
        <ConsentForm />
      </div>
    </AuthShell>
  );
}
