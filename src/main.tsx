import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
// Map styles first, so the site's own styles (index.css) can adjust them.
import "leaflet/dist/leaflet.css";
import "./index.css";
import { App } from "./App";
import { installErrorReporting } from "./lib/errorReporting";

// Installable app + offline support. Updates apply automatically on the next visit.
registerSW({ immediate: true });

// After a new release, an open tab may ask for page files that no longer exist. Reload once to get the new ones.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  if (!sessionStorage.getItem("msak-reloaded")) {
    sessionStorage.setItem("msak-reloaded", "1");
    location.reload();
  }
});
window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("msak-reloaded"), 10_000));
installErrorReporting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
