import { lavauxElevation } from "@/lib/studio/poster";
import type { LavauxConfig } from "@/lib/studio/types";

// Pictos des profils du vase (brief « Strates », §6.2 : « radios (pictos) ») :
// la silhouette EXACTE du profil, calculée par le même code que l'Élévation
// (lavauxElevation), pas un dessin à la main. Un vase lisse, à galbe moyen, dans
// sa boîte de 16 × 22 px ; calculés une fois par profil et gardés (le serveur et
// le navigateur en ont besoin, les cinq ne coûtent ensemble que quelques
// millisecondes).
type Profile = LavauxConfig["profile"];

const cache = new Map<Profile, { d: string; box: string }>();

function silhouette(profile: Profile) {
  let hit = cache.get(profile);
  if (!hit) {
    const data = lavauxElevation({
      object: "lavaux",
      h: 150,
      d: 96,
      profile,
      belly: 0.5,
      neck: 0.72,
      lip: 0.08,
      pattern: { kind: "lisse" },
      wall: 1.6,
      bands: [{ filament: "blanc-neve", toMm: 150 }],
    });
    const [x, y, w, h] = data.viewBox;
    hit = { d: data.outline, box: `${x} ${y} ${w} ${h}` };
    cache.set(profile, hit);
  }
  return hit;
}

export function ProfileIcon({
  profile,
  className,
}: {
  profile: Profile;
  className?: string;
}) {
  const { d, box } = silhouette(profile);
  return (
    <svg
      viewBox={box}
      width={16}
      height={22}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
