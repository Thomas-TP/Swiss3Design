import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

import { createElement, type ComponentProps } from "react";
const navigation = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = navigation;
// Le rendu dynamique sollicite le Worker et Postgres : ne charger une autre
// page qu'au clic. Une route légère peut explicitement réactiver prefetch.
export function Link({
  prefetch = false,
  ...props
}: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, { ...props, prefetch });
}
