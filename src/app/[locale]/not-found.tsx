import {
  NotFoundContent,
  notFoundMetadata,
} from "@/components/not-found-content";

// 404 d'une page qui correspond à une route mais lance notFound() (produit
// supprimé) : rendue dans le layout [locale], donc déjà habillée. Le contenu
// est partagé avec la 404 des URL inconnues (src/app/not-found.tsx).
export const generateMetadata = notFoundMetadata;
export default NotFoundContent;
