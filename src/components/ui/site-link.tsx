"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useId, type ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { motionBridge, useMotionBridge } from "@/lib/motion-bridge/store";

// Lien de navigation du chrome et des CTA (brief « Strates », §3.4, §8).
// Deux rôles en plus de Link (@/i18n/navigation, prefetch coupé par défaut) :
//
// 1. Transition « Coupe » : il porte le type "s3d-coupe", que les <PageCut>
//    des pages vitrine traduisent en animation (la nouvelle page s'imprime en
//    8 paliers par-dessus l'ancienne). Le type n'est posé qu'entre deux pages
//    DIFFÉRENTES du groupe (site) : vers le panier, le compte ou le légal,
//    l'ancienne page resterait figée par-dessus la nouvelle pendant que le
//    soulignement de la nav glisse. En mouvement réduit, aucun type : React
//    ne démarre alors aucune View Transition (au lieu d'une transition de
//    durée nulle qui capturerait quand même deux instantanés). Le bouton
//    retour du navigateur n'a jamais de type : pas d'animation, par design.
// 2. Attente serveur : prefetch coupé et pages dynamiques, un clic peut
//    attendre le Worker. useLinkStatus() (seul import toléré de next/link) le
//    signale au pont (navPending), et le header fait courir sa buse rouge.

const COUPE = ["s3d-coupe"];

// Chemins (sans locale) servis par le groupe de routes src/app/[locale]/(site)
// et donc enveloppés de <PageCut>. À tenir à jour si une page entre dans le
// groupe ou en sort (docs/conventions.md, « Motion »).
const SITE_SECTIONS = [
  "/shop",
  "/products",
  "/studio",
  "/custom",
  "/a-propos",
  "/contact",
];

/** true si le chemin (sans préfixe de locale) appartient au groupe (site). */
export function isSitePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return SITE_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}

type LinkProps = ComponentProps<typeof Link>;

/** Chemin interne visé par un href, sans requête ni ancre ; null s'il sort du site. */
function targetPath(href: LinkProps["href"]): string | null {
  const raw = typeof href === "string" ? href : href.pathname;
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//"))
    return null;
  const cut = raw.search(/[?#]/);
  const path = cut === -1 ? raw : raw.slice(0, cut);
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// Un seul lien « en attente » à la fois (Next ne montre que le dernier cliqué) :
// le propriétaire courant est seul à pouvoir éteindre la buse, sinon l'ancien
// lien, en repassant à false, l'éteindrait pendant que le nouveau attend.
let pendingOwner: string | null = null;

function PendingSignal() {
  const { pending } = useLinkStatus();
  const id = useId();
  useEffect(() => {
    if (!pending) return;
    pendingOwner = id;
    motionBridge.set({ navPending: true });
    return () => {
      if (pendingOwner !== id) return;
      pendingOwner = null;
      motionBridge.set({ navPending: false });
    };
  }, [pending, id]);
  return null;
}

export type SiteLinkProps = LinkProps & {
  /** false : jamais de « Coupe » depuis ce lien (l'attente reste signalée). */
  coupe?: boolean;
};

export function SiteLink({
  coupe = true,
  transitionTypes,
  children,
  ...props
}: SiteLinkProps) {
  const pathname = usePathname();
  const reduced = useMotionBridge((s) => s.reduced);
  const target = targetPath(props.href);
  const types =
    transitionTypes ??
    (coupe &&
    !reduced &&
    target !== null &&
    target !== pathname &&
    isSitePath(pathname) &&
    isSitePath(target)
      ? COUPE
      : undefined);

  return (
    <Link {...props} transitionTypes={types}>
      {children}
      <PendingSignal />
    </Link>
  );
}
