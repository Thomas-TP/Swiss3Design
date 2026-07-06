// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          {assets}
        </head>
        <body class="flex min-h-screen flex-col">
          {/* Applique le thème avant le 1er rendu : évite le flash clair→sombre.
              Miroir du script anti-FOUC de l'app Next.js (src/app/[locale]/layout.tsx). */}
          <script
            // eslint-disable-next-line solid/no-innerhtml
            innerHTML={`(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`}
          />
          <div id="app" class="flex min-h-screen flex-col">
            {children}
          </div>
          {scripts}
        </body>
      </html>
    )}
  />
));
