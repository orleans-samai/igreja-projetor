import { resolve } from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: resolve("desktop"),
  publicDir: resolve("public"),
  base: "/",
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: {
      "@": resolve("src"),
      "@tanstack/react-start": resolve("desktop/shims/react-start.ts"),
    },
  },
  build: {
    outDir: resolve("desktop/www"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
