# Refonte 2026 — carte du code existant (ce que la refonte doit savoir)

> Recherche en lecture seule sur `C:/Perso/github/swiss3design/Swiss3Design`
> (branche `claude/redesign-2026`, snapshot = `main` @ `e7f4c12`). Rien n'a été
> modifié dans le dépôt. Chemins relatifs à la racine du repo.

---

## 0. TL;DR — les contraintes dures (casser l'une = casser la prod)

1. **Worker Cloudflare unique (OpenNext)** : tout composant client est AUSSI
   rendu côté serveur dans le Worker. Une lib importée au niveau module d'un
   composant `"use client"` entre dans le bundle serveur. Bundle actuel
   **2 946 KiB gzip** (mesure 2026-09-27), plafond Workers Paid **10 MiB gzip**
   ; chaque KiB rallonge le cold start. Mesurer avec
   `bunx wrangler deploy --dry-run` (ligne `Total Upload: … / gzip:`).
2. **WebGL/Three.js = `next/dynamic(() => import(...), { ssr: false })` déclaré
   dans un composant CLIENT** (le `ssr:false` est interdit dans un Server
   Component). Importer `showroom-scene.ts` en statique depuis
   `product-gallery.tsx` coûte ~243 KiB gzip au Worker (golden rule 10). À
   l'intérieur des modules 3D : `import type * as THREE` + `await import("three")`
   dans les effets.
3. **CSP nonce en prod** (`src/middleware.ts`) : `script-src 'self' 'nonce-…'`
   - js.stripe.com + static.cloudflareinsights.com + *.posthog.com. **Aucun
     script CDN** (GSAP/Lenis/etc. doivent être installés via `bun add` et
     bundlés). Tout `<script>` inline serveur doit porter
     `(await headers()).get("x-nonce")`. Pas de `'unsafe-eval'` ni
     `'wasm-unsafe-eval'` en prod (voir § 14). `bun run dev` NE révèle PAS ces
     blocages → vérifier avec `bun run preview`.
4. **Jamais `redirect()` dans une Server Action** (gèle l'UI sur Workers) :
   renvoyer `{ status }`/`{ error }` et naviguer côté client (`router.push`).
   Les `redirect()` de `@/i18n/navigation` dans des Server Components/layouts
   (compte, admin, consentement OAuth) sont, eux, légitimes.
5. **`src/middleware.ts` reste `middleware.ts`** (Edge) — jamais `proxy.ts`.
6. **Pas de Turbopack pour le build prod** : `open-next.config.ts` →
   `npx next build --webpack`. Conséquence : pas de loader GLSL exotique ;
   écrire les shaders en chaînes TS (template literals) plutôt qu'en `.glsl`
   importés.
7. **Aucun binaire via une convention de fichier Next** (`app/icon.*`,
   `apple-icon.*`, `opengraph-image.*`, `twitter-image.*`) ni image
   `import`ée : ils sont inlinés en base64 dans le bundle. Tout média va dans
   `public/` (static assets Cloudflare, hors bundle, ≤ 25 MiB par fichier) et
   est référencé par URL.
8. **i18n** : tout texte UI dans `messages/{fr,de,it,en}.json` (fr = repli),
   ajouter chaque clé dans les **4** fichiers. Liens/navigation via
   `@/i18n/navigation` (`Link`, `useRouter`, `usePathname`, `redirect`), jamais
   `next/link` nu.
9. **Argent = entiers `*_cents` CHF**, affichage via `formatChf()`
   (`src/lib/format.ts`). Analytics en décimales via `chf()`.
10. **Bindings Cloudflare seulement dans une requête** (`getDb()`,
    `getAuth()`, `getCloudflareContext()` dans le handler, jamais au top-level).
11. **Le shell global est partagé par l'admin** : `src/app/[locale]/admin/*`
    hérite de `[locale]/layout.tsx` (Header, Footer, BottomNav, WebMcpTools).
    Tout effet global (Lenis, curseur custom, fond WebGL, transitions de page)
    touche aussi l'admin, le checkout et le compte → prévoir un groupe de
    routes `(site)` ou des exclusions par pathname.
12. **Les jetons de thème sont un contrat** : `paper surface elevated ink soft
line accent accent-dark night night-soft night-line swatch-ring` +
    `rounded-card`. Utilisés par **116 fichiers** dont **27 fichiers admin** sur
    48 (`rounded-card` : 110 occurrences). Renommer = casser l'admin (hors
    scope) → garder les noms (on peut changer leurs valeurs) ou migrer l'admin.

---

## 1. Modèle d'exécution

- Next **16.3.6** App Router, React **19.3.0**, next-intl **4.14.7**, Tailwind
  **4.3**, motion **13.4.4**, three **0.186.1**, lucide-react, Stripe
  (`@stripe/react-stripe-js` 6.12 / `@stripe/stripe-js` 9.17), better-auth
  1.7.6 (+ passkey, oauth-provider), posthog-js, qrcode.react, zod 4.
  **Pas installés** : gsap, lenis, @react-three/fiber, drei.
- Compilé par `@opennextjs/cloudflare` → `.open-next/worker.js` + assets.
  `placement: aws:eu-central-1` (près de Neon Francfort).
- `next.config.ts` : `poweredByHeader: false`, `images.unoptimized: true`
  (optimisation = Cloudflare Images via `cfImage()`, prod only), plugin
  next-intl (`./src/i18n/request.ts`). Aucune config `experimental`.
- Il n'existe **pas** de `src/app/layout.tsx` : **`src/app/[locale]/layout.tsx`
  est le root layout** (`<html>`/`<body>`). Les routes hors locale
  (`sitemap.xml`, `robots.txt`, `llms.txt`, `mcp`, `a2a`, `.well-known/*`,
  `agents.md`, `auth.md`, `openapi.json`, `manifest.ts`) sont des route
  handlers sans layout.
- Quasi toutes les pages sont `export const dynamic = "force-dynamic"` et le
  layout lit `headers()`, `cookies()` et `getCloudflareContext()` → **tout est
  rendu dynamiquement par requête** (Worker + Postgres/Hyperdrive). Aucun
  `loading.tsx`, aucune frontière `<Suspense>` aujourd'hui.
- `Link` localisé (`src/i18n/navigation.ts`) force **`prefetch = false`** par
  défaut (chaque prefetch = rendu Worker + Postgres). Une navigation attend
  donc la réponse serveur (≈ TTFB) avant de commuter — à habiller (voir
  `useLinkStatus`, § 17).
- CPU : l'incident « Workers Free 10 ms » (503) a poussé au plan Paid ; rester
  sobre en SSR (pas de SVG géant généré, pas de split de texte en milliers de
  `<span>` rendu serveur si évitable).

---

## 2. Shell global — `src/app/[locale]/layout.tsx` (163 l.)

Ordre exact (à reproduire ou reconstruire en connaissance de cause) :

```
<html lang={locale} className={`${geist.variable} antialiased`} suppressHydrationWarning
      data-geo-country/continent/region/region-code/city/tz={cf.*}>   ← lu par l'analytics
  <body className="flex min-h-screen flex-col">
    <script nonce={nonce}> anti-FOUC thème (localStorage 'theme' ou prefers-color-scheme) </script>
    <JsonLd data={siteJsonLd(locale, seo("organizationDescription"))} />   ← OnlineStore + WebSite
    <link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/json" />  ← hoisté par React 19
    <ThemeManager />
    <NextIntlClientProvider>            ← sans prop messages : v4 transmet TOUS les messages de la locale
      <CartProvider>
        <FavoritesProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only …">{nav.skipContent}</a>
          <Header hasSession={hasSession} />
          <main id="main-content" tabIndex={-1} className="flex-1 pb-24 lg:pb-0">{children}</main>
          <Footer />
          <BottomNav hasSession={hasSession} />
          <ConsentBanner />
          <WebMcpTools />               ← doit rester DANS CartProvider (lit/modifie le panier)
```

- `hasSession` = présence d'un cookie `*better-auth.session_token` (pas de
  requête DB) → avatar dans Header/BottomNav.
- `generateMetadata` du layout = socle (title template `%s · Swiss3Design`,
  description `seo.homeDescription`, icônes **déclarées à la main** depuis
  `public/brand/app/*` + `/favicon.ico`, OG `/brand/social/og-image.png`
  1200×630, Twitter `summary_large_image`, `metadataBase`). Les pages
  indexables surchargent via `pageMetadata()`.
- Police : `Geist` via `next/font/google`, variable `--font-geist-sans`
  (self-hostée par Next → `font-src 'self'` suffit).
- `globals.css` importé ici (`import "../globals.css"`).

Autres layouts :

- `checkout/layout.tsx` : metadata `title` + `NOINDEX`, passe-plat.
- `account/layout.tsx` : `metadata = { robots: NOINDEX }`.
- `account/(dashboard)/layout.tsx` : garde de session (`redirect` →
  `/account/login`), en-tête avatar (`AvatarPicker`, avatars
  `public/avatars/a01..a10.svg`) + `SignOutButton`, `AccountNav` (10 onglets +
  Admin si rôle), **contient un 2ᵉ `<main>` imbriqué dans le `<main>` racine
  (défaut a11y à corriger)**.
- `admin/layout.tsx` : garde rôle admin + fraîcheur de session,
  `MarkInternalVisitor`, `AdminShell` (sidebar). Hors scope mais hérite du
  shell public.

---

## 3. Thème clair/sombre

- Source de vérité : **classe `.dark` sur `<html>`** + `style.colorScheme`.
  - Script anti-FOUC inline (nonce) dans le layout au 1er chargement.
  - `ThemeManager` (`src/components/theme-manager.tsx`) ré-applique à chaque
    changement de pathname (via `next/navigation` pour inclure le préfixe de
    langue — `router.replace` de langue re-rend le layout), sur `pageshow`
    persisté (bfcache) et sur `storage` (synchro onglets).
  - `src/lib/theme.ts` : `resolveTheme()`, `applyTheme()`, `toggleTheme()`
    (persiste `localStorage.theme`), `useIsDark()` (useSyncExternalStore +
    MutationObserver sur la classe — valeur serveur `false`).
  - `ThemeToggle` (Sun/Moon, aria-label `nav.theme`).
- Tailwind : `@custom-variant dark (&:where(.dark, .dark *));`
- Consommateurs du thème à ne pas oublier : `stripeAppearance(isDark)`
  (Payment Element), toute scène WebGL qui doit suivre le thème (s'abonner à
  `useIsDark()`), la scène showroom est volontairement **identique** dans les
  deux thèmes.
- `manifest.ts` : `background_color #fafaf9`, `theme_color #1c1917` (pas de
  `<meta name="theme-color">` par thème aujourd'hui).

## 4. Jetons & CSS global (`src/app/globals.css`, 153 l.)

```
:root  --paper #fafaf9  --surface #fff  --elevated #fff  --ink #1a1614  --soft #6f6962  --line #e8e5e1
.dark  --paper #0b0a09  --surface #1a1714 --elevated #221e1b --ink #f4f1ed --soft #a39c92 --line #2a2622
@theme inline : --color-{paper,surface,elevated,ink,soft,line} → var(...)
  --color-accent #e5231c  --color-accent-dark #c01d14 (constants)
  --color-swatch-ring #767676 (contour pastilles, AA sur les deux fonds)
  --color-night #121110 / night-soft #a8a29b / night-line #2c2825 (panneau sombre constant)
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui
  --radius-card: 1.25rem
html { scroll-behavior: smooth }            ← CONFLIT avec Lenis (à neutraliser)
body { background paper + halo radial rouge 5 % en haut ; font-sans ; antialiased }
::selection { accent / blanc }
.faq-item (details/summary sans JS, chevron qui pivote)
.schematic-leaders/.schematic-dots/.schematic-callout/.schematic-hi (page À propos)
@media (prefers-reduced-motion: reduce) → coupe TOUTES les animations/transitions CSS (0.01ms !important)
```

- Le kill-switch reduced-motion ne concerne que le CSS : GSAP/Lenis/WebGL
  (JS) doivent être gérés à part (`gsap.matchMedia()`, Lenis désactivé,
  scènes figées).
- Pas de classe `.legal-prose` définie (utilisée par `LegalPage`, sans effet).
- Marque : rouge `#E5231C` seul dans le mark ; `public/brand/webp/mark.webp`
  (raster, non recolorable, rendu par `BrandMark` = simple `<img>`).
  Wordmark = texte « **Swiss**3Design » (`font-medium` + `font-bold`) dans
  Header/Footer. Tout nouveau visuel de marque doit être validé.
- Signature « 4 couleurs AMS » : `MulticolorDots` (#e5231c, #1d4ed8,
  #f59e0b, #1c1917 / #fafaf9 sur fond sombre).

## 5. Typographie

- Une seule famille : **Geist** (next/font/google, subsets latin, variable).
- **Couplage Stripe** : `checkout-flow.tsx` charge Geist DANS les iframes
  Stripe (`elementsOptions.fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" }]`)
  et `stripe-appearance.ts` fixe `fontFamily: "Geist, system-ui, sans-serif"`.
  Changer de police ⇒ mettre à jour ces deux endroits (+ `quote-pay-flow.tsx`
  qui n'envoie pas `fonts`). Une police non-Google doit être servie en URL
  publique avec en-tête CORS (`public/_headers`) pour être lisible depuis
  l'iframe `js.stripe.com`.
- CSP `font-src 'self' https://fonts.gstatic.com https://*.posthog.com data:` :
  Adobe Fonts / autres CDN bloqués → self-host via `next/font/local`.

---

## 6. Motion existant (à remplacer / réutiliser)

| Fichier                                                                   | Rôle                                                                                                                                                                                                                                     | Technique                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/reveal.tsx`                                               | Fade + translateY(18px) d'entrée (`animate` au montage ou `whileInView` once, margin -60px), easing `[0.21,0.65,0.36,1]`, 0.55 s, `delay` prop                                                                                           | motion/react, `useReducedMotion`                                  |
| `src/components/hero-scene.tsx` (230 l.)                                  | Hero « imprimante qui dépose un vase couche par couche » en boucle 5,6 s : clip-path + portique dérivés d'une seule motion value `reveal`, balayage X de la tête, flottement, filament pulsé                                             | 100 % DOM/CSS + motion, `aria-hidden`, reduced-motion → état figé |
| `src/components/header.tsx`                                               | Pastille active de la nav desktop qui glisse (`layoutId="nav-pill"`, spring 400/34)                                                                                                                                                      | motion `layoutId`                                                 |
| `src/components/product-viewer-3d.tsx` (191 l.)                           | `ModelViewer` (OrbitControls, damping, pan, clavier, pause si hors écran/onglet caché, recolor live via contexte couleur) + `ModelThumbnail3D` (rendu hors-écran 384² → dataURL PNG, `forceContextLoss`)                                 | three dynamique, `import type` only                               |
| `src/components/showroom-scene.ts` (341 l.)                               | Scène partagée : pièce fermée (murs texture canvas procédurale, parquet canvas), tapis rouge, socle + plinthe, `RoomEnvironment` PMREM, spot ombré 2048², rim/fill/2 point lights, ACES, cadrage ¾ ; STL ou GLB (matériau teinté unique) | 100 % procédural, aucun asset externe                             |
| `src/components/product-gallery.tsx`                                      | Galerie : grande image + vignettes, le 3D est le **dernier slot** ; `ModelViewer`/`ModelThumbnail3D` en `next/dynamic({ ssr:false })`                                                                                                    | pattern de référence anti-bundle                                  |
| `a-propos/printer-showcase.tsx` + `printer-schematic.tsx` (794 l. de SVG) | Schéma annoté interactif (survol ↔ légende, boutons focusables, épinglage)                                                                                                                                                               | SVG + CSS transitions                                             |
| `a-propos/about-nav.tsx`                                                  | Sommaire sticky `top-16` avec section active (scroll listener déterministe, `scrollIntoView({behavior:"smooth"})`, `history.replaceState`)                                                                                               | JS natif                                                          |
| Divers                                                                    | `hover:-translate-y-1` + zoom image sur cartes, `active:scale-[0.98]` sur boutons, barre de progression livraison offerte (`transition-[width]`), spinner paiement                                                                       | Tailwind                                                          |

Aucune animation liée au scroll (scrub/pin), aucun smooth scroll, aucune
transition de page, aucun shader aujourd'hui.

## 7. Garder Three.js (et tout WebGL) hors du bundle serveur — recette exacte

1. Composant client « enveloppe » (`"use client"`) qui déclare au top du
   module : `const Scene = dynamic(() => import("./scene").then(m => m.Scene), { ssr: false })`.
   (`import()` avec chemin littéral, `dynamic()` au top-level du module.)
2. Le module de scène : `import type * as THREE from "three"` pour les types ;
   `const THREE = await import("three")` et `await import("three/addons/...")`
   **dans** `useEffect`.
3. Jamais d'import statique d'un module qui importe `three` depuis un fichier
   rendu côté serveur (page, layout, composant client SSR). Même règle pour
   postprocessing, lil-gui, stats, R3F/drei si adoptés.
4. Pendant le chargement : placeholder de même ratio (évite CLS), `aria-hidden`
   sur les canvases décoratifs ; canvas interactif = `tabIndex=0` + `aria-label`.
5. Cycle de vie : `IntersectionObserver` + `document.hidden` pour couper le
   rAF, `renderer.dispose()` + `forceContextLoss()` au démontage (limite ≈ 16
   contextes WebGL par page : **un renderer partagé** est préférable à un
   renderer par vignette/carte).
6. DPR plafonné à 2 (`Math.min(devicePixelRatio, 2)`).
   Même logique pour GSAP/ScrollTrigger/SplitText/Lenis : pas besoin de SSR →
   `await import("gsap")` dans un effet, ou module client chargé via
   `dynamic({ ssr:false })`, pour ne pas alourdir le Worker (gsap+ScrollTrigger
   ≈ 45 KiB gzip, Lenis ≈ 5 KiB).

## 8. Patterns mobile & couches

- **BottomNav** (`src/components/bottom-nav.tsx`) : `fixed bottom-0 z-50`,
  `lg:hidden`, `paddingBottom: env(safe-area-inset-bottom)`, 5 entrées
  (home/Home, shop/LayoutGrid, custom/Sparkles, cart/ShoppingBag + badge
  compteur, account/CircleUser ou avatar), trait accent au-dessus de l'actif.
  `<main>` a `pb-24 lg:pb-0` ; le footer `pb-24 md:pb-0` (**incohérence md/lg**
  : entre 768 et 1023 px le footer n'a plus de marge alors que la barre est
  encore là).
- **Header** : `sticky top-0 z-40 h-16`, fond `paper/80` + `backdrop-blur-lg`,
  nav centrale en pilule seulement `lg+`, compte & panier cachés `< md` (la
  BottomNav prend le relais), favoris + thème + langue toujours visibles,
  wordmark caché `< 360px`. « À propos » n'est pas dans la BottomNav → bouton
  dédié `md:hidden` dans le hero de l'accueil.
- **ConsentBanner** : `fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))]
z-40` (au-dessus de la BottomNav), `lg:bottom-6 lg:left-6`, masquée sur
  `/checkout*` et `/admin*`.
- Offsets dépendants de la hauteur du header (64 px) : `AboutNav` `top-16` +
  `DETECTION_LINE = 150`, sections `scroll-mt-32`, colonnes sticky `top-24`
  (fiche produit `md:sticky md:top-24`, panier/checkout `lg:sticky lg:top-24`).
  Changer la hauteur du header ⇒ tout réaligner.
- Carte z-index : skip link z-50, BottomNav z-50, LocaleSwitcher menu z-50,
  Header z-40, Consent z-40, AboutNav z-30, Select menu z-20, favori sur carte
  z-10.
- Checkout mobile : récapitulatif (`order-1`) AVANT le formulaire.
- `AccountNav` : rangée horizontale scrollable en mobile, colonne `md:w-56`.

---

## 9. i18n — comment les pages obtiennent leurs textes

- Routing (`src/i18n/routing.ts`) : `locales ["fr","de","it","en"]`,
  `defaultLocale "fr"`, **`alternateLinks: false`** (hreflang uniquement via
  `alternatesFor()` de `lib/seo.ts`). Locale = 1er segment (`/fr/...`).
- `src/i18n/request.ts` : `import(\`../../messages/${locale}.json\`)`.
- Serveur : `getTranslations("ns")` (next-intl/server) ; en
  `generateMetadata` : `getTranslations({ locale, namespace })`.
- Client : `useTranslations("ns")`, `useLocale()` — via le
  `NextIntlClientProvider` du layout (tous les messages sérialisés).
- `LocaleSwitcher` : `router.replace(pathname + search + hash, { locale })`
  (listbox clavier complète) ; le cookie `NEXT_LOCALE` est re-posé durci par le
  middleware.
- **Contenus riches hors messages** (JSX par langue, à conserver tel quel) :
  `a-propos/about-content.tsx` (`ABOUT_CONTENT[locale]` : meta, badge, stats,
  imprimantes + callouts + specs, étapes, matières PLA, engagements, **FAQ**
  alimentant `faqJsonLd`, contact) ; `legal/{terms,privacy,shipping}/content.tsx`
  (sections `{title, body}`), `legal/legal-layout.tsx` (en-têtes/avis par langue
  codés en dur).
- Données catalogue localisées en base (`*_translations`).
- `messages/fr.json` (748 l.) — namespaces : `common` (2), `nav` (10),
  `home` (25 : heroBadge/Title/Subtitle, ctaShop/ctaCustom, featured*,
  multicolor*, trust{Shipping,Made,Payment}{Title,Text}, process*,
  customBand*), `shop` (14), `product` (20), `reviews` (9), `viewer` (6),
  `cartLink` (2), `cartReminder` (9), `cart` (14), `checkout` (57),
  `orderSuccess` (12), `attribution` (7), `consent` (5), `track` (26),
  `custom` (20), `favorites` (7), `account` (26, imbriqué : nav, status…),
  `auth` (35, imbriqué : twoFactor, passwordless), `errors` (6), `contact`
  (14), `footer` (14), `orderPayment` (3), `seo` (20), `agentAccess` (4,
  imbriqué : scopes, consent, claim, account).
- ⚠ Les clés `home.trust*Title` sont **réutilisées par la fiche produit**
  (réassurance) ; `footer.terms` par le checkout ; `account.status` par
  `/track`. Renommer une clé = chercher tous ses usages.
- Contraintes SEO sur `seo.*` : titre complet ≤ 60 car. (le gabarit ajoute
  « · Swiss3Design »), description 110–160 car.

---

## 10. Pages publiques — fiche par route

Légende priorité : **core** (à redessiner en profondeur), **secondary**,
**utility** (restyle léger, logique intouchable), **skip**.

### `/[locale]` — Accueil (`page.tsx`, 241 l.) — core

- Données : `getProducts(locale, { featuredOnly: true })` (produits
  `featured` triés `featuredOrder`), `getShippingSettings()` (seuil port
  offert → `formatChf` dans les textes), traductions `home`, `nav`.
- Sections : hero (badge, h1, sous-titre, CTA shop accent + CTA sur mesure +
  « À propos » mobile, `HeroScene`), réassurance ×3, panneau « nuit »
  multicolore (barres 4 couleurs), « Comment ça marche » (3 étapes `<ol>`),
  sélection (`ProductCard` grid), bandeau sur mesure.
- Pas d'action serveur, pas d'état client propre (cartes : panier/favoris).
- À préserver : `pageMetadata({ path: "", absoluteTitle: true })`, 1 seul
  `<h1>` (texte SSR = LCP), liens `/shop` et `/custom`, montants port offert
  dynamiques, `ProductCard` (h2 + lien étiré, favori, ajout rapide + event
  `Product Added` source `catalog`).

### `/[locale]/shop` — Catalogue (`shop/page.tsx`, 303 l.) — core

- `searchParams` : `category`, `material`, `color`, `multicolor=1`, `sort`
  (`new|price_asc|price_desc`), `q`. `getUsedFilters(locale)` (catégories,
  matières, couleurs réellement utilisées) + `getProducts(locale, {...})`.
- **Filtres = liens `<Link>` (SSR, sans JS)** ; recherche = `<form>` GET vers
  `/${locale}/shop` avec champs cachés conservant les filtres. Pastilles
  couleur : `<span class="sr-only">{nom}</span>` (a11y + SEO).
- JSON-LD `collectionJsonLd` **seulement** si catalogue non filtré.
- Events : `Products Searched {query, results}`, `Product List Filtered
{category, material, color, multicolor, sort, results}` (via `TrackEvent`).
- Canonical toujours `/shop` ; facettes `sort/material/color/q` en `Disallow`
  dans `robots.txt` → ne pas inventer de nouveau paramètre sans l'ajouter
  (robots + `KEPT_PARAMS` analytics).
- Grille : 1 col < 480 px, 2 cols, 3 cols `lg`.

### `/[locale]/products/[slug]` — Fiche produit (360 l.) — core

- `cache(getProductBySlug)` partagé metadata/page ; puis en parallèle
  `getRelatedProducts`, `getPublishedReviews`, `getRatingSummary`,
  `getShippingSettings`, traductions `product/reviews/home/seo/shop`.
  `notFound()` si absent (avant tout Suspense pour garder un vrai 404).
- Metadata : titre enrichi `seo.productTitle` si nom ≤ 20 car., description
  calculée (`productMetaDescription` : 1er paragraphe 110–160 car. ou phrase
  générée `seo.productDescription`), OG = jusqu'à 4 photos via `cfOgImage`
  (JPEG 1200×630, SVG exclus).
- JSON-LD : `productJsonLd` (prix CHF, dispo InStock/OutOfStock, livraison,
  retours, note, matière, poids, dimensions, couleurs, images) +
  `breadcrumbJsonLd` (Accueil › Boutique › Produit).
- Event `Product Viewed` (`productProperties` + `in_stock`, `rating`,
  `reviews`).
- UI : `ProductColorProvider` enveloppe les DEUX colonnes (galerie ↔ achat
  partagent la couleur ; le viewer 3D se reteinte en live). `ProductGallery`
  (images `cfImage` 1200/200, `fetchPriority="high"` sur la grande, slot 3D
  final si `model3dUrl`). Colonne droite sticky : badge multicolore, h1,
  1er paragraphe, étoiles, `ProductPurchase` (badge dispo, prix, pastilles
  couleur `aria-pressed`, variantes, `AddToCart` accent `aria-live`,
  `FavoriteButton`, `BuyNow` → `/checkout`), réassurance ×3, paragraphes
  suivants, **fiche technique `<dl>` rendue serveur** (matière, dimensions,
  poids, délai, provenance — lue par moteurs/agents), avis (liste),
  produits liés (4 `ProductCard`).
- Opportunité : morph `ViewTransition` carte → galerie (même `name` par slug).

### `/[locale]/custom` — Sur mesure / devis (`custom/`) — core

- Serveur : `getMaterials()` ; JSON-LD `customServiceJsonLd`.
- `QuoteForm` (client) : `useActionState(submitQuoteRequest)` (Server Action
  `custom/actions.ts` : rate limit 5/10 min, zod, insert `quote_requests` +
  `status_events` en transaction, e-mail admin via outbox ; renvoie `{status}`
  — **aucun redirect**). Upload fichier **avant** l'envoi via
  `POST /api/quote-upload` (FormData, `.stl,.3mf,.obj,.step,.stp`) → champs
  cachés `fileKey`/`fileName`. E-mail prérempli via `useSession()`.
- Event `Quote Requested {material, has_file, signed_in}` au succès.
- À préserver : champs `email, description (min 10), material, colors,
dimensions, locale`, états succès/erreur, labels `htmlFor`.
- Le doc `docs/refonte-plateforme-2026.md` (non implémenté) décrit une
  « Forge » (devis instantané, analyse de fichier, viewer 3D sur upload).

### `/[locale]/a-propos` — À propos (322 l. + contenu 1 307 l.) — core

- Contenu `ABOUT_CONTENT[locale]` ; metadata depuis ce contenu.
- JSON-LD `webPageJsonLd({type:"AboutPage"})` + **`faqJsonLd(c.faq)`** (la
  FAQ visible DOIT rester dans le HTML SSR).
- Sections ancrées `equipment, process, materials, trust, faq, contact`
  (`scroll-mt-32`) + `AboutNav` sticky (enfant direct du conteneur racine,
  sinon le sticky se décolle — bug réel documenté).
- `PrinterShowcase` (onglets par imprimante, schéma SVG annoté interactif,
  specs), FAQ `<details class="faq-item">` sans JS, `ContactForm`.
- Photo : `public/about/p1s-ams2-pro.jpg`.

### `/[locale]/contact` — secondary

- JSON-LD `webPageJsonLd({type:"ContactPage"})`, `pageMetadata`.
- `ContactForm` (partagé avec À propos) : `useActionState(submitContactMessage)`
  (`a-propos/actions.ts` : rate limit, zod, **honeypot `company`** caché
  `aria-hidden`, 2 e-mails via outbox, renvoie `{status}`). Lien
  `mailto:contact@swiss3design.ch` + lien `/custom`.

### `/[locale]/cart` — Panier (NOINDEX) — utility

- Serveur : `getShippingSettings()`. Monte `CartRecovery` (jeton
  `#restore=` dans le fragment → `POST /api/cart-reminder/restore`) et
  `CartLinkImport` (`?item=slug|qty||Couleur` générés par les agents →
  revalidés via l'API publique, puis URL nettoyée).
- `CartContent` (client) : lignes (qty ±, supprimer), sous-total, port
  (`shippingFor`), barre de progression port offert, CTA `/checkout`,
  `CartReminder` (opt-in nLPD **case décochée par défaut**, vérif e-mail
  invité par code, `POST /api/cart-reminder`).
- Events `Cart Viewed` (une fois, après hydratation), `Product Removed`.

### `/[locale]/checkout` — Tunnel (NOINDEX) — utility (logique intouchable)

- Serveur : `getCloudflareContext()` → `env.STRIPE_PUBLISHABLE_KEY` (clé TEST
  en preview), session + adresse par défaut (`customer_addresses`).
- `CheckoutFlow` (955 l.) : étape 1 = contact (e-mail de compte ou
  `GuestEmailVerification` à 6 chiffres), adresse **Suisse uniquement**
  (`StreetAutocomplete` combobox ARIA sur `api3.geo.admin.ch`, NPA 4 chiffres,
  `Select` canton, pays figé), case « enregistrer l'adresse » ; code promo
  (`/api/discount/validate`) ; `POST /api/checkout` avec clé d'essai
  idempotente (empreinte SHA-256, `sessionStorage s3d-checkout-attempt`).
  Étape 2 = **`CheckoutElementsProvider` + `PaymentElement`** (Stripe Checkout
  Sessions, layout accordéon, `stripeAppearance(isDark)`, polices Geist),
  `checkout.confirm()` puis `router.push('/checkout/success?session_id=…')`.
  Stripe.js préchargé en idle (`@stripe/stripe-js/pure`).
- Events : `Checkout Started`, `Coupon Applied/Denied`, `Checkout Step
Viewed {step:2,…}`, `Payment Info Entered`, `Payment Failed {error_code,
decline_code}`.
- **Légal** : mention `checkout.termsPrefix` + lien CGV `/legal/terms` sous
  le bouton payer, « Sécurisé par Stripe ». `ph-mask` sur l'e-mail affiché.
- ⚠ `window.scrollTo({ top: 0, behavior: "smooth" })` au passage à l'étape 2
  (à router vers Lenis si smooth scroll global) ; bannière consentement masquée
  ici. Recommandation : **pas de smooth scroll / effets lourds sur le tunnel**.

### `/[locale]/checkout/success` — Confirmation — utility

- `stripe.checkout.sessions.retrieve` + `settleSession()` (finalisation
  idempotente, en double du webhook), statut `succeeded|processing|failed`.
- `ClearCart`, `TrackEvent "Order Completed"` (`onceKey = order_id`,
  `revenue` = montant payé port compris — propriété lue par PostHog Revenue),
  `AttributionQuestion` (`Attribution Survey Answered`), conversion invité →
  compte (`/account/register?email=`) et lien `/track?order=`.

### `/[locale]/track` — Suivi invité (NOINDEX) — utility

- `TrackFlow` : n° + e-mail → `POST /api/track-order` ; résultat : statut
  (palette `statusStyle`), lien Poste suisse, lignes, totaux, adresse.
  `?order=` prérempli. Exclu des replays PostHog.

### `/[locale]/favorites` — Favoris (NOINDEX) — secondary

- 100 % client (`localStorage s3d-favorites-v1`), « tout ajouter au panier ».
  Events `Product Added to Wishlist` / `Product Removed from Wishlist`
  (émis par `FavoritesProvider.toggle/remove`).

### `/[locale]/legal/{terms,privacy,shipping}` — utility (texte intouchable)

- `pageMetadata` + `LegalPage` (h1, « Swiss3Design — Gland (VD), Suisse ·
  Dernière mise à jour : … » via `LEGAL_UPDATED`, avis « la version française
  fait foi » en de/it/en) + `Section` numérotées.
- `LEGAL_UPDATED` alimente aussi les `<lastmod>` du sitemap.
- Privacy monte `<AnalyticsOptOut>` (droit d'opposition, art. 45c LTC) et
  liste les sous-traitants (Cloudflare, Neon, Stripe/Link, Resend, Google,
  PostHog…). **Tout nouveau service tiers de la refonte (police/vidéo/3D
  hébergée ailleurs) ⇒ mise à jour de la politique dans les 4 langues.**

### Compte (NOINDEX) — utility

- `/account/login` (`LoginForm` 455 l. : mot de passe, **passkey + WebAuthn
  conditional UI** `autoComplete="username webauthn"`, 2FA TOTP/backup,
  e-mail OTP, ne pas `router.push` quand better-auth répond `{redirect,url}`
  (flux OAuth), `next` interne uniquement, `reauth=admin`), `SocialButtons`
  (Google si configuré), liens inscription + `/track`.
- `/account/register` (`RegisterForm`, event `Signed Up`, email prérempli),
  `/account/forgot-password`, `/account/reset-password`.
- `(dashboard)` : vue d'ensemble (commandes/devis récents + compteurs),
  `orders` + `orders/[id]` (`ReviewForm` → `submitReview`, `ReorderButton` →
  `getReorderItems` puis `router.push('/cart')`), `quotes` + `quotes/[id]`
  (fil de messages, `requestQuoteRevision`, `declineQuote`) + `quotes/[id]/pay`
  (**2ᵉ Payment Element** `QuotePayFlow` via `/api/quote-checkout`),
  `profile` (nom, e-mail), `addresses` (CRUD + défaut), `payment` (cartes
  Stripe en lecture seule), `security` (mot de passe, passkeys, sessions par
  appareil, comptes liés, 2FA avec QR `qrcode.react`), `agents` (révocation
  accès OAuth/auth.md), `notifications` (opt-ins), `privacy` (export JSON,
  suppression de compte nLPD). Classes partagées dans `(dashboard)/_ui.ts`.

### Agents OAuth — utility

- `/oauth/consent` (requête signée better-auth, `ScopeList`, `ConsentForm`
  POST `/oauth2/consent`, avertissement non vérifié) ;
  `/agent/claim` (code 6 chiffres, `confirmAgentClaim/denyAgentClaim`).

### Système

- `not-found.tsx` (event `Page Not Found`), `error.tsx` (`trackException`,
  bouton `reset`), `[...rest]/page.tsx` → `notFound()` (404 dans le shell).
- `/admin/*` : **skip** (hors scope) — mais hérite du shell et des jetons.

---

## 11. Analytics (PostHog UE, régime suisse opt-out) — ce qui doit survivre

- `track()` (`src/lib/analytics.ts`, file bornée avant chargement) côté client,
  `<TrackEvent event properties onceKey>` depuis un Server Component.
- `posthog-js` n'est importé QUE par `src/instrumentation-client.ts` (idle) —
  ne jamais l'importer ailleurs (bundle Worker).
- Relais first-party `/api/relay/*` dans le middleware ; `data-geo-*` sur
  `<html>`.
- Liste des événements à conserver (noms = spec e-commerce PostHog) :
  `Product Viewed`, `Products Searched`, `Product List Filtered`,
  `Product Added` (source `product_page|catalog|buy_now`), `Product Added to
Wishlist`, `Product Removed from Wishlist`, `Cart Viewed`, `Product Removed`,
  `Checkout Started`, `Checkout Step Viewed`, `Coupon Applied`, `Coupon
Denied`, `Payment Info Entered`, `Payment Failed`, `Order Completed`
  (onceKey), `Attribution Survey Answered`, `Quote Requested`, `Signed Up`,
  `Page Not Found`, + `trackException` (error boundary).
- `ph-mask` sur toute donnée perso affichée ; inputs masqués d'office.
- ⚠ **Autocapture / actions PostHog** : le projet (EU 285063) définit des
  actions/objectifs ; si certaines reposent sur des sélecteurs CSS/texte
  d'éléments (autocapture `$elements_chain`), la refonte les cassera
  silencieusement → auditer les définitions d'actions avant de livrer (via le
  connecteur PostHog). Heatmaps/replays : l'ancien DOM ne sera plus comparable.
- Consentement : `ConsentBanner` (texte `consent.*`, « OK » / « Refuser »,
  lien politique) — information art. 45c LTC, ne bloque rien ;
  `localStorage["s3d-consent"]`, opt-out `s3d-analytics-optout`.

## 12. Surfaces agents IA à préserver

- `<WebMcpTools />` (layout) : `navigator.modelContext.registerTool` —
  `search_products`, `get_product`, `get_store_info`, `view_cart`,
  `add_to_cart`, `remove_from_cart`, `go_to_checkout` (consequential),
  `track_order`. Dépend de `useCart()`, `useLocale()`, `useRouter()`.
- `<link rel="ai-catalog">` dans le layout ; en-tête HTTP `Link` (api-catalog,
  OpenAPI, agents.md, llms.txt, ai-catalog) + `Vary: Accept` posés par le
  middleware sur chaque page.
- **Négociation Markdown** : `Accept: text/markdown` → la page HTML SSR est
  convertie par Workers AI (`/api/agent/markdown`), JSON-LD extrait. ⇒ le
  contenu doit exister en **HTML serveur lisible** (pas seulement dans un
  canvas, pas de texte injecté uniquement au montage client ; un split de
  texte doit garder le mot entier accessible : `aria-label` sur le parent +
  `aria-hidden` sur les fragments).
- Liens panier agents `?item=` (`CartLinkImport`) et restauration `#restore=`
  (`CartRecovery`) sur `/cart`.
- `llms.txt`, `agents.md`, `auth.md`, `/mcp`, `/a2a`, `/api/v1`,
  `/.well-known/*` : route handlers, non concernés par l'UI mais la page
  `STATIC_PAGES` du sitemap et `llms.txt` doivent être mis à jour si des
  pages publiques sont ajoutées/renommées.

## 13. SEO

| Route                                                                            | Metadata                               | JSON-LD                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| layout (toutes)                                                                  | socle + icônes + OG défaut             | `siteJsonLd` (OnlineStore + WebSite, référencés par `@id`) |
| `/`                                                                              | `pageMetadata(path:"", absoluteTitle)` | —                                                          |
| `/shop`                                                                          | `pageMetadata("/shop")`                | `collectionJsonLd` (non filtré)                            |
| `/products/[slug]`                                                               | `pageMetadata` + OG photos             | `productJsonLd`, `breadcrumbJsonLd`                        |
| `/custom`                                                                        | `pageMetadata`                         | `customServiceJsonLd`                                      |
| `/a-propos`                                                                      | `pageMetadata` (contenu)               | `webPageJsonLd(AboutPage)`, `faqJsonLd`                    |
| `/contact`                                                                       | `pageMetadata`                         | `webPageJsonLd(ContactPage)`                               |
| `/legal/*`                                                                       | `pageMetadata`                         | —                                                          |
| cart, checkout(+success), track, favorites, account/*, oauth, agent/claim, admin | `NOINDEX` / `index:false`              | —                                                          |

- `pageMetadata()` (`src/lib/seo.ts`) = title, description, canonical,
  hreflang 4 langues + `x-default` → FR, OG complet (fusion superficielle de
  Next !), Twitter. `JsonLd` lit lui-même le nonce et échappe `<`.
- `sitemap.xml/route.ts` `STATIC_PAGES` : `"" /shop /custom /a-propos /contact
/legal/terms /legal/privacy /legal/shipping` (+ produits). Nouvelle page
  publique ⇒ l'y ajouter (+ `llms.txt` si utile).
- `robots.txt` (route écrite à la main) : Disallow account/admin/checkout/
  cart/track/favorites + facettes ; `Allow /api/files/products/` (images
  produit R2) et `/api/v1/`.
- Images produit : `/api/files/products/...` (R2 via route), transformées par
  `cfImage(url, {width})` → `/cdn-cgi/image/format=auto,…` **en prod
  seulement** (dev/preview : URL brute). SVG jamais transformés (6 SVG de démo
  dans `public/products/`). Le panier et les favoris n'utilisent pas
  `cfImage` (opportunité).
- Un seul `<h1>` par page ; `ProductCard` titre en `<h2>` avec lien étiré
  (`after:absolute after:inset-0`), boutons internes en `z-10`.

## 14. CSP de prod — implications pour une stack motion

Politique exacte (`buildCsp`, `src/middleware.ts`) :

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self';
script-src 'self' 'nonce-X' https://js.stripe.com https://static.cloudflareinsights.com https://*.posthog.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.posthog.com
font-src 'self' https://fonts.gstatic.com https://*.posthog.com data:
img-src 'self' data: blob: https:
connect-src 'self' https://*.stripe.com https://m.stripe.network https://fonts.googleapis.com https://api3.geo.admin.ch https://cloudflareinsights.com https://*.posthog.com
frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network
worker-src 'self' blob: data:;  manifest-src 'self';  report-uri/report-to /api/csp-report;  upgrade-insecure-requests
(media-src absent → retombe sur default-src 'self')
```

- `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

Conséquences :

- Scripts : uniquement bundlés (`'self'`) → `bun add gsap lenis …` ; aucun
  `<script src=cdn>`. Scripts inline serveur = nonce obligatoire. Next pose
  lui-même le nonce sur ses scripts (runtime, hydratation, **scripts de
  révélation Suspense en streaming**) car le middleware recopie la CSP dans les
  en-têtes de requête GET — vérifier en `bun run preview`.
- **Pas de `'wasm-unsafe-eval'`** : tout WebAssembly (décodeur Draco, KTX2/Basis,
  meshopt, Rive, runtime Spline, physique Rapier…) sera bloqué en prod →
  ajouter `'wasm-unsafe-eval'` au `script-src` si besoin (changement de
  sécurité à valider) ou éviter le WASM. Pas de `'unsafe-eval'` non plus (libs
  qui compilent via `new Function` bloquées).
- **Vidéo** : `media-src` = `'self'` → vidéos (ex. rendus Higgsfield/Runway)
  à auto-héberger dans `public/` (≤ 25 MiB/fichier, static assets, cache long
  via `public/_headers`) ou via une route R2 ; Cloudflare Stream/Mux/Vimeo/
  YouTube exigeraient d'élargir `media-src`/`connect-src`/`frame-src`.
- `connect-src` : charger HDRI/GLB/textures/fonts depuis un autre domaine
  (Poly Haven, CDN, Spline) est bloqué → servir depuis `'self'` (`public/` ou
  `/api/files/...`). `img-src https:` autorise les images de n'importe où,
  mais `fetch`/XHR (loaders Three) non.
- `style-src 'unsafe-inline'` → styles inline de motion/GSAP OK ;
  `worker-src blob:` → OffscreenCanvas/worker de rendu OK.
- Polices tierces (Typekit…) bloquées → `next/font/local`.

## 15. Stripe Payment Element — ce qui doit survivre

- `@stripe/react-stripe-js/checkout` (`CheckoutElementsProvider`,
  `PaymentElement`, `useCheckoutElements`), `loadStripe` depuis
  `@stripe/stripe-js/pure` (pas d'injection au simple import), promesse
  singleton, préchargée en idle au montage du checkout.
- Clé publiable : `env.STRIPE_PUBLISHABLE_KEY` (runtime) avec repli
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `stripeAppearance(dark)` (`src/lib/stripe-appearance.ts`) : thèmes
  `stripe`/`night`, sélecteurs **supportés uniquement** (`.Input`, `.Label`,
  `.Error`, `.AccordionItem`, `.Dropdown*`) — un sélecteur non supporté fait
  échouer le rendu. Couleurs codées en dur = jetons actuels (à resynchroniser
  si la palette change).
- Deux intégrations : checkout boutique + paiement de devis
  (`account/(dashboard)/quotes/[id]/pay/quote-pay-flow.tsx`).
- Éviter autour de l'iframe : smooth scroll qui détourne le focus/scroll de
  l'accordéon, `overflow:hidden`/transforms animés sur les ancêtres pendant la
  saisie, overlays WebGL plein écran (3DS ouvre sa propre modale iframe).

## 16. Libellés/légal à ne pas altérer

- Contenus `legal/*/content.tsx` (4 langues, FR fait foi), `LEGAL_UPDATED`.
- Bannière consentement (`consent.*`) + `AnalyticsOptOut` dans la politique.
- Opt-in relance panier : case **non cochée** par défaut + texte
  `cartReminder.consent` (nLPD).
- Checkout : lien CGV avant paiement, « Suisse uniquement », mentions de
  sécurité ; moyens de paiement du footer (`TWINT, Visa, Mastercard, Google
Pay`), copyright `footer.copyright`, crédit « Site créé par » + logo
  Calyroc (`public/credits/calyroc-logo.png`, lien externe).
- Footer : colonnes Boutique (shop, custom, favoris, suivi), Compte & aide
  (compte, à propos, contact), Informations (CGV, confidentialité, livraison
  & retours), « Conçu et imprimé dans l'arc lémanique (VD) ».
- Honeypot du formulaire de contact, rate limits côté actions.

---

## 17. Next 16 / React 19.3 — fonctionnalités utiles à une refonte motion

(sources : `node_modules/next/dist/docs/01-app/…`)

- **`<ViewTransition>`** exporté par `react` 19.3 stable (vérifié dans
  `node_modules/react/cjs/react.production.js`), aucune config Next requise
  (`02-guides/view-transitions.md`). Déclenché par les navigations (qui sont des
  transitions), `<Suspense>` et `useDeferredValue`, pas par `setState`.
  - Morph d'élément partagé : même `name` des deux côtés (`share="morph"` +
    `default="none"` pour ne pas animer à chaque transition) → idéal carte
    produit → galerie.
  - Directionnel : `<Link transitionTypes={['nav-forward']}>` (prop présente
    dans `next/dist/client/app-dir/link.d.ts` et relayée par le `Link` de
    next-intl) + `router.push(url, { transitionTypes })`. Wrapper dans chaque
    `page.tsx` (pas le layout). Ancrer le header avec
    `viewTransitionName: 'site-header'`.
  - `::view-transition { pointer-events: none }` et règle reduced-motion
    dédiée (le kill-switch CSS actuel ne vise pas les pseudo-éléments VT).
  - Ici : pas de prefetch + pages dynamiques ⇒ l'ancien écran reste affiché
    pendant le rendu serveur, puis le morph joue au commit (pas de fallback
    `loading.tsx` qui casserait la paire). Il faut donc un indicateur
    d'attente.
- **`useLinkStatus()`** (`next/link`) : état `pending` d'un lien — recommandé
  précisément quand le prefetch est désactivé et que la route est dynamique
  sans `loading.js` (notre cas) → rideau/progress bar de transition.
  `Link.onNavigate` existe aussi (hook avant navigation).
- **Streaming `<Suspense>` / `loading.tsx`** (`02-guides/streaming.md`) :
  aucun aujourd'hui. Utile pour peindre le hero immédiatement et streamer la
  sélection produits/avis. Garder LCP (h1, image héro) hors Suspense ;
  `notFound()` avant toute frontière pour un vrai 404 ; un fallback qui ne
  réserve pas la hauteur = CLS ; chaque boundary = unité d'hydratation
  sélective (INP). Les bots HTML-limités reçoivent les metadata bloquantes.
- **`next/font`** (google ou local) : self-hosting automatique, pas de
  requête tierce, variable CSS (`variable: "--font-…"`), compatible CSP
  `'self'`. Pour une display font variable (ex. « Neue Montreal », « PP
  Editorial », « Geist » + mono), préférer `next/font/local` avec woff2 dans
  le repo.
- **Frontière client** (`02-guides/server-and-client-boundary.md`,
  `lazy-loading.md`) : les Client Components sont pré-rendus (SSR) ;
  `dynamic(..., { ssr:false })` uniquement dans un Client Component ; un
  Server Component qui importe dynamiquement un Client Component n'a pas de
  code splitting automatique ; `import()` avec chemin littéral, `dynamic()`
  au top-level.
- **`<Activity>`** exporté par React 19.3 : garder un sous-arbre monté mais
  caché (ex. conserver une scène/état sans la re-créer) — à évaluer.
- `instrumentation-client.ts` s'exécute avant l'hydratation (déjà utilisé
  pour PostHog en idle) — ne pas y mettre Lenis/GSAP (pas de gain, risque
  LCP).
- Hors périmètre / risqué avec OpenNext : `cacheComponents`, partial
  prefetching, `use cache` (non activés ; valider la compat OpenNext avant).
- `next/image` n'est pas utilisé (`images.unoptimized`, lint
  `no-img-element` off) — garder `<img>` + `cfImage()`.

## 18. Pièges d'intégration Lenis / GSAP / WebGL propres à ce code

- **Lenis plutôt que ScrollSmoother** : Lenis garde le scroll natif
  (`window.scrollY`), donc `position: sticky` (header, colonne produit,
  récap panier/checkout, AboutNav) continue de fonctionner ; un smooth scroll
  par `transform` (ScrollSmoother, Locomotive v4) les casse.
- Retirer/neutraliser `html { scroll-behavior: smooth }` (conflit Lenis) ;
  remplacer `window.scrollTo({behavior:"smooth"})` (checkout) et
  `scrollIntoView({behavior:"smooth"})` (AboutNav) par `lenis.scrollTo` en
  conservant l'offset header ; synchroniser `ScrollTrigger.update` sur le
  scroll Lenis et piloter les deux avec un seul rAF (`gsap.ticker`).
- `OrbitControls` (zoom molette) sur le canvas produit → `data-lenis-prevent`
  sur le conteneur ; idem listes scrollables (Select, LocaleSwitcher, nav
  horizontale compte/À propos, suggestions d'adresse).
- Désactiver Lenis/effets lourds sur `/checkout*`, `/account*`, `/admin*`,
  `/oauth*`, `/agent*` et sous `prefers-reduced-motion`.
- Chaque navigation client démonte la page : `useGSAP()`/`gsap.context()`
  - `ScrollTrigger.refresh()` après chargement des images/polices ; les
    pages étant dynamiques, les hauteurs changent après hydratation (panier/
    favoris lus du localStorage).
- `AboutNav` calcule la section active sur `window.scroll` — compatible
  Lenis (scroll natif), mais sa `DETECTION_LINE` dépend de la hauteur du
  header.
- WebGL : plafond ~16 contextes ; la galerie crée déjà 1 renderer par
  vignette 3D (snapshot puis `forceContextLoss`) ; un fond/hero WebGL global
  - viewer produit = 2 contextes minimum → mutualiser si plusieurs canvases.
    Couper le rendu hors écran/onglet caché (pattern existant).
- Texte animé (SplitText) : garder le texte dans le HTML SSR (SEO, Markdown
  agents, lecteurs d'écran) et découper côté client après hydratation ;
  `aria-label` sur le conteneur.
- GSAP est gratuit (y compris SplitText, ScrollSmoother, MorphSVG) depuis la
  3.13 (2025, rachat Webflow) — revérifier la licence au moment d'installer.
- `motion` 13 est déjà dans le bundle (Header, Reveal, HeroScene) et sait
  faire `useScroll`/`useTransform`/`scroll()`/`useInView` : alternative
  légère à ScrollTrigger pour les effets simples ; éviter de charger deux
  moteurs pour le même effet.

## 19. Défauts/opportunités repérés en passant

- `<main>` imbriqué dans `account/(dashboard)/layout.tsx` (a11y).
- Footer `pb-24 md:pb-0` vs BottomNav `lg:hidden` (trou 768–1023 px).
- `favorites.tsx` : `localStorage.setItem` sans try/catch (navigation privée
  Safari) et écriture de `[]` avant hydratation.
- Images panier/favoris sans `cfImage` (pleine taille).
- Aucune `loading.tsx` ni Suspense : navigation « figée » pendant le rendu
  serveur (prefetch off).
- `manifest.theme_color` unique, pas de `theme-color` par thème.
- `BrandMark` = `<img>` sans dimensions (léger CLS potentiel).

## 20. Fichiers clés (pour la suite)

- Shell : `src/app/[locale]/layout.tsx`, `src/app/globals.css`,
  `src/components/{header,footer,bottom-nav,consent-banner,theme-manager,theme-toggle,locale-switcher,session-avatar,brand-mark,webmcp-tools,json-ld,track-event}.tsx`
- Motion/3D : `src/components/{reveal,hero-scene,product-gallery,product-viewer-3d}.tsx`, `src/components/showroom-scene.ts`
- Commerce UI : `src/components/{product-card,product-purchase,add-to-cart,favorite-button,product-color-context,multicolor-dots,page-header,select,star-rating,cart-reminder,cart-recovery,cart-link-import,guest-email-verification}.tsx`
- État client : `src/lib/cart.tsx` (`s3d-cart-v1`), `src/lib/favorites.tsx` (`s3d-favorites-v1`), `src/lib/theme.ts`, `src/lib/analytics.ts`
- Pages : `src/app/[locale]/{page,shop/page,products/[slug]/page,custom/*,a-propos/*,contact/page,cart/*,checkout/*,track/*,favorites/*,legal/*}.tsx`
- Contraintes : `src/middleware.ts`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `src/i18n/*`, `src/lib/seo.ts`, `src/lib/cf-image.ts`, `src/lib/stripe-appearance.ts`, `public/_headers`, `src/app/sitemap.xml/route.ts`, `src/app/robots.txt/route.ts`
- Docs : `AGENTS.md`, `docs/codemap.md`, `docs/architecture.md`, `docs/conventions.md`, `docs/refonte-plateforme-2026.md` (proposition produit « La Forge », non implémentée)
