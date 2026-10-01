"use client";

import { useMemo, useRef } from "react";
import { cx } from "@/components/ui/cx";
import { filamentHex } from "@/lib/studio/filaments";
import { HOME_VIEW_ATTR, type HomeViewName } from "./contract";
import { useHomeConfig } from "./home-config-context";
import type { ContourFieldProps } from "./stage-props";
import { useHomeMotion, useHomeView } from "./use-home-motion";
import styles from "./home.module.css";

// Le champ de courbes de niveau (brief « Strates », §5.5 B3, annexe A) : une
// vue du Stage qui couvre tout son hôte, derrière le texte. WebGL en capacité C2
// seulement ; partout ailleurs (mobile, appareil modeste, mouvement réduit) un
// SVG statique tient lieu de champ, ici le poster du chapitre 01
// (public/posters/field-home-*.svg, un fichier par thème). Le héros n'a pas de
// poster : le champ ne s'y ouvre qu'en fin de pin, en C2.
//
// Les teintes hypsométriques suivent la palette réglée dans le héros.

type FieldName = Extract<HomeViewName, "heroField" | "mapField">;

export function FieldView({
  name,
  reveal,
  anchorX,
  anchorY,
  poster = false,
}: {
  name: FieldName;
  /** Ouverture initiale : 0 dans le héros (la chorégraphie l'ouvre), 1 ailleurs. */
  reveal: number;
  anchorX: number;
  anchorY: number;
  /** Poster SVG statique (chapitre 01). */
  poster?: boolean;
}) {
  const { data, palette } = useHomeConfig();
  const { reduced, capability } = useHomeMotion();
  const ref = useRef<HTMLDivElement>(null);

  const bands = data.palettes[palette];
  const props = useMemo<ContourFieldProps>(() => {
    const hex = (index: number) =>
      filamentHex(bands[Math.min(index, bands.length - 1)].filament);
    return {
      tint: [hex(0), hex(1), hex(2)],
      reveal,
      anchor: [anchorX, anchorY],
    };
  }, [bands, reveal, anchorX, anchorY]);

  useHomeView(ref, "contour-field", props, {
    enabled: !reduced && capability === 2,
    // Dans le héros épinglé : rectangle relu à chaque frame.
    liveRect: name === "heroField",
    priority: 0,
  });

  return (
    <div
      ref={ref}
      data-stage-view="contour-field"
      {...{ [HOME_VIEW_ATTR]: name }}
      className={styles.fieldView}
      aria-hidden="true"
    >
      {poster ? (
        <div className="s3d-poster absolute inset-0">
          <img
            src="/posters/field-home-light.svg"
            alt=""
            loading="lazy"
            decoding="async"
            className={cx(styles.fieldPoster, styles.lightOnly)}
          />
          <img
            src="/posters/field-home-dark.svg"
            alt=""
            loading="lazy"
            decoding="async"
            className={cx(styles.fieldPoster, styles.darkOnly)}
          />
        </div>
      ) : null}
    </div>
  );
}
