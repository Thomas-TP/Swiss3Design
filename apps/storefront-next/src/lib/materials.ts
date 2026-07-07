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

export async function getProductColors(productId: string): Promise<ColorSwatch[]> {
  const { colors } = await medusa.client.fetch<{ colors: { id: string; name: string; hex: string }[] }>(
    `/store/products/${productId}/colors`,
  );
  return colors;
}
