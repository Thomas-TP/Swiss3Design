import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Bot } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getServerSession } from "@/lib/session";
import { checkClaimAttempt, maskEmail } from "@/lib/agent/agent-auth-core";
import { findClaimAttempt } from "@/lib/agent/claim-attempt";
import { POST_CLAIM_SCOPES } from "@/lib/agent/oauth";
import { PATHS } from "@/lib/agent/paths";
import { ScopeList } from "@/components/agent-scope-list";
import { AuthShell } from "../../account/auth-shell";
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
    const reg = await findClaimAttempt(token);
    state = checkClaimAttempt(reg, session.user.email, new Date());
    expectedEmail = reg?.claimEmail ? maskEmail(reg.claimEmail) : null;
  }

  // Picto d'agent à la place du mark : décoratif, le titre porte le sens.
  const icon = (
    <Bot size={40} strokeWidth={1.5} aria-hidden="true" className="text-ink" />
  );

  if (state !== "ok") {
    return (
      <AuthShell icon={icon} title={t(`claim.state.${state}.title`)}>
        <p className="text-center text-sm text-soft">
          {t(`claim.state.${state}.body`, {
            email: expectedEmail ?? "",
          })}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={icon}
      title={t("claim.heading")}
      intro={t("consent.signedInAs", { email: session!.user.email })}
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">{t("claim.willAccess")}</h2>
          <ScopeList scopes={POST_CLAIM_SCOPES} className="mt-3" />
        </div>
        <ClaimForm token={token!} />
      </div>
    </AuthShell>
  );
}
