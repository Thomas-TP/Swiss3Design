import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Middleware i18n uniquement pour l'instant — CSP nonce/en-têtes de sécurité
// avancés reportés (même séquencement que le storefront SolidStart, cf. plan
// Phase 5 : "middleware pas encore commencé"), à ajouter avant toute mise en
// production.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
