"use client";

import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import type { Printability } from "@/lib/studio/types";

type Issue = Extract<Printability, { issues: unknown }>["issues"][number];

// Badge « Imprimable » (brief « Strates », §6.7) : « ✓ Imprimable » (encre),
// « ! À vérifier » (ambre), « ✕ Non imprimable » (`accent-text`), chaque
// anomalie en clair et son bouton « Corriger » quand le garde-fou sait la
// réparer. Le statut n'est jamais une couleur seule : un signe et un mot. Pas
// de région vivante ici : le résumé du Studio (debounce d'une seconde) annonce
// le statut et la première anomalie, un glissé ne doit pas faire parler le
// lecteur d'écran à chaque pixel.

const TONE: Record<Printability["status"], string> = {
  ok: "border-ink text-ink",
  warn: "border-amber-600 text-amber-800 dark:text-amber-300",
  error: "border-accent-text text-accent-text",
};
const SIGN: Record<Printability["status"], string> = {
  ok: "✓",
  warn: "!",
  error: "✕",
};

export function PrintableBadge({
  printable,
  statusLabel,
  messageOf,
  fixLabel,
  onFix,
  className,
}: {
  printable: Printability;
  statusLabel: string;
  messageOf: (issue: Issue) => string;
  fixLabel: string;
  onFix: (issue: Issue) => void;
  className?: string;
}) {
  const issues = printable.status === "ok" ? [] : printable.issues;
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <p
        className={cx(
          "s3d-label inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 normal-case",
          TONE[printable.status],
        )}
      >
        <span aria-hidden="true" className="font-bold">
          {SIGN[printable.status]}
        </span>
        {statusLabel}
      </p>
      {issues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink"
            >
              <span className="max-w-[46ch]">{messageOf(issue)}</span>
              {issue.fix ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onFix(issue)}
                >
                  {fixLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
