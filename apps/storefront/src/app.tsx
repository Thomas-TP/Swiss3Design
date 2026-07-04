import { For, Suspense, createResource } from "solid-js";
import "virtual:uno.css";
import "./app.css";
import { medusa } from "./lib/medusa";

async function fetchRegions() {
  const { regions } = await medusa.store.region.list();
  return regions;
}

export default function App() {
  const [regions] = createResource(fetchRegions);

  return (
    <main class="mx-auto max-w-2xl p-8 text-center font-sans">
      <h1 class="text-3xl font-bold text-red-600">Swiss3Design — Phase 0</h1>
      <p class="mt-2 text-gray-600">
        SolidStart + UnoCSS + SDK Medusa, branché sur le backend Medusa (Neon).
      </p>
      <div class="mt-6 rounded-lg border border-gray-200 p-4 text-left">
        <p class="font-semibold">Régions Medusa (via Store API) :</p>
        <Suspense fallback={<p>Chargement...</p>}>
          <ul class="mt-2 list-disc pl-5">
            <For each={regions()}>
              {(region) => (
                <li>
                  {region.name} ({region.currency_code})
                </li>
              )}
            </For>
          </ul>
        </Suspense>
      </div>
    </main>
  );
}
