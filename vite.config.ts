import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "favicon-64.png", "icons/apple-touch-icon.png", "brand/msak-crest-128.png"],
      manifest: {
        name: "MSAK — Messianic Students Association of Kenya",
        short_name: "MSAK",
        description:
          "Announcements from your campus, region and the national office, and a map of local churches across Kenya.",
        theme_color: "#0B1F4D",
        background_color: "#F8F6F0",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/app",
        scope: "/",
        lang: "en",
        categories: ["education", "social", "lifestyle"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Find a church", url: "/churches", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Announcements", url: "/app/announcements", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,png,jpg,svg,woff2}"],
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map tiles (OpenStreetMap street + Esri satellite/labels): keep areas a member has viewed
            urlPattern: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org") || url.hostname.endsWith("arcgisonline.com"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase REST reads (churches, directory, announcements): show the last copy when offline
            urlPattern: ({ url, request }) =>
              request.method === "GET" && url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
