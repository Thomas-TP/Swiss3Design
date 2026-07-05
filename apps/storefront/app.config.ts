import { defineConfig } from "@solidjs/start/config";
import UnoCSS from "unocss/vite";

export default defineConfig({
  server: {
    preset: "cloudflare-module",
  },
  vite: {
    plugins: [UnoCSS()],
  },
});
