import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { OAUTH_SCOPES } from "@/lib/agent/oauth";

const KNOWN = new Set<string>(OAUTH_SCOPES);

// Portées OAuth traduites en phrases lisibles (consentement, revendication
// d'agent, page « Agents et applications »). Une portée inconnue s'affiche
// telle quelle plutôt que d'être masquée.
export function ScopeList({
  scopes,
  className = "",
}: {
  scopes: readonly string[];
  className?: string;
}) {
  const t = useTranslations("agentAccess.scopes");
  const unique = [...new Set(scopes)];
  return (
    <ul className={`space-y-2 ${className}`}>
      {unique.map((scope) => (
        <li key={scope} className="flex items-start gap-2 text-sm">
          <CheckCircle2
            size={16}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
          <span>{KNOWN.has(scope) ? t(scope.replace(".", "_")) : scope}</span>
        </li>
      ))}
    </ul>
  );
}
