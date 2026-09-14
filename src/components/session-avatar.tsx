"use client";

import { useEffect, useState } from "react";
import { CircleUser } from "lucide-react";

let avatarRequest: Promise<string | null> | null = null;

function loadAvatar() {
  avatarRequest ??= fetch("/api/auth/get-session", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return null;
      const session = (await response.json()) as {
        user?: { image?: string | null };
      } | null;
      return session?.user?.image ?? null;
    })
    .catch(() => null);
  return avatarRequest;
}

export function SessionAvatar({
  variant = "header",
  active = false,
}: {
  variant?: "header" | "bottom";
  active?: boolean;
}) {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void loadAvatar().then((image) => {
      if (current) setAvatar(image);
    });
    return () => {
      current = false;
    };
  }, []);

  if (!avatar) {
    return (
      <CircleUser
        size={variant === "bottom" ? 22 : 20}
        strokeWidth={active ? 2.4 : 1.8}
        className={active ? "text-ink" : "text-soft"}
      />
    );
  }

  return (
    <img
      src={avatar}
      alt=""
      referrerPolicy="no-referrer"
      className={
        variant === "bottom"
          ? `h-[22px] w-[22px] rounded-full object-cover ${
              active ? "ring-2 ring-ink" : "ring-1 ring-line"
            }`
          : "h-5 w-5 rounded-full object-cover ring-1 ring-line"
      }
    />
  );
}
