import { medusa } from "./medusa";

export interface ColorSwatch {
  name: string;
  hex: string;
}

export async function getUsedFilters(): Promise<{
  materials: string[];
  colors: ColorSwatch[];
  multicolor: boolean;
}> {
  return medusa.client.fetch<{ materials: string[]; colors: ColorSwatch[]; multicolor: boolean }>(
    "/store/filters",
  );
}

export interface ProductColorOption {
  id: string;
  name: string;
  hex: string;
}

export async function getProductColors(productId: string): Promise<ProductColorOption[]> {
  const { colors } = await medusa.client.fetch<{ colors: ProductColorOption[] }>(
    `/store/products/${productId}/colors`,
  );
  return colors;
}
