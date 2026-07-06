import { createContext, useContext, createMemo, createSignal, type JSX } from "solid-js";

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

interface ProductColorValue {
  colors: ProductColor[];
  selectedId: () => string | null;
  setSelectedId: (id: string) => void;
  selected: () => ProductColor | null;
}

// Couleur choisie partagée sur toute la fiche produit - source unique pour le
// sélecteur du bloc d'achat. Miroir de product-color-context.tsx côté Next.js
// (le viewer 3D qui s'y abonnait aussi n'est pas encore porté - cf. plan Phase 5).
const ProductColorContext = createContext<ProductColorValue>();

export function ProductColorProvider(props: { colors: ProductColor[]; children: JSX.Element }) {
  const [selectedId, setSelectedId] = createSignal<string | null>(props.colors[0]?.id ?? null);
  const selected = createMemo(() => props.colors.find((c) => c.id === selectedId()) ?? null);

  return (
    <ProductColorContext.Provider
      value={{ colors: props.colors, selectedId, setSelectedId, selected }}
    >
      {props.children}
    </ProductColorContext.Provider>
  );
}

export function useProductColor(): ProductColorValue {
  const ctx = useContext(ProductColorContext);
  if (!ctx) throw new Error("useProductColor doit être utilisé dans ProductColorProvider");
  return ctx;
}
