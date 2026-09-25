const SUPPORTED_LOCALES = new Set(["fr", "de", "it", "en"]);

// Les appels fetch n'empruntent pas le rendu du layout. Ce repli couvre donc
// l'onglet resté ouvert exactement au moment où la fenêtre sensible expire.
export function redirectToAdminReauthentication() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] ?? "fr";
  const locale = SUPPORTED_LOCALES.has(firstSegment) ? firstSegment : "fr";
  const pathname = SUPPORTED_LOCALES.has(firstSegment)
    ? `/${segments.slice(1).join("/")}`
    : window.location.pathname;
  const next = `${pathname || "/admin"}${window.location.search}${window.location.hash}`;
  const query = new URLSearchParams({ next, reauth: "admin" });
  window.location.assign(`/${locale}/account/login?${query}`);
}
