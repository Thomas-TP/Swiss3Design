import { notFound } from "next/navigation";

// Toute URL inconnue sous /fr, /de… rend la 404 de la boutique (en-tête,
// langue, lien vers l'accueil, événement « Page Not Found ») au lieu de la
// page brute de Next, qui ne passe pas par le layout [locale]. Le statut reste
// 404 : rien d'indexable. Motif recommandé par next-intl.
export default function CatchAllPage() {
  notFound();
}
