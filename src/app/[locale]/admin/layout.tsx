import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getServerSession } from "@/lib/session";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  if (session?.user.role !== "admin") {
    redirect({ href: "/account/login", locale: locale as Locale });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Administration
          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        </h1>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
