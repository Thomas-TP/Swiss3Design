import { For, Show, Suspense, createResource, createSignal } from "solid-js";
import "virtual:uno.css";
import "./app.css";
import { medusa, loginToMedusa } from "./lib/medusa";
import { signInWithEmail, signOutAndClear, useSession } from "./lib/auth-client";

async function fetchRegions() {
  const { regions } = await medusa.store.region.list();
  return regions;
}

export default function App() {
  const [regions] = createResource(fetchRegions);
  const session = useSession();

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [authError, setAuthError] = createSignal<string | null>(null);

  const [medusaCustomerEmail, setMedusaCustomerEmail] = createSignal<string | null>(null);
  const [medusaError, setMedusaError] = createSignal<string | null>(null);
  const [medusaLoading, setMedusaLoading] = createSignal(false);

  async function handleLogin(event: SubmitEvent) {
    event.preventDefault();
    setAuthError(null);
    const { error } = await signInWithEmail(email(), password());
    if (error) setAuthError(error.message ?? "Échec de la connexion");
  }

  async function handleLogout() {
    await signOutAndClear();
    setMedusaCustomerEmail(null);
    setMedusaError(null);
  }

  async function handleConnectMedusa() {
    setMedusaLoading(true);
    setMedusaError(null);
    try {
      await loginToMedusa();
      const { customer } = await medusa.store.customer.retrieve();
      setMedusaCustomerEmail(customer.email);
    } catch (err) {
      setMedusaError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setMedusaLoading(false);
    }
  }

  return (
    <main class="mx-auto max-w-2xl p-8 text-center font-sans">
      <h1 class="text-3xl font-bold text-red-600">Swiss3Design — Phase 4</h1>
      <p class="mt-2 text-gray-600">
        Pont d'authentification Better Auth → Medusa (preuve de bout en bout).
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

      <div class="mt-6 rounded-lg border border-gray-200 p-4 text-left">
        <p class="font-semibold">Session Better Auth :</p>
        <Show
          when={session().data}
          fallback={
            <form class="mt-2 flex flex-col gap-2" onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="email"
                class="rounded border p-2"
                value={email()}
                onInput={(event) => setEmail(event.currentTarget.value)}
              />
              <input
                type="password"
                placeholder="mot de passe"
                class="rounded border p-2"
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
              <button type="submit" class="rounded bg-red-600 p-2 text-white">
                Se connecter
              </button>
              <Show when={authError()}>
                <p class="text-sm text-red-600">{authError()}</p>
              </Show>
            </form>
          }
        >
          <p class="mt-2">Connecté en tant que {session().data?.user.email}</p>
          <button type="button" class="mt-2 rounded border p-2" onClick={handleLogout}>
            Se déconnecter
          </button>

          <div class="mt-4 border-t pt-4">
            <button
              type="button"
              class="rounded bg-black p-2 text-white disabled:opacity-50"
              disabled={medusaLoading()}
              onClick={handleConnectMedusa}
            >
              Se connecter à Medusa
            </button>
            <Show when={medusaCustomerEmail()}>
              <p class="mt-2 text-green-700">Client Medusa authentifié : {medusaCustomerEmail()}</p>
            </Show>
            <Show when={medusaError()}>
              <p class="mt-2 text-sm text-red-600">{medusaError()}</p>
            </Show>
          </div>
        </Show>
      </div>
    </main>
  );
}
