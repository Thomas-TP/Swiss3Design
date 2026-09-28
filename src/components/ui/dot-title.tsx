import type { ReactNode } from "react";

// Point rouge final des titres d'affichage (brief « Strates », §2.2, motif M2).
// Le « . » reste dans le texte (SEO, lecteurs d'écran, copier-coller) : .s3d-dot
// le rend transparent et dessine un disque rouge de 0,22em à sa place. Aucun
// espace entre le dernier mot et le point : le disque ne passe jamais seul à la
// ligne. Seul un point final unique déclenche le disque : ni « ? », ni « … »,
// ni « .. ».

/** Rend le point final d'un texte en disque rouge ; tout autre texte passe tel quel. */
export function withDot(text: string): ReactNode {
  if (!text.endsWith(".") || text.endsWith("..")) return text;
  return (
    <>
      {text.slice(0, -1)}
      <span className="s3d-dot">.</span>
    </>
  );
}

type Heading = "h1" | "h2" | "h3" | "p";

/** Titre d'affichage (font-display) dont le point final devient le point rouge. */
export function DotTitle({
  as: Tag = "h2",
  children,
  className,
  id,
}: {
  as?: Heading;
  children: string;
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={className}>
      {withDot(children)}
    </Tag>
  );
}
