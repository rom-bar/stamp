import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Stamp Collector",
        short_name: "Stamps",
        description: "Award playful stamps to your kids",
        theme_color: "#faf8f2",
        background_color: "#faf8f2",
        display: "standalone",
        icons: [
          // TODO: add real 192x192 and 512x512 icon PNGs under /public before
          // shipping — placeholders needed here for install-to-home-screen.
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  build: {
    outDir: "dist",
  },
});
