import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { Bot } from "lucide-react";
import { getDb } from "@/db";
import { agentRegistrations } from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getServerSession } from "@/lib/session";
import {
  checkClaimAttempt,
  maskEmail,
  sha256Hex,
} from "@/lib/agent/agent-auth-core";
import { POST_CLAIM_SCOPES } from "@/lib/agent/oauth";
import { PATHS } from "@/lib/agent/paths";
import { ScopeList } from "@/components/agent-scope-list";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agentAccess" });
  return { title: t("claim.title"), robots: { index: false } };
}

// Lien de vérification d'un agent auth.md (verification_uri) : le client s'y
// connecte puis recopie le code à 6 chiffres affiché par son agent. Le code
// n'apparaît jamais ici — c'est ce qui prouve que la personne connectée est
// bien celle qui parle à l'agent.
export default async function AgentClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ claim_attempt_token?: string | string[] }>;
}) {
  const { locale } = await params;
  const raw = (await searchParams).claim_attempt_token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const t = await getTranslations("agentAccess");

  const session = token ? await getServerSession() : null;
  if (token && !session) {
    const back = `${PATHS.agentClaim}?claim_attempt_token=${encodeURIComponent(token)}`;
    redirect({
      href: `/account/login?next=${encodeURIComponent(back)}`,
      locale,
    });
  }

  let state: ReturnType<typeof checkClaimAttempt> = "invalid";
  let expectedEmail: string | null = null;
  if (token && session) {
    const db = await getDb();
    const [reg] = await db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.attemptTokenHash, await sha256Hex(token)))
      .limit(1);
    state = checkClaimAttempt(reg ?? null, session.user.email, new Date());
    expectedEmail = reg?.claimEmail ? maskEmail(reg.claimEmail) : null;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <Bot size={40} className="mx-auto text-ink" />
      {state === "ok" ? (
        <>
          <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">
            {t("claim.heading")}
          </h1>
          <p className="mt-3 text-center text-sm text-soft">
            {t("consent.signedInAs", { email: session!.user.email })}
          </p>
          <div className="mt-8 space-y-5 rounded-card border border-line bg-surface p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold">{t("claim.willAccess")}</p>
              <ScopeList scopes={POST_CLAIM_SCOPES} className="mt-3" />
            </div>
            <ClaimForm token={token!} />
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-card border border-line bg-surface p-6 text-center sm:p-8">
          <h1 className="text-xl font-bold">
            {t(`claim.state.${state}.title`)}
          </h1>
          <p className="mt-3 text-sm text-soft">
            {t(`claim.state.${state}.body`, {
              email: expectedEmail ?? "",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
