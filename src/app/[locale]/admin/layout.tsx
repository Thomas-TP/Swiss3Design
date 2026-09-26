import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { NOINDEX } from "@/lib/seo";
import { getServerSession } from "@/lib/session";
import {
  isSessionFresh,
  SENSITIVE_SESSION_MAX_AGE_MS,
} from "@/lib/session-freshness";
import { MarkInternalVisitor } from "@/components/mark-internal-visitor";
import { AdminFreshnessGuard } from "./admin-freshness-guard";
import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: NOINDEX };

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    redirect({ href: "/account/login", locale: locale as Locale });
    return null;
  }
  if (!isSessionFresh(session.session.createdAt)) {
    redirect({
      href: {
        pathname: "/account/login",
        query: { next: "/admin", reauth: "admin" },
      },
      locale: locale as Locale,
    });
  }

  const expiresAt =
    new Date(session.session.createdAt).getTime() +
    SENSITIVE_SESSION_MAX_AGE_MS;
  return (
    <AdminFreshnessGuard expiresAt={expiresAt}>
      <MarkInternalVisitor />
      <AdminShell>{children}</AdminShell>
    </AdminFreshnessGuard>
  );
}
