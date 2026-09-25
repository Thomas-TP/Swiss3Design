"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export function AdminFreshnessGuard({
  expiresAt,
  children,
}: {
  expiresAt: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let redirected = false;
    const reauthenticateIfExpired = () => {
      if (redirected || Date.now() <= expiresAt) return;
      redirected = true;
      const suffix = `${window.location.search}${window.location.hash}`;
      router.replace({
        pathname: "/account/login",
        query: { next: `${pathname}${suffix}`, reauth: "admin" },
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reauthenticateIfExpired();
    };
    const delay = Math.max(0, expiresAt - Date.now() + 50);
    const timeout = window.setTimeout(reauthenticateIfExpired, delay);
    window.addEventListener("focus", reauthenticateIfExpired);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reauthenticateIfExpired();
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", reauthenticateIfExpired);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [expiresAt, pathname, router]);

  return children;
}
