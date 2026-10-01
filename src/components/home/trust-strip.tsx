import { useTranslations } from "next-intl";
import { Fragment } from "react";

// Bande de réassurance (brief « Strates », §5.1) : une ligne mono sous le
// héros. Le seuil de livraison offerte vient des réglages (jamais écrit en
// dur) : la page le formate et nous le passe.
export function TrustStrip({ freeOver }: { freeOver: string }) {
  const t = useTranslations("landing.trust");
  const items = [
    t("shipping", { amount: freeOver }),
    t("made"),
    t("payment"),
  ];
  return (
    <div className="border-y border-line">
      <ul className="s3d-page s3d-label flex flex-wrap items-center gap-x-3 gap-y-1 py-4 normal-case text-soft">
        {items.map((item, index) => (
          <Fragment key={item}>
            {index > 0 && (
              <li aria-hidden="true" className="text-iso-index">
                ·
              </li>
            )}
            <li>{item}</li>
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
