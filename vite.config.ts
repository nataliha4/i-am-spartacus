import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "I AM SPARTACUS — Daily Tracker",
        short_name: "Spartacus",
        description: "Your private health and activity tracker",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#333333",
        background_color: "#ffffff",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/health\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    outDir: "dist/client",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "dates", test: /node_modules\/@js-temporal\// },
            { name: "validation", test: /node_modules\/zod\// },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
