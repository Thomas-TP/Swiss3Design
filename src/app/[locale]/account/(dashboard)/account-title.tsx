import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Titre d'un onglet du compte : l'unique <h1> de la page, en Archivo
// (`font-display`, échelle `text-title` : le h1 de l'accueil et des pages
// vitrine a l'échelle `text-display`, trop grande pour une colonne à côté de la
// navigation). Pas de point rouge : le rouge reste aux actions et à l'onglet
// courant. Composant serveur, sans état.
export function AccountTitle({
  title,
  subtitle,
  icon: Icon,
  className = "mb-6",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header className={className}>
      <h1 className="flex items-center gap-2.5 break-words font-display text-title text-ink">
        {Icon && (
          <Icon
            size={22}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-soft"
          />
        )}
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-sm text-soft">{subtitle}</p>}
    </header>
  );
}
