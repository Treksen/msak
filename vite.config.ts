import { readdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The public address of the site, for Google (canonical links, sitemap, sharing previews).
 * Set VITE_SITE_URL (e.g. https://msak.or.ke). On Vercel it falls back to the production domain automatically.
 */
const SITE_URL = (
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/$/, "");

/** Puts the site address into index.html and writes sitemap.xml + robots.txt at build time. */
function seoFiles(): Plugin {
  const policySlugs = readdirSync("src/data/policies")
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  const pages = [
    { path: "/", priority: "1.0", freq: "weekly" },
    { path: "/churches", priority: "0.9", freq: "weekly" },
    { path: "/register", priority: "0.8", freq: "monthly" },
    { path: "/past-leaders", priority: "0.5", freq: "monthly" },
    { path: "/policies", priority: "0.4", freq: "yearly" },
    ...policySlugs.map((slug) => ({ path: `/policies/${slug}`, priority: "0.3", freq: "yearly" })),
  ];
  return {
    name: "msak-seo-files",
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", SITE_URL),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const robots = ["User-agent: *", "Allow: /", "Disallow: /app", "Disallow: /login", "Disallow: /forgot-password", "Disallow: /reset-password"];
      if (SITE_URL) {
        robots.push("", `Sitemap: ${SITE_URL}/sitemap.xml`);
        const urls = pages
          .map((p) => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`)
          .join("\n");
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      } else {
        this.warn("VITE_SITE_URL is not set, so sitemap.xml was skipped. Set it to your site's address (e.g. https://msak.or.ke).");
      }
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots.join("\n") + "\n" });
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_SITE_URL": JSON.stringify(SITE_URL),
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: separate files stay cached on phones between releases.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return "map";
          return undefined;
        },
      },
    },
  },
  plugins: [
    seoFiles(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "favicon-64.png", "icons/apple-touch-icon.png", "brand/msak-crest-128.webp"],
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
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
        // App files + small images for offline use. Large photos are cached when first viewed (below).
        globPatterns: ["**/*.{js,css,html,svg,woff2}", "favicon-*.png", "icons/*.png", "brand/*.webp", "photos/*-640.webp"],
        runtimeCaching: [
          {
            // Site photos (large sizes, old JPEG copies): keep after the first view
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/photos/"),
            handler: "CacheFirst",
            options: { cacheName: "photos", expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
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
